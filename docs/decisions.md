# Decision model

Kapibara returns exactly one decision:

```text
ALLOW | WARN | REQUIRE_APPROVAL | BLOCK
```

The decision is deterministic. The same input, rules, and files produce the same
result.

## Pipeline

1. **Validate** the input with Zod.
2. **Classify** the action into one of 21 action profiles.
3. **Detect target signals** such as `.env`, private keys, backups, databases,
   financial documents, generated files, and production targets.
4. **Scan explicit content and files** when provided. Content is scanned for
   secrets and prompt injection. Directories are never crawled.
5. **Evaluate rules** from project, global, and profile sources.
6. **Compute six factors** and sum them into a raw score.
7. **Apply floors** from issue severity, blocking issues, and rule decisions.
8. **Decide** using the precedence below.
9. **Redact** secrets in output and optionally write a sanitized audit record.

## Risk factors

| Factor                  | Max | Main inputs                                                                          |
| ----------------------- | --- | ------------------------------------------------------------------------------------ |
| `destructive_impact`    | 25  | action baseline, production, financial impact, broad scope, valuable targets         |
| `reversibility`         | 20  | action baseline, `context.reversible`                                                |
| `sensitive_data`        | 20  | action baseline, target signals, detected secrets, financial data                    |
| `external_side_effects` | 15  | action baseline, `context.external`, financial impact, broad scope                   |
| `production_impact`     | 10  | production action, production environment, production target                         |
| `uncertainty`           | 10  | unknown action, environment mismatch, failed scan, prompt injection, secret findings |

Each factor reports its score, maximum, and a human-readable reason. The raw
score is the sum, clamped to 0–100.

### Score floors

An issue's severity sets a minimum score:

| Severity | Floor |
| -------- | ----- |
| low      | 0     |
| medium   | 25    |
| high     | 50    |
| critical | 75    |
| blocking | 85    |

A rule decision also sets a floor:

| Rule effect | Floor |
| ----------- | ----- |
| allow       | 0     |
| warn        | 25    |
| approval    | 50    |
| block       | 85    |

### Risk bands

| Score  | Risk     |
| ------ | -------- |
| 0–24   | low      |
| 25–49  | medium   |
| 50–74  | high     |
| 75–100 | critical |

## Decision precedence

```text
blocking issue or BLOCK rule        → BLOCK
APPROVAL rule                       → REQUIRE_APPROVAL
critical or high issue              → REQUIRE_APPROVAL
score >= 50                         → REQUIRE_APPROVAL
WARN rule                           → WARN
medium issue                        → WARN
score >= 25                         → WARN
otherwise                           → ALLOW
```

`requiresUserApproval` is true for both `REQUIRE_APPROVAL` and `BLOCK`.

## Worked examples

### Read a file

```json
{ "action": "read file", "target": "README.md" }
```

- classification: `read_file`
- factors: 2 uncertainty
- score: 2
- decision: `ALLOW`

### Delete a temporary file

```json
{ "action": "delete file", "target": "tmp/report.txt" }
```

- classification: `delete_file`
- factors: destructive 12, reversibility 12, uncertainty 4
- score: 28
- decision: `WARN`

### Delete a production database backup

```json
{ "action": "delete file", "target": "production database backup" }
```

- classification: `delete_file`
- target signals: `database_backup`
- issue: `database_backup`, critical
- balanced rules: approval for deleting backups and destructive database work
- score: 75
- decision: `REQUIRE_APPROVAL`

### Force push to main

```json
{
  "action": "force push",
  "target": "origin/main",
  "context": { "metadata": { "branch": "main" } }
}
```

- classification: `git_force_push`
- issue: `protected_branch_force_push`, critical, blocking
- balanced rule: `never-force-push-to-main`
- score: 85
- decision: `BLOCK`

### Upload content with a secret

```json
{
  "action": "upload file",
  "target": "report.txt",
  "context": {
    "metadata": { "content": "OPENAI_API_KEY=sk-proj-<fake>" }
  }
}
```

- classification: `upload`
- issue: `external_publication`, medium
- issue: `sensitive_data`, critical, blocking because the action is outbound
- score: 85
- decision: `BLOCK`

The raw secret is never returned. Evidence contains a redacted value and a
location.

## Rule conflicts

Two kinds of conflict can occur:

1. **Within one rule set.** Two matching rules share a condition topic but
   disagree about the effect. The higher-precedence rule wins. If effects
   differ, the applied effect becomes `approval`, unless a non-overridable
   secret block is involved, in which case it becomes `block`.
2. **Across rule definitions.** The same rule ID exists at different levels with
   different effects. The higher level wins, but the disagreement is reported
   and forces `approval` (or `block` for a non-overridable secret rule).

Conflicts are included in `ruleConflicts` and as `rule_conflict` issues.

## Fail modes

When the rules file cannot be read or parsed, preflight still returns a result
with `failure: "rules_unavailable"`.

| `failMode`   | Behavior                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------ |
| `risk_based` | Use the action's base score. Low scores warn, medium scores require approval, high scores block. |
| `closed`     | Block with score at least 90.                                                                    |
| `open`       | Warn with score capped below 50.                                                                 |

The default is `risk_based`. A broken safety file should be visible and should
not silently become `ALLOW`.

## What the decision is not

- It is not a probability.
- It is not a sandbox.
- It does not prove an action is safe.
- It does not replace least-privilege credentials or backups.

It is a consistent checkpoint with inspectable evidence.
