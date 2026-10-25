import type { NormalizedRule, RuleEffect, RuleLevel } from "./types.js";
import { inferTopics } from "./topics.js";

const EFFECT_HEADINGS: Array<{ pattern: RegExp; effect: RuleEffect }> = [
  { pattern: /\b(block|deny|forbid|never)\b/i, effect: "block" },
  { pattern: /\b(require[\s_-]*approval|approval|ask|confirm)\b/i, effect: "approval" },
  { pattern: /\b(warn|warning|caution)\b/i, effect: "warn" },
  { pattern: /\b(allow|permit)\b/i, effect: "allow" },
];

export interface ParseRulesOptions {
  source: string;
  level: RuleLevel;
  defaultEffect?: RuleEffect;
}

export function slugifyRuleId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function headingEffect(line: string): RuleEffect | null {
  const heading = line.replace(/^#{1,6}\s*/, "").trim();
  for (const { pattern, effect } of EFFECT_HEADINGS) {
    if (pattern.test(heading)) {
      return effect;
    }
  }
  return null;
}

function inlineEffect(text: string): { text: string; effect: RuleEffect | null } {
  const match = /^\s*\[(block|approval|warn|allow|require_approval)\]\s*/i.exec(text);
  if (!match) {
    return { text, effect: null };
  }
  const label = match[1]?.toLowerCase();
  const effect: RuleEffect = label === "require_approval" ? "approval" : (label as RuleEffect);
  return { text: text.slice(match[0].length), effect };
}

function isOverridable(effect: RuleEffect, text: string, topics: string[]): boolean {
  if (effect !== "block") {
    return true;
  }
  const secretExposure =
    topics.includes("secrets") ||
    topics.includes("env_file") ||
    /\b(exfiltrat|expose|leak|send\s+secret|publish\s+secret)\b/i.test(text);
  return !secretExposure;
}

export function parseRulesMarkdown(markdown: string, options: ParseRulesOptions): NormalizedRule[] {
  const rules: NormalizedRule[] = [];
  const seenIds = new Map<string, number>();
  let currentEffect: RuleEffect = options.defaultEffect ?? "warn";
  let inCodeFence = false;

  for (const rawLine of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();

    if (/^\s*```/.test(line)) {
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence) {
      continue;
    }

    const heading = /^#{1,6}\s+(.+)$/.exec(line);
    if (heading) {
      const effect = headingEffect(line);
      if (effect) {
        currentEffect = effect;
      }
      continue;
    }

    const bullet = /^\s*(?:[-*+]|\d+[.)])\s+(.+)$/.exec(line);
    if (!bullet) {
      continue;
    }

    const rawText = bullet[1]?.replace(/\s+/g, " ").trim();
    if (!rawText || rawText.startsWith("<!--")) {
      continue;
    }

    const inline = inlineEffect(rawText);
    const text = inline.text.replace(/\s+/g, " ").trim();
    if (!text) {
      continue;
    }

    const effect = inline.effect ?? currentEffect;
    const baseId = slugifyRuleId(text) || "rule";
    const count = seenIds.get(baseId) ?? 0;
    seenIds.set(baseId, count + 1);
    const id = count === 0 ? baseId : `${baseId}-${count + 1}`;
    const topics = inferTopics(text);

    rules.push({
      id,
      effect,
      text,
      source: options.source,
      level: options.level,
      topics,
      overridable: isOverridable(effect, text, topics),
    });
  }

  return rules;
}
