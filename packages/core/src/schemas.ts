import { z } from "zod";

export const preflightContextSchema = z
  .object({
    environment: z.string().max(200).optional(),
    reversible: z.boolean().optional(),
    production: z.boolean().optional(),
    external: z.boolean().optional(),
    financialImpact: z.number().nonnegative().optional(),
    scope: z.string().max(500).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const preflightInputSchema = z
  .object({
    intent: z.string().max(20_000).optional(),
    action: z.string().min(1).max(500),
    target: z.string().max(4_000).optional(),
    context: preflightContextSchema.optional(),
  })
  .passthrough();

export const comparisonSourceSchema = z.object({
  name: z.string().min(1).max(200),
  content: z.string().max(2_000_000),
});

export const compareInputSchema = z.object({
  sources: z.array(comparisonSourceSchema).min(2).max(20),
});

export const scanSensitiveInputSchema = z
  .object({
    text: z.string().max(2_000_000).optional(),
    path: z.string().min(1).max(4_000).optional(),
    maxBytes: z.number().int().positive().max(10_000_000).optional(),
  })
  .refine((value) => (value.text !== undefined) !== (value.path !== undefined), {
    message: "Provide exactly one of text or path",
    path: ["text"],
  });

export const actionRiskInputSchema = preflightInputSchema;

export type PreflightInputSchema = z.infer<typeof preflightInputSchema>;
export type CompareInputSchema = z.infer<typeof compareInputSchema>;
export type ScanSensitiveInputSchema = z.infer<typeof scanSensitiveInputSchema>;

export function formatZodError(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "input";
    return `${path}: ${issue.message}`;
  });
}
