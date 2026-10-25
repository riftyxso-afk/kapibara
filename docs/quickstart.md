# Quick start

Kapibara is an MCP server and a small TypeScript library. Most users only need
the server.

## Requirements

- Node.js 20 or newer
- pnpm 10 for development from source
- An MCP client such as Claude Code, Claude Desktop, or OpenCode

## Install from source

```bash
git clone <repository-url> kapibara
cd kapibara
pnpm install
pnpm build
pnpm test
```

Start the server:

```bash
pnpm --filter @kapibara/mcp dev
```

It prints a startup line to stderr and waits for MCP messages on stdio. You do
not type into it directly.

## Connect a client

### Claude Desktop

Edit `claude_desktop_config.json`:

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

Restart Claude Desktop. The five tools should appear.

### Claude Code

```bash
claude mcp add kapibara -- npx -y @kapibara/mcp
```

Or use the project-scoped [`.mcp.json`](../.mcp.json) in this repository.

### OpenCode

Add to `opencode.json`:

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

### Local checkout

```json
{
  "mcpServers": {
    "kapibara": {
      "command": "node",
      "args": [
        "/absolute/path/to/kapibara/packages/mcp/dist/cli.js",
        "--cwd",
        "/absolute/path/to/project"
      ]
    }
  }
}
```

`--cwd` pins the workspace used for `.kapibara/rules.md`, `.kapibara/config.json`,
and file scans. Without it, the server uses its process working directory.

## First call

Ask the agent:

> Run a Kapibara preflight for force pushing to main.

Expected decision: `BLOCK`.

Then try:

```json
{ "action": "read file", "target": "README.md" }
```

Expected decision: `ALLOW`.

## Add project rules

Create `.kapibara/rules.md`:

```markdown
# BLOCK

- Never force push to main.

# APPROVAL

- Ask before deploying on Fridays.

# WARN

- Prefer feature branches.
```

Call `kapibara_rules_check` to see which rules match without scanning files.

## Choose a profile

`.kapibara/config.json`:

```json
{
  "profile": "balanced"
}
```

- `balanced`: sensible default.
- `developer`: more approval gates around pushes, shell commands, and releases.
- `strict`: approval for almost every side effect.
- `custom`: only project and global rules.

## Verify the install

```bash
node packages/mcp/dist/cli.js --version
node packages/mcp/dist/cli.js --help
```

Inside the client, list tools. You should see exactly:

- `kapibara_preflight`
- `kapibara_action_risk`
- `kapibara_compare`
- `kapibara_scan_sensitive`
- `kapibara_rules_check`

## Troubleshooting

**No tools appear.** Check the command path, run `npx -y @kapibara/mcp --version`,
and restart the client. Some clients cache the tool list.

**Rules are ignored.** Confirm the file is `.kapibara/rules.md` in the workspace
the server was started with. Use `--cwd` if the client starts elsewhere.

**A file scan is refused.** Paths must stay inside the workspace. Directories are
not scanned. Pass one explicit file, or use `files` in preflight.

**The decision is more cautious than expected.** Call `kapibara_action_risk` to
see which factors and issues drive the score. Then call `kapibara_rules_check`
to see which rules match.

**The rules file is broken.** Preflight reports `failure: "rules_unavailable"`.
The configured `failMode` decides whether to block, warn, or continue.
