# @kapibara/policy

Markdown rules, topic matching, precedence, and conflict resolution for
Kapibara.

```bash
pnpm add @kapibara/policy
```

```ts
import { loadRuleSet, evaluateRules } from "@kapibara/policy";

const rules = await loadRuleSet({
  cwd: process.cwd(),
  profile: "balanced",
});

const evaluation = evaluateRules(rules, {
  action: "git push",
  target: "origin/main",
});

console.log(evaluation.decision); // "approval"
```

## Rule files

| Level   | Path                       | Precedence |
| ------- | -------------------------- | ---------- |
| Project | `<cwd>/.kapibara/rules.md` | highest    |
| Global  | `~/.kapibara/rules.md`     | middle     |
| Default | built-in profile           | lowest     |

```markdown
# BLOCK

- Never force push to main.

# APPROVAL

- Ask before production deployments.

# WARN

- Warn before editing generated files.

# ALLOW

- Allow reading documentation.
```

Inline effects are supported:

```markdown
- [block] Never publish the roadmap.
- [approval] Ask before changing the billing plan.
```

## API

### `loadRuleSet(options?)`

Loads and merges the profile, global rules, and project rules. Returns:

```ts
interface RuleSet {
  profile: "balanced" | "developer" | "strict" | "custom";
  rules: NormalizedRule[];
  conflicts: RuleConflict[];
  sources: string[];
}
```

Options: `cwd`, `homeDir`, `profile`, `projectRulesPath`, `globalRulesPath`,
`includeDefaults`.

### `evaluateRules(ruleSet, input)`

Returns matches, effective rules, conflicts, a decision (`allow`, `warn`,
`approval`, `block`, or `null`), and matched IDs.

### Other exports

- `parseRulesMarkdown`, `parseRuleFile`, `slugifyRuleId`
- `inferTopics`, `conditionKey`, `normalizeForMatching`, `fallbackTokens`
- `getProfileMarkdown`, `RULE_PROFILES`, `PROFILE_NAMES`, `isRuleProfile`
- `RuleLoadError`

## Precedence

1. Project beats global beats default.
2. The stronger effect wins within the same condition.
3. Conflicting effects become `approval`.
4. A non-overridable secret block stays `block`.

A `BLOCK` rule is overridable by an explicit user request unless it concerns
secrets or `.env` files. Overridden blocks still require approval.

## Profiles

Canonical profile text lives in `src/profiles.ts`; mirrors live in the
repository's `rules/` directory and are checked by tests.

## License

MIT
