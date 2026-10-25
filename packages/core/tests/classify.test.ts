import { describe, expect, it } from "vitest";

import {
  ACTION_IDS,
  classifyAction,
  getActionFactors,
  getActionProfile,
  isOutboundAction,
  type ActionId,
} from "@kapibara/core";

const CASES: Array<[string, string | undefined, ActionId]> = [
  ["read file", "src/index.ts", "read_file"],
  ["modify file", "src/index.ts", "modify_local_file"],
  ["overwrite file", "src/index.ts", "overwrite_file"],
  ["delete file", "tmp.txt", "delete_file"],
  ["rm -rf build", "build", "recursive_delete"],
  ["git commit", "feature", "commit"],
  ["git push", "origin/feature", "git_push"],
  ["git force push", "origin/main", "git_force_push"],
  ["deploy", "staging", "deploy"],
  ["deploy to production", "api", "deploy_production"],
  ["publish package", "npm", "publish"],
  ["upload file", "report.csv", "upload"],
  ["share document", "team", "share"],
  ["send email", "customer@example.com", "send_email"],
  ["drop database", "users", "drop_database"],
  ["truncate table", "users", "truncate_database"],
  ["run database migration", "db/migrations/001.sql", "database_migration"],
  ["purchase", "supplier", "purchase"],
  ["chmod 777", "deploy.sh", "permission_change"],
  ["execute shell", "workspace", "execute_shell"],
  ["frobnicate", "thing", "unknown"],
];

describe("classifyAction", () => {
  for (const [action, target, expected] of CASES) {
    it(`classifies ${action}`, () => {
      expect(classifyAction({ action, ...(target ? { target } : {}) }).id).toBe(expected);
    });
  }

  it("detects production deployments from context", () => {
    expect(
      classifyAction({
        action: "deploy",
        target: "api",
        context: { environment: "production" },
      }).id,
    ).toBe("deploy_production");
  });

  it("detects recursive deletion from a trailing slash", () => {
    expect(classifyAction({ action: "delete", target: "archive/" }).id).toBe("recursive_delete");
  });

  it("detects recursive deletion from metadata", () => {
    expect(
      classifyAction({
        action: "delete",
        target: "archive",
        context: { metadata: { recursive: true } },
      }).id,
    ).toBe("recursive_delete");
  });

  it("classifies a destructive shell command as recursive deletion", () => {
    expect(
      classifyAction({
        action: "execute shell",
        target: "workspace",
        context: { metadata: { command: "rm -rf node_modules" } },
      }).id,
    ).toBe("recursive_delete");
  });
});

describe("action profiles", () => {
  it("exposes every action id", () => {
    expect(ACTION_IDS.length).toBeGreaterThan(15);
    for (const id of ACTION_IDS) {
      expect(getActionProfile(id).label.length).toBeGreaterThan(0);
    }
  });

  it("returns a defensive copy of factors", () => {
    const first = getActionFactors("git_push");
    first.destructive = 999;
    expect(getActionFactors("git_push").destructive).not.toBe(999);
  });

  it("marks outbound and deploy actions as outbound", () => {
    expect(isOutboundAction("publish")).toBe(true);
    expect(isOutboundAction("upload")).toBe(true);
    expect(isOutboundAction("deploy")).toBe(true);
    expect(isOutboundAction("read_file")).toBe(false);
    expect(isOutboundAction("delete_file")).toBe(false);
  });
});
