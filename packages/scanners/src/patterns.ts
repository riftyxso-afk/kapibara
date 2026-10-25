import {
  redactBearer,
  redactGeneric,
  redactLabeled,
  redactPrivateKey,
  redactUrl,
} from "./redact.js";
import type { ScanSeverity } from "./types.js";

export interface SecretPattern {
  type: string;
  severity: ScanSeverity;
  regex: RegExp;
  valueGroup?: number;
  labelGroup?: number;
  redact: (value: string, match: RegExpExecArray) => string;
}

export const SECRET_PATTERNS: SecretPattern[] = [
  {
    type: "private_key",
    severity: "critical",
    regex:
      /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP |ENCRYPTED )?PRIVATE KEY-----[\s\S]{0,20000}?(?:-----END (?:RSA |EC |OPENSSH |DSA |PGP |ENCRYPTED )?PRIVATE KEY-----|$)/g,
    redact: (value) => redactPrivateKey(value),
  },
  {
    type: "openai_api_key",
    severity: "critical",
    regex: /\bsk-(?!ant-)(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{16,}\b/g,
    redact: (value) => redactGeneric(value, 8, 4),
  },
  {
    type: "anthropic_api_key",
    severity: "critical",
    regex: /\bsk-ant-[A-Za-z0-9_-]{16,}\b/g,
    redact: (value) => redactGeneric(value, 8, 4),
  },
  {
    type: "github_token",
    severity: "critical",
    regex: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
    redact: (value) => redactGeneric(value, 4, 4),
  },
  {
    type: "aws_access_key_id",
    severity: "critical",
    regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
    redact: (value) => redactGeneric(value, 4, 4),
  },
  {
    type: "aws_secret_access_key",
    severity: "critical",
    regex: /\baws_?secret_?access_?key\b\s*[:=]\s*["']?([A-Za-z0-9/+=]{30,})["']?/gi,
    valueGroup: 1,
    redact: (value) => redactGeneric(value, 4, 4),
  },
  {
    type: "stripe_secret_key",
    severity: "critical",
    regex: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g,
    redact: (value) => redactGeneric(value, 8, 4),
  },
  {
    type: "stripe_webhook_secret",
    severity: "critical",
    regex: /\bwhsec_[A-Za-z0-9]{16,}\b/g,
    redact: (value) => redactGeneric(value, 6, 4),
  },
  {
    type: "jwt",
    severity: "high",
    regex: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    redact: (value) => redactGeneric(value, 6, 4),
  },
  {
    type: "google_api_key",
    severity: "critical",
    regex: /\bAIza[0-9A-Za-z_-]{30,}\b/g,
    redact: (value) => redactGeneric(value, 6, 4),
  },
  {
    type: "slack_token",
    severity: "critical",
    regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
    redact: (value) => redactGeneric(value, 4, 4),
  },
  {
    type: "npm_token",
    severity: "critical",
    regex: /\bnpm_[A-Za-z0-9]{30,}\b/g,
    redact: (value) => redactGeneric(value, 4, 4),
  },
  {
    type: "database_url_with_credentials",
    severity: "critical",
    regex:
      /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|rediss|amqp|amqps|mssql|sqlserver):\/\/[^\s:/@]+:[^\s/@]+@[^\s"'`<>]+/gi,
    redact: (value) => redactUrl(value),
  },
  {
    type: "database_url",
    severity: "high",
    regex:
      /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|rediss|amqp|amqps|mssql|sqlserver):\/\/[^\s"'`<>]+/gi,
    redact: (value) => redactUrl(value),
  },
  {
    type: "credential_url",
    severity: "high",
    regex: /\b(?:https?|ftp):\/\/[^\s:/@]+:[^\s/@]+@[^\s"'`<>]+/gi,
    redact: (value) => redactUrl(value),
  },
  {
    type: "bearer_token",
    severity: "high",
    regex: /\bBearer\s+([A-Za-z0-9._~+/=-]{12,})/g,
    valueGroup: 1,
    redact: (value) => redactBearer(value),
  },
  {
    type: "env_secret",
    severity: "high",
    regex:
      /\b([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|PWD|CREDENTIALS?|PRIVATE_KEY|ACCESS_KEY|CLIENT_SECRET|DATABASE_URL|WEBHOOK_SECRET)[A-Z0-9_]*)\s*[:=]\s*["']?([^\s"'#]{4,})["']?/g,
    valueGroup: 2,
    labelGroup: 1,
    redact: (value, match) => redactLabeled(match[1] ?? "SECRET", value),
  },
  {
    type: "generic_api_key",
    severity: "high",
    regex:
      /\b(?:api[_-]?key|apikey|access[_-]?token|auth[_-]?token|client[_-]?secret|secret[_-]?key)\b\s*[:=]\s*["']?([A-Za-z0-9_\-./+=]{16,})["']?/gi,
    valueGroup: 1,
    redact: (value) => redactGeneric(value, 4, 4),
  },
  {
    type: "password_assignment",
    severity: "high",
    regex: /\b(?:password|passwd|pwd)\b\s*[:=]\s*["']?([^\s"'#]{4,})["']?/gi,
    valueGroup: 1,
    redact: (value) => redactGeneric(value, 2, 2),
  },
];

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /^(?:your|my|example|sample|dummy|test|placeholder|changeme|change_me|redacted|hidden|secret|password|string|number|boolean|null|undefined|true|false|required|optional|todo|tbd)$/i,
  /^(?:your|my|example|sample|dummy|placeholder|changeme|change_me|redacted|hidden)[_-](?:api[_-]?key|apikey|access[_-]?token|auth[_-]?token|token|secret|password|passwd|key|value|here)(?:[_-].*)?$/i,
  /\$\{/,
  /process\.env/i,
  /os\.environ/i,
  /getenv/i,
  /^<.*>$/,
  /^\*+$/,
  /^\[.*\]$/,
  /^x{4,}$/i,
  // A known key prefix followed only by filler, e.g. sk_live_xxxxxxxx or ghp_********.
  /^[A-Za-z0-9]{0,12}(?:[_-][A-Za-z0-9]{1,12}){0,3}[_-]?(?:x{6,}|\*{6,})$/i,
];

export function isPlaceholderSecret(value: string): boolean {
  const trimmed = value.trim().replace(/^["']|["']$/g, "");
  if (trimmed.length === 0) {
    return true;
  }
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}
