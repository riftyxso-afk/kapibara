# @kapibara/mcp

Kapibara MCP server: local-first preflight safety checks for AI agents.

```bash
npx -y @kapibara/mcp
```

The server speaks MCP over stdio and exposes exactly five read-only tools.

## Tools

| Tool                      | Purpose                                           |
| ------------------------- | ------------------------------------------------- |
| `kapibara_preflight`      | Full check with rules and explicit scans.         |
| `kapibara_action_risk`    | Classify and explain risk without rules or files. |
| `kapibara_compare`        | Find conflicting facts across sources.            |
| `kapibara_scan_sensitive` | Scan explicit text or one explicit file.          |
| `kapibara_rules_check`    | Evaluate rules without scanning files.            |

## Claude Desktop

```json
{
  "mcpServers": {
    "kapibara": {
      "command": "npx",
      "args": ["-y", "@kapibara/mcp"]
    }
  }
}
```

## Claude Code

```bash
claude mcp add kapibara -- npx -y @kapibara/mcp
```

## OpenCode

```json
{
  "mcp": {
    "kapibara": {
      "type": "local",
      "command": ["npx", "-y", "@kapibara/mcp"],
      "enabled": true
    }
  }
}
```

## CLI

```bash
kapibara-mcp --help
kapibara-mcp --version
kapibara-mcp --cwd /path/to/project
kapibara-mcp --quiet
```

`--cwd` pins the workspace for `.kapibara/config.json`, `.kapibara/rules.md`,
and file scans. Without it, the server uses its process working directory.

## First call

```json
{
  "action": "force push",
  "target": "origin/main",
  "context": { "metadata": { "branch": "main" } }
}
```

Returns `BLOCK`. A read-only action such as reading `README.md` returns `ALLOW`.

## Configuration

`.kapibara/config.json`:

```json
{
  "profile": "balanced",
  "auditLog": false,
  "failMode": "risk_based",
  "auditRetentionDays": 7
}
```

`.kapibara/rules.md`:

```markdown
# BLOCK

- Never force push to main.

# APPROVAL

- Ask before deploying on Fridays.
```

## Scanning boundaries

- Only explicit `files` are scanned.
- The single named `target` is scanned only for outbound actions.
- Directories are never crawled.
- Paths must resolve inside the workspace.
- Raw secret values are never returned.

## Programmatic use

```ts
import { createKapibaraServer } from "@kapibara/mcp";

const server = createKapibaraServer({ cwd: "/path/to/project" });
```

The handlers are also exported for tests and custom transports:

`runPreflight`, `runActionRisk`, `runCompare`, `runScanSensitive`,
`runRulesCheck`.

## License

MIT
