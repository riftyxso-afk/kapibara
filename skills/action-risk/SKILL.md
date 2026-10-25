---
name: action-risk
description: Explain why an action is risky using Kapibara's deterministic classifier, factors, issues, and score. Use when planning an action, comparing alternatives, or explaining a risk assessment without loading project rules or scanning files.
---

# Action risk

Use `kapibara_action_risk` when you need the reasoning, not a binding gate. It
classifies the action and returns deterministic factors, issues, a risk level,
and a decision without reading project rules or files.

## Workflow

1. Call `kapibara_action_risk` with `action`, `target`, and optional `intent` and
   `context`.
2. Read the factors in order. They explain the score:
   - destructive impact
   - reversibility
   - sensitive data
   - external side effects
   - production impact
   - uncertainty
3. Read the issues. Each issue carries severity, evidence, and a recommendation.
4. Use the result to choose a safer alternative, not to argue with a
   `kapibara_preflight` decision.

```json
{
  "action": "drop database",
  "target": "production",
  "context": { "environment": "production" }
}
```

## How to use the result

- Prefer a reversible alternative when `reversibility` is the largest factor.
- Narrow the target when `uncertainty` is high.
- Remove secrets from the payload when `sensitive_data` is present.
- Stage externally visible work locally when `external_side_effects` is high.
- If the action is `unknown`, rewrite it as a concrete verb and target.

## Boundaries

- This tool is advisory. `kapibara_preflight` is the binding check because it
  also applies project, global, and default rules and can scan explicit content.
- Do not present the score as a probability. It is a deterministic heuristic.
- Do not ask this tool to scan files; it never reads the filesystem.
