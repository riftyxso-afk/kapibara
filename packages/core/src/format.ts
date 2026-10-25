import type {
  ActionRiskResult,
  ComparisonResult,
  PreflightInput,
  PreflightResult,
} from "./types.js";

const DECISION_LABEL = {
  allow: "ALLOW",
  warn: "WARN",
  require_approval: "REQUIRE_APPROVAL",
  block: "BLOCK",
} as const;

const SEVERITY_MARK = {
  low: "·",
  medium: "!",
  high: "!!",
  critical: "!!!",
} as const;

export function formatPreflightResult(result: PreflightResult, input?: PreflightInput): string {
  const lines: string[] = [];
  lines.push("🦫 Kapibara preflight");
  if (input) {
    lines.push(`Action: ${input.action}${input.target ? ` → ${input.target}` : ""}`);
  }
  lines.push(`Decision: ${DECISION_LABEL[result.decision]}`);
  lines.push(`Risk: ${result.risk.toUpperCase()} (${result.score}/100)`);

  if (result.issues.length > 0) {
    lines.push("");
    lines.push("Findings:");
    for (const issue of result.issues) {
      lines.push(`  ${SEVERITY_MARK[issue.severity]} ${issue.type}: ${issue.message}`);
      for (const evidence of issue.evidence ?? []) {
        lines.push(`      ${evidence}`);
      }
    }
  }

  if (result.matchedRules.length > 0) {
    lines.push("");
    lines.push(`Matched rules: ${result.matchedRules.join(", ")}`);
  }

  if (result.recommendation) {
    lines.push("");
    lines.push(`Recommendation: ${result.recommendation}`);
  }

  if (result.requiresUserApproval) {
    lines.push("");
    lines.push("Human approval is required before this action proceeds.");
  }

  return lines.join("\n");
}

export function formatActionRisk(result: ActionRiskResult): string {
  const lines = [
    `Action: ${result.action} (${result.category})`,
    `Decision: ${DECISION_LABEL[result.decision]}`,
    `Risk: ${result.risk.toUpperCase()} (${result.score}/100)`,
    "",
    "Factors:",
    ...result.factors.map(
      (factor) => `  ${factor.name}: ${factor.score}/${factor.max} — ${factor.reason}`,
    ),
  ];
  if (result.recommendation) {
    lines.push("", `Recommendation: ${result.recommendation}`);
  }
  return lines.join("\n");
}

export function formatComparison(result: ComparisonResult): string {
  if (result.matches) {
    return `No mismatches detected. Checked: ${result.checked.join(", ") || "none"}.`;
  }
  const lines = ["Mismatches detected:"];
  for (const issue of result.issues) {
    lines.push(`  ${issue.type}: ${issue.message}`);
    for (const [source, value] of Object.entries(issue.values)) {
      lines.push(`    ${source}: ${value}`);
    }
  }
  return lines.join("\n");
}
