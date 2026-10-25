const TOPIC_PATTERNS: Record<string, RegExp> = {
  force_push: /force[\s_-]*push|forcepush/,
  push: /\b(push|pushes|pushing|pushed)\b/,
  protected_branch: /\b(main|master|protected\s+branch|default\s+branch)\b/,
  secrets:
    /\b(secret|secrets|credential|credentials|api[\s_-]*key|api[\s_-]*keys|token|tokens|password|passwords|passwd|private[\s_-]*key|private[\s_-]*keys|access[\s_-]*key|access[\s_-]*keys)\b|(^|\s)\.env\b/,
  env_file: /(^|\s)\.env\b|\benv\s+files?\b|\benvironment\s+files?\b/,
  backup: /\b(backup|backups|snapshot|snapshots|dump|dumps)\b/,
  database: /\b(database|databases|db|schema|schemas|table|tables|migration|migrations)\b/,
  delete:
    /\b(delete|deletes|deleting|deletion|remove|removes|removing|removal|erase|erases|erasing|destroy|destroys|destroying|drop|drops|dropping|truncate|truncates|truncating|rm|unlink)\b/,
  recursive: /\b(recursive|recursively|rm\s+-rf|entire|whole|everything|all\s+files|broad)\b/,
  deploy:
    /\b(deploy|deploys|deploying|deployment|deployments|release|releases|releasing|ship|ships|shipping)\b/,
  production: /\b(production|prod)\b/,
  external: /\b(external|externally|outside|third[\s-]*party)\b/,
  email: /\b(email|emails|e-mail|e-mails)\b/,
  outbound:
    /\b(commit|commits|committing|push|pushes|pushing|publish|publishes|publishing|upload|uploads|uploading|share|shares|sharing|send|sends|sending|expose|exposes|exposing|log|logs|logging|transmit|transmits|transmitting)\b/,
  publish:
    /\b(publish|publishes|publishing|upload|uploads|uploading|share|shares|sharing|send|sends|sending)\b/,
  modify:
    /\b(modify|modifies|modifying|change|changes|changing|edit|edits|editing|update|updates|updating|write|writes|writing|overwrite|overwrites|overwriting|replace|replaces|replacing)\b/,
  overwrite: /\b(overwrite|overwrites|overwriting|replace|replaces|replacing)\b/,
  auth_config:
    /\b(authentication|auth|oauth|jwt|session|sessions|security\s+config(?:uration)?|security\s+settings?)\b/,
  config: /\b(config|configs|configuration|configurations|settings?)\b/,
  generated:
    /\b(generated|generated\s+files?|lockfile|lock\s+file|dist|build\s+output|build\s+artifacts?)\b/,
  shell: /\b(shell|terminal|command|commands|bash|zsh|powershell|rm\s+-rf|exec|executing)\b/,
  purchase:
    /\b(purchase|purchases|purchasing|buy|buys|buying|pay|pays|payment|payments|transfer|transfers|transaction|transactions)\b/,
  financial: /\b(financial|finance|billing|invoice|invoices|tax|payroll|bank)\b/,
  permissions: /\b(chmod|chown|permission|permissions|acl|role|roles|sudo)\b/,
  archive:
    /\b(archive|archives|archiving|keep|keeps|retain|retains|retaining|preserve|preserves|preserving)\b/,
  irreversible: /\b(irreversible|permanent|permanently|unrecoverable|forever)\b/,
  data: /\b(data|customer|customers|pii|personal|sensitive)\b/,
};

export function normalizeForMatching(text: string): string {
  return text.toLowerCase().replace(/_/g, " ").replace(/[’']/g, "").replace(/\s+/g, " ").trim();
}

export function inferTopics(text: string): string[] {
  const normalized = normalizeForMatching(text);
  const topics: string[] = [];
  for (const [topic, pattern] of Object.entries(TOPIC_PATTERNS)) {
    if (pattern.test(normalized)) {
      topics.push(topic);
    }
  }
  return topics;
}

const FALLBACK_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "any",
  "are",
  "as",
  "ask",
  "at",
  "automatically",
  "be",
  "before",
  "by",
  "do",
  "does",
  "for",
  "from",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "never",
  "no",
  "not",
  "of",
  "on",
  "only",
  "or",
  "should",
  "than",
  "that",
  "the",
  "their",
  "then",
  "this",
  "to",
  "use",
  "user",
  "when",
  "with",
  "without",
  "warn",
  "warning",
  "require",
  "required",
  "always",
  "allow",
  "block",
  "approval",
  "file",
  "files",
  "folder",
  "folders",
  "change",
  "changes",
  "action",
  "actions",
  "project",
  "rule",
  "rules",
  "kapibara",
]);

export function fallbackTokens(text: string): string[] {
  return normalizeForMatching(text)
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token.length >= 3 && !FALLBACK_STOPWORDS.has(token));
}

export function conditionKey(topics: string[]): string {
  return [...new Set(topics)].sort().join("+");
}
