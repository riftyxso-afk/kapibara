import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { getProfileMarkdown, PROFILE_NAMES, type RuleProfile } from "@kapibara/policy";

const FILE_BY_PROFILE: Record<RuleProfile, string> = {
  balanced: "default.md",
  developer: "developer.md",
  strict: "strict.md",
};

describe("rule profile files", () => {
  for (const profile of PROFILE_NAMES) {
    it(`keeps rules/${FILE_BY_PROFILE[profile]} in sync with the ${profile} profile`, async () => {
      const path = new URL(`../../../rules/${FILE_BY_PROFILE[profile]}`, import.meta.url);
      const content = await readFile(path, "utf8");

      expect(content).toBe(getProfileMarkdown(profile));
    });
  }
});
