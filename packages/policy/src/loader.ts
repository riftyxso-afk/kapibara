import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { parseRulesMarkdown } from "./parser.js";
import { getProfileMarkdown, isRuleProfile } from "./profiles.js";
import type { NormalizedRule, RuleConflict, RuleLevel, RuleProfile, RuleSet } from "./types.js";

export interface LoadRuleSetOptions {
  cwd?: string;
  homeDir?: string;
  profile?: RuleProfile | "custom";
  projectRulesPath?: string;
  globalRulesPath?: string;
  includeDefaults?: boolean;
}

export class RuleLoadError extends Error {
  readonly path: string;

  constructor(path: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RuleLoadError";
    this.path = path;
  }
}

async function readOptionalFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw new RuleLoadError(path, `Could not read rules file: ${path}`, { cause: error });
  }
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

const LEVEL_RANK: Record<RuleLevel, number> = {
  default: 1,
  global: 2,
  project: 3,
};

export function parseRuleFile(content: string, path: string, level: RuleLevel): NormalizedRule[] {
  return parseRulesMarkdown(content, { source: path, level });
}

function mergeRules(rules: NormalizedRule[]): {
  rules: NormalizedRule[];
  conflicts: RuleConflict[];
} {
  const byId = new Map<string, NormalizedRule>();
  const conflicts: RuleConflict[] = [];

  for (const rule of rules) {
    const existing = byId.get(rule.id);
    if (!existing) {
      byId.set(rule.id, rule);
      continue;
    }

    const winner = LEVEL_RANK[rule.level] >= LEVEL_RANK[existing.level] ? rule : existing;
    const loser = winner === rule ? existing : rule;

    if (winner.effect !== loser.effect) {
      conflicts.push({
        id: rule.id,
        winner,
        loser,
        reason: `${winner.level} rule overrides ${loser.level} rule with a different effect`,
      });
    }

    byId.set(rule.id, winner);
  }

  return {
    rules: [...byId.values()].sort((a, b) => {
      const levelDelta = LEVEL_RANK[b.level] - LEVEL_RANK[a.level];
      return levelDelta !== 0 ? levelDelta : a.id.localeCompare(b.id);
    }),
    conflicts,
  };
}

export async function loadRuleSet(options: LoadRuleSetOptions = {}): Promise<RuleSet> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const home = resolve(options.homeDir ?? homedir());
  const requestedProfile = options.profile ?? "balanced";
  const profile: RuleProfile =
    requestedProfile === "custom" || !isRuleProfile(requestedProfile)
      ? "balanced"
      : requestedProfile;

  const sources: string[] = [];
  const collected: NormalizedRule[] = [];

  if (options.includeDefaults !== false) {
    const defaultSource = `default:${profile}`;
    collected.push(...parseRuleFile(getProfileMarkdown(profile), defaultSource, "default"));
    sources.push(defaultSource);
  }

  const globalPath = resolve(options.globalRulesPath ?? join(home, ".kapibara", "rules.md"));
  const globalContent = await readOptionalFile(globalPath);
  if (globalContent !== null) {
    collected.push(...parseRuleFile(globalContent, globalPath, "global"));
    sources.push(globalPath);
  }

  const projectPath = resolve(options.projectRulesPath ?? join(cwd, ".kapibara", "rules.md"));
  const projectContent = await readOptionalFile(projectPath);
  if (projectContent !== null) {
    collected.push(...parseRuleFile(projectContent, projectPath, "project"));
    sources.push(projectPath);
  }

  const merged = mergeRules(collected);
  return {
    profile: requestedProfile,
    rules: merged.rules,
    conflicts: merged.conflicts,
    sources,
  };
}
