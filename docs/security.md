# Security

Kapibara is a local safety checkpoint for agent actions. This document describes
what it protects, what it does not, and the assumptions behind the design.

## Goals

1. Keep every check local. No account, network call, or telemetry.
2. Never return a raw secret value.
3. Read only files the caller explicitly names, and only inside the workspace.
4. Make a failed check visible instead of silently allowing the action.
5. Treat scanned content as untrusted data.
6. Produce deterministic decisions that can be reviewed and tested.

## Non-goals

Kapibara is not:

- a sandbox, container runtime, or syscall filter
- an operating-system permission system
- a malware or antivirus scanner
- a data-loss-prevention product
- a guarantee that an action is safe
- a replacement for backups, least-privilege credentials, or human review

An agent with local code execution can bypass an in-process check. Use
Kapibara together with real isolation.

## Secret handling

The scanner catalog covers private keys, OpenAI, Anthropic, GitHub, AWS, Stripe,
Google, Slack, npm, JWTs, bearer tokens, credential-bearing URLs, database URLs,
environment-style secrets, generic API keys, and password assignments.

Values are redacted before they enter a `SensitiveFinding`. Evidence strings use
the redacted value and a location. Tests assert that fake raw values never appear
in serialized handler, server, or audit output.

Placeholders and references are suppressed, including:

- `your_api_key`, `example_token`, `changeme`, `redacted`
- `${VAR}`, `process.env.*`, `os.environ`, `getenv`
- `<...>`, `***`, `[redacted]`, `xxxx`

This reduces noise, but it also means a real value that looks like a placeholder
may be skipped.

### Limits

- Patterns are regex-based and can miss unusual formats, encoded values, split
  values, or secrets in binary files.
- The scanner reads at most the configured byte limit. Content after the limit
  is not scanned.
- Findings are capped. A truncated scan does not prove the rest is clean.
- Redaction preserves a short prefix/suffix for some patterns. Do not treat a
  redacted value as safe to share.

## File access

`scanSensitiveFile`:

1. Resolves the path against the workspace.
2. Resolves the real path and the real workspace root, following symlinks.
3. Rejects a real path outside the workspace unless library code explicitly sets
   `allowOutsideCwd`.
4. Rejects directories and non-regular files.
5. Reads at most `maxBytes`.
6. Skips files with a NUL byte in the first 8 KiB and reports `binary`.

The MCP tools never set `allowOutsideCwd`. The `kapibara_scan_sensitive` tool
accepts one file. `kapibara_preflight` accepts at most 100 explicit files and
never walks a directory.

A path that is exactly the workspace root is rejected as outside the workspace;
it is a directory and would be rejected anyway.

## Prompt injection

Scanned text is data, not instructions. The prompt-injection scanner reports
instruction-like patterns such as "ignore previous instructions", role changes,
or attempts to reveal a system prompt. Findings become a medium
`prompt_injection_content` issue and add uncertainty. They do not change the
agent's instructions, and Kapibara never executes scanned content.

Detection is heuristic. It can miss paraphrases and can flag quoted examples.

## Audit log

Off by default. When enabled:

- one JSONL record per preflight call
- stored under `<workspace>/.kapibara/logs/`
- contains action, target, decision, risk, score, matched rule IDs, and issue
  types
- does not contain raw content, evidence strings, scan locations, or secrets
- action and target are truncated and control characters are replaced
- old files are pruned by date

The audit log is not tamper-evident. A local attacker can edit or delete it.

## Failure behavior

A rules file that cannot be read produces `failure: "rules_unavailable"` and a
decision based on `failMode`:

- `risk_based`: keep the risk-based decision
- `closed`: block
- `open`: warn

The default is `risk_based`. A config error is reported as `configError` while
defaults are used. A scanner error adds a `sensitive_scan_failed` issue.

None of these paths silently returns `ALLOW` for a failed check.

## Data flow

```text
agent input ──► local process ──► local files
                    │
                    ├─ no network
                    ├─ no telemetry
                    ├─ no account
                    └─ optional local audit file
```

There is no remote logging, crash reporting, update check, or model call.

## Threat model

Kapibara is designed for mistakes and over-broad agent behavior:

- an agent that misreads a target
- an agent that includes a secret in an upload
- an agent that force pushes a shared branch
- an agent that deploys or deletes more than the user asked for
- an agent that follows instructions found in fetched content

It is not designed to stop a malicious local user who controls the process,
the rules file, or the Node.js runtime. Protect the workspace and credentials
with normal operating-system controls.

## Reporting

Follow [SECURITY.md](../SECURITY.md). Do not include a live secret in a report.
