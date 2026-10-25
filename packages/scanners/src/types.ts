export type ScanSeverity = "low" | "medium" | "high" | "critical";

export interface SensitiveLocation {
  line: number;
  column: number;
  source?: string;
}

export interface SensitiveFinding {
  type: string;
  severity: ScanSeverity;
  redactedValue: string;
  location: SensitiveLocation;
  label?: string;
}

export interface ScanResult {
  findings: SensitiveFinding[];
  source?: string;
  scannedBytes: number;
  truncated: boolean;
  skippedReason?: string;
}

export interface ScanSensitiveOptions {
  source?: string;
  maxBytes?: number;
  maxFindings?: number;
}

export interface FileScanOptions {
  cwd?: string;
  maxBytes?: number;
  allowOutsideCwd?: boolean;
}

export interface PromptInjectionFinding {
  type: string;
  severity: ScanSeverity;
  line: number;
  pattern: string;
}

export interface PromptScanResult {
  findings: PromptInjectionFinding[];
  scannedBytes: number;
  truncated: boolean;
}
