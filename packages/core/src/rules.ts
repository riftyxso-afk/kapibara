import { evaluateRules, type RuleEvaluation, type RuleSet } from "@kapibara/policy";

import { classifyAction } from "./action.js";
import { detectEnvironmentMismatch } from "./issues.js";
import { targetTags } from "./target.js";
import type { PreflightInput } from "./types.js";

export function evaluateRulesForInput(
  input: PreflightInput,
  ruleSet: RuleSet,
  extraSignals: string[] = [],
): RuleEvaluation {
  const classification = classifyAction(input);
  const environmentMismatch = detectEnvironmentMismatch(input);
  const signals = [
    classification.id,
    classification.category,
    ...targetTags(input.target),
    ...(environmentMismatch.mismatch ? ["environment_mismatch"] : []),
    ...extraSignals,
  ];

  return evaluateRules(ruleSet, {
    action: classification.id,
    target: input.target,
    intent: input.intent,
    context: input.context,
    signals,
    explicitUserRequest: input.context?.metadata?.explicitUserRequest === true,
  });
}
