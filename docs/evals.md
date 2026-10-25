# Evals

Kapibara ships 15 end-to-end decision evals. They pin behavior that a refactor
could quietly change.

## Run

```bash
pnpm eval
```

The script builds the workspace, then runs `evals/run-evals.ts` with `tsx`.

Output:

```text
Kapibara eval suite
Profile: balanced
Cases: 15

PASS 01-read-only.json  read-only file access
PASS 02-edit-local-file.json  edit a local source file
...
Summary: 15/15 passed, 0 failed
```

A failure prints the expected and actual values and exits with code 1.

## Case format

Each file in `evals/cases/` is JSON:

```json
{
  "name": "delete a production database backup",
  "description": "Backups require explicit approval.",
  "input": {
    "action": "delete file",
    "target": "production database backup"
  },
  "expect": {
    "decision": "require_approval",
    "action": "delete_file",
    "risk": "critical",
    "issues": ["database_backup"],
    "matchedRules": ["ask-before-deleting-database-backups"]
  }
}
```

### Expectations

| Field           | Meaning                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------- |
| `decision`      | Required. Exact decision.                                                                   |
| `action`        | Optional. Exact classified action ID.                                                       |
| `risk`          | Optional. Exact risk level.                                                                 |
| `issues`        | Optional. Required issue types. An empty array asserts no issues.                           |
| `matchedRules`  | Optional. Required rule IDs. An empty array asserts no matches.                             |
| `forbiddenText` | Optional. Strings that must not appear in the serialized result. Use it to prove redaction. |

### Runner behavior

- Loads the `balanced` profile from a temporary workspace, so local project
  rules do not affect results.
- Calls `preflight` with `scanTarget: false`.
- Compares the result to the expectation.
- Checks `forbiddenText` against `JSON.stringify(result)`.
- Cleans up its temporary directories.

## Current coverage

The suite covers:

1. read-only allow
2. local edit warning
3. plain file deletion warning
4. database backup deletion approval
5. recursive deletion approval
6. protected branch push approval
7. force push block
8. production deployment approval
9. external email approval
10. database drop approval
11. secret upload block with redaction
12. purchase approval
13. permission change approval
14. staging deployment warning
15. prompt-injection content with an outbound email

## Adding a case

1. Copy an existing case.
2. Give it a unique, descriptive filename, numbered in order.
3. Use a concrete action and target.
4. Run `pnpm eval` and inspect the actual decision before writing expectations.
5. Add the case only when the behavior is intentional.

Use fake secrets only. Never put a real credential in a case.

## What evals do not cover

- MCP transport behavior (covered by `packages/mcp/tests/server.test.ts`)
- handler-level error handling (covered by `packages/mcp/tests/handlers.test.ts`)
- every secret pattern (covered by `packages/scanners/tests`)
- rule parser edge cases (covered by `packages/policy/tests`)

Use the Vitest suite for unit and integration coverage; use evals for the final
decision.
