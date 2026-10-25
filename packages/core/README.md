# @kapibara/core

Deterministic preflight risk engine for AI agent actions.

```bash
pnpm add @kapibara/core
```

```ts
import { preflight, formatPreflightResult } from "@kapibara/core";

const result = await preflight({
  action: "force push",
  target: "origin/main",
  context: { metadata: { branch: "main" } },
});

console.log(formatPreflightResult(result));
// Decision: BLOCK
```

## What it does

- classifies an action into one of 21 profiles
- detects target signals such as `.env`, private keys, backups, databases, and
  production resources
- scans explicit content and files for secrets and prompt injection
- evaluates markdown rules from `@kapibara/policy`
- computes six risk factors and a 0–100 score
- returns `allow`, `warn`, `require_approval`, or `block`

## API

### `preflight(input, options?)`

```ts
const result = await preflight(
  {
    action: "deploy",
    target: "production",
    intent: "Release after approval.",
    context: { production: true, reversible: false },
  },
  {
    cwd: process.cwd(),
    rules: ruleSet, // optional RuleSet from @kapibara/policy
    scanFiles: ["a.txt"], // explicit files only
    scanTarget: true, // outbound target only
  },
);
```

`preflight` validates input with Zod and throws `KapibaraValidationError` for
invalid input. It reads only explicit files and the outbound target. It never
crawls directories and never writes.

### `assessActionRisk(input)`

Classify and score without rules or file access. Returns the action ID, category,
factors, issues, decision, and recommendation.

### `compareSources(sources)`

Compare two or more named text sources for conflicting amounts, currencies,
dates, versions, Node.js versions, URLs, emails, filenames, identifiers,
percentages, and quantities.

### Helpers

- `classifyAction`, `getActionProfile`, `getActionFactors`, `ACTION_IDS`
- `computeFactors`, `scoreFactors`, `riskFromScore`, `applyScoreFloors`
- `decide`, `buildRecommendation`
- `detectTargetSignals`, `targetIssues`, `targetTags`
- `loadConfig`, `configPaths`, `DEFAULT_CONFIG`
- `createAuditEvent`, `appendAuditEvent`
- `formatPreflightResult`, `formatActionRisk`, `formatComparison`
- `evaluateRulesForInput`
- Zod schemas and exported types

## Result

```ts
interface PreflightResult {
  decision: "allow" | "warn" | "require_approval" | "block";
  risk: "low" | "medium" | "high" | "critical";
  score: number;
  issues: KapibaraIssue[];
  matchedRules: string[];
  recommendation?: string;
  requiresUserApproval: boolean;
  action?: ActionId;
  factors?: RiskFactor[];
  scan?: PreflightScanSummary;
  ruleConflicts?: RuleConflictMatch[];
}
```

## Security

- no network calls
- no telemetry
- secrets are redacted before entering findings
- file scans are confined to the workspace
- audit logging is opt-in and sanitized

Kapibara is a heuristic checkpoint, not a sandbox. See the root
[security documentation](../../docs/security.md).

## License

MIT
