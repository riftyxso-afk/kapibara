import { describe, expect, it } from "vitest";

import { inferTopics, parseRulesMarkdown, slugifyRuleId } from "@kapibara/policy";

const MARKDOWN = `# BLOCK

- Never expose secrets.
- Never force push to main.

# APPROVAL

- Ask before production deployments.

## WARN

- Warn before recursive file deletion.
- [allow] Allow reading documentation.

\`\`\`
- This bullet is inside a code fence and must be ignored.
\`\`\`
`;

describe("parseRulesMarkdown", () => {
  it("maps headings and inline effects to rules", () => {
    const rules = parseRulesMarkdown(MARKDOWN, {
      source: "test.md",
      level: "project",
    });

    expect(rules.map((rule) => rule.effect)).toEqual([
      "block",
      "block",
      "approval",
      "warn",
      "allow",
    ]);
    expect(rules.every((rule) => rule.source === "test.md")).toBe(true);
    expect(rules.every((rule) => rule.level === "project")).toBe(true);
    expect(rules.map((rule) => rule.text)).not.toContain(
      "This bullet is inside a code fence and must be ignored.",
    );
  });

  it("marks secret-exposure blocks as non-overridable", () => {
    const rules = parseRulesMarkdown(MARKDOWN, {
      source: "test.md",
      level: "project",
    });
    const secrets = rules.find((rule) => rule.text === "Never expose secrets.");
    const forcePush = rules.find((rule) => rule.text === "Never force push to main.");

    expect(secrets?.overridable).toBe(false);
    expect(forcePush?.overridable).toBe(true);
    expect(secrets?.topics).toContain("secrets");
    expect(forcePush?.topics).toContain("force_push");
  });

  it("creates stable unique ids for repeated rule text", () => {
    const rules = parseRulesMarkdown(
      `# WARN\n- Warn before deleting files.\n- Warn before deleting files.\n`,
      { source: "test.md", level: "global" },
    );

    expect(rules.map((rule) => rule.id)).toEqual([
      "warn-before-deleting-files",
      "warn-before-deleting-files-2",
    ]);
  });

  it("ignores headings that are not effects and bullets without text", () => {
    const rules = parseRulesMarkdown(`# Notes\n\n- A rule without a matching heading.\n- \n`, {
      source: "test.md",
      level: "default",
      defaultEffect: "allow",
    });

    expect(rules).toHaveLength(1);
    expect(rules[0]?.effect).toBe("allow");
  });
});

describe("rule helpers", () => {
  it("slugifies rule text", () => {
    expect(slugifyRuleId("  Never force push to main!  ")).toBe("never-force-push-to-main");
  });

  it("infers topics used by the evaluator", () => {
    expect(inferTopics("Never force push to the protected branch")).toEqual(
      expect.arrayContaining(["force_push", "push", "protected_branch"]),
    );
    expect(inferTopics("Ask before deleting database backups")).toEqual(
      expect.arrayContaining(["delete", "database", "backup"]),
    );
    expect(inferTopics("Never expose secrets or .env files")).toEqual(
      expect.arrayContaining(["secrets", "env_file"]),
    );
  });
});
