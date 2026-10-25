import { resolve } from "node:path";

import {
  appendAuditEvent,
  assessActionRisk,
  compareSources,
  createAuditEvent,
  evaluateRulesForInput,
  failureResult,
  formatActionRisk,
  formatComparison,
  formatPreflightResult,
  preflight,
  type ActionRiskResult,
  type AuditResult,
  type CompareInputSchema,
  type ComparisonResult,
  type Decision,
  type PreflightInput,
  type PreflightResult,
  type ScanSensitiveInputSchema,
} from "@kapibara/core";
import { type RuleEffect, type RuleEvaluation, type RuleProfile } from "@kapibara/policy";
import {
  ScanError,
  scanSensitiveFile,
  scanSensitiveText,
  type ScanResult,
} from "@kapibara/scanners";

import { loadRuntimeContext } from "./context.js";

export interface HandlerOptions {
  cwd?: string;
  homeDir?: string;
}

export interface ToolResponse<T = unknown> {
  summary: string;
  data: T;
  isError?: boolean;
}

export interface PreflightToolInput extends PreflightInput {
  files?: string[];
  scanTarget?: boolean;
}

export interface RulesCheckToolInput extends PreflightInput {
  profile?: RuleProfile | "custom";
}

export interface PreflightToolData {
  result: PreflightResult;
  rules: {
    profile: string;
    sources: string[];
    conflicts: number;
  };
  audit?: AuditResult;
  failure?: "rules_unavailable" | "preflight_error";
  configError?: string;
}

export interface ScanToolData extends ScanResult {
  counts: {
    total: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
  };
}

export interface RulesCheckData {
  decision: Decision;
  profile: string;
  sources: string[];
  matchedRules: string[];
  effective: Array<{
    id: string;
    text: string;
    level: string;
    source: string;
    effect: RuleEffect;
    appliedEffect: RuleEffect;
    overriddenByUserRequest: boolean;
    reason: string;
  }>;
  conflicts: Array<{
    conditionKey: string;
    winner: string;
    losers: string[];
    appliedEffect: RuleEffect;
    reason: string;
  }>;
  ruleSetConflicts: Array<{
    id: string;
    winner: string;
    loser: string;
    reason: string;
  }>;
}

const DECISION_LABEL: Record<Decision, string> = {
  allow: "ALLOW",
  warn: "WARN",
  require_approval: "REQUIRE_APPROVAL",
  block: "BLOCK",
};

function errorData(message: string, code?: string): { error: string; code?: string } {
  return { error: message, ...(code ? { code } : {}) };
}

function errorResponse<T>(message: string, code?: string): ToolResponse<T> {
  return {
    summary: message,
    data: errorData(message, code) as T,
    isError: true,
  };
}

function splitPreflightInput(input: PreflightToolInput): {
  input: PreflightInput;
  files?: string[];
  scanTarget: boolean;
} {
  const { files, scanTarget, ...rest } = input;
  return {
    input: rest,
    ...(files ? { files } : {}),
    scanTarget: scanTarget ?? true,
  };
}

export async function runPreflight(
  rawInput: PreflightToolInput,
  options: HandlerOptions = {},
): Promise<ToolResponse<PreflightToolData>> {
  const context = await loadRuntimeContext({
    cwd: options.cwd,
    ...(options.homeDir ? { homeDir: options.homeDir } : {}),
  });
  const { input, files, scanTarget } = splitPreflightInput(rawInput);

  let result: PreflightResult;
  let failure: PreflightToolData["failure"];

  if (context.rulesError) {
    result = failureResult(context.rulesError, {
      input,
      failMode: context.config.failMode,
    });
    failure = "rules_unavailable";
  } else {
    try {
      result = await preflight(input, {
        cwd: context.cwd,
        ...(context.ruleSet ? { rules: context.ruleSet } : {}),
        scanTarget,
        ...(files ? { scanFiles: files } : {}),
      });
    } catch (error) {
      result = failureResult(error, {
        input,
        failMode: context.config.failMode,
      });
      failure = "preflight_error";
    }
  }

  let audit: AuditResult | undefined;
  if (context.config.auditLog) {
    audit = await appendAuditEvent(createAuditEvent(input, result), {
      cwd: context.cwd,
      retentionDays: context.config.auditRetentionDays,
    });
  }

  const data: PreflightToolData = {
    result,
    rules: {
      profile: context.ruleSet?.profile ?? context.config.profile,
      sources: context.ruleSet?.sources ?? [],
      conflicts: context.ruleSet?.conflicts.length ?? 0,
    },
    ...(audit ? { audit } : {}),
    ...(failure ? { failure } : {}),
    ...(context.configError ? { configError: context.configError.message } : {}),
  };

  return {
    summary: formatPreflightResult(result, input),
    data,
  };
}

export async function runActionRisk(
  input: PreflightInput,
): Promise<ToolResponse<ActionRiskResult>> {
  try {
    const result = assessActionRisk(input);
    return {
      summary: formatActionRisk(result),
      data: result,
    };
  } catch {
    return errorResponse<ActionRiskResult>(
      "Kapibara could not assess this action.",
      "action_risk_failed",
    );
  }
}

export async function runCompare(
  input: CompareInputSchema,
): Promise<ToolResponse<ComparisonResult>> {
  try {
    const result = compareSources(input.sources);
    return {
      summary: formatComparison(result),
      data: result,
    };
  } catch {
    return errorResponse<ComparisonResult>(
      "Kapibara could not compare these sources.",
      "comparison_failed",
    );
  }
}

function countFindings(findings: ScanResult["findings"]): ScanToolData["counts"] {
  const bySeverity: Record<string, number> = {};
  const byType: Record<string, number> = {};
  for (const finding of findings) {
    bySeverity[finding.severity] = (bySeverity[finding.severity] ?? 0) + 1;
    byType[finding.type] = (byType[finding.type] ?? 0) + 1;
  }
  return { total: findings.length, bySeverity, byType };
}

function scanErrorMessage(error: unknown): { message: string; code: string } {
  if (error instanceof ScanError) {
    switch (error.code) {
      case "outside_workspace":
        return {
          message: "Refusing to scan a path outside the workspace. Pass a path inside the project.",
          code: error.code,
        };
      case "not_found":
        return { message: "The requested file was not found.", code: error.code };
      case "not_a_file":
        return { message: "The requested path is not a regular file.", code: error.code };
      case "too_many_files":
        return { message: "Too many files were requested.", code: error.code };
      case "read_failed":
        return { message: "The requested file could not be read.", code: error.code };
    }
  }
  return {
    message: "The sensitive-data scan could not be completed.",
    code: "scan_failed",
  };
}

export async function runScanSensitive(
  input: ScanSensitiveInputSchema,
  options: HandlerOptions = {},
): Promise<ToolResponse<ScanToolData>> {
  const cwd = resolve(options.cwd ?? process.cwd());

  try {
    let result: ScanResult;
    if (input.text !== undefined) {
      result = scanSensitiveText(input.text, {
        source: "input.text",
        maxBytes: input.maxBytes ?? 2_000_000,
      });
    } else if (input.path !== undefined) {
      result = await scanSensitiveFile(input.path, {
        cwd,
        maxBytes: input.maxBytes ?? 1_000_000,
      });
    } else {
      return errorResponse<ScanToolData>("Provide exactly one of text or path.", "invalid_input");
    }

    const counts = countFindings(result.findings);
    const parts: string[] = [];
    if (counts.total === 0) {
      parts.push("No sensitive values detected.");
    } else {
      parts.push(
        `${counts.total} sensitive value(s) detected. Values are redacted and never returned.`,
      );
    }
    if (result.truncated) {
      parts.push("The scan was truncated at the configured size limit.");
    }
    if (result.skippedReason) {
      parts.push(`The file was skipped (${result.skippedReason}).`);
    }

    return {
      summary: parts.join(" "),
      data: { ...result, counts },
    };
  } catch (error) {
    const { message, code } = scanErrorMessage(error);
    return errorResponse<ScanToolData>(message, code);
  }
}

function ruleDecisionToDecision(effect: RuleEffect | null): Decision {
  switch (effect) {
    case "block":
      return "block";
    case "approval":
      return "require_approval";
    case "warn":
      return "warn";
    case "allow":
    case null:
      return "allow";
  }
}

function rulesSummary(data: RulesCheckData): string {
  const lines = [`Rule decision: ${DECISION_LABEL[data.decision]}`, `Profile: ${data.profile}`];
  if (data.matchedRules.length === 0) {
    lines.push("Matched rules: none");
  } else {
    lines.push(`Matched rules: ${data.matchedRules.join(", ")}`);
  }
  if (data.conflicts.length > 0) {
    lines.push(
      `Rule conflicts: ${data.conflicts.map((conflict) => conflict.conditionKey).join(", ")}`,
    );
  }
  return lines.join("\n");
}

function rulesData(
  evaluation: RuleEvaluation,
  profile: string,
  sources: string[],
  ruleSetConflicts: Array<{ id: string; winner: string; loser: string; reason: string }>,
): RulesCheckData {
  return {
    decision: ruleDecisionToDecision(evaluation.decision),
    profile,
    sources,
    matchedRules: evaluation.matchedIds,
    effective: evaluation.effective.map((entry) => ({
      id: entry.rule.id,
      text: entry.rule.text,
      level: entry.rule.level,
      source: entry.rule.source,
      effect: entry.rule.effect,
      appliedEffect: entry.appliedEffect,
      overriddenByUserRequest: entry.overriddenByUserRequest,
      reason: entry.reason,
    })),
    conflicts: evaluation.conflicts.map((conflict) => ({
      conditionKey: conflict.conditionKey,
      winner: conflict.winner.id,
      losers: conflict.losers.map((rule) => rule.id),
      appliedEffect: conflict.appliedEffect,
      reason: conflict.reason,
    })),
    ruleSetConflicts,
  };
}

export async function runRulesCheck(
  rawInput: RulesCheckToolInput,
  options: HandlerOptions = {},
): Promise<ToolResponse<RulesCheckData>> {
  const { profile, ...input } = rawInput;
  const context = await loadRuntimeContext({
    cwd: options.cwd,
    ...(options.homeDir ? { homeDir: options.homeDir } : {}),
    ...(profile ? { profile } : {}),
  });

  if (!context.ruleSet || context.rulesError) {
    return errorResponse<RulesCheckData>(
      "Kapibara could not load the effective rules.",
      "rules_unavailable",
    );
  }

  try {
    const evaluation = evaluateRulesForInput(input, context.ruleSet);
    const data = rulesData(
      evaluation,
      context.ruleSet.profile,
      context.ruleSet.sources,
      context.ruleSet.conflicts.map((conflict) => ({
        id: conflict.id,
        winner: conflict.winner.id,
        loser: conflict.loser.id,
        reason: conflict.reason,
      })),
    );
    return { summary: rulesSummary(data), data };
  } catch {
    return errorResponse<RulesCheckData>(
      "Kapibara could not evaluate the rules.",
      "rules_check_failed",
    );
  }
}
