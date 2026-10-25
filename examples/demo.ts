import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  assessActionRisk,
  compareSources,
  formatActionRisk,
  formatComparison,
  formatPreflightResult,
  preflight,
} from "@kapibara/core";
import { loadRuleSet } from "@kapibara/policy";
import { scanSensitiveText } from "@kapibara/scanners";

const FAKE_SECRET = "sk-demo000000000000000000000000";

function heading(title: string): void {
  console.log(`\n${"=".repeat(60)}\n${title}\n${"=".repeat(60)}`);
}

const cwd = await mkdtemp(join(tmpdir(), "kapibara-demo-cwd-"));
const homeDir = await mkdtemp(join(tmpdir(), "kapibara-demo-home-"));

try {
  const rules = await loadRuleSet({ cwd, homeDir, profile: "balanced" });

  heading("1. Force push to main");
  const forcePush = await preflight(
    {
      action: "force push",
      target: "origin/main",
      context: { metadata: { branch: "main" } },
    },
    { rules, cwd },
  );
  console.log(formatPreflightResult(forcePush, { action: "force push", target: "origin/main" }));

  heading("2. Upload content containing a secret");
  const upload = await preflight(
    {
      action: "upload file",
      target: "report.txt",
      context: { metadata: { content: `OPENAI_API_KEY=${FAKE_SECRET}` } },
    },
    { rules, cwd },
  );
  console.log(formatPreflightResult(upload, { action: "upload file", target: "report.txt" }));

  heading("3. Compare two sources");
  const comparison = compareSources([
    { name: "invoice", content: "Total: $1,200 due 2026-11-01" },
    { name: "email", content: "Total: $1,500 due 2026-11-01" },
  ]);
  console.log(formatComparison(comparison));

  heading("4. Scan text for secrets");
  const scan = scanSensitiveText(`GITHUB_TOKEN=ghp_${"a".repeat(36)}`);
  console.log(`Findings: ${scan.findings.length}`);
  for (const finding of scan.findings) {
    console.log(`- ${finding.type} (${finding.severity}): ${finding.redactedValue}`);
  }

  heading("5. Explain action risk");
  const risk = assessActionRisk({ action: "drop database", target: "production" });
  console.log(formatActionRisk(risk));
} finally {
  await Promise.all([
    rm(cwd, { recursive: true, force: true }),
    rm(homeDir, { recursive: true, force: true }),
  ]);
}
