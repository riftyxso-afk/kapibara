---
name: consistency-check
description: Compare two or more text sources for conflicting amounts, currencies, dates, versions, URLs, emails, filenames, identifiers, percentages, or quantities. Use before sending an invoice, publishing a report, merging documents, or acting on figures that appear in more than one place.
---

# Consistency check

Use `kapibara_compare` when the same fact appears in multiple sources and a
mismatch would change what you do.

## Workflow

1. Give each source a short, stable name.
2. Pass the relevant text, not the whole document, when possible.
3. Call `kapibara_compare`.
4. If `matches` is false, stop and resolve the mismatch with the user.

```json
{
  "sources": [
    { "name": "invoice", "content": "Total: $1,200 due 2026-11-01" },
    { "name": "email", "content": "Total: $1,500 due 2026-11-01" }
  ]
}
```

## What it checks

- amounts and currencies
- dates
- versions and Node.js versions
- URLs, emails, and filenames
- identifiers
- percentages and quantities

Each issue includes the conflicting values keyed by source name, a severity, and
a recommendation.

## Rules

- Two sources with no overlapping values are not proof of consistency. The
  comparison only reports conflicting values it can extract.
- Treat a mismatch as unresolved until a human or an authoritative source
  settles it.
- Do not average, reconcile, or silently pick one value.
- Keep source content local. Kapibara does not send it anywhere.
- For a high-stakes action, follow the comparison with `kapibara_preflight`.
