import { describe, expect, it } from "vitest";

import { assessActionRisk, classifyAction, failureResult, preflight } from "@kapibara/core";
import { loadRuleSet } from "@kapibara/policy";

describe("read actions are not mistaken for deletion", () => {
  it.each([
    [{ action: "list", target: "src/" }],
    [{ action: "read", target: "docs/" }],
    [{ action: "grep", target: "src", context: { metadata: { recursive: true } } }],
  ])("classifies %j as read_file and allows it", (input) => {
    expect(classifyAction(input).id).toBe("read_file");
    expect(assessActionRisk(input).decision).toBe("allow");
  });

  it("still treats a delete with a trailing slash or recursive flag as recursive", () => {
    expect(classifyAction({ action: "remove", target: "build/" }).id).toBe("recursive_delete");
    expect(
      classifyAction({ action: "erase", target: "tmp", context: { metadata: { recursive: true } } })
        .id,
    ).toBe("recursive_delete");
    expect(classifyAction({ action: "rm -fr", target: "build" }).id).toBe("recursive_delete");
  });
});

describe("publish vs deploy", () => {
  it("classifies release package as publish", () => {
    expect(classifyAction({ action: "release package", target: "@kapibara/mcp" }).id).toBe(
      "publish",
    );
  });

  it("keeps plain release as a deployment", () => {
    expect(classifyAction({ action: "release", target: "api" }).id).toBe("deploy");
  });
});

describe("wrapped shell commands cannot downgrade a check", () => {
  it("blocks a force push to main passed as metadata.command", async () => {
    const input = {
      action: "run",
      context: { metadata: { command: "git push --force origin main" } },
    };
    expect(classifyAction(input).id).toBe("git_force_push");
    const result = await preflight(input, {
      rules: await loadRuleSet({ cwd: "/x", homeDir: "/x" }),
    });
    expect(result.decision).toBe("block");
    expect(result.issues.map((issue) => issue.type)).toContain("protected_branch_force_push");
    expect(result.matchedRules).toContain("never-force-push-to-main");
  });

  it("blocks a force push to main passed as the target of execute shell", () => {
    const result = assessActionRisk({
      action: "execute shell",
      target: "git push --force origin main",
    });
    expect(result.action).toBe("git_force_push");
    expect(result.decision).toBe("block");
  });

  it("requires approval for a shell push to a protected branch", () => {
    const result = assessActionRisk({
      action: "run",
      context: { metadata: { command: "git push origin main" } },
    });
    expect(result.action).toBe("git_push");
    expect(result.decision).toBe("require_approval");
  });

  it("classifies a dropped table in a shell command as a database drop", () => {
    expect(
      classifyAction({
        action: "execute shell",
        context: { metadata: { command: 'psql -c "drop table users"' } },
      }).id,
    ).toBe("drop_database");
  });

  it("keeps harmless shell commands as execute_shell", () => {
    expect(
      classifyAction({ action: "run tests", context: { metadata: { command: "pnpm test" } } }).id,
    ).toBe("execute_shell");
    expect(classifyAction({ action: "execute shell", target: "workspace" }).id).toBe(
      "execute_shell",
    );
    expect(
      classifyAction({ action: "run", context: { metadata: { command: "cat README.md" } } }).id,
    ).toBe("execute_shell");
  });
});

describe("production targets raise risk for destructive and unclassified actions", () => {
  it("requires approval for terraform destroy against production", () => {
    const result = assessActionRisk({ action: "terraform destroy", target: "production" });
    expect(result.decision).toBe("require_approval");
    expect(result.issues.map((issue) => issue.type)).toContain("production_destructive_action");
  });

  it("requires approval for an unclassified action on a prod target", () => {
    const result = assessActionRisk({ action: "kubectl apply", target: "prod cluster" });
    expect(result.decision).toBe("require_approval");
    expect(result.issues.map((issue) => issue.type)).toContain("production_change");
  });

  it("requires approval for a shell command that mentions production", () => {
    const result = assessActionRisk({
      action: "run",
      context: { metadata: { command: "kubectl rollout restart deploy/api -n production" } },
    });
    expect(result.decision).toBe("require_approval");
  });

  it("leaves non-production unclassified actions at warn", () => {
    expect(assessActionRisk({ action: "kubectl apply", target: "dev cluster" }).decision).toBe(
      "warn",
    );
  });
});

describe("failureResult", () => {
  it("treats environment=production like production=true", () => {
    const viaEnvironment = failureResult(new Error("x"), {
      input: { action: "deploy", context: { environment: "production" } },
    });
    const viaFlag = failureResult(new Error("x"), {
      input: { action: "deploy", context: { production: true } },
    });
    expect(viaEnvironment.decision).toBe("block");
    expect(viaFlag.decision).toBe("block");
  });

  it("uses the target when classifying the failed action", () => {
    const result = failureResult(new Error("x"), {
      input: { action: "deploy", target: "production" },
    });
    expect(result.action).toBe("deploy_production");
    expect(result.decision).toBe("block");
  });
});
