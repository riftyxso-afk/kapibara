# Contributing

Thanks for helping make agent actions safer. Kapibara is a small, deterministic
tool, and contributions should keep it that way.

## Development setup

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm typecheck
pnpm eval
```

Node.js 20 or newer and pnpm 10 are required.

## Before opening a pull request

- Add or update tests for behavior changes.
- Keep the five MCP tool names and their purpose stable.
- Never add a network call, telemetry, account requirement, or cloud lookup.
- Never return a raw secret value from a scanner or tool.
- Keep file scanning opt-in and confined to the workspace.
- Update the relevant docs, schema, or example when the public surface changes.
- Run `pnpm format:check`.
- Run all required commands above and include the results in the pull request.

## Design constraints

- Decisions are exactly `ALLOW`, `WARN`, `REQUIRE_APPROVAL`, or `BLOCK`.
- The engine is deterministic. Avoid randomness, wall-clock-dependent decisions,
  and model calls.
- Rules are markdown with explicit effects. Do not add an opaque policy language.
- Prefer small dependencies. Explain any new runtime dependency.
- Keep package boundaries acyclic: `mcp → core → policy/scanners`.
- Error messages should tell the agent what to do next without leaking data.

## Adding a secret pattern

Add the pattern to `packages/scanners/src/patterns.ts`, including:

- a specific `type`
- a severity
- a redaction function
- a test with a fake value
- a test proving the raw value never appears in serialized output

Use obviously fake values in tests. Never commit a real credential.

## Adding a rule profile

Profile markdown is canonical in `packages/policy/src/profiles.ts`. Mirror it in
`rules/<profile>.md`; the consistency test verifies that the files match. Add a
test for the behavior the profile is meant to change.

## Adding an eval

Add a JSON case to `evals/cases/`. Each case needs a `name`, an `input`, and an
`expect` object with at least a `decision`. Prefer cases that pin a behavior a
future refactor could break. Run `pnpm eval`.

## Commit style

Use a short imperative subject. Keep the body focused on why the change is
needed. Do not include secrets, tokens, or private user data in commits, logs,
or issue reports.

## Code of conduct

Be direct about code and generous with people. Harassment, discrimination, and
personal attacks are not welcome. Maintainers may remove content or contributions
that violate this standard.

## Security

Do not open a public issue for a vulnerability. Follow [SECURITY.md](./SECURITY.md).
