---
name: setup
description: Install, configure, and verify the Kapibara MCP server for Claude Code, Claude Desktop, OpenCode, or another MCP client. Use when Kapibara is missing, tools are not listed, rules are not loading, or the user wants to change profiles or enable the audit log.
---

# Setup

Kapibara is local-first. There is no account, API key, cloud dependency, or
telemetry. The server speaks MCP over stdio.

## From this repository

```bash
pnpm install
pnpm build
pnpm --filter @kapibara/mcp dev
```

`pnpm --filter @kapibara/mcp dev` runs the server on stdio. It is meant to be
launched by an MCP client, not used interactively.

## From npm

```bash
npx -y @kapibara/mcp
```

## Client configuration

Claude Desktop (`claude_desktop_config.json`):

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

Claude Code:

```bash
claude mcp add kapibara -- npx -y @kapibara/mcp
```

OpenCode (`opencode.json`):

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

Pin the workspace when the client may start elsewhere:

```json
{
  "command": "npx",
  "args": ["-y", "@kapibara/mcp", "--cwd", "/absolute/path/to/project"]
}
```

## Verify

Ask the client to list tools. You should see exactly:

- `kapibara_preflight`
- `kapibara_action_risk`
- `kapibara_compare`
- `kapibara_scan_sensitive`
- `kapibara_rules_check`

Then call `kapibara_preflight` with:

```json
{ "action": "read file", "target": "README.md" }
```

A working server returns `ALLOW`.

## Configure

Project config: `.kapibara/config.json`

```json
{
  "profile": "balanced",
  "auditLog": false,
  "failMode": "risk_based",
  "auditRetentionDays": 7
}
```

Profiles:

- `balanced` — default; approval for production, outbound, and destructive work.
- `developer` — fewer gates for local iteration.
- `strict` — approval for most side effects and any push.
- `custom` — use only project and global rules.

Project rules: `.kapibara/rules.md`

```markdown
# BLOCK

- Never force push to main.

# APPROVAL

- Ask before deploying on Fridays.

# WARN

- Prefer feature branches.
```

Global config and rules live in `~/.kapibara/`. Project rules override global
rules, which override profile defaults.

`failMode` controls a broken rules file:

- `risk_based` — keep the risk-based decision and report the failure.
- `closed` — block.
- `open` — continue without project rules.

## Troubleshooting

- No tools: check the command path, run `npx -y @kapibara/mcp --version`, and
  restart the client.
- Wrong project: pass `--cwd` explicitly.
- Rules ignored: confirm the file is `.kapibara/rules.md` and starts with a
  `# BLOCK`, `# APPROVAL`, `# WARN`, or `# ALLOW` section.
- File scan refused: paths must stay inside the workspace. Kapibara never
  crawls directories.
- Audit log: set `"auditLog": true`. Sanitized JSONL records are written to
  `.kapibara/logs/` and pruned after `auditRetentionDays`.
