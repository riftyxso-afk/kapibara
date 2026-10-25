import { conditionKey, fallbackTokens, inferTopics, normalizeForMatching } from "./topics.js";
import type {
  EffectiveRule,
  NormalizedRule,
  RuleConflictMatch,
  RuleEffect,
  RuleEvaluation,
  RuleMatch,
  RuleMatchInput,
  RuleSet,
} from "./types.js";

const EFFECT_RANK: Record<RuleEffect, number> = {
  allow: 0,
  warn: 1,
  approval: 2,
  block: 3,
};

const LEVEL_RANK = {
  default: 1,
  global: 2,
  project: 3,
} as const;

const METADATA_KEYS = [
  "command",
  "file",
  "files",
  "path",
  "branch",
  "environment",
  "migration",
  "scope",
  "description",
  "reason",
] as const;

function metadataStrings(metadata: Record<string, unknown> | undefined): string[] {
  if (!metadata) {
    return [];
  }
  const values: string[] = [];
  for (const key of METADATA_KEYS) {
    const value = metadata[key];
    if (typeof value === "string") {
      values.push(value);
    } else if (Array.isArray(value)) {
      values.push(value.filter((item) => typeof item === "string").join(" "));
    }
  }
  return values;
}

function buildHaystack(input: RuleMatchInput): string {
  const context = input.context;
  const flags: string[] = [];
  if (context?.production || /\b(prod|production)\b/i.test(context?.environment ?? "")) {
    flags.push("production");
  }
  if (context?.external) {
    flags.push("external");
  }
  if (context?.reversible === false) {
    flags.push("irreversible");
  }
  if (context?.metadata?.recursive === true) {
    flags.push("recursive");
  }
  if (input.explicitUserRequest || context?.metadata?.explicitUserRequest === true) {
    flags.push("explicit request");
  }

  return normalizeForMatching(
    [
      input.action,
      input.target ?? "",
      input.intent ?? "",
      context?.environment ?? "",
      flags.join(" "),
      input.signals?.join(" ") ?? "",
      metadataStrings(context?.metadata).join(" "),
    ].join(" "),
  );
}

function fallbackMatch(rule: NormalizedRule, haystack: string): string | null {
  const ruleTokens = fallbackTokens(rule.text);
  const inputTokens = new Set(fallbackTokens(haystack));
  const overlap = ruleTokens.filter((token) => inputTokens.has(token));
  const distinctive = overlap.filter((token) => token.length >= 6);
  if (overlap.length >= 2 || distinctive.length >= 1) {
    return `Matched custom rule keywords: ${overlap.join(", ")}`;
  }
  return null;
}

export function evaluateRules(ruleSet: RuleSet, input: RuleMatchInput): RuleEvaluation {
  const haystack = buildHaystack(input);
  const inputTopics = new Set(inferTopics(haystack));
  const explicitUserRequest =
    input.explicitUserRequest === true || input.context?.metadata?.explicitUserRequest === true;

  const matches: RuleMatch[] = [];
  for (const rule of ruleSet.rules) {
    let reason: string | null = null;
    if (rule.topics.length > 0) {
      const missing = rule.topics.filter((topic) => !inputTopics.has(topic));
      if (missing.length === 0) {
        reason = `Matched rule topics: ${rule.topics.join(", ")}`;
      }
    } else {
      reason = fallbackMatch(rule, haystack);
    }

    if (reason) {
      matches.push({ rule, reason });
    }
  }

  matches.sort((a, b) => {
    const levelDelta = LEVEL_RANK[b.rule.level] - LEVEL_RANK[a.rule.level];
    if (levelDelta !== 0) return levelDelta;
    const effectDelta = EFFECT_RANK[b.rule.effect] - EFFECT_RANK[a.rule.effect];
    if (effectDelta !== 0) return effectDelta;
    return a.rule.id.localeCompare(b.rule.id);
  });

  const groups = new Map<string, RuleMatch[]>();
  for (const match of matches) {
    const key =
      match.rule.topics.length > 0 ? conditionKey(match.rule.topics) : `id:${match.rule.id}`;
    const group = groups.get(key) ?? [];
    group.push(match);
    groups.set(key, group);
  }

  const effective: EffectiveRule[] = [];
  const conflicts: RuleConflictMatch[] = [];

  for (const [key, group] of groups) {
    const sorted = [...group].sort((a, b) => {
      const levelDelta = LEVEL_RANK[b.rule.level] - LEVEL_RANK[a.rule.level];
      if (levelDelta !== 0) return levelDelta;
      const effectDelta = EFFECT_RANK[b.rule.effect] - EFFECT_RANK[a.rule.effect];
      if (effectDelta !== 0) return effectDelta;
      return a.rule.id.localeCompare(b.rule.id);
    });
    const winner = sorted[0];
    if (!winner) {
      continue;
    }

    const effects = new Set(group.map((match) => match.rule.effect));
    let appliedEffect: RuleEffect = winner.rule.effect;
    let reason = `${winner.rule.level} rule matched`;
    let overriddenByUserRequest = false;

    if (effects.size > 1) {
      const nonOverridableBlock = group.some(
        (match) => match.rule.effect === "block" && !match.rule.overridable,
      );
      appliedEffect = nonOverridableBlock ? "block" : "approval";
      reason = `Conflicting rules for "${key}"; human confirmation required`;
      conflicts.push({
        conditionKey: key,
        winner: winner.rule,
        losers: sorted.slice(1).map((match) => match.rule),
        appliedEffect,
        reason,
      });
    } else if (appliedEffect === "block" && explicitUserRequest && winner.rule.overridable) {
      appliedEffect = "approval";
      overriddenByUserRequest = true;
      reason = "Block rule is overridable; the current explicit user request requires confirmation";
    }

    effective.push({
      rule: winner.rule,
      appliedEffect,
      reason,
      overriddenByUserRequest,
    });
  }

  const matchedIds = [...new Set(matches.map((match) => match.rule.id))].sort();

  const conflictById = new Map(ruleSet.conflicts.map((conflict) => [conflict.id, conflict]));
  for (const entry of effective) {
    const conflict = conflictById.get(entry.rule.id);
    if (!conflict) {
      continue;
    }
    const nonOverridableBlock = [conflict.winner, conflict.loser].some(
      (rule) => rule.effect === "block" && !rule.overridable,
    );
    entry.appliedEffect = nonOverridableBlock ? "block" : "approval";
    entry.overriddenByUserRequest = false;
    entry.reason = nonOverridableBlock
      ? "Conflicting rule definitions include a non-overridable block; human confirmation is required"
      : "Conflicting rule definitions require human confirmation";
  }

  const decision = effective.reduce<RuleEffect | null>((current, entry) => {
    if (current === null) {
      return entry.appliedEffect;
    }
    return EFFECT_RANK[entry.appliedEffect] > EFFECT_RANK[current] ? entry.appliedEffect : current;
  }, null);

  return {
    matches,
    effective,
    conflicts,
    decision,
    matchedIds,
  };
}
