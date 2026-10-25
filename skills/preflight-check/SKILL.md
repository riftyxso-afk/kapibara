---
name: preflight-check
description: Run a Kapibara preflight before any action that changes files, sends data, deploys, spends money, changes permissions, or rewrites history. Use when an agent is about to act and needs a binding ALLOW, WARN, REQUIRE_APPROVAL, or BLOCK decision.
---

# Preflight check

Use this skill immediately before a side-effecting action, not after it.

## Workflow

1. Describe the action precisely. Include the verb, the exact target, and the
   user's intent. Vague actions produce vague risk.
2. Add context the engine cannot infer: environment, reversibility, production,
   external exposure, financial impact, branch, command, or content.
3. Call `kapibara_preflight`.
4. Obey the returned decision exactly. Do not reinterpret it.

```json
{
  "action": "deploy",
  "target": "production",
  "intent": "Release version 2.4.1 after the user approved the changelog.",
  "context": {
    "environment": "production",
    "reversible": false,
    "production": true
  }
}
```

## Decisions

| Decision           | What to do                                                                     |
| ------------------ | ------------------------------------------------------------------------------ |
| `ALLOW`            | Proceed.                                                                       |
| `WARN`             | Proceed carefully and tell the user the warning and its evidence.              |
| `REQUIRE_APPROVAL` | Stop. Ask the user for explicit approval for this exact action and target.     |
| `BLOCK`            | Do not proceed. Report the blocking issue and evidence. Never route around it. |

`REQUIRE_APPROVAL` is not permission to ask a rhetorical question and continue.
Wait for a real answer. If the user changes the action, run preflight again.

## Input tips

- `target` is the single most important field. Use the real path, branch,
  environment, recipient, package, or resource name.
- Put shell text in `context.metadata.command`.
- Put message or document text in `context.metadata.content` when it will be
  sent or published. Kapibara scans it for secrets and prompt injection.
- Put a branch name in `context.metadata.branch`.
- List explicit files to scan in `files`. Never pass a directory and never ask
  Kapibara to crawl the workspace.
- Set `scanTarget: false` only when the named target is not a local file.

## Rules

- Never claim a decision came from Kapibara unless you called the tool.
- Never expose raw secrets. Kapibara redacts values; keep them redacted.
- If the tool reports `failure: "rules_unavailable"`, follow the configured fail
  mode and tell the user. Do not silently downgrade a failure to ALLOW.
- A previous ALLOW does not cover a new target or a changed command. Run it
  again.
