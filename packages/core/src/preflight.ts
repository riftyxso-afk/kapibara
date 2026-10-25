import type { RuleEvaluation, RuleSet } from "@kapibara/policy";
import {
  scanPromptInjection,
  scanSensitiveFile,
  scanSensitiveText,
  ScanError,
  type PromptInjectionFinding,
  type SensitiveFinding,
} from "@kapibara/scanners";

import { analyze, type AnalysisResult } from "./analyze.js";
import { classifyAction, isOutboundAction } from "./action.js";
import { KapibaraValidationError } from "./errors.js";
import { formatZodError, preflightInputSchema } from "./schemas.js";
import { evaluateRulesForInput } from "./rules.js";
import type { PreflightInput, PreflightResult, PreflightScanSummary } from "./types.js";

export interface PreflightOptions {
  rules?: RuleSet;
  cwd?: string;
  scanTarget?: boolean;
  scanFiles?: string[];
}

function dedupeFindings(findings: SensitiveFinding[]): SensitiveFinding[] {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = [
      finding.type,
      finding.redactedValue,
      finding.location.source ?? "",
      finding.location.line,
      finding.location.column,
    ].join("|");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function metadataString(input: PreflightInput, key: string): string | undefined {
  const value = input.context?.metadata?.[key];
  return typeof value === "string" ? value : undefined;
}

function metadataFiles(input: PreflightInput): string[] {
  const value = input.context?.metadata?.files;
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

export async function preflight(
  rawInput: PreflightInput,
  options: PreflightOptions = {},
): Promise<PreflightResult> {
  const parsed = preflightInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new KapibaraValidationError(formatZodError(parsed.error));
  }
  const input = parsed.data as PreflightInput;
  const classification = classifyAction(input);
  const cwd = options.cwd ?? process.cwd();

  const sensitiveFindings: SensitiveFinding[] = [];
  const promptInjectionFindings: PromptInjectionFinding[] = [];
  const sources = new Set<string>();
  const skipped = new Set<string>();
  let truncated = false;
  let scanFailed = false;
  let scanAttempted = false;

  const content = metadataString(input, "content");
  if (content !== undefined) {
    scanAttempted = true;
    const contentScan = scanSensitiveText(content, {
      source: "context.metadata.content",
      maxBytes: 2_000_000,
    });
    sensitiveFindings.push(...contentScan.findings);
    sources.add("context.metadata.content");
    if (contentScan.truncated) {
      truncated = true;
      scanFailed = true;
    }
    const promptScan = scanPromptInjection(content, { maxBytes: 2_000_000 });
    promptInjectionFindings.push(...promptScan.findings);
  }

  const files = [...new Set([...metadataFiles(input), ...(options.scanFiles ?? [])])];
  if (files.length > 100) {
    scanFailed = true;
    skipped.add("too_many_files");
  }

  for (const file of files.slice(0, 100)) {
    scanAttempted = true;
    try {
      const result = await scanSensitiveFile(file, { cwd, maxBytes: 1_000_000 });
      sensitiveFindings.push(...result.findings);
      sources.add(result.source ?? file);
      if (result.truncated) {
        truncated = true;
        scanFailed = true;
      }
      if (result.skippedReason) {
        skipped.add(`${result.source ?? file}:${result.skippedReason}`);
        scanFailed = true;
      }
    } catch (error) {
      if (error instanceof ScanError && error.code === "not_found") {
        skipped.add(`${file}:not_found`);
        continue;
      }
      scanFailed = true;
      const code = error instanceof ScanError ? error.code : "read_failed";
      skipped.add(`${file}:${code}`);
    }
  }

  if (options.scanTarget === true && input.target && isOutboundAction(classification.id)) {
    scanAttempted = true;
    try {
      const result = await scanSensitiveFile(input.target, { cwd, maxBytes: 1_000_000 });
      sensitiveFindings.push(...result.findings);
      sources.add(result.source ?? input.target);
      if (result.truncated) {
        truncated = true;
        scanFailed = true;
      }
      if (result.skippedReason) {
        skipped.add(`${result.source ?? input.target}:${result.skippedReason}`);
        scanFailed = true;
      }
    } catch (error) {
      if (!(error instanceof ScanError && error.code === "not_found")) {
        scanFailed = true;
        const code = error instanceof ScanError ? error.code : "read_failed";
        skipped.add(`${input.target}:${code}`);
      }
    }
  }

  let ruleEvaluation: RuleEvaluation | undefined;
  if (options.rules) {
    ruleEvaluation = evaluateRulesForInput(input, options.rules, [
      ...(sensitiveFindings.length > 0 ? ["sensitive_data"] : []),
      ...(promptInjectionFindings.length > 0 ? ["prompt_injection"] : []),
    ]);
  }

  const deduped = dedupeFindings(sensitiveFindings);
  const scan: PreflightScanSummary | undefined =
    scanAttempted || sources.size > 0 || skipped.size > 0
      ? {
          sources: [...sources].sort(),
          findings: deduped.length,
          truncated,
          skipped: [...skipped].sort(),
        }
      : undefined;

  const analysis: AnalysisResult = analyze(
    input,
    {
      sensitiveFindings: deduped,
      promptInjectionFindings,
      ...(scan ? { scan } : {}),
      ...(options.rules ? { ruleSetConflicts: options.rules.conflicts } : {}),
      ...(scanFailed ? { scanFailed: true } : {}),
    },
    ruleEvaluation,
  );

  return analysis.result;
}
