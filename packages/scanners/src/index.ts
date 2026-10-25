export { isPlaceholderSecret, SECRET_PATTERNS } from "./patterns.js";
export type { SecretPattern } from "./patterns.js";
export {
  redactBearer,
  redactGeneric,
  redactLabeled,
  redactPrivateKey,
  redactUrl,
} from "./redact.js";
export { ScanError, scanSensitiveFile, scanSensitiveFiles, scanSensitiveText } from "./scan.js";
export { scanPromptInjection } from "./prompt.js";
export type {
  FileScanOptions,
  PromptInjectionFinding,
  PromptScanResult,
  ScanResult,
  ScanSeverity,
  ScanSensitiveOptions,
  SensitiveFinding,
  SensitiveLocation,
} from "./types.js";
