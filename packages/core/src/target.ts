import type { ActionClassification, KapibaraIssue, RiskLevel, TargetSignal } from "./types.js";

interface SignalDefinition {
  type: string;
  pattern: RegExp;
  baseSeverity: RiskLevel;
  tags: string[];
  message: string;
  recommendation: string;
  blockingCategories: TargetSignal["blockingCategories"];
}

const SIGNALS: SignalDefinition[] = [
  {
    type: "env_file",
    pattern: /(^|[\\/])\.env(\.[a-z0-9_-]+)?$/i,
    baseSeverity: "high",
    tags: ["env_file", "secrets"],
    message: "The target appears to be an environment file that may contain credentials.",
    recommendation: "Keep .env files out of commits, uploads, logs, and public artifacts.",
    blockingCategories: ["outbound", "deploy"],
  },
  {
    type: "private_key",
    pattern: /(^|[\\/])id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$|\.(pem|key)$/i,
    baseSeverity: "critical",
    tags: ["private_key", "secrets"],
    message: "The target appears to be a private key or key material.",
    recommendation: "Never publish or share private keys. Rotate the key if it was exposed.",
    blockingCategories: ["outbound", "deploy"],
  },
  {
    type: "credentials_file",
    pattern:
      /(^|[\\/])(credentials?|secrets?|service-account)(\.[a-z0-9_-]+)?$|service-account.*\.json$/i,
    baseSeverity: "high",
    tags: ["credentials", "secrets"],
    message: "The target appears to contain credentials.",
    recommendation: "Keep credential files local and rotate any exposed values.",
    blockingCategories: ["outbound", "deploy"],
  },
  {
    type: "database_backup",
    pattern:
      /(backup|bak|dump|snapshot).*(database|db|prod|production|sql|postgres|mysql)|(database|db|prod|production|sql|postgres|mysql).*(backup|bak|dump|snapshot)|\.(dump|bak)$/i,
    baseSeverity: "critical",
    tags: ["backup", "database", "data"],
    message: "The target appears to be a database backup or dump.",
    recommendation: "Keep or archive the backup unless deletion is explicitly confirmed.",
    blockingCategories: ["outbound", "deploy"],
  },
  {
    type: "database_file",
    pattern: /\.(db|sqlite|sqlite3|mdb)$/i,
    baseSeverity: "high",
    tags: ["database", "data"],
    message: "The target appears to be a database file.",
    recommendation: "Treat the database file as sensitive and preserve a backup.",
    blockingCategories: ["outbound"],
  },
  {
    type: "financial_document",
    pattern: /tax[-_]?return|invoice|payroll|bank[-_]?statement|financial|salary/i,
    baseSeverity: "high",
    tags: ["financial", "data"],
    message: "The target appears to be a personal or financial document.",
    recommendation: "Handle the document as sensitive personal data.",
    blockingCategories: ["outbound"],
  },
  {
    type: "certificate_bundle",
    pattern: /\.(p12|pfx)$/i,
    baseSeverity: "high",
    tags: ["certificate", "secrets"],
    message: "The target appears to be a certificate bundle that may include a private key.",
    recommendation: "Do not publish certificate bundles that contain private key material.",
    blockingCategories: ["outbound"],
  },
  {
    type: "secret_named_file",
    pattern: /(^|[\\/])[^\\/]*(secret|token|password|passwd|apikey|api[-_]key)[^\\/]*$/i,
    baseSeverity: "high",
    tags: ["secrets"],
    message: "The target filename suggests it contains secret material.",
    recommendation: "Keep secret material out of external actions and version control.",
    blockingCategories: ["outbound"],
  },
  {
    type: "backup_file",
    pattern: /(backup|\.bak|snapshot)/i,
    baseSeverity: "medium",
    tags: ["backup"],
    message: "The target appears to be a backup.",
    recommendation: "Prefer archiving over permanent deletion.",
    blockingCategories: ["outbound"],
  },
  {
    type: "production_target",
    pattern: /\b(prod|production)\b/i,
    baseSeverity: "medium",
    tags: ["production"],
    message: "The target references a production environment.",
    recommendation: "Confirm the target and rollback plan before changing production.",
    blockingCategories: [],
  },
  {
    type: "generated_file",
    pattern:
      /(^|[\\/])(dist|build|coverage|\.next|node_modules)([\\/]|$)|lockfile|package-lock|pnpm-lock|yarn\.lock/i,
    baseSeverity: "low",
    tags: ["generated"],
    message: "The target appears to be generated output or a lockfile.",
    recommendation: "Change the source and regenerate the output instead of editing it directly.",
    blockingCategories: [],
  },
];

export function detectTargetSignals(target: string | undefined): TargetSignal[] {
  if (!target) {
    return [];
  }
  const signals: TargetSignal[] = [];
  for (const definition of SIGNALS) {
    if (definition.pattern.test(target)) {
      signals.push({
        type: definition.type,
        baseSeverity: definition.baseSeverity,
        tags: definition.tags,
        message: definition.message,
        recommendation: definition.recommendation,
        blockingCategories: definition.blockingCategories,
      });
    }
  }
  return signals;
}

function downgrade(severity: RiskLevel): RiskLevel {
  switch (severity) {
    case "critical":
      return "high";
    case "high":
      return "medium";
    case "medium":
      return "low";
    case "low":
      return "low";
  }
}

function readSeverity(signal: TargetSignal): RiskLevel {
  if (signal.tags.includes("backup") || signal.tags.includes("financial")) {
    return "low";
  }
  if (signal.tags.includes("credentials") || signal.tags.includes("private_key")) {
    return "medium";
  }
  if (signal.tags.includes("env_file")) {
    return "medium";
  }
  return downgrade(signal.baseSeverity);
}

function issueSeverity(signal: TargetSignal, classification: ActionClassification): RiskLevel {
  if (classification.category === "read") {
    return readSeverity(signal);
  }

  const outbound = signal.blockingCategories.includes(classification.category);
  if (outbound) {
    return "critical";
  }

  if (classification.category === "delete" || classification.id === "overwrite_file") {
    if (
      signal.tags.includes("backup") ||
      signal.tags.includes("database") ||
      signal.tags.includes("data") ||
      signal.tags.includes("credentials") ||
      signal.tags.includes("private_key")
    ) {
      return "critical";
    }
    return "high";
  }

  if (classification.category === "modify") {
    if (
      signal.tags.includes("credentials") ||
      signal.tags.includes("private_key") ||
      signal.tags.includes("env_file") ||
      signal.tags.includes("backup") ||
      signal.tags.includes("database")
    ) {
      return "high";
    }
    return signal.baseSeverity;
  }

  return signal.baseSeverity;
}

export function targetIssues(
  target: string | undefined,
  classification: ActionClassification,
): KapibaraIssue[] {
  const issues: KapibaraIssue[] = [];
  const signals = detectTargetSignals(target);
  const hasDatabaseBackup = signals.some((signal) => signal.type === "database_backup");

  for (const signal of signals) {
    if (signal.type === "production_target") {
      continue;
    }
    if (signal.type === "backup_file" && hasDatabaseBackup) {
      continue;
    }

    const severity = issueSeverity(signal, classification);
    const outbound = signal.blockingCategories.includes(classification.category);
    const blocking = outbound && severity === "critical";

    let message = signal.message;
    if (classification.category === "delete" && signal.tags.includes("backup")) {
      message = "The target appears to be a database backup. Deleting it may be irreversible.";
    } else if (outbound && signal.tags.includes("secrets")) {
      message = `${signal.message} It would leave the local environment.`;
    }

    issues.push({
      type: signal.type,
      severity,
      message,
      evidence: [`target: ${target ?? "unknown"}`],
      recommendation: signal.recommendation,
      ...(blocking ? { blocking: true } : {}),
    });
  }
  return issues;
}

export function targetTags(target: string | undefined): string[] {
  return [...new Set(detectTargetSignals(target).flatMap((signal) => signal.tags))];
}
