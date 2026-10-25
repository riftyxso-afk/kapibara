# Rules and profiles

Kapibara rules are markdown. They are meant to be read and edited by humans.

## File locations

| Level   | Path                       | Precedence |
| ------- | -------------------------- | ---------- |
| Project | `<cwd>/.kapibara/rules.md` | highest    |
| Global  | `~/.kapibara/rules.md`     | middle     |
| Default | built-in profile           | lowest     |

Project rules override global rules with the same ID. Global rules override
defaults. Different IDs accumulate.

## Format

```markdown
# BLOCK

- Never force push to main.
- Never expose secrets.

# APPROVAL

- Ask before production deployments.
- Ask before deleting customer records.

# WARN

- Warn before editing generated files.

# ALLOW

- Allow reading documentation.
```

Supported effect headings:

| Heading                                                  | Effect   |
| -------------------------------------------------------- | -------- |
| `# BLOCK`, `# DENY`, `# FORBID`, `# NEVER`               | block    |
| `# APPROVAL`, `# REQUIRE_APPROVAL`, `# ASK`, `# CONFIRM` | approval |
| `# WARN`, `# WARNING`, `# CAUTION`                       | warn     |
| `# ALLOW`, `# PERMIT`                                    | allow    |

Headings can be any level (`#`, `##`, `###`, ...). Bullets can use `-`, `*`, `+`,
or a number. Code fences are ignored. Lines that are not headings or bullets
are ignored.

### Inline effects

An inline label overrides the current section:

```markdown
- [block] Never publish the internal roadmap.
- [approval] Ask before changing the billing plan.
- [warn] Warn before touching the migration folder.
- [allow] Allow reading the changelog.
```

`[require_approval]` is accepted as a synonym for `[approval]`.

## Rule IDs

An ID is a slug of the rule text, limited to 80 characters:

```text
Never force push to main. → never-force-push-to-main
```

Duplicate IDs within one file get a numeric suffix: `rule-id-2`, `rule-id-3`.
Across levels, the same ID is treated as the same rule for precedence.

Keep rule text stable if you rely on the ID in audit records or tests.

## Matching

Rules match by topic. Kapibara infers topics from the rule text and from the
action, target, intent, context, and metadata. Topics cover areas such as:

- git push, force push, protected branches
- deployment and production
- deletion, recursive deletion, overwrites
- databases, migrations, backups
- secrets, `.env` files, credentials
- email, upload, publish, external communication
- purchases, permissions, shell commands
- generated files, authentication configuration

Rules without a recognized topic fall back to keyword matching against the input.
A custom rule matches when at least two keywords overlap, or one distinctive
keyword of at least six characters overlaps.

This is intentionally simple. If a custom rule does not match, add concrete words
that appear in the action or target.

## Precedence and conflicts

Within one evaluation:

1. Project rules beat global rules beat defaults.
2. For rules with the same level and matching condition, the stronger effect
   wins (`block` > `approval` > `warn` > `allow`).
3. If matching rules disagree about the effect, the applied effect becomes
   `approval`.
4. If any disagreeing rule is a non-overridable block, the applied effect becomes
   `block`.

Across definitions of the same rule ID, the higher level wins, but the
disagreement is reported. It also forces `approval` or `block`.

Use `kapibara_rules_check` to inspect `effective`, `conflicts`, and
`ruleSetConflicts` before relying on a rule.

## Overridable blocks

A `BLOCK` rule is normally overridable by an explicit user request. When the
request is explicit, the applied effect becomes `approval`, not `block`. The
agent still has to ask.

Secret-related blocks are **not** overridable:

- rules whose topics include `secrets` or `env_file`
- rules containing words such as `exfiltrate`, `expose`, `leak`, `send secret`,
  or `publish secret`

This protects against a user request that would publish credentials.

## Profiles

Canonical profile text lives in `packages/policy/src/profiles.ts`. Mirrors live
in `rules/`.

### Balanced

```markdown
# BLOCK

- Never expose secrets.
- Never commit .env files.
- Never force push to main.

# APPROVAL

- Ask before production deployments.
- Ask before destructive database operations.
- Ask before deleting database backups.
- Ask before sending emails.

# WARN

- Warn before recursive file deletion.
- Warn before overwriting recent backups.
- Warn when modifying authentication configuration.
```

### Developer

Balanced plus approval for:

- pushing to protected branches
- destructive shell commands
- publishing packages
- changing production configuration

and a warning when modifying generated files.

### Strict

Developer plus approval for:

- deleting any file
- any git push
- publishing or uploading anything
- external communications
- purchases
- permission changes
- any shell command

### Custom

`profile: "custom"` disables profile defaults. Only project and global rules
apply. Use this when a project has its own complete policy.

## Testing rules

```bash
pnpm test -- packages/policy/tests/evaluator.test.ts
```

The profile consistency test verifies that `rules/*.md` matches the canonical
strings. If you edit one, edit both.

## Limitations

- Matching is lexical, not semantic. A paraphrase may not match.
- Rules cannot execute code or call external services.
- Rules cannot inspect file contents directly. Use preflight's explicit scan
  inputs for that.
- A rule can only produce an effect; it cannot lower the risk score below an
  issue floor.
