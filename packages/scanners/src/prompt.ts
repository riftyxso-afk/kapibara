import type { PromptInjectionFinding, PromptScanResult, ScanSeverity } from "./types.js";

interface PromptPattern {
  type: string;
  severity: ScanSeverity;
  pattern: RegExp;
}

const PROMPT_PATTERNS: PromptPattern[] = [
  {
    type: "ignore_instructions",
    severity: "high",
    pattern:
      /\b(ignore|disregard|forget)\b[^\n]{0,40}\b(previous|prior|above|all)\b[^\n]{0,24}\b(instructions?|prompts?|rules?)\b/i,
  },
  {
    type: "system_prompt_reference",
    severity: "medium",
    pattern: /\b(system prompt|developer message|hidden instructions?)\b/i,
  },
  {
    type: "role_override",
    severity: "medium",
    pattern: /\byou are now\b|\bact as\b[^\n]{0,30}\b(admin|root|system)\b/i,
  },
  {
    type: "exfiltration_instruction",
    severity: "high",
    pattern:
      /\b(exfiltrate|send|upload|post)\b[^\n]{0,48}\b(secret|credential|api[ -]?key|token|file|data)\b[^\n]{0,48}\b(external|externally|outside|https?:\/\/)\b/i,
  },
  {
    type: "destructive_instruction",
    severity: "high",
    pattern:
      /\b(delete|remove|wipe|destroy)\b[^\n]{0,24}\b(everything|all files|the database|all data)\b/i,
  },
  {
    type: "tool_instruction",
    severity: "medium",
    pattern:
      /\b(run|execute|invoke)\b[^\n]{0,32}\b(command|shell|tool)\b[^\n]{0,32}\b(without|ignore|bypass)\b/i,
  },
];

function lineNumber(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

export function scanPromptInjection(
  text: string,
  options: { maxBytes?: number } = {},
): PromptScanResult {
  const maxBytes = options.maxBytes ?? 2_000_000;
  let content = text;
  let truncated = false;
  if (Buffer.byteLength(content, "utf8") > maxBytes) {
    content = content.slice(0, maxBytes);
    truncated = true;
  }

  const findings: PromptInjectionFinding[] = [];
  for (const candidate of PROMPT_PATTERNS) {
    const regex = new RegExp(
      candidate.pattern.source,
      candidate.pattern.flags.includes("g")
        ? candidate.pattern.flags
        : `${candidate.pattern.flags}g`,
    );
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      if (match[0].length === 0) {
        regex.lastIndex += 1;
        continue;
      }
      findings.push({
        type: candidate.type,
        severity: candidate.severity,
        line: lineNumber(content, match.index),
        pattern: candidate.type,
      });
    }
  }

  findings.sort((a, b) => a.line - b.line || a.type.localeCompare(b.type));

  return {
    findings,
    scannedBytes: Buffer.byteLength(content, "utf8"),
    truncated,
  };
}
