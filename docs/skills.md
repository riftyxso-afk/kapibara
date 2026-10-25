# Skills

Skills teach an agent when and how to use Kapibara. They are plain `SKILL.md`
files with YAML frontmatter, compatible with Claude Code and OpenCode.

## Available skills

| Skill                                                             | Trigger                        | What it does                                                |
| ----------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------- |
| [`preflight-check`](../skills/preflight-check/SKILL.md)           | Before a side-effecting action | Calls `kapibara_preflight` and enforces the four decisions. |
| [`action-risk`](../skills/action-risk/SKILL.md)                   | Planning or explaining risk    | Calls `kapibara_action_risk` and interprets the factors.    |
| [`sensitive-data-check`](../skills/sensitive-data-check/SKILL.md) | Content may contain secrets    | Calls `kapibara_scan_sensitive` and keeps values redacted.  |
| [`consistency-check`](../skills/consistency-check/SKILL.md)       | The same fact appears twice    | Calls `kapibara_compare` and stops on mismatches.           |
| [`second-opinion`](../skills/second-opinion/SKILL.md)             | Reviewing another agent's plan | Combines risk, preflight, and comparison into a verdict.    |
| [`setup`](../skills/setup/SKILL.md)                               | Installing or troubleshooting  | Connects the MCP server and configures rules.               |

## Frontmatter

Each skill starts with:

```yaml
---
name: preflight-check
description: Run a Kapibara preflight before any action that changes files, ...
---
```

`name` matches the directory. `description` is written to trigger on the
situations where the skill is useful, not to summarize the whole file.

## How an agent should use them

1. Load `preflight-check` before acting.
2. Load `sensitive-data-check` when the payload may contain credentials.
3. Load `consistency-check` when figures or identifiers come from multiple
   sources.
4. Load `second-opinion` when reviewing a plan written by another model.
5. Load `action-risk` when the user asks why something is risky.
6. Load `setup` when the tools are missing or misconfigured.

Skills are guidance, not enforcement. The server returns the decision; the agent
must respect it.

## Installing as a Claude Code plugin

This repository includes:

- `.claude-plugin/plugin.json`
- `.mcp.json`
- `skills/`

Add the repository as a local plugin or marketplace source in Claude Code. The
plugin exposes the five MCP tools and the six skills. The MCP server is launched
with `npx -y @kapibara/mcp`.

## Installing skills in OpenCode

OpenCode discovers skills from configured skill directories. Point it at this
repository's `skills/` directory, or copy the six directories into your global
skill directory.

Each skill assumes the Kapibara MCP server is available. If it is not, the agent
should say so instead of pretending a check ran.

## Writing a new skill

- Put it in `skills/<name>/SKILL.md`.
- Use a specific `description` with trigger language.
- Include exact tool names and input shapes.
- Include the decision-handling rules.
- State what the skill must not do.
- Keep it short enough to load into context.

Do not add a skill that tells the agent to bypass `BLOCK`, hide a warning, or
reconstruct a redacted secret.
