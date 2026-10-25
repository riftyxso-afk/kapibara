import { describe, expect, it } from "vitest";

import {
  applyScoreFloors,
  assessActionRisk,
  riskFromScore,
  scoreFactors,
  type KapibaraIssue,
  type RiskFactor,
} from "@kapibara/core";

function issue(severity: KapibaraIssue["severity"], blocking = false): KapibaraIssue {
  return {
    type: "test",
    severity,
    message: "test",
    ...(blocking ? { blocking: true } : {}),
  };
}

describe("riskFromScore", () => {
  it("maps score bands to risk levels", () => {
    expect(riskFromScore(0)).toBe("low");
    expect(riskFromScore(24)).toBe("low");
    expect(riskFromScore(25)).toBe("medium");
    expect(riskFromScore(49)).toBe("medium");
    expect(riskFromScore(50)).toBe("high");
    expect(riskFromScore(74)).toBe("high");
    expect(riskFromScore(75)).toBe("critical");
    expect(riskFromScore(100)).toBe("critical");
  });
});

describe("scoreFactors", () => {
  it("sums factors and clamps to 0-100", () => {
    const factors: RiskFactor[] = [
      { name: "destructive_impact", score: 25, max: 25, reason: "" },
      { name: "reversibility", score: 20, max: 20, reason: "" },
    ];
    expect(scoreFactors(factors)).toBe(45);
    expect(scoreFactors([{ ...factors[0]!, score: 500 }])).toBe(100);
    expect(scoreFactors([{ ...factors[0]!, score: -5 }])).toBe(0);
  });
});

describe("applyScoreFloors", () => {
  it("applies issue severity floors", () => {
    expect(applyScoreFloors(0, [issue("medium")])).toBe(25);
    expect(applyScoreFloors(0, [issue("high")])).toBe(50);
    expect(applyScoreFloors(0, [issue("critical")])).toBe(75);
    expect(applyScoreFloors(0, [issue("medium", true)])).toBe(85);
  });

  it("applies rule decision floors", () => {
    expect(applyScoreFloors(0, [], "warn")).toBe(25);
    expect(applyScoreFloors(0, [], "approval")).toBe(50);
    expect(applyScoreFloors(0, [], "block")).toBe(85);
    expect(applyScoreFloors(0, [], "allow")).toBe(0);
  });

  it("keeps the highest floor", () => {
    expect(applyScoreFloors(90, [issue("medium")])).toBe(90);
    expect(applyScoreFloors(60, [issue("critical")])).toBe(75);
  });
});

describe("assessActionRisk", () => {
  it("allows a read-only action", () => {
    const result = assessActionRisk({ action: "read file", target: "README.md" });

    expect(result.action).toBe("read_file");
    expect(result.decision).toBe("allow");
    expect(result.risk).toBe("low");
    expect(result.requiresUserApproval).toBe(false);
    expect(result.factors).toHaveLength(6);
  });

  it("blocks a force push to a protected branch", () => {
    const result = assessActionRisk({
      action: "force push",
      target: "origin/main",
      context: { metadata: { branch: "main" } },
    });

    expect(result.action).toBe("git_force_push");
    expect(result.decision).toBe("block");
    expect(result.risk).toBe("critical");
    expect(result.requiresUserApproval).toBe(true);
    expect(result.issues.some((item) => item.type === "protected_branch_force_push")).toBe(true);
  });

  it("requires approval for a production deployment", () => {
    const result = assessActionRisk({
      action: "deploy",
      target: "api",
      context: { environment: "production", production: true },
    });

    expect(result.action).toBe("deploy_production");
    expect(result.decision).toBe("require_approval");
    expect(result.issues.some((item) => item.type === "production_deployment")).toBe(true);
  });

  it("warns for a plain file deletion", () => {
    const result = assessActionRisk({ action: "delete file", target: "tmp.txt" });

    expect(result.action).toBe("delete_file");
    expect(result.decision).toBe("warn");
    expect(result.risk).toBe("medium");
  });

  it("warns for an unclassified action", () => {
    const result = assessActionRisk({ action: "frobnicate", target: "thing" });

    expect(result.action).toBe("unknown");
    expect(result.decision).toBe("warn");
    expect(result.issues.some((item) => item.type === "unknown_action")).toBe(true);
  });
});
