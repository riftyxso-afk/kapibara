import { appendFile, mkdir, readdir, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";

import type { Decision, PreflightInput, PreflightResult, RiskLevel } from "./types.js";

export interface AuditEvent {
  timestamp: string;
  action: string;
  target?: string;
  risk: RiskLevel;
  decision: Decision;
  score: number;
  matchedRules: string[];
  issueTypes: string[];
}

export interface AuditResult {
  written: boolean;
  path?: string;
  error?: string;
}

function sanitize(value: string, maxLength = 300): string {
  return [...value]
    .map((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code < 0x20 || code === 0x7f ? " " : char;
    })
    .join("")
    .slice(0, maxLength);
}

export function createAuditEvent(
  input: PreflightInput,
  result: PreflightResult,
  now = new Date(),
): AuditEvent {
  return {
    timestamp: now.toISOString(),
    action: sanitize(input.action, 120),
    ...(input.target ? { target: sanitize(input.target) } : {}),
    risk: result.risk,
    decision: result.decision,
    score: result.score,
    matchedRules: result.matchedRules.map((rule) => sanitize(rule, 120)),
    issueTypes: [...new Set(result.issues.map((issue) => issue.type))].map((type) =>
      sanitize(type, 120),
    ),
  };
}

function dateStamp(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function cleanOldLogs(logDir: string, retentionDays: number): Promise<void> {
  if (retentionDays <= 0) {
    return;
  }
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let entries: string[];
  try {
    entries = await readdir(logDir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const match = /^audit-(\d{4}-\d{2}-\d{2})\.jsonl$/.exec(entry);
    if (!match?.[1]) {
      continue;
    }
    const timestamp = Date.parse(`${match[1]}T00:00:00Z`);
    if (Number.isFinite(timestamp) && timestamp < cutoff) {
      await unlink(join(logDir, entry)).catch(() => undefined);
    }
  }
}

export async function appendAuditEvent(
  event: AuditEvent,
  options: { cwd?: string; retentionDays?: number } = {},
): Promise<AuditResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const logDir = join(cwd, ".kapibara", "logs");
  const path = join(logDir, `audit-${dateStamp(new Date(event.timestamp))}.jsonl`);

  try {
    await mkdir(logDir, { recursive: true });
    await appendFile(path, `${JSON.stringify(event)}\n`, "utf8");
    await cleanOldLogs(logDir, options.retentionDays ?? 7);
    return { written: true, path };
  } catch (error) {
    return {
      written: false,
      path,
      error: error instanceof Error ? error.message : "Unknown audit log error",
    };
  }
}
