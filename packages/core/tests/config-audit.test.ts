import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  ConfigError,
  DEFAULT_CONFIG,
  appendAuditEvent,
  configPaths,
  createAuditEvent,
  loadConfig,
  type PreflightResult,
} from "@kapibara/core";

const FAKE_SECRET = "sk-auditFAKE1234567890abcdef";
const tempDirs: string[] = [];

async function tempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), `kapibara-core-${prefix}-`));
  tempDirs.push(dir);
  return dir;
}

async function writeConfig(root: string, config: unknown): Promise<void> {
  await mkdir(join(root, ".kapibara"), { recursive: true });
  await writeFile(join(root, ".kapibara", "config.json"), JSON.stringify(config), "utf8");
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("loadConfig", () => {
  it("returns defaults when no config exists", async () => {
    const cwd = await tempDir("config-empty");
    const homeDir = await tempDir("config-home");
    const config = await loadConfig({ cwd, homeDir });

    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it("merges global and project config with project precedence", async () => {
    const cwd = await tempDir("config-project");
    const homeDir = await tempDir("config-home");
    await writeConfig(homeDir, { profile: "developer", auditLog: true });
    await writeConfig(cwd, { profile: "strict", failMode: "closed" });

    const config = await loadConfig({ cwd, homeDir });

    expect(config.profile).toBe("strict");
    expect(config.auditLog).toBe(true);
    expect(config.failMode).toBe("closed");
    expect(config.auditRetentionDays).toBe(7);
  });

  it("rejects invalid JSON", async () => {
    const cwd = await tempDir("config-invalid");
    const homeDir = await tempDir("config-home");
    await mkdir(join(cwd, ".kapibara"), { recursive: true });
    await writeFile(join(cwd, ".kapibara", "config.json"), "{ nope", "utf8");

    await expect(loadConfig({ cwd, homeDir })).rejects.toBeInstanceOf(ConfigError);
  });

  it("rejects invalid values", async () => {
    const cwd = await tempDir("config-values");
    const homeDir = await tempDir("config-home");
    await writeConfig(cwd, { failMode: "sometimes" });

    await expect(loadConfig({ cwd, homeDir })).rejects.toBeInstanceOf(ConfigError);
  });

  it("reports config paths", async () => {
    const cwd = await tempDir("config-paths");
    const homeDir = await tempDir("config-home");
    const paths = configPaths({ cwd, homeDir });

    expect(paths.project).toBe(join(cwd, ".kapibara", "config.json"));
    expect(paths.global).toBe(join(homeDir, ".kapibara", "config.json"));
  });
});

describe("audit log", () => {
  const result: PreflightResult = {
    decision: "block",
    risk: "critical",
    score: 85,
    issues: [
      {
        type: "sensitive_data",
        severity: "critical",
        message: "Sensitive value detected.",
        evidence: [`openai_api_key: sk-a****cdef (report.txt:1:1)`],
        blocking: true,
      },
    ],
    matchedRules: ["never-expose-secrets"],
    recommendation: "Remove the secret.",
    requiresUserApproval: true,
    action: "publish",
  };

  it("writes a sanitized JSONL event without raw content", async () => {
    const cwd = await tempDir("audit");
    const event = createAuditEvent(
      {
        action: "publish",
        target: "report.txt",
        context: { metadata: { content: `OPENAI_API_KEY=${FAKE_SECRET}` } },
      },
      result,
      new Date(),
    );

    expect(JSON.stringify(event)).not.toContain(FAKE_SECRET);
    expect(event.issueTypes).toEqual(["sensitive_data"]);

    const audit = await appendAuditEvent(event, { cwd, retentionDays: 7 });
    expect(audit.written).toBe(true);
    expect(audit.path).toBeDefined();

    const content = await readFile(audit.path!, "utf8");
    expect(content).not.toContain(FAKE_SECRET);
    const parsed = JSON.parse(content.trim()) as Record<string, unknown>;
    expect(parsed.decision).toBe("block");
    expect(parsed.target).toBe("report.txt");
    expect(parsed.matchedRules).toEqual(["never-expose-secrets"]);
  });

  it("removes logs older than the retention window", async () => {
    const cwd = await tempDir("audit-retention");
    const logDir = join(cwd, ".kapibara", "logs");
    await mkdir(logDir, { recursive: true });
    const oldPath = join(logDir, "audit-2000-01-01.jsonl");
    await writeFile(oldPath, "{}\n", "utf8");

    const event = createAuditEvent(
      { action: "read file", target: "README.md" },
      {
        ...result,
        decision: "allow",
        risk: "low",
        score: 0,
        issues: [],
        matchedRules: [],
        requiresUserApproval: false,
        recommendation: "No issue.",
        action: "read_file",
      },
      new Date(),
    );
    const audit = await appendAuditEvent(event, { cwd, retentionDays: 7 });

    expect(audit.written).toBe(true);
    const entries = await readdir(logDir);
    expect(entries).not.toContain("audit-2000-01-01.jsonl");
  });

  it("does not throw when the log directory cannot be written", async () => {
    const cwd = await tempDir("audit-failure");
    const event = createAuditEvent(
      { action: "read file", target: "README.md" },
      {
        ...result,
        decision: "allow",
        risk: "low",
        score: 0,
        issues: [],
        matchedRules: [],
        requiresUserApproval: false,
        recommendation: "No issue.",
        action: "read_file",
      },
    );

    await writeFile(join(cwd, ".kapibara"), "not a directory", "utf8");
    const audit = await appendAuditEvent(event, { cwd });
    expect(audit.written).toBe(false);
    expect(audit.error).toBeDefined();
  });
});
