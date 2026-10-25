---
name: second-opinion
description: Adversarially review another model's or agent's planned action before it runs. Use when a plan, command, migration, deployment, or outbound message needs an independent safety check, or when the user asks for a second opinion.
---

# Second opinion

Use this skill to challenge a plan you did not write. The goal is to find the
failure mode the first agent missed, not to agree politely.

## Workflow

1. Restate the proposed action in one sentence: verb, target, environment, and
   expected effect.
2. List what the plan assumes but does not verify.
3. Run `kapibara_action_risk` to expose the deterministic risk factors.
4. Run `kapibara_preflight` on the exact action, target, and context. Add
   `context.metadata.command` or `context.metadata.content` when relevant.
5. If the plan cites figures, versions, or recipients, run
   `kapibara_compare` against the source material.
6. Return a verdict and the smallest safer alternative.

## Review questions

- Is the target the real production resource, or a name that looks similar?
- What is the rollback path, and has it been tested?
- Is the action reversible? If not, who approved it?
- Does the payload contain credentials or personal data?
- Is the scope wider than the user asked for?
- Does the plan rely on an assumption that a quick read would falsify?
- Would a staging run answer the question more cheaply?

## Output format

```text
Verdict: AGREE | AGREE WITH CHANGES | DO NOT PROCEED
Kapibara: <decision> (<risk>, score <n>)
Main concern: <one sentence>
Evidence: <tool issues, mismatches, or missing verification>
Safer alternative: <one concrete change>
```

## Rules

- Do not soften a `BLOCK`. Report it as a block.
- Do not invent tool output. If Kapibara was not called, say so.
- Distinguish a missing check from a failed check.
- If the plan is fine, say so briefly. Do not manufacture risk.
- Keep secrets redacted in the review.
