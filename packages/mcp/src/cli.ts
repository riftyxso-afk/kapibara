#!/usr/bin/env node
import { stat } from "node:fs/promises";
import { resolve } from "node:path";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createKapibaraServer } from "./server.js";
import { VERSION } from "./version.js";

interface CliOptions {
  cwd?: string;
  quiet: boolean;
  help: boolean;
  version: boolean;
}

const USAGE = `kapibara-mcp ${VERSION}

Local-first preflight safety checks for AI agents over MCP stdio.

Usage:
  kapibara-mcp [options]

Options:
  --cwd <path>   Workspace root for rules and file scans (default: current directory)
  --quiet        Do not print the startup banner to stderr
  --version      Print the version
  --help         Print this help

Tools:
  kapibara_preflight
  kapibara_action_risk
  kapibara_compare
  kapibara_scan_sensitive
  kapibara_rules_check

Configuration:
  <cwd>/.kapibara/config.json   Project config
  <cwd>/.kapibara/rules.md      Project rules
  ~/.kapibara/config.json       Global config
  ~/.kapibara/rules.md          Global rules

Kapibara has no account, cloud dependency, or telemetry.
`;

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    quiet: false,
    help: false,
    version: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--cwd": {
        const value = argv[index + 1];
        if (!value) {
          throw new Error("--cwd requires a path");
        }
        options.cwd = resolve(value);
        index += 1;
        break;
      }
      case "--quiet":
        options.quiet = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--version":
      case "-v":
        options.version = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    process.stdout.write(USAGE);
    return;
  }
  if (options.version) {
    process.stdout.write(`${VERSION}\n`);
    return;
  }

  if (options.cwd) {
    const info = await stat(options.cwd);
    if (!info.isDirectory()) {
      throw new Error(`--cwd is not a directory: ${options.cwd}`);
    }
  }

  const server = createKapibaraServer({
    ...(options.cwd ? { cwd: options.cwd } : {}),
  });
  const transport = new StdioServerTransport();
  await server.connect(transport);

  if (!options.quiet) {
    process.stderr.write(`kapibara-mcp ${VERSION} listening on stdio\n`);
  }

  const shutdown = async (): Promise<void> => {
    await server.close().catch(() => undefined);
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`kapibara-mcp error: ${message}\n`);
  process.exit(1);
});
