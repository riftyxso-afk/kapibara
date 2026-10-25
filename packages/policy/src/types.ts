export type RuleEffect = "allow" | "warn" | "approval" | "block";

export type RuleLevel = "default" | "global" | "project";

export type RuleProfile = "balanced" | "developer" | "strict";

export interface NormalizedRule {
  id: string;
  effect: RuleEffect;
  text: string;
  source: string;
  level: RuleLevel;
  topics: string[];
  overridable: boolean;
}

export interface RuleConflict {
  id: string;
  winner: NormalizedRule;
  loser: NormalizedRule;
  reason: string;
}

export interface RuleSet {
  profile: RuleProfile | "custom";
  rules: NormalizedRule[];
  conflicts: RuleConflict[];
  sources: string[];
}

export interface RuleMatchInput {
  action: string;
  target?: string;
  intent?: string;
  context?: {
    environment?: string;
    production?: boolean;
    external?: boolean;
    reversible?: boolean;
    metadata?: Record<string, unknown>;
  };
  signals?: string[];
  explicitUserRequest?: boolean;
}

export interface RuleMatch {
  rule: NormalizedRule;
  reason: string;
}

export interface EffectiveRule {
  rule: NormalizedRule;
  appliedEffect: RuleEffect;
  reason: string;
  overriddenByUserRequest: boolean;
}

export interface RuleConflictMatch {
  conditionKey: string;
  winner: NormalizedRule;
  losers: NormalizedRule[];
  appliedEffect: RuleEffect;
  reason: string;
}

export interface RuleEvaluation {
  matches: RuleMatch[];
  effective: EffectiveRule[];
  conflicts: RuleConflictMatch[];
  decision: RuleEffect | null;
  matchedIds: string[];
}
