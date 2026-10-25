import { describe, expect, it } from "vitest";

import { classifyAction, detectTargetSignals, targetIssues, targetTags } from "@kapibara/core";

describe("detectTargetSignals", () => {
  it("detects environment files and secret-bearing names", () => {
    const signals = detectTargetSignals(".env.production");
    expect(signals.map((signal) => signal.type)).toContain("env_file");
    expect(detectTargetSignals("api_key.txt").map((signal) => signal.type)).toContain(
      "secret_named_file",
    );
  });

  it("detects private keys", () => {
    expect(detectTargetSignals("keys/id_ed25519").map((signal) => signal.type)).toContain(
      "private_key",
    );
    expect(detectTargetSignals("certs/server.pem").map((signal) => signal.type)).toContain(
      "private_key",
    );
  });

  it("detects database backups but not ordinary migration SQL", () => {
    expect(detectTargetSignals("backups/prod-database.sql").map((signal) => signal.type)).toContain(
      "database_backup",
    );
    expect(detectTargetSignals("db/migrations/001.sql").map((signal) => signal.type)).not.toContain(
      "database_backup",
    );
  });

  it("detects generated output and lockfiles", () => {
    expect(detectTargetSignals("dist/index.js").map((signal) => signal.type)).toContain(
      "generated_file",
    );
    expect(detectTargetSignals("pnpm-lock.yaml").map((signal) => signal.type)).toContain(
      "generated_file",
    );
  });

  it("returns no signals without a target", () => {
    expect(detectTargetSignals(undefined)).toEqual([]);
    expect(detectTargetSignals("")).toEqual([]);
  });
});

describe("targetIssues", () => {
  it("blocks publishing an environment file", () => {
    const classification = classifyAction({ action: "publish", target: ".env" });
    const issues = targetIssues(".env", classification);
    const env = issues.find((issue) => issue.type === "env_file");

    expect(env?.severity).toBe("critical");
    expect(env?.blocking).toBe(true);
  });

  it("downgrades secret signals for read-only actions", () => {
    const classification = classifyAction({ action: "read file", target: ".env" });
    const issues = targetIssues(".env", classification);

    expect(issues.every((issue) => issue.blocking !== true)).toBe(true);
    expect(issues.find((issue) => issue.type === "env_file")?.severity).toBe("medium");
  });

  it("escalates database backups for deletion", () => {
    const classification = classifyAction({
      action: "delete file",
      target: "backups/prod-database.sql",
    });
    const issues = targetIssues("backups/prod-database.sql", classification);

    expect(issues.some((issue) => issue.type === "database_backup")).toBe(true);
    expect(issues.every((issue) => issue.severity === "critical")).toBe(true);
  });

  it("does not block a production target for a read action", () => {
    const classification = classifyAction({ action: "read file", target: "production" });
    const issues = targetIssues("production", classification);

    expect(issues.find((issue) => issue.type === "production_target")).toBeUndefined();
  });
});

describe("targetTags", () => {
  it("returns unique tags", () => {
    const tags = targetTags("backups/prod-database.sql");
    expect(new Set(tags).size).toBe(tags.length);
    expect(tags).toEqual(expect.arrayContaining(["backup", "database", "data"]));
  });
});
