# Configuration

Kapibara reads two JSON config files:

| Level   | Path                          |
| ------- | ----------------------------- |
| Global  | `~/.kapibara/config.json`     |
| Project | `<cwd>/.kapibara/config.json` |

Project values override global values, which override defaults.

## Options

```json
{
  "profile": "balanced",
  "auditLog": false,
  "failMode": "risk_based",
  "auditRetentionDays": 7
}
```

| Key                  | Type                                              | Default      | Description                           |
| -------------------- | ------------------------------------------------- | ------------ | ------------------------------------- |
| `profile`            | `balanced` \| `developer` \| `strict` \| `custom` | `balanced`   | Default rule profile.                 |
| `auditLog`           | boolean                                           | `false`      | Write sanitized JSONL audit records.  |
| `failMode`           | `risk_based` \| `closed` \| `open`                | `risk_based` | Behavior when rules cannot be loaded. |
| `auditRetentionDays` | integer 1–365                                     | `7`          | Delete audit files older than this.   |

Unknown keys are allowed and preserved, so a newer config does not break an
older server.

## Profiles

- **balanced** — blocks secret exposure and force pushes to main; approval for
  production deployments, destructive database work, backups, and email.
- **developer** — balanced plus protected-branch pushes, destructive shell
  commands, package publishing, and production config changes.
- **strict** — developer plus approval for any deletion, any push, any upload or
  publish, external communication, purchases, permission changes, and shell
  commands.
- **custom** — no profile defaults; only project and global rules.

The profile can be overridden per `kapibara_rules_check` call with the `profile`
input. `kapibara_preflight` uses the configured profile.

## Fail modes

A rules file that cannot be read or parsed does not silently disappear.

| Mode         | Behavior                                                                         |
| ------------ | -------------------------------------------------------------------------------- |
| `risk_based` | Use the action's base score. The result includes `failure: "rules_unavailable"`. |
| `closed`     | `BLOCK`, score at least 90.                                                      |
| `open`       | `WARN`, score capped below 50.                                                   |

The same mechanism applies to unexpected preflight errors.

## Audit log

Set `"auditLog": true` to append one JSONL record per preflight call:

```text
<workspace>/.kapibara/logs/audit-YYYY-MM-DD.jsonl
```

Record shape:

```json
{
  "timestamp": "2026-10-24T12:00:00.000Z",
  "action": "upload file",
  "target": "report.txt",
  "risk": "critical",
  "decision": "block",
  "score": 85,
  "matchedRules": ["never-expose-secrets"],
  "issueTypes": ["external_publication", "sensitive_data"]
}
```

The record contains no raw content, secret values, evidence strings, or scan
locations. Action and target are truncated and control characters are replaced.
Files older than `auditRetentionDays` are removed when a new record is written.

Audit logging is the only write the MCP server performs in the workspace. It is
off by default.

## Config errors

Invalid JSON or an invalid known value produces a `configError` in the preflight
data. Kapibara falls back to defaults for the affected values and continues. It
does not hide the error.

Example:

```json
{
  "summary": "🦫 Kapibara preflight\n...",
  "data": {
    "result": { "decision": "allow", "risk": "low", "score": 2 },
    "rules": { "profile": "balanced", "sources": ["default:balanced"], "conflicts": 0 },
    "configError": "Config file is not valid JSON: /project/.kapibara/config.json"
  }
}
```

## Environment variables

Kapibara has no required environment variables. It does not read API keys or
tokens. The server uses its process working directory unless `--cwd` is passed.

## Schemas

Machine-readable schemas:

- [`schemas/config.schema.json`](../schemas/config.schema.json)
- [`schemas/preflight-input.schema.json`](../schemas/preflight-input.schema.json)
- [`schemas/eval-case.schema.json`](../schemas/eval-case.schema.json)
