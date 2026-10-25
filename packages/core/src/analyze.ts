import { conditionKey, type RuleEvaluation } from "@kapibara/policy";

import { classifyAction } from "./action.js";
import { buildRecommendation, decide } from "./decision.js";
import { baseIssues, detectEnvironmentMismatch } from "./issues.js";
import { applyScoreFloors, computeFactors, scoreFactors } from "./risk.js";
import { detectTargetSignals, targetIssues } from "./target.js";
import type {
  ActionClassification,
  ActionRiskResult,
  AnalysisExtras,
  KapibaraIssue,
  PreflightInput,
  PreflightResult,
  RiskFactor,
} from "./types.js";

export interface AnalysisResult {
  result: PreflightResult;
  classification: ActionClassification;
  factors: RiskFactor[];
}

function ruleIssues(ruleEvaluation: RuleEvaluation | undefined): KapibaraIssue[] {
  if (!ruleEvaluation) {
    return [];
  }

  const issues: KapibaraIssue[] = [];
  for (const entry of ruleEvaluation.effective) {
    if (entry.appliedEffect === "allow") {
      continue;
    }

    const severity =
      entry.appliedEffect === "block"
        ? "critical"
        : entry.appliedEffect === "approval"
          ? "high"
          : "medium";

    issues.push({
      type: "rule_violation",
      severity,
      message: entry.overriddenByUserRequest
        ? `Rule "${entry.rule.text}" was matched. The current explicit request requires confirmation.`
        : `Rule matched: ${entry.rule.text}`,
      evidence: [`rule: ${entry.rule.id}`, `source: ${entry.rule.source}`],
      recommendation:
        entry.appliedEffect === "block"
          ? "Do not proceed unless the user explicitly overrides this rule."
          : "Follow the project rule or ask the user before proceeding.",
      ...(entry.appliedEffect === "block" ? { blocking: true } : {}),
    });
  }

  for (const conflict of ruleEvaluation.conflicts) {
    issues.push({
      type: "rule_conflict",
      severity: "high",
      message: `Conflicting rules match this action: ${conflict.conditionKey}.`,
      evidence: [
        `winner: ${conflict.winner.id}`,
        ...conflict.losers.map((rule) => `conflict: ${rule.id}`),
      ],
      recommendation: "Ask the user to resolve the rule conflict before proceeding.",
    });
  }

  return issues;
}

export function analyze(
  input: PreflightInput,
  extras: AnalysisExtras = {},
  ruleEvaluation?: RuleEvaluation,
): AnalysisResult {
  const classification = classifyAction(input);
  const targetSignals = detectTargetSignals(input.target);
  const environmentMismatch = detectEnvironmentMismatch(input);
  const sensitiveFindings = extras.sensitiveFindings ?? [];
  const promptInjectionFindings = extras.promptInjectionFindings ?? [];

  const issues: KapibaraIssue[] = [
    ...baseIssues({
      input,
      classification,
      targetSignals,
      sensitiveFindings,
      promptInjectionFindings,
      environmentMismatch,
      ...(extras.scanFailed ? { scanFailed: true } : {}),
    }),
    ...targetIssues(input.target, classification),
    ...ruleIssues(ruleEvaluation),
  ];

  for (const conflict of extras.ruleSetConflicts ?? []) {
    if (ruleEvaluation?.matchedIds.includes(conflict.id)) {
      issues.push({
        type: "rule_conflict",
        severity: "high",
        message: `Project, global, or default rules disagree for "${conflict.id}".`,
        evidence: [
          `winner: ${conflict.winner.id} (${conflict.winner.level})`,
          `loser: ${conflict.loser.id} (${conflict.loser.level})`,
        ],
        recommendation: "Ask the user to resolve the conflicting rule definitions.",
      });
    }
  }

  const factors = computeFactors({
    input,
    classification,
    targetSignals,
    sensitiveFindings,
    promptInjectionFindings,
    environmentMismatch: environmentMismatch.mismatch,
    ...(extras.scanFailed ? { scanFailed: true } : {}),
  });

  const rawScore = scoreFactors(factors);
  const score = applyScoreFloors(rawScore, issues, ruleEvaluation?.decision);
  const decision = decide({
    score,
    issues,
    ruleDecision: ruleEvaluation?.decision,
  });
  const recommendation = buildRecommendation(issues, decision.decision);

  const loaderConflicts = (extras.ruleSetConflicts ?? [])
    .filter((conflict) => ruleEvaluation?.matchedIds.includes(conflict.id))
    .map((conflict) => {
      const nonOverridableBlock = [conflict.winner, conflict.loser].some(
        (rule) => rule.effect === "block" && !rule.overridable,
      );
      return {
        conditionKey: conditionKey(conflict.winner.topics) || conflict.id,
        winner: conflict.winner.id,
        losers: [conflict.loser.id],
        appliedEffect: nonOverridableBlock ? "block" : "approval",
        reason: conflict.reason,
      };
    });

  const ruleConflicts = [
    ...(ruleEvaluation?.conflicts ?? []).map((conflict) => ({
      conditionKey: conflict.conditionKey,
      winner: conflict.winner.id,
      losers: conflict.losers.map((rule) => rule.id),
      appliedEffect: conflict.appliedEffect,
      reason: conflict.reason,
    })),
    ...loaderConflicts,
  ];

  const result: PreflightResult = {
    decision: decision.decision,
    risk: decision.risk,
    score,
    issues,
    matchedRules: ruleEvaluation?.matchedIds ?? [],
    recommendation,
    requiresUserApproval: decision.requiresUserApproval,
    action: classification.id,
    factors,
    ...(extras.scan ? { scan: extras.scan } : {}),
    ...(ruleConflicts.length > 0 ? { ruleConflicts } : {}),
  };

  return { result, classification, factors };
}

export function assessActionRisk(input: PreflightInput): ActionRiskResult {
  const { result, classification, factors } = analyze(input);
  return {
    action: classification.id,
    category: classification.category,
    decision: result.decision,
    risk: result.risk,
    score: result.score,
    factors,
    issues: result.issues,
    recommendation: result.recommendation ?? "Ask the user before proceeding.",
    requiresUserApproval: result.requiresUserApproval,
  };
}
