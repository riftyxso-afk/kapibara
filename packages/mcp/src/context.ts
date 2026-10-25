import { resolve } from "node:path";

import { DEFAULT_CONFIG, loadConfig, type KapibaraConfig } from "@kapibara/core";
import { loadRuleSet, type RuleProfile, type RuleSet } from "@kapibara/policy";

export interface RuntimeContext {
  cwd: string;
  config: KapibaraConfig;
  ruleSet?: RuleSet;
  configError?: Error;
  rulesError?: Error;
}

export interface LoadRuntimeContextOptions {
  cwd?: string;
  homeDir?: string;
  profile?: RuleProfile | "custom";
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

/**
 * Load local configuration and rules for one tool call.
 *
 * Kapibara is local-first: there is no account, cloud lookup, or telemetry.
 * Errors are returned instead of thrown so a broken rules file cannot make the
 * safety layer disappear. Callers decide how to fail based on `failMode`.
 */
export async function loadRuntimeContext(
  options: LoadRuntimeContextOptions = {},
): Promise<RuntimeContext> {
  const cwd = resolve(options.cwd ?? process.cwd());

  let config: KapibaraConfig = DEFAULT_CONFIG;
  let configError: Error | undefined;
  try {
    config = await loadConfig({
      cwd,
      ...(options.homeDir ? { homeDir: options.homeDir } : {}),
    });
  } catch (error) {
    configError = toError(error);
  }

  let ruleSet: RuleSet | undefined;
  let rulesError: Error | undefined;
  try {
    ruleSet = await loadRuleSet({
      cwd,
      ...(options.homeDir ? { homeDir: options.homeDir } : {}),
      profile: options.profile ?? config.profile,
    });
  } catch (error) {
    rulesError = toError(error);
  }

  return {
    cwd,
    config,
    ...(ruleSet ? { ruleSet } : {}),
    ...(configError ? { configError } : {}),
    ...(rulesError ? { rulesError } : {}),
  };
}
