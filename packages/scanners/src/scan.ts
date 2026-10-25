import { open, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import { isPlaceholderSecret, SECRET_PATTERNS } from "./patterns.js";
import type {
  FileScanOptions,
  ScanResult,
  ScanSensitiveOptions,
  ScanSeverity,
  SensitiveFinding,
} from "./types.js";

const SEVERITY_RANK: Record<ScanSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

interface InternalFinding {
  start: number;
  end: number;
  finding: SensitiveFinding;
}

export class ScanError extends Error {
  readonly code:
    "not_found" | "not_a_file" | "outside_workspace" | "read_failed" | "too_many_files";

  constructor(code: ScanError["code"], message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ScanError";
    this.code = code;
  }
}

function lineColumn(text: string, index: number): { line: number; column: number } {
  const before = text.slice(0, index);
  const line = before.split("\n").length;
  const lastNewline = before.lastIndexOf("\n");
  return { line, column: index - lastNewline };
}

function cloneGlobalRegex(regex: RegExp): RegExp {
  return new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : `${regex.flags}g`);
}

export function scanSensitiveText(text: string, options: ScanSensitiveOptions = {}): ScanResult {
  const maxBytes = options.maxBytes ?? 2_000_000;
  const maxFindings = options.maxFindings ?? 500;
  let content = text;
  let truncated = false;

  if (Buffer.byteLength(content, "utf8") > maxBytes) {
    content = content.slice(0, maxBytes);
    truncated = true;
  }

  const internal: InternalFinding[] = [];

  for (const pattern of SECRET_PATTERNS) {
    const regex = cloneGlobalRegex(pattern.regex);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      if (match[0].length === 0) {
        regex.lastIndex += 1;
        continue;
      }

      const value = pattern.valueGroup ? match[pattern.valueGroup] : match[0];
      if (!value || isPlaceholderSecret(value)) {
        continue;
      }

      const offsetInMatch = pattern.valueGroup ? match[0].indexOf(value) : 0;
      const start = match.index + Math.max(0, offsetInMatch);
      const end = start + value.length;
      const label = pattern.labelGroup ? match[pattern.labelGroup] : undefined;
      const { line, column } = lineColumn(content, start);

      internal.push({
        start,
        end,
        finding: {
          type: pattern.type,
          severity: pattern.severity,
          redactedValue: pattern.redact(value, match),
          location: {
            line,
            column,
            ...(options.source ? { source: options.source } : {}),
          },
          ...(label ? { label } : {}),
        },
      });

      if (internal.length >= maxFindings * 5) {
        break;
      }
    }
  }

  internal.sort((a, b) => {
    const severityDelta = SEVERITY_RANK[b.finding.severity] - SEVERITY_RANK[a.finding.severity];
    if (severityDelta !== 0) return severityDelta;
    const lengthDelta = b.end - b.start - (a.end - a.start);
    if (lengthDelta !== 0) return lengthDelta;
    return a.start - b.start;
  });

  const kept: InternalFinding[] = [];
  for (const candidate of internal) {
    if (kept.length >= maxFindings) {
      break;
    }
    const overlaps = kept.some(
      (existing) => candidate.start < existing.end && candidate.end > existing.start,
    );
    if (!overlaps) {
      kept.push(candidate);
    }
  }

  kept.sort((a, b) => a.start - b.start);

  return {
    findings: kept.map((item) => item.finding),
    ...(options.source ? { source: options.source } : {}),
    scannedBytes: Buffer.byteLength(content, "utf8"),
    truncated,
  };
}

async function resolveSafePath(
  filePath: string,
  options: FileScanOptions,
): Promise<{ realPath: string; source: string }> {
  const cwd = options.cwd ? resolve(options.cwd) : undefined;
  const candidate = cwd && !isAbsolute(filePath) ? resolve(cwd, filePath) : resolve(filePath);

  let realCandidate: string;
  let realRoot: string | undefined;
  try {
    realCandidate = await realpath(candidate);
    if (cwd) {
      realRoot = await realpath(cwd);
    }
  } catch (error) {
    throw new ScanError("not_found", `Could not access file: ${filePath}`, { cause: error });
  }

  if (realRoot && !options.allowOutsideCwd) {
    const rel = relative(realRoot, realCandidate);
    if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
      throw new ScanError(
        "outside_workspace",
        "Refusing to scan a file outside the workspace. Set allowOutsideCwd explicitly.",
      );
    }
  }

  const info = await stat(realCandidate);
  if (!info.isFile()) {
    throw new ScanError("not_a_file", `Not a regular file: ${filePath}`);
  }

  const source = realRoot ? relative(realRoot, realCandidate) : realCandidate;
  return { realPath: realCandidate, source };
}

export async function scanSensitiveFile(
  filePath: string,
  options: FileScanOptions & { maxFindings?: number } = {},
): Promise<ScanResult> {
  const maxBytes = options.maxBytes ?? 1_000_000;
  const { realPath, source } = await resolveSafePath(filePath, options);

  let info: Awaited<ReturnType<typeof stat>>;
  try {
    info = await stat(realPath);
  } catch (error) {
    throw new ScanError("not_found", `Could not access file: ${filePath}`, { cause: error });
  }

  if (info.size === 0) {
    return { findings: [], source, scannedBytes: 0, truncated: false };
  }

  const bytesToRead = Math.min(info.size, maxBytes);
  const buffer = Buffer.alloc(bytesToRead);
  let handle: Awaited<ReturnType<typeof open>> | undefined;

  try {
    handle = await open(realPath, "r");
    await handle.read(buffer, 0, bytesToRead, 0);
  } catch (error) {
    throw new ScanError("read_failed", `Could not read file: ${filePath}`, { cause: error });
  } finally {
    await handle?.close().catch(() => undefined);
  }

  if (buffer.subarray(0, Math.min(buffer.length, 8192)).includes(0)) {
    return {
      findings: [],
      source,
      scannedBytes: buffer.length,
      truncated: info.size > maxBytes,
      skippedReason: "binary",
    };
  }

  const result = scanSensitiveText(buffer.toString("utf8"), {
    source,
    maxBytes,
    maxFindings: options.maxFindings,
  });

  return {
    ...result,
    source,
    scannedBytes: buffer.length,
    truncated: result.truncated || info.size > maxBytes,
  };
}

export async function scanSensitiveFiles(
  filePaths: string[],
  options: FileScanOptions & { maxFindings?: number; maxFiles?: number } = {},
): Promise<ScanResult[]> {
  const maxFiles = options.maxFiles ?? 100;
  if (filePaths.length > maxFiles) {
    throw new ScanError(
      "too_many_files",
      `Refusing to scan more than ${maxFiles} files in one call. Pass an explicit smaller list.`,
    );
  }
  const results: ScanResult[] = [];
  for (const path of filePaths) {
    results.push(await scanSensitiveFile(path, options));
  }
  return results;
}
