import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assessActionRisk,
  compareSources,
  evaluateRulesForInput,
  preflight,
  type Decision,
} from "@kapibara/core";
import { loadRuleSet } from "@kapibara/policy";
import { scanPromptInjection, scanSensitiveText } from "@kapibara/scanners";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname);
const REPO_ROOT = resolve(__dirname, "..");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".otf": "font/otf",
  ".woff2": "font/woff2",
};

function badgeToneForDecision(decision: Decision | string): string {
  switch (decision) {
    case "block":
    case "conflict":
      return "block";
    case "require_approval":
      return "approval";
    case "warn":
      return "warn";
    default:
      return "allow";
  }
}

interface EvaluateBody {
  tool?: string;
  action?: string;
  target?: string;
  profile?: "developer" | "balanced" | "strict";
  content?: string;
}

async function handleEvaluate(body: EvaluateBody) {
  const tool = body.tool ?? "preflight";
  const action = body.action ?? "execute";
  const target = body.target ?? "";
  const profile = body.profile ?? "balanced";
  const content = body.content ?? "";

  if (tool === "compare") {
    const result = compareSources([
      { name: "Source A", content: target },
      { name: "Source B", content },
    ]);
    const hasConflict = !result.matches;
    return {
      badgeText: hasConflict
        ? `CONFLICT · ${result.issues.length} issue(s)`
        : "CONSISTENT · 0 issues",
      badgeTone: hasConflict ? "block" : "allow",
      toolLabel: "kapibara_compare · @kapibara/core",
      summary: hasConflict
        ? (result.issues[0]?.message ?? "Sources contain conflicting values.")
        : "All extracted amounts, dates, and versions match across sources.",
      payload: result,
    };
  }

  if (tool === "scan") {
    const secretScan = scanSensitiveText(content);
    const promptScan = scanPromptInjection(content);
    const totalFindings = secretScan.findings.length + promptScan.findings.length;
    const decision: Decision = totalFindings > 0 ? "block" : "allow";
    return {
      badgeText: totalFindings > 0 ? `BLOCK · ${totalFindings} finding(s)` : "ALLOW · Clean",
      badgeTone: badgeToneForDecision(decision),
      toolLabel: "kapibara_scan_sensitive · @kapibara/scanners",
      summary:
        totalFindings > 0
          ? `Detected ${secretScan.findings.length} secret(s) and ${promptScan.findings.length} prompt injection pattern(s).`
          : "No secrets, private keys, or prompt injections found.",
      payload: {
        decision,
        secrets: secretScan,
        promptInjection: promptScan,
      },
    };
  }

  const rules = await loadRuleSet({ cwd: REPO_ROOT, profile });
  const preflightInput = {
    action,
    target,
    context: {
      metadata: { command: content, content },
    },
  };

  if (tool === "rules") {
    const rulesRes = evaluateRulesForInput(preflightInput, rules);
    const topDecision = rulesRes.decision ?? "allow";
    return {
      badgeText: `${topDecision.toUpperCase()} · ${rulesRes.matches.length} rule(s)`,
      badgeTone: badgeToneForDecision(topDecision),
      toolLabel: "kapibara_rules_check · .kapibara/rules.md",
      summary:
        rulesRes.matches.length > 0
          ? `Matched ${rulesRes.matches.length} rule(s) in active policy.`
          : "No explicit rule blocked this action.",
      payload: rulesRes,
    };
  }

  if (tool === "risk") {
    const riskRes = assessActionRisk(preflightInput);
    return {
      badgeText: `${riskRes.risk.toUpperCase()} · ${riskRes.score}/100`,
      badgeTone: badgeToneForDecision(riskRes.decision),
      toolLabel: `kapibara_action_risk · ${riskRes.action}`,
      summary: riskRes.recommendation,
      payload: riskRes,
    };
  }

  const preflightRes = await preflight(preflightInput, {
    cwd: REPO_ROOT,
    rules,
  });

  return {
    badgeText: `${preflightRes.decision.toUpperCase()} · ${preflightRes.score}/100`,
    badgeTone: badgeToneForDecision(preflightRes.decision),
    toolLabel: `kapibara_preflight · ${preflightRes.action ?? action}`,
    summary:
      preflightRes.recommendation ??
      `Decision: ${preflightRes.decision} (${preflightRes.risk}, score ${preflightRes.score}/100).`,
    payload: preflightRes,
  };
}

const port = Number(process.env.PORT ?? 4173);

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);

    if (req.method === "POST" && url.pathname === "/api/evaluate") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as EvaluateBody;
      const evaluation = await handleEvaluate(parsed);
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(evaluation));
      return;
    }

    const cleanPath =
      url.pathname === "/"
        ? "/index.html"
        : url.pathname === "/favicon.ico"
          ? "/assets/favicon.png"
          : decodeURIComponent(url.pathname);
    const fullPath = resolve(join(WEB_ROOT, `.${cleanPath}`));
    if (!fullPath.startsWith(WEB_ROOT)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    const data = await readFile(fullPath);
    const ext = extname(fullPath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Kapibara web running at http://127.0.0.1:${port}`);
});
