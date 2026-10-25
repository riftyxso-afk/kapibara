import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { z } from "zod";

import { ConfigError } from "./errors.js";
import { formatZodError } from "./schemas.js";

export const kapibaraConfigSchema = z
  .object({
    profile: z.enum(["balanced", "developer", "strict", "custom"]).default("balanced"),
    auditLog: z.boolean().default(false),
    failMode: z.enum(["risk_based", "closed", "open"]).default("risk_based"),
    auditRetentionDays: z.number().int().min(1).max(365).default(7),
  })
  .passthrough();

export type KapibaraConfig = z.infer<typeof kapibaraConfigSchema>;
export type FailMode = KapibaraConfig["failMode"];

export const DEFAULT_CONFIG: KapibaraConfig = Object.freeze(
  kapibaraConfigSchema.parse({}),
) as KapibaraConfig;

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

async function readConfigFile(path: string): Promise<Record<string, unknown> | null> {
  let content: string;
  try {
    content = await readFile(path, "utf8");
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw new ConfigError(path, `Could not read config file: ${path}`, { cause: error });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new ConfigError(path, `Config file is not valid JSON: ${path}`, { cause: error });
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ConfigError(path, `Config file must contain a JSON object: ${path}`);
  }

  const validated = kapibaraConfigSchema.partial().safeParse(parsed);
  if (!validated.success) {
    throw new ConfigError(
      path,
      `Invalid config file: ${formatZodError(validated.error).join("; ")}`,
    );
  }
  return parsed as Record<string, unknown>;
}

export interface LoadConfigOptions {
  cwd?: string;
  homeDir?: string;
}

export async function loadConfig(options: LoadConfigOptions = {}): Promise<KapibaraConfig> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const home = resolve(options.homeDir ?? homedir());
  const globalPath = join(home, ".kapibara", "config.json");
  const projectPath = join(cwd, ".kapibara", "config.json");

  const globalConfig = await readConfigFile(globalPath);
  const projectConfig = await readConfigFile(projectPath);
  const merged = { ...DEFAULT_CONFIG, ...globalConfig, ...projectConfig };

  const parsed = kapibaraConfigSchema.safeParse(merged);
  if (!parsed.success) {
    throw new ConfigError(
      projectPath,
      `Invalid merged config: ${formatZodError(parsed.error).join("; ")}`,
    );
  }
  return parsed.data;
}

export function configPaths(options: LoadConfigOptions = {}): {
  global: string;
  project: string;
} {
  const cwd = resolve(options.cwd ?? process.cwd());
  const home = resolve(options.homeDir ?? homedir());
  return {
    global: join(home, ".kapibara", "config.json"),
    project: join(cwd, ".kapibara", "config.json"),
  };
}
