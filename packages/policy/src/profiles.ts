import type { RuleProfile } from "./types.js";

const BALANCED = `# BLOCK

- Never expose secrets.
- Never commit .env files.
- Never force push to main.

# APPROVAL

- Ask before production deployments.
- Ask before destructive database operations.
- Ask before deleting database backups.
- Ask before sending emails.

# WARN

- Warn before recursive file deletion.
- Warn before overwriting recent backups.
- Warn when modifying authentication configuration.
`;

const DEVELOPER = `${BALANCED}
# Developer safeguards

## APPROVAL

- Ask before pushing to protected branches.
- Ask before running destructive shell commands.
- Ask before publishing packages.
- Ask before changing production configuration.

## WARN

- Warn when modifying generated files.
`;

const STRICT = `${DEVELOPER}
# Strict safeguards

## APPROVAL

- Ask before deleting any files.
- Ask before any git push.
- Ask before publishing or uploading anything.
- Ask before external communications.
- Ask before purchases.
- Ask before permission changes.
- Ask before any shell command.
`;

export const RULE_PROFILES: Record<RuleProfile, string> = {
  balanced: BALANCED,
  developer: DEVELOPER,
  strict: STRICT,
};

export const PROFILE_NAMES: RuleProfile[] = ["balanced", "developer", "strict"];

export function getProfileMarkdown(profile: RuleProfile): string {
  return RULE_PROFILES[profile];
}

export function isRuleProfile(value: string): value is RuleProfile {
  return (PROFILE_NAMES as string[]).includes(value);
}
