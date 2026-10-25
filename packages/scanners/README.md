# @kapibara/scanners

Local secret and prompt-injection scanning for Kapibara.

```bash
pnpm add @kapibara/scanners
```

```ts
import { scanSensitiveText, scanSensitiveFile } from "@kapibara/scanners";

const text = scanSensitiveText("OPENAI_API_KEY=sk-proj-<fake>");
console.log(text.findings[0]?.redactedValue);

const file = await scanSensitiveFile("config/production.env", {
  cwd: process.cwd(),
});
```

## What it detects

- private keys
- OpenAI, Anthropic, GitHub, AWS, Stripe, Google, Slack, and npm tokens
- JWTs and bearer tokens
- credential-bearing URLs and database URLs
- environment-style secrets
- generic API keys and password assignments

Placeholders and references such as `your_api_key`, `${VAR}`,
`process.env.KEY`, `<secret>`, and `***` are suppressed.

## API

### `scanSensitiveText(text, options?)`

Options: `source`, `maxBytes` (default 2,000,000), `maxFindings` (default 500).

Returns findings with `type`, `severity`, `redactedValue`, `location`, and an
optional `label`, plus `scannedBytes` and `truncated`.

### `scanSensitiveFile(path, options?)`

Options: `cwd`, `maxBytes` (default 1,000,000), `allowOutsideCwd`,
`maxFindings`.

Resolves real paths, rejects paths outside the workspace, rejects directories,
skips binary files, and reads at most `maxBytes`. Throws `ScanError` with a
code: `not_found`, `not_a_file`, `outside_workspace`, `read_failed`, or
`too_many_files`.

### `scanSensitiveFiles(paths, options?)`

Scans an explicit list (default maximum 100). It does not crawl directories.

### `scanPromptInjection(text, options?)`

Reports instruction-like content with type, severity, line, and pattern. It does
not execute or follow the content.

### Redaction helpers

`redactGeneric`, `redactLabeled`, `redactBearer`, `redactPrivateKey`,
`redactUrl`, and `isPlaceholderSecret`.

## Guarantees

- Raw values are not included in `SensitiveFinding`.
- File access is confined to the workspace unless library code explicitly
  opts out.
- No network access.
- Directories are never walked.

Detection is regex-based. A clean scan is not proof that content is safe. See the
root [security documentation](../../docs/security.md).

## License

MIT
