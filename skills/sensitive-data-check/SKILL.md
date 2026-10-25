---
name: sensitive-data-check
description: Scan explicit text or one explicit file for secrets with Kapibara before sharing, committing, uploading, or publishing. Use when content may contain API keys, tokens, passwords, private keys, or credentials. Never crawls directories and never returns raw values.
---

# Sensitive data check

Use `kapibara_scan_sensitive` before content leaves the workspace or enters
version control.

## Workflow

Scan text:

```json
{
  "text": "OPENAI_API_KEY=<value>"
}
```

Scan exactly one file inside the workspace:

```json
{
  "path": "config/production.env"
}
```

Do not pass a directory. Kapibara does not crawl. If you need several files,
call the tool once per file or pass an explicit `files` array to
`kapibara_preflight`.

## Reading the result

- `findings` contains the type, severity, location, and a redacted value.
- `counts` summarizes findings by severity and type.
- `truncated` means the size limit was reached. Do not assume the rest is clean.
- `skippedReason` means the file was intentionally skipped.
- Errors use `isError: true` and a code such as `outside_workspace`,
  `not_found`, or `not_a_file`.

## Rules

- Never reconstruct, guess, or print a secret from a redacted value.
- Never send the raw secret to another tool, model, log, or remote service.
- If a secret is found, stop the outbound action. Remove the value, rotate it if
  it was exposed, and use a secret manager or environment variable.
- Report only the finding type, location, and redacted value.
- Scanning is not sanitization. A clean scan does not prove content is safe.

## Preflight integration

For an upload, publish, share, or email, prefer `kapibara_preflight` with
`context.metadata.content` or an explicit `files` list. It combines the secret
scan with action risk and project rules, and blocks critical secrets from
leaving the workspace.
