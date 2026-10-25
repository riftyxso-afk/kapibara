import type { RuleEffect } from "@kapibara/policy";
import type { PromptInjectionFinding, SensitiveFinding } from "@kapibara/scanners";

import { getActionFactors } from "./action.js";
import type {
  ActionClassification,
  KapibaraIssue,
  PreflightInput,
  RiskFactor,
  RiskLevel,
  TargetSignal,
} from "./types.js";

const FACTOR_MAX = {
  destructive_impact: 25,
  reversibility: 20,
  sensitive_data: 20,
  external_side_effects: 15,
  production_impact: 10,
  uncertainty: 10,
} as const;

type FactorName = keyof typeof FACTOR_MAX;

function add(factors: RiskFactor[], name: FactorName, amount: number, reason: string): void {
  const factor = factors.find((candidate) => candidate.name === name);
  if (!factor) {
    return;
  }
  factor.score = Math.max(0, Math.min(FACTOR_MAX[name], factor.score + amount));
  if (amount !== 0) {
    factor.reason = `${factor.reason} ${reason}`.trim();
  }
}

function baseFactors(classification: ActionClassification): RiskFactor[] {
  const base = getActionFactors(classification.id);
  return [
    {
      name: "destructive_impact",
      score: base.destructive,
      max: FACTOR_MAX.destructive_impact,
      reason: `${classification.label} has a baseline destructive impact.`,
    },
    {
      name: "reversibility",
      score: base.reversibility,
      max: FACTOR_MAX.reversibility,
      reason: `${classification.label} is ${classification.reversible ? "generally reversible" : "not reliably reversible"}.`,
    },
    {
      name: "sensitive_data",
      score: base.sensitive,
      max: FACTOR_MAX.sensitive_data,
      reason: "Baseline exposure of sensitive data for this action.",
    },
    {
      name: "external_side_effects",
      score: base.external,
      max: FACTOR_MAX.external_side_effects,
      reason: `${classification.label} ${classification.external ? "affects systems outside the workspace" : "has no external side effect"}.`,
    },
    {
      name: "production_impact",
      score: base.production,
      max: FACTOR_MAX.production_impact,
      reason: "Baseline production impact for this action.",
    },
    {
      name: "uncertainty",
      score: base.uncertainty,
      max: FACTOR_MAX.uncertainty,
      reason: "Baseline uncertainty in the action's outcome.",
    },
  ];
}

function financialBoost(amount: number): number {
  if (amount >= 1_000_000) return 10;
  if (amount >= 100_000) return 8;
  if (amount >= 10_000) return 6;
  if (amount >= 1_000) return 4;
  if (amount > 0) return 2;
  return 0;
}

function targetAdjustments(
  factors: RiskFactor[],
  signal: TargetSignal,
  classification: ActionClassification,
): void {
  const tags = new Set(signal.tags);
  const isSecret =
    tags.has("secrets") ||
    tags.has("credentials") ||
    tags.has("private_key") ||
    tags.has("env_file");
  const isData =
    tags.has("backup") || tags.has("database") || tags.has("data") || tags.has("financial");

  if (classification.category === "read") {
    if (isSecret)
      add(factors, "sensitive_data", 10, "Reading a sensitive target raises exposure risk.");
    if (tags.has("backup")) add(factors, "sensitive_data", 6, "The target is a backup.");
    if (tags.has("financial")) add(factors, "sensitive_data", 6, "The target is financial data.");
    add(factors, "uncertainty", 2, "The target is sensitive.");
    return;
  }

  if (classification.category === "delete" || classification.id === "overwrite_file") {
    if (isData)
      add(factors, "destructive_impact", 12, "The target is valuable or hard to recreate.");
    if (isSecret) add(factors, "sensitive_data", 8, "The target contains secret material.");
    if (tags.has("backup") || tags.has("database")) {
      add(factors, "uncertainty", 5, "It is difficult to confirm that a copy exists.");
    }
    return;
  }

  if (classification.category === "outbound") {
    if (isSecret) {
      add(
        factors,
        "sensitive_data",
        18,
        "The target contains secret material that could leave the workspace.",
      );
      add(factors, "uncertainty", 5, "Secret exposure cannot be undone.");
    }
    if (tags.has("backup") || tags.has("database")) {
      add(factors, "destructive_impact", 5, "The target may contain production data.");
      add(factors, "uncertainty", 5, "The target may contain production data.");
    }
    if (tags.has("financial")) add(factors, "sensitive_data", 12, "The target is financial data.");
    return;
  }

  if (classification.category === "modify") {
    if (isSecret) add(factors, "sensitive_data", 10, "The target contains secret material.");
    if (tags.has("backup") || tags.has("database")) {
      add(factors, "destructive_impact", 8, "The target is valuable or hard to recreate.");
    }
    if (tags.has("generated")) add(factors, "uncertainty", 3, "The target is generated output.");
    return;
  }

  if (classification.category === "deploy" && tags.has("production")) {
    add(factors, "production_impact", 10, "The target is a production resource.");
  }
}

export interface FactorInput {
  input: PreflightInput;
  classification: ActionClassification;
  targetSignals: TargetSignal[];
  sensitiveFindings: SensitiveFinding[];
  promptInjectionFindings: PromptInjectionFinding[];
  environmentMismatch: boolean;
  scanFailed?: boolean;
}

export function computeFactors({
  input,
  classification,
  targetSignals,
  sensitiveFindings,
  promptInjectionFindings,
  environmentMismatch,
  scanFailed,
}: FactorInput): RiskFactor[] {
  const factors = baseFactors(classification);
  const context = input.context ?? {};

  if (context.reversible === false) {
    add(factors, "reversibility", 8, "The caller marked the action as not reversible.");
  } else if (context.reversible === true) {
    add(factors, "reversibility", -4, "The caller marked the action as reversible.");
  }

  const production =
    context.production === true || /\b(prod|production)\b/i.test(context.environment ?? "");
  if (production) {
    add(factors, "production_impact", 10, "The action targets production.");
    add(factors, "destructive_impact", 3, "Production changes have a wider blast radius.");
  }

  if (context.external === true) {
    add(factors, "external_side_effects", 6, "The caller marked the action as external.");
  }

  if (typeof context.financialImpact === "number" && context.financialImpact > 0) {
    const boost = financialBoost(context.financialImpact);
    add(
      factors,
      "destructive_impact",
      boost,
      `The action has a financial impact of ${context.financialImpact}.`,
    );
    add(
      factors,
      "external_side_effects",
      Math.min(5, Math.ceil(boost / 2)),
      "Financial impact increases external risk.",
    );
  }

  const scope = `${context.scope ?? ""} ${input.target ?? ""}`;
  if (
    /\b(recursive|all|everything|entire|broad)\b/i.test(scope) ||
    context.metadata?.recursive === true
  ) {
    add(factors, "destructive_impact", 5, "The action has a broad scope.");
    add(factors, "external_side_effects", 5, "The action has a broad scope.");
  }

  for (const signal of targetSignals) {
    targetAdjustments(factors, signal, classification);
  }

  if (sensitiveFindings.length > 0) {
    const highest = sensitiveFindings.reduce<RiskLevel>((current, finding) => {
      const rank: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };
      return rank[finding.severity] > rank[current] ? finding.severity : current;
    }, "low");
    const mapping: Record<RiskLevel, number> = { low: 4, medium: 10, high: 16, critical: 20 };
    add(
      factors,
      "sensitive_data",
      Math.min(20, mapping[highest] + Math.max(0, sensitiveFindings.length - 1) * 2),
      `${sensitiveFindings.length} sensitive value(s) were detected (redacted).`,
    );
    add(factors, "uncertainty", 3, "Sensitive values were detected.");
  }

  if (promptInjectionFindings.length > 0) {
    add(
      factors,
      "uncertainty",
      5,
      "Instruction-like content was found; it is treated as untrusted data.",
    );
  }

  if (environmentMismatch) {
    add(factors, "uncertainty", 8, "The action, target, and environment do not agree.");
  }

  if (scanFailed) {
    add(factors, "uncertainty", 5, "A requested sensitive-data scan could not be completed.");
  }

  return factors;
}

export function scoreFactors(factors: RiskFactor[]): number {
  return Math.max(
    0,
    Math.min(
      100,
      factors.reduce((sum, factor) => sum + factor.score, 0),
    ),
  );
}

export function riskFromScore(score: number): RiskLevel {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

const ISSUE_FLOOR: Record<RiskLevel, number> = {
  low: 0,
  medium: 25,
  high: 50,
  critical: 75,
};

export function applyScoreFloors(
  score: number,
  issues: KapibaraIssue[],
  ruleDecision?: RuleEffect | null,
): number {
  let result = score;
  for (const issue of issues) {
    result = Math.max(result, ISSUE_FLOOR[issue.severity]);
    if (issue.blocking) {
      result = Math.max(result, 85);
    }
  }
  if (ruleDecision === "block") {
    result = Math.max(result, 85);
  } else if (ruleDecision === "approval") {
    result = Math.max(result, 50);
  } else if (ruleDecision === "warn") {
    result = Math.max(result, 25);
  }
  return Math.min(100, result);
}
