import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  preflight,
  type ActionId,
  type Decision,
  type PreflightInput,
  type RiskLevel,
} from "@kapibara/core";
import { loadRuleSet } from "@kapibara/policy";

const HERE = dirname(fileURLToPath(import.meta.url));
const CASES_DIR = join(HERE, "cases");

interface EvalExpectation {
  decision: Decision;
  action?: ActionId;
  risk?: RiskLevel;
  issues?: string[];
  matchedRules?: string[];
  forbiddenText?: string[];
}

interface EvalCase {
  name: string;
  description?: string;
  input: PreflightInput;
  expect: EvalExpectation;
}

interface LoadedCase {
  file: string;
  value: EvalCase;
}

interface CaseFailure {
  caseName: string;
  file: string;
  messages: string[];
}

const DECISION_LABEL: Record<Decision, string> = {
  allow: "ALLOW",
  warn: "WARN",
  require_approval: "REQUIRE_APPROVAL",
  block: "BLOCK",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertCase(value: unknown, file: string): asserts value is EvalCase {
  if (!isRecord(value)) {
    throw new Error(`${file}: expected a JSON object`);
  }
  if (typeof value.name !== "string" || value.name.length === 0) {
    throw new Error(`${file}: "name" must be a non-empty string`);
  }
  if (!isRecord(value.input) || typeof value.input.action !== "string") {
    throw new Error(`${file}: "input.action" must be a string`);
  }
  if (!isRecord(value.expect) || typeof value.expect.decision !== "string") {
    throw new Error(`${file}: "expect.decision" must be a string`);
  }
}

async function loadCases(): Promise<LoadedCase[]> {
  const files = (await readdir(CASES_DIR))
    .filter((file) => file.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));

  const loaded: LoadedCase[] = [];
  for (const file of files) {
    const raw = await readFile(join(CASES_DIR, file), "utf8");
    const value: unknown = JSON.parse(raw);
    assertCase(value, file);
    loaded.push({ file, value });
  }
  return loaded;
}

function missing(actual: string[], expected: string[]): string[] {
  const present = new Set(actual);
  return expected.filter((item) => !present.has(item));
}

function compareCase(testCase: EvalCase, result: Awaited<ReturnType<typeof preflight>>): string[] {
  const messages: string[] = [];
  const expectation = testCase.expect;

  if (result.decision !== expectation.decision) {
    messages.push(
      `decision: expected ${DECISION_LABEL[expectation.decision]}, got ${DECISION_LABEL[result.decision]}`,
    );
  }
  if (expectation.action !== undefined && result.action !== expectation.action) {
    messages.push(`action: expected ${expectation.action}, got ${result.action ?? "undefined"}`);
  }
  if (expectation.risk !== undefined && result.risk !== expectation.risk) {
    messages.push(`risk: expected ${expectation.risk}, got ${result.risk}`);
  }

  if (expectation.issues !== undefined) {
    const actualIssues = result.issues.map((issue) => issue.type);
    if (expectation.issues.length === 0) {
      if (actualIssues.length > 0) {
        messages.push(`issues: expected none, got ${actualIssues.join(", ")}`);
      }
    } else {
      const absent = missing(actualIssues, expectation.issues);
      if (absent.length > 0) {
        messages.push(`issues: missing ${absent.join(", ")}`);
      }
    }
  }

  if (expectation.matchedRules !== undefined) {
    if (expectation.matchedRules.length === 0) {
      if (result.matchedRules.length > 0) {
        messages.push(`matchedRules: expected none, got ${result.matchedRules.join(", ")}`);
      }
    } else {
      const absent = missing(result.matchedRules, expectation.matchedRules);
      if (absent.length > 0) {
        messages.push(`matchedRules: missing ${absent.join(", ")}`);
      }
    }
  }

  if (expectation.forbiddenText !== undefined) {
    const serialized = JSON.stringify(result);
    const leaked = expectation.forbiddenText.filter((text) => serialized.includes(text));
    if (leaked.length > 0) {
      messages.push(`forbiddenText: ${leaked.length} raw value(s) leaked into the result`);
    }
  }

  return messages;
}

async function main(): Promise<void> {
  const cases = await loadCases();
  if (cases.length === 0) {
    throw new Error(`No eval cases found in ${CASES_DIR}`);
  }

  const cwd = await mkdtemp(join(tmpdir(), "kapibara-eval-cwd-"));
  const homeDir = await mkdtemp(join(tmpdir(), "kapibara-eval-home-"));

  try {
    const rules = await loadRuleSet({ cwd, homeDir, profile: "balanced" });
    const failures: CaseFailure[] = [];

    console.log("Kapibara eval suite");
    console.log(`Profile: ${rules.profile}`);
    console.log(`Cases: ${cases.length}`);
    console.log("");

    for (const { file, value } of cases) {
      let messages: string[];
      try {
        const result = await preflight(value.input, { rules, cwd, scanTarget: false });
        messages = compareCase(value, result);
      } catch (error) {
        messages = [`runner error: ${error instanceof Error ? error.message : String(error)}`];
      }

      if (messages.length === 0) {
        console.log(`PASS ${file}  ${value.name}`);
      } else {
        failures.push({ caseName: value.name, file, messages });
        console.log(`FAIL ${file}  ${value.name}`);
        for (const message of messages) {
          console.log(`     ${message}`);
        }
      }
    }

    const passed = cases.length - failures.length;
    console.log("");
    console.log(`Summary: ${passed}/${cases.length} passed, ${failures.length} failed`);

    if (failures.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await Promise.all([
      rm(cwd, { recursive: true, force: true }),
      rm(homeDir, { recursive: true, force: true }),
    ]);
  }
}

main().catch((error: unknown) => {
  console.error("Kapibara evals could not run.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
