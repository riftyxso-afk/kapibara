import { classifyAction, getActionFactors } from "./action.js";
import type { FailMode } from "./config.js";
import { riskFromScore } from "./risk.js";
import type {
  ActionId,
  Decision,
  KapibaraIssue,
  PreflightInput,
  PreflightResult,
} from "./types.js";

export interface FailureOptions {
  input?: Partial<PreflightInput>;
  failMode?: FailMode;
  risk?: PreflightResult["risk"];
  score?: number;
}

function baseScore(id: ActionId, production: boolean): number {
  const factors = getActionFactors(id);
  let score =
    factors.destructive +
    factors.reversibility +
    factors.sensitive +
    factors.external +
    factors.production +
    factors.uncertainty;
  if (production) {
    score = Math.max(score, 75);
  }
  return Math.min(100, score);
}

export function failureResult(error: unknown, options: FailureOptions = {}): PreflightResult {
  const input = options.input ?? {};
  const action = input.action ?? "unknown";
  const classification = classifyAction({ action, target: input.target, context: input.context });
  const production =
    input.context?.production === true ||
    /\b(prod|production)\b/i.test(input.context?.environment ?? "") ||
    classification.id === "deploy_production";
  const initialScore = options.score ?? baseScore(classification.id, production);
  const failMode = options.failMode ?? "risk_based";

  let decision: Decision;
  let score = initialScore;

  if (failMode === "closed") {
    decision = "block";
    score = Math.max(score, 90);
  } else if (failMode === "open") {
    decision = "warn";
    score = Math.min(score, 49);
  } else if (score >= 75) {
    decision = "block";
    score = Math.max(score, 90);
  } else if (score >= 25) {
    decision = "require_approval";
  } else {
    decision = "warn";
  }

  const severity =
    decision === "block" ? "critical" : decision === "require_approval" ? "high" : "medium";
  const issue: KapibaraIssue = {
    type: "kapibara_error",
    severity,
    message: "Kapibara could not complete the safety check.",
    evidence: [error instanceof Error ? error.name : "unknown_error"],
    recommendation: "Manually review this action before proceeding.",
    ...(decision === "block" ? { blocking: true } : {}),
  };

  return {
    decision,
    risk: options.risk ?? riskFromScore(score),
    score,
    issues: [issue],
    matchedRules: [],
    recommendation: "Manually review this action before proceeding.",
    requiresUserApproval: decision === "require_approval" || decision === "block",
    action: classification.id,
  };
}
