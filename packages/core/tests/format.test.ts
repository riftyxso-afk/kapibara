import { describe, expect, it } from "vitest";

import {
  formatActionRisk,
  formatComparison,
  formatPreflightResult,
  type ActionRiskResult,
  type PreflightResult,
} from "@kapibara/core";

const RESULT: PreflightResult = {
  decision: "require_approval",
  risk: "high",
  score: 60,
  issues: [
    {
      type: "production_deployment",
      severity: "high",
      message: "The deployment targets production.",
      evidence: ["target: api"],
      recommendation: "Confirm the target.",
    },
  ],
  matchedRules: ["ask-before-production-deployments"],
  recommendation: "Confirm the target.",
  requiresUserApproval: true,
  action: "deploy_production",
};

describe("formatPreflightResult", () => {
  it("renders the decision, risk, findings, and recommendation", () => {
    const text = formatPreflightResult(RESULT, {
      action: "deploy",
      target: "api",
    });

    expect(text).toContain("Kapibara preflight");
    expect(text).toContain("Decision: REQUIRE_APPROVAL");
    expect(text).toContain("Risk: HIGH (60/100)");
    expect(text).toContain("production_deployment");
    expect(text).toContain("Human approval is required");
  });

  it("renders ALLOW without findings", () => {
    const text = formatPreflightResult({
      ...RESULT,
      decision: "allow",
      risk: "low",
      score: 0,
      issues: [],
      matchedRules: [],
      requiresUserApproval: false,
      recommendation: "No meaningful issue found.",
    });

    expect(text).toContain("Decision: ALLOW");
    expect(text).toContain("No meaningful issue found.");
  });
});

describe("formatActionRisk", () => {
  it("renders factors and the recommendation", () => {
    const result: ActionRiskResult = {
      action: "git_force_push",
      category: "outbound",
      decision: "block",
      risk: "critical",
      score: 85,
      factors: [
        {
          name: "destructive_impact",
          score: 20,
          max: 25,
          reason: "Force push rewrites history.",
        },
      ],
      issues: [],
      recommendation: "Do not force push.",
      requiresUserApproval: true,
    };

    const text = formatActionRisk(result);

    expect(text).toContain("Action: git_force_push (outbound)");
    expect(text).toContain("Decision: BLOCK");
    expect(text).toContain("destructive_impact: 20/25");
    expect(text).toContain("Do not force push.");
  });
});

describe("formatComparison", () => {
  it("renders mismatches with per-source values", () => {
    const text = formatComparison({
      matches: false,
      checked: ["amount"],
      issues: [
        {
          type: "amount_mismatch",
          severity: "high",
          message: "The sources report different amounts.",
          values: { invoice: "$1,200", email: "$1,500" },
        },
      ],
    });

    expect(text).toContain("Mismatches detected");
    expect(text).toContain("amount_mismatch");
    expect(text).toContain("invoice: $1,200");
  });

  it("renders a match summary", () => {
    const text = formatComparison({ matches: true, checked: ["amount"], issues: [] });
    expect(text).toContain("No mismatches detected");
  });
});
