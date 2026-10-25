# MCP tools

The Kapibara MCP server exposes exactly five tools. All are annotated
`readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, and
`openWorldHint: false`.

The server does not crawl the filesystem. File access requires an explicit file
path. Audit logging, when enabled, is the only workspace write.

## Response shape

Success:

```json
{
  "content": [{ "type": "text", "text": "<summary>\n\n<pretty JSON>" }],
  "structuredContent": {
    "summary": "<summary>",
    "data": {}
  }
}
```

Failure:

```json
{
  "content": [{ "type": "text", "text": "<summary>\n\n<pretty JSON>" }],
  "isError": true
}
```

Failures do not include `structuredContent`. Invalid input is rejected by the
MCP SDK with `isError: true` and an `Input validation error` message.

## `kapibara_preflight`

The full gate. Use it immediately before a side-effecting action.

### Input

| Field                     | Type                 | Required | Description                                                                                                  |
| ------------------------- | -------------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| `action`                  | string, 1–500 chars  | yes      | Concrete verb, e.g. `deploy`, `delete file`, `send email`.                                                   |
| `target`                  | string, ≤4000 chars  | no       | Exact path, branch, environment, recipient, package, or resource.                                            |
| `intent`                  | string, ≤20000 chars | no       | The user's intent. Used for rule matching.                                                                   |
| `context.environment`     | string               | no       | e.g. `production`, `staging`.                                                                                |
| `context.reversible`      | boolean              | no       | Whether the action can be undone.                                                                            |
| `context.production`      | boolean              | no       | Marks production impact.                                                                                     |
| `context.external`        | boolean              | no       | Marks an external side effect.                                                                               |
| `context.financialImpact` | non-negative number  | no       | Amount at risk.                                                                                              |
| `context.scope`           | string               | no       | Scope description.                                                                                           |
| `context.metadata`        | object               | no       | Extra fields. `command`, `content`, `branch`, `files`, `migration`, `environment`, and `recursive` are used. |
| `files`                   | string[], ≤100       | no       | Explicit workspace-relative files to scan.                                                                   |
| `scanTarget`              | boolean              | no       | Scan the single named target for outbound actions. Defaults to `true`.                                       |

```json
{
  "action": "deploy",
  "target": "production",
  "intent": "Release 2.4.1 after the user approved the changelog.",
  "context": {
    "environment": "production",
    "reversible": false,
    "production": true
  }
}
```

### Data

```ts
{
  result: {
    decision: "allow" | "warn" | "require_approval" | "block";
    risk: "low" | "medium" | "high" | "critical";
    score: number;
    issues: Array<{
      type: string;
      severity: "low" | "medium" | "high" | "critical";
      message: string;
      evidence?: string[];
      recommendation?: string;
      blocking?: boolean;
    }>;
    matchedRules: string[];
    recommendation?: string;
    requiresUserApproval: boolean;
    action?: string;
    factors?: Array<{ name: string; score: number; max: number; reason: string }>;
    ruleConflicts?: Array<{
      conditionKey: string;
      winner: string;
      losers: string[];
      appliedEffect: string;
      reason: string;
    }>;
    scan?: {
      sources: string[];
      findings: number;
      truncated: boolean;
      skipped: string[];
    };
  };
  rules: {
    profile: string;
    sources: string[];
    conflicts: number;
  };
  audit?: { written: boolean; path?: string; error?: string };
  failure?: "rules_unavailable" | "preflight_error";
  configError?: string;
}
```

`failure` means the check could not use the configured rules or hit an
unexpected error. Read `result.decision` and the configured fail mode; do not
treat a failure as an implicit ALLOW.

### Scanning behavior

- `context.metadata.content` is scanned for secrets and prompt injection.
- Every path in `files` is scanned. Directories and paths outside the workspace
  fail the scan.
- When `scanTarget` is true and the action is outbound or a deployment, the
  single `target` path is scanned.
- Missing target files are ignored for target scanning. Missing explicit files
  are reported in `scan.skipped`.
- No other file is read.

## `kapibara_action_risk`

Classify and score an action without project rules or file access.

### Input

Same as preflight, without `files` and `scanTarget`.

### Data

```ts
{
  action: ActionId;
  category: "read" | "modify" | "delete" | "outbound" | "deploy" |
            "database" | "financial" | "execute" | "permission" | "unknown";
  decision: Decision;
  risk: RiskLevel;
  score: number;
  factors: RiskFactor[];
  issues: KapibaraIssue[];
  recommendation: string;
  requiresUserApproval: boolean;
}
```

Use this to explain risk or compare alternatives. It is advisory; preflight is
the binding check because it applies rules and scans content.

## `kapibara_compare`

Find conflicting facts across two or more named sources.

### Input

```ts
{
  sources: Array<{ name: string; content: string }>; // 2–20 sources
}
```

### Data

```ts
{
  matches: boolean;
  checked: string[];
  issues: Array<{
    type: string;
    severity: RiskLevel;
    message: string;
    values: Record<string, string>;
    recommendation?: string;
  }>;
}
```

Checked categories: `amount`, `currency`, `date`, `version`, `node_version`,
`url`, `email`, `filename`, `identifier`, `percentage`, `quantity`.

`matches: true` means no conflicting values were extracted. It does not prove
the sources agree about everything.

## `kapibara_scan_sensitive`

Scan explicit text or one explicit file.

### Input

Provide exactly one of `text` or `path`.

| Field      | Type                          | Description                                                   |
| ---------- | ----------------------------- | ------------------------------------------------------------- |
| `text`     | string, ≤2,000,000 chars      | Text to scan.                                                 |
| `path`     | string, ≤4000 chars           | One workspace-relative or absolute file inside the workspace. |
| `maxBytes` | positive integer, ≤10,000,000 | Scan limit.                                                   |

```json
{ "path": "config/production.env" }
```

### Data

```ts
{
  findings: Array<{
    type: string;
    severity: "low" | "medium" | "high" | "critical";
    redactedValue: string;
    location: { line: number; column: number; source?: string };
    label?: string;
  }>;
  source?: string;
  scannedBytes: number;
  truncated: boolean;
  skippedReason?: string;
  counts: {
    total: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
  };
}
```

`skippedReason: "binary"` means a NUL byte was found in the first 8 KiB. The
file is not scanned further. `truncated: true` means the size limit was reached.

### Errors

| Code                | Meaning                                             |
| ------------------- | --------------------------------------------------- |
| `invalid_input`     | Neither or both of `text` and `path` were provided. |
| `outside_workspace` | The resolved path is outside the workspace.         |
| `not_found`         | The path does not exist.                            |
| `not_a_file`        | The path is not a regular file.                     |
| `too_many_files`    | More than the allowed file count.                   |
| `read_failed`       | The file could not be read.                         |
| `scan_failed`       | An unexpected scanner error.                        |

## `kapibara_rules_check`

Evaluate rules for an action without scanning files.

### Input

Same as preflight, plus:

| Field     | Type                                              | Description                                    |
| --------- | ------------------------------------------------- | ---------------------------------------------- |
| `profile` | `balanced` \| `developer` \| `strict` \| `custom` | Override the configured profile for this call. |

### Data

```ts
{
  decision: Decision;
  profile: string;
  sources: string[];
  matchedRules: string[];
  effective: Array<{
    id: string;
    text: string;
    level: "default" | "global" | "project";
    source: string;
    effect: "allow" | "warn" | "approval" | "block";
    appliedEffect: "allow" | "warn" | "approval" | "block";
    overriddenByUserRequest: boolean;
    reason: string;
  }>;
  conflicts: Array<{
    conditionKey: string;
    winner: string;
    losers: string[];
    appliedEffect: string;
    reason: string;
  }>;
  ruleSetConflicts: Array<{
    id: string;
    winner: string;
    loser: string;
    reason: string;
  }>;
}
```

If the rules cannot be loaded, the tool returns `isError: true` with code
`rules_unavailable`. It does not fall back to defaults silently.

## Error handling for agents

- Treat `isError: true` as a failed check, not a pass.
- Treat `failure` in preflight data according to the configured fail mode.
- Never retry a blocked action with a broader or vaguer target.
- Never ask a different tool to do the same action after a block.
- Tell the user what failed and what you need from them.
