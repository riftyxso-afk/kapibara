import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  runActionRisk,
  runCompare,
  runPreflight,
  runRulesCheck,
  runScanSensitive,
  type RulesCheckData,
  type ScanToolData,
} from "@kapibara/mcp";

const FAKE_SECRET = "sk-mcpFAKE1234567890abcdef";
const tempDirs: string[] = [];

async function workspace(): Promise<{ cwd: string; homeDir: string }> {
  const cwd = await mkdtemp(join(tmpdir(), "kapibara-mcp-cwd-"));
  const homeDir = await mkdtemp(join(tmpdir(), "kapibara-mcp-home-"));
  tempDirs.push(cwd, homeDir);
  return { cwd, homeDir };
}

async function writeConfig(cwd: string, config: unknown): Promise<void> {
  await mkdir(join(cwd, ".kapibara"), { recursive: true });
  await writeFile(join(cwd, ".kapibara", "config.json"), JSON.stringify(config), "utf8");
}

async function writeRules(cwd: string, content: string): Promise<void> {
  await mkdir(join(cwd, ".kapibara"), { recursive: true });
  await writeFile(join(cwd, ".kapibara", "rules.md"), content, "utf8");
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("kapibara_preflight handler", () => {
  it("returns an ALLOW decision for a read-only action", async () => {
    const { cwd, homeDir } = await workspace();
    const response = await runPreflight(
      { action: "read file", target: "README.md" },
      { cwd, homeDir },
    );

    expect(response.isError).toBeUndefined();
    expect(response.summary).toContain("Decision: ALLOW");
    expect(response.data.result.decision).toBe("allow");
    expect(response.data.rules.profile).toBe("balanced");
    expect(response.data.rules.sources).toContain("default:balanced");
  });

  it("returns BLOCK for a force push to main", async () => {
    const { cwd, homeDir } = await workspace();
    const response = await runPreflight(
      {
        action: "force push",
        target: "origin/main",
        context: { metadata: { branch: "main" } },
      },
      { cwd, homeDir },
    );

    expect(response.summary).toContain("Decision: BLOCK");
    expect(response.data.result.decision).toBe("block");
    expect(
      response.data.result.issues.some((issue) => issue.type === "protected_branch_force_push"),
    ).toBe(true);
  });

  it("scans only explicit files and never returns the raw secret", async () => {
    const { cwd, homeDir } = await workspace();
    await writeFile(join(cwd, "secret.txt"), `OPENAI_API_KEY=${FAKE_SECRET}\n`);

    const response = await runPreflight(
      {
        action: "upload file",
        target: "report.txt",
        files: ["secret.txt"],
      },
      { cwd, homeDir },
    );

    expect(response.data.result.decision).toBe("block");
    expect(response.data.result.scan?.sources).toContain("secret.txt");
    expect(JSON.stringify(response)).not.toContain(FAKE_SECRET);
  });

  it("does not crawl the workspace when no paths are given", async () => {
    const { cwd, homeDir } = await workspace();
    await writeFile(join(cwd, ".env"), `OPENAI_API_KEY=${FAKE_SECRET}\n`);

    const response = await runPreflight(
      { action: "upload file", target: "report.txt", scanTarget: false },
      { cwd, homeDir },
    );

    expect(response.data.result.scan).toBeUndefined();
    expect(response.data.result.issues.some((issue) => issue.type === "sensitive_data")).toBe(
      false,
    );
  });

  it("writes a sanitized audit event when enabled", async () => {
    const { cwd, homeDir } = await workspace();
    await writeConfig(cwd, { auditLog: true });
    await writeFile(join(cwd, "secret.txt"), `OPENAI_API_KEY=${FAKE_SECRET}\n`);

    const response = await runPreflight(
      { action: "upload file", target: "report.txt", files: ["secret.txt"] },
      { cwd, homeDir },
    );

    expect(response.data.audit?.written).toBe(true);
    const logDir = join(cwd, ".kapibara", "logs");
    const entries = await readdir(logDir);
    expect(entries).toHaveLength(1);
    const content = await readFile(join(logDir, entries[0]!), "utf8");
    expect(content).not.toContain(FAKE_SECRET);
    expect(content).toContain('"decision":"block"');
  });

  it("fails closed when the rules file cannot be read", async () => {
    const { cwd, homeDir } = await workspace();
    await writeConfig(cwd, { failMode: "closed" });
    await mkdir(join(cwd, ".kapibara", "rules.md"), { recursive: true });

    const response = await runPreflight(
      { action: "read file", target: "README.md" },
      { cwd, homeDir },
    );

    expect(response.data.failure).toBe("rules_unavailable");
    expect(response.data.result.decision).toBe("block");
  });

  it("reports a config error without losing the default decision", async () => {
    const { cwd, homeDir } = await workspace();
    await mkdir(join(cwd, ".kapibara"), { recursive: true });
    await writeFile(join(cwd, ".kapibara", "config.json"), "{ invalid", "utf8");

    const response = await runPreflight(
      { action: "read file", target: "README.md" },
      { cwd, homeDir },
    );

    expect(response.data.configError).toBeDefined();
    expect(response.data.result.decision).toBe("allow");
  });
});

describe("kapibara_action_risk handler", () => {
  it("classifies and scores an action", async () => {
    const response = await runActionRisk({
      action: "force push",
      target: "origin/main",
    });

    expect(response.data.action).toBe("git_force_push");
    expect(response.data.decision).toBe("block");
    expect(response.summary).toContain("Decision: BLOCK");
  });
});

describe("kapibara_compare handler", () => {
  it("reports conflicting amounts", async () => {
    const response = await runCompare({
      sources: [
        { name: "invoice", content: "Total: $1,200" },
        { name: "email", content: "Total: $1,500" },
      ],
    });

    expect(response.data.matches).toBe(false);
    expect(response.data.issues.map((issue) => issue.type)).toContain("amount_mismatch");
    expect(response.summary).toContain("Mismatches detected");
  });
});

describe("kapibara_scan_sensitive handler", () => {
  it("scans text and redacts the value", async () => {
    const response = await runScanSensitive({
      text: `OPENAI_API_KEY=${FAKE_SECRET}`,
    });
    const data = response.data as ScanToolData;

    expect(data.counts.total).toBe(1);
    expect(data.counts.bySeverity.critical).toBe(1);
    expect(JSON.stringify(response)).not.toContain(FAKE_SECRET);
    expect(response.summary).toContain("redacted");
  });

  it("scans one explicit file inside the workspace", async () => {
    const { cwd } = await workspace();
    await writeFile(join(cwd, "secret.txt"), `OPENAI_API_KEY=${FAKE_SECRET}\n`);

    const response = await runScanSensitive({ path: "secret.txt" }, { cwd });
    const data = response.data as ScanToolData;

    expect(data.source).toBe("secret.txt");
    expect(data.findings).toHaveLength(1);
    expect(JSON.stringify(response)).not.toContain(FAKE_SECRET);
  });

  it("refuses to scan outside the workspace", async () => {
    const { cwd } = await workspace();
    const project = join(cwd, "project");
    await mkdir(project, { recursive: true });
    await writeFile(join(cwd, "outside.txt"), `OPENAI_API_KEY=${FAKE_SECRET}\n`);

    const response = await runScanSensitive({ path: "../outside.txt" }, { cwd: project });

    expect(response.isError).toBe(true);
    expect((response.data as { code?: string }).code).toBe("outside_workspace");
  });

  it("reports a missing file", async () => {
    const { cwd } = await workspace();
    const response = await runScanSensitive({ path: "missing.txt" }, { cwd });

    expect(response.isError).toBe(true);
    expect((response.data as { code?: string }).code).toBe("not_found");
  });
});

describe("kapibara_rules_check handler", () => {
  it("uses the balanced profile by default", async () => {
    const { cwd, homeDir } = await workspace();
    const response = await runRulesCheck(
      { action: "git push", target: "origin/feature" },
      { cwd, homeDir },
    );

    expect(response.data.decision).toBe("allow");
    expect(response.data.profile).toBe("balanced");
  });

  it("accepts a strict profile override", async () => {
    const { cwd, homeDir } = await workspace();
    const response = await runRulesCheck(
      { action: "git push", target: "origin/feature", profile: "strict" },
      { cwd, homeDir },
    );

    expect(response.data.decision).toBe("require_approval");
    expect(response.data.matchedRules).toContain("ask-before-any-git-push");
  });

  it("applies project rules", async () => {
    const { cwd, homeDir } = await workspace();
    await writeRules(cwd, "# BLOCK\n- Never deploy on Fridays.\n");

    const response = await runRulesCheck({ action: "deploy", target: "staging" }, { cwd, homeDir });

    expect(response.data.decision).toBe("block");
    expect(response.data.matchedRules).toContain("never-deploy-on-fridays");
  });

  it("reports rule conflicts as require_approval", async () => {
    const { cwd, homeDir } = await workspace();
    const shared = "- Ask before deleting files.";
    await mkdir(join(homeDir, ".kapibara"), { recursive: true });
    await writeFile(join(homeDir, ".kapibara", "rules.md"), `# APPROVAL\n${shared}\n`);
    await writeRules(cwd, `# BLOCK\n${shared}\n`);

    const response = await runRulesCheck(
      { action: "delete file", target: "tmp.txt" },
      { cwd, homeDir },
    );
    const data = response.data as RulesCheckData;

    expect(data.decision).toBe("require_approval");
    expect(data.ruleSetConflicts).toHaveLength(1);
    expect(data.effective[0]?.appliedEffect).toBe("approval");
  });

  it("fails with a tool error when rules cannot be loaded", async () => {
    const { cwd, homeDir } = await workspace();
    await mkdir(join(cwd, ".kapibara", "rules.md"), { recursive: true });

    const response = await runRulesCheck(
      { action: "read file", target: "README.md" },
      { cwd, homeDir },
    );

    expect(response.isError).toBe(true);
    expect((response.data as { code?: string }).code).toBe("rules_unavailable");
  });
});
