import {
  actionRiskInputSchema,
  compareInputSchema,
  preflightInputSchema,
  scanSensitiveInputSchema,
} from "@kapibara/core";
import { z } from "zod";

export const preflightToolInputSchema = preflightInputSchema.extend({
  files: z
    .array(z.string().min(1).max(4_000))
    .max(100)
    .optional()
    .describe("Explicit workspace-relative file paths to scan. Kapibara never crawls directories."),
  scanTarget: z
    .boolean()
    .optional()
    .describe(
      "Scan the single named target when the action is outbound. Defaults to true; the target must stay inside the workspace.",
    ),
});

export const rulesCheckInputSchema = preflightInputSchema.extend({
  profile: z
    .enum(["balanced", "developer", "strict", "custom"])
    .optional()
    .describe("Override the configured rule profile for this check."),
});

export const actionRiskToolInputSchema = actionRiskInputSchema;
export const compareToolInputSchema = compareInputSchema;
export const scanSensitiveToolInputSchema = scanSensitiveInputSchema;

export const toolOutputSchema = z.object({
  summary: z.string().describe("Human-readable summary of the result."),
  data: z.unknown().describe("Structured tool result. Secret values are redacted."),
});
