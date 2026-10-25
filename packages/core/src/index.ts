export {
  ACTION_IDS,
  classifyAction,
  getActionFactors,
  getActionProfile,
  isOutboundAction,
} from "./action.js";
export type { ActionProfile, FactorBase } from "./action.js";
export { analyze, assessActionRisk } from "./analyze.js";
export type { AnalysisResult } from "./analyze.js";
export { appendAuditEvent, createAuditEvent } from "./audit.js";
export type { AuditEvent, AuditResult } from "./audit.js";
export { configPaths, DEFAULT_CONFIG, kapibaraConfigSchema, loadConfig } from "./config.js";
export type { FailMode, KapibaraConfig, LoadConfigOptions } from "./config.js";
export {
  compareSources,
  extractDates,
  extractEmails,
  extractFilenames,
  extractIds,
  extractMoney,
  extractNodeVersions,
  extractPercentages,
  extractQuantities,
  extractUrls,
  extractVersions,
} from "./consistency.js";
export type { ExtractedValue } from "./consistency.js";
export { buildRecommendation, decide } from "./decision.js";
export type { DecisionInput, DecisionOutput } from "./decision.js";
export { ComparisonError, ConfigError, KapibaraError, KapibaraValidationError } from "./errors.js";
export { failureResult } from "./fail.js";
export type { FailureOptions } from "./fail.js";
export { formatActionRisk, formatComparison, formatPreflightResult } from "./format.js";
export { baseIssues, detectEnvironmentMismatch } from "./issues.js";
export type { BaseIssueInput } from "./issues.js";
export { preflight } from "./preflight.js";
export type { PreflightOptions } from "./preflight.js";
export { evaluateRulesForInput } from "./rules.js";
export { applyScoreFloors, computeFactors, riskFromScore, scoreFactors } from "./risk.js";
export type { FactorInput } from "./risk.js";
export {
  actionRiskInputSchema,
  compareInputSchema,
  comparisonSourceSchema,
  formatZodError,
  preflightContextSchema,
  preflightInputSchema,
  scanSensitiveInputSchema,
} from "./schemas.js";
export type {
  CompareInputSchema,
  PreflightInputSchema,
  ScanSensitiveInputSchema,
} from "./schemas.js";
export { detectTargetSignals, targetIssues, targetTags } from "./target.js";
export type {
  ActionCategory,
  ActionClassification,
  ActionId,
  ActionRiskResult,
  AnalysisExtras,
  ComparisonIssue,
  ComparisonResult,
  ComparisonSource,
  Decision,
  KapibaraIssue,
  PreflightContext,
  PreflightInput,
  PreflightResult,
  PreflightScanSummary,
  PromptInjectionFinding,
  RiskFactor,
  RiskLevel,
  ScanSeverity,
  SensitiveFinding,
  TargetSignal,
} from "./types.js";
