import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadRuleSet, parseRuleFile } from "@kapibara/policy";

const tempDirs: string[] = [];

async function tempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), `kapibara-${prefix}-`));
  tempDirs.push(dir);
  return dir;
}

async function writeRules(root: string, content: string): Promise<void> {
  await mkdir(join(root, ".kapibara"), { recursive: true });
  await writeFile(join(root, ".kapibara", "rules.md"), content, "utf8");
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("loadRuleSet", () => {
  it("loads the balanced profile by default", async () => {
    const cwd = await tempDir("empty");
    const homeDir = await tempDir("home");
    const ruleSet = await loadRuleSet({ cwd, homeDir });

    expect(ruleSet.profile).toBe("balanced");
    expect(ruleSet.sources).toEqual(["default:balanced"]);
    expect(ruleSet.rules.length).toBeGreaterThan(0);
    expect(ruleSet.conflicts).toEqual([]);
  });

  it("loads global and project rules with project precedence", async () => {
    const cwd = await tempDir("project");
    const homeDir = await tempDir("home");
    const shared = "- Ask before deleting files.";
    await writeRules(homeDir, `# APPROVAL\n${shared}\n`);
    await writeRules(cwd, `# BLOCK\n${shared}\n`);

    const ruleSet = await loadRuleSet({ cwd, homeDir });

    expect(ruleSet.sources).toHaveLength(3);
    expect(ruleSet.sources[1]).toContain(homeDir);
    expect(ruleSet.sources[2]).toContain(cwd);

    const effective = ruleSet.rules.find((rule) => rule.id === "ask-before-deleting-files");
    expect(effective?.level).toBe("project");
    expect(effective?.effect).toBe("block");
    expect(ruleSet.conflicts).toHaveLength(1);
    expect(ruleSet.conflicts[0]?.winner.level).toBe("project");
    expect(ruleSet.conflicts[0]?.loser.level).toBe("global");
  });

  it("loads the developer profile on top of the balanced rules", async () => {
    const cwd = await tempDir("developer");
    const homeDir = await tempDir("home");
    const ruleSet = await loadRuleSet({ cwd, homeDir, profile: "developer" });

    expect(ruleSet.profile).toBe("developer");
    expect(ruleSet.rules.map((rule) => rule.text)).toEqual(
      expect.arrayContaining([
        "Ask before production deployments.",
        "Ask before pushing to protected branches.",
      ]),
    );
  });

  it("tolerates missing global and project rule files", async () => {
    const cwd = await tempDir("missing");
    const homeDir = await tempDir("missing-home");
    const ruleSet = await loadRuleSet({ cwd, homeDir, profile: "strict" });

    expect(ruleSet.profile).toBe("strict");
    expect(ruleSet.rules.map((rule) => rule.text)).toEqual(
      expect.arrayContaining(["Ask before any git push."]),
    );
  });
});

describe("parseRuleFile", () => {
  it("parses a markdown file at the requested level", () => {
    const rules = parseRuleFile(
      "# WARN\n- Warn before modifying generated files.\n",
      "/tmp/rules.md",
      "global",
    );

    expect(rules).toHaveLength(1);
    expect(rules[0]?.level).toBe("global");
    expect(rules[0]?.source).toBe("/tmp/rules.md");
    expect(rules[0]?.effect).toBe("warn");
  });
});
