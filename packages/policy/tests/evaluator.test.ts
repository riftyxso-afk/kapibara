import { describe, expect, it } from "vitest";

import {
  evaluateRules,
  inferTopics,
  type NormalizedRule,
  type RuleEffect,
  type RuleLevel,
  type RuleSet,
} from "@kapibara/policy";

function makeRule(
  input: Pick<NormalizedRule, "id" | "effect" | "text" | "level"> &
    Partial<Pick<NormalizedRule, "topics" | "overridable" | "source">>,
): NormalizedRule {
  const topics = input.topics ?? inferTopics(input.text);
  return {
    id: input.id,
    effect: input.effect,
    text: input.text,
    source: input.source ?? "test",
    level: input.level,
    topics,
    overridable: input.overridable ?? !(input.effect === "block" && topics.includes("secrets")),
  };
}

function makeRuleSet(rules: NormalizedRule[]): RuleSet {
  return {
    profile: "custom",
    rules,
    conflicts: [],
    sources: ["test"],
  };
}

function rule(
  id: string,
  effect: RuleEffect,
  text: string,
  level: RuleLevel = "default",
): NormalizedRule {
  return makeRule({ id, effect, text, level });
}

describe("evaluateRules", () => {
  it("matches rules by inferred topics", () => {
    const ruleSet = makeRuleSet([
      rule("force-push", "block", "Never force push to main.", "default"),
    ]);
    const evaluation = evaluateRules(ruleSet, {
      action: "git force push",
      target: "origin/main",
      signals: ["git_force_push", "force_push"],
    });

    expect(evaluation.matchedIds).toEqual(["force-push"]);
    expect(evaluation.decision).toBe("block");
    expect(evaluation.effective[0]?.appliedEffect).toBe("block");
  });

  it("returns no decision when nothing matches", () => {
    const evaluation = evaluateRules(
      makeRuleSet([rule("deploy", "approval", "Ask before deployments.")]),
      { action: "read file", target: "README.md" },
    );

    expect(evaluation.matches).toHaveLength(0);
    expect(evaluation.matchedIds).toEqual([]);
    expect(evaluation.decision).toBeNull();
  });

  it("lets a project rule win over a default rule and records the conflict", () => {
    const ruleSet = makeRuleSet([
      rule("default-db", "block", "Never drop database tables.", "default"),
      rule("project-db", "approval", "Ask before dropping database tables.", "project"),
    ]);
    const evaluation = evaluateRules(ruleSet, {
      action: "drop database table",
      target: "users",
    });

    expect(evaluation.conflicts).toHaveLength(1);
    expect(evaluation.conflicts[0]?.winner.id).toBe("project-db");
    expect(evaluation.conflicts[0]?.appliedEffect).toBe("approval");
    expect(evaluation.decision).toBe("approval");
  });

  it("keeps a non-overridable secret block when another rule allows it", () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: "never-secrets",
        effect: "block",
        text: "Never expose secrets.",
        level: "default",
        topics: ["secrets"],
        overridable: false,
      }),
      makeRule({
        id: "allow-secrets",
        effect: "allow",
        text: "Allow publishing secrets in this project.",
        level: "project",
        topics: ["secrets"],
      }),
    ]);
    const evaluation = evaluateRules(ruleSet, {
      action: "publish secrets",
      target: "secrets.txt",
    });

    expect(evaluation.conflicts).toHaveLength(1);
    expect(evaluation.conflicts[0]?.appliedEffect).toBe("block");
    expect(evaluation.decision).toBe("block");
  });

  it("downgrades an overridable block when the user explicitly asks", () => {
    const ruleSet = makeRuleSet([
      rule("force-push", "block", "Never force push to main.", "default"),
    ]);
    const evaluation = evaluateRules(ruleSet, {
      action: "git force push",
      target: "origin/main",
      signals: ["git_force_push"],
      explicitUserRequest: true,
    });

    expect(evaluation.effective[0]?.appliedEffect).toBe("approval");
    expect(evaluation.effective[0]?.overriddenByUserRequest).toBe(true);
    expect(evaluation.decision).toBe("approval");
  });

  it("does not downgrade a non-overridable secret block", () => {
    const ruleSet = makeRuleSet([
      makeRule({
        id: "never-secrets",
        effect: "block",
        text: "Never expose secrets.",
        level: "default",
        topics: ["secrets"],
        overridable: false,
      }),
    ]);
    const evaluation = evaluateRules(ruleSet, {
      action: "publish secrets",
      target: "secrets.txt",
      explicitUserRequest: true,
    });

    expect(evaluation.effective[0]?.appliedEffect).toBe("block");
    expect(evaluation.effective[0]?.overriddenByUserRequest).toBe(false);
    expect(evaluation.decision).toBe("block");
  });

  it("reads explicit requests from context metadata", () => {
    const ruleSet = makeRuleSet([rule("push", "block", "Never push directly to main.", "default")]);
    const evaluation = evaluateRules(ruleSet, {
      action: "git push",
      target: "origin/main",
      context: { metadata: { explicitUserRequest: true } },
    });

    expect(evaluation.effective[0]?.overriddenByUserRequest).toBe(true);
    expect(evaluation.decision).toBe("approval");
  });

  it("returns unique sorted matched ids", () => {
    const ruleSet = makeRuleSet([
      rule("b-rule", "warn", "Warn before database changes.", "default"),
      rule("a-rule", "warn", "Warn before database migrations.", "default"),
    ]);
    const evaluation = evaluateRules(ruleSet, {
      action: "modify database migration",
      target: "db/migrations/001.sql",
    });

    expect(evaluation.matchedIds).toEqual(["a-rule", "b-rule"]);
  });
});
