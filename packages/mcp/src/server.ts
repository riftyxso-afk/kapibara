import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

import {
  runActionRisk,
  runCompare,
  runPreflight,
  runRulesCheck,
  runScanSensitive,
  type ToolResponse,
} from "./handlers.js";
import {
  actionRiskToolInputSchema,
  compareToolInputSchema,
  preflightToolInputSchema,
  rulesCheckInputSchema,
  scanSensitiveToolInputSchema,
  toolOutputSchema,
} from "./tool-schemas.js";
import { SERVER_NAME, VERSION } from "./version.js";

export interface KapibaraServerOptions {
  cwd?: string;
  homeDir?: string;
  name?: string;
  version?: string;
}

const READ_ONLY_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const INSTRUCTIONS = [
  "Kapibara is a local-first preflight safety layer for AI agents.",
  "Call kapibara_preflight before destructive, external, production, financial, permission-changing, or irreversible actions.",
  "Treat the decision as binding:",
  "- ALLOW: proceed.",
  "- WARN: proceed carefully and tell the user about the warning.",
  "- REQUIRE_APPROVAL: stop and ask the user for explicit approval.",
  "- BLOCK: do not proceed; report the block and its evidence.",
  "Never try to bypass a BLOCK. Kapibara never returns raw secret values.",
  "Use kapibara_scan_sensitive only on explicit text or explicit file paths. Do not crawl the filesystem.",
].join("\n");

function toCallToolResult<T>(response: ToolResponse<T>): CallToolResult {
  const text = `${response.summary}\n\n${JSON.stringify(response.data, null, 2)}`;
  if (response.isError) {
    return {
      content: [{ type: "text", text }],
      isError: true,
    };
  }
  return {
    content: [{ type: "text", text }],
    structuredContent: {
      summary: response.summary,
      data: response.data,
    },
  };
}

/**
 * Create the Kapibara MCP server with exactly five tools.
 *
 * The server is local-first and read-only with respect to the workspace. If
 * audit logging is enabled in `.kapibara/config.json`, preflight calls append a
 * sanitized JSONL record under `.kapibara/logs/`.
 */
export function createKapibaraServer(options: KapibaraServerOptions = {}): McpServer {
  const server = new McpServer(
    {
      name: options.name ?? SERVER_NAME,
      version: options.version ?? VERSION,
    },
    { instructions: INSTRUCTIONS },
  );

  server.registerTool(
    "kapibara_preflight",
    {
      title: "Kapibara preflight",
      description:
        "Decide whether an AI agent action is safe to proceed. Returns exactly ALLOW, WARN, REQUIRE_APPROVAL, or BLOCK. Scans only explicit content, explicit file paths, and the single named target for outbound actions. Never returns raw secret values.",
      inputSchema: preflightToolInputSchema,
      outputSchema: toolOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (args) =>
      toCallToolResult(
        await runPreflight(args, {
          ...(options.cwd ? { cwd: options.cwd } : {}),
          ...(options.homeDir ? { homeDir: options.homeDir } : {}),
        }),
      ),
  );

  server.registerTool(
    "kapibara_action_risk",
    {
      title: "Kapibara action risk",
      description:
        "Classify an action and return deterministic risk factors, issues, and a decision without loading project rules or scanning files. Use this to understand why an action is risky.",
      inputSchema: actionRiskToolInputSchema,
      outputSchema: toolOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (args) => toCallToolResult(await runActionRisk(args)),
  );

  server.registerTool(
    "kapibara_compare",
    {
      title: "Kapibara compare",
      description:
        "Compare two or more named text sources for conflicting amounts, currencies, dates, versions, URLs, emails, filenames, identifiers, percentages, or quantities. Returns mismatches without sending data anywhere.",
      inputSchema: compareToolInputSchema,
      outputSchema: toolOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (args) => toCallToolResult(await runCompare(args)),
  );

  server.registerTool(
    "kapibara_scan_sensitive",
    {
      title: "Kapibara scan sensitive",
      description:
        "Scan explicit text or one explicit file path for secrets. Values are redacted and never returned. File paths are confined to the workspace; directories are not crawled.",
      inputSchema: scanSensitiveToolInputSchema,
      outputSchema: toolOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (args) =>
      toCallToolResult(
        await runScanSensitive(args, {
          ...(options.cwd ? { cwd: options.cwd } : {}),
          ...(options.homeDir ? { homeDir: options.homeDir } : {}),
        }),
      ),
  );

  server.registerTool(
    "kapibara_rules_check",
    {
      title: "Kapibara rules check",
      description:
        "Evaluate the effective project, global, and default Kapibara rules for an action without scanning files. Shows matched rules, precedence, conflicts, and the resulting rule decision.",
      inputSchema: rulesCheckInputSchema,
      outputSchema: toolOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (args) =>
      toCallToolResult(
        await runRulesCheck(args, {
          ...(options.cwd ? { cwd: options.cwd } : {}),
          ...(options.homeDir ? { homeDir: options.homeDir } : {}),
        }),
      ),
  );

  return server;
}
