import type { RuleEffect } from "@kapibara/policy";

import { riskFromScore } from "./risk.js";
import type { Decision, KapibaraIssue, RiskLevel } from "./types.js";

export interface DecisionInput {
  score: number;
  issues: KapibaraIssue[];
  ruleDecision?: RuleEffect | null;
}

export interface DecisionOutput {
  decision: Decision;
  risk: RiskLevel;
  requiresUserApproval: boolean;
}

export function decide({ score, issues, ruleDecision }: DecisionInput): DecisionOutput {
  const blocking = issues.some((issue) => issue.blocking === true);
  const critical = issues.some((issue) => issue.severity === "critical");
  const high = issues.some((issue) => issue.severity === "high");
  const medium = issues.some((issue) => issue.severity === "medium");

  let decision: Decision;
  if (blocking || ruleDecision === "block") {
    decision = "block";
  } else if (ruleDecision === "approval" || critical || high || score >= 50) {
    decision = "require_approval";
  } else if (ruleDecision === "warn" || medium || score >= 25) {
    decision = "warn";
  } else {
    decision = "allow";
  }

  return {
    decision,
    risk: riskFromScore(score),
    requiresUserApproval: decision === "require_approval" || decision === "block",
  };
}

const PRIORITY_TYPES = [
  "sensitive_data",
  "protected_branch_force_push",
  "env_file",
  "private_key",
  "credentials_file",
  "possible_database_backup",
  "database_backup",
  "destructive_database_operation",
  "production_deployment",
  "environment_mismatch",
  "rule_violation",
  "rule_conflict",
];

export function buildRecommendation(issues: KapibaraIssue[], decision: Decision): string {
  if (decision === "allow") {
    return "No meaningful issue found.";
  }

  const withRecommendation = issues.filter(
    (issue) => typeof issue.recommendation === "string" && issue.recommendation.length > 0,
  );
  if (withRecommendation.length === 0) {
    return decision === "warn"
      ? "Proceed carefully and inform the user if relevant."
      : "Ask the user before proceeding.";
  }

  const ranked = [...withRecommendation].sort((a, b) => {
    const aPriority = PRIORITY_TYPES.indexOf(a.type);
    const bPriority = PRIORITY_TYPES.indexOf(b.type);
    const aRank = aPriority === -1 ? 999 : aPriority;
    const bRank = bPriority === -1 ? 999 : bPriority;
    return aRank - bRank;
  });

  const selected: string[] = [];
  for (const issue of ranked) {
    const recommendation = issue.recommendation?.trim();
    if (recommendation && !selected.includes(recommendation)) {
      selected.push(recommendation);
    }
    if (selected.length >= (decision === "warn" ? 1 : 2)) {
      break;
    }
  }

  return selected.join(" ");
}
