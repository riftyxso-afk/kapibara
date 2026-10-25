import type { RuleConflict, RuleConflictMatch } from "@kapibara/policy";
import type { PromptInjectionFinding, ScanSeverity, SensitiveFinding } from "@kapibara/scanners";

export type Decision = "allow" | "warn" | "require_approval" | "block";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface PreflightContext {
  environment?: string;
  reversible?: boolean;
  production?: boolean;
  external?: boolean;
  financialImpact?: number;
  scope?: string;
  metadata?: Record<string, unknown>;
}

export interface PreflightInput {
  intent?: string;
  action: string;
  target?: string;
  context?: PreflightContext;
}

export interface KapibaraIssue {
  type: string;
  severity: RiskLevel;
  message: string;
  evidence?: string[];
  recommendation?: string;
  blocking?: boolean;
}

export interface RiskFactor {
  name:
    | "destructive_impact"
    | "reversibility"
    | "sensitive_data"
    | "external_side_effects"
    | "production_impact"
    | "uncertainty";
  score: number;
  max: number;
  reason: string;
}

export interface PreflightScanSummary {
  sources: string[];
  findings: number;
  truncated: boolean;
  skipped: string[];
}

export interface PreflightResult {
  decision: Decision;
  risk: RiskLevel;
  score: number;
  issues: KapibaraIssue[];
  matchedRules: string[];
  recommendation?: string;
  requiresUserApproval: boolean;
  action?: string;
  factors?: RiskFactor[];
  ruleConflicts?: Array<{
    conditionKey: string;
    winner: string;
    losers: string[];
    appliedEffect: string;
    reason: string;
  }>;
  scan?: PreflightScanSummary;
}

export type ActionCategory =
  | "read"
  | "modify"
  | "delete"
  | "outbound"
  | "deploy"
  | "database"
  | "financial"
  | "execute"
  | "permission"
  | "unknown";

export type ActionId =
  | "read_file"
  | "modify_local_file"
  | "delete_file"
  | "recursive_delete"
  | "overwrite_file"
  | "commit"
  | "git_push"
  | "git_force_push"
  | "deploy"
  | "deploy_production"
  | "publish"
  | "upload"
  | "share"
  | "send_email"
  | "drop_database"
  | "truncate_database"
  | "database_migration"
  | "purchase"
  | "permission_change"
  | "execute_shell"
  | "unknown";

export interface ActionClassification {
  id: ActionId;
  category: ActionCategory;
  label: string;
  description: string;
  destructive: boolean;
  external: boolean;
  reversible: boolean;
}

export interface TargetSignal {
  type: string;
  baseSeverity: RiskLevel;
  tags: string[];
  message: string;
  recommendation: string;
  blockingCategories: ActionCategory[];
}

export interface ActionRiskResult {
  action: ActionId;
  category: ActionCategory;
  decision: Decision;
  risk: RiskLevel;
  score: number;
  factors: RiskFactor[];
  issues: KapibaraIssue[];
  recommendation: string;
  requiresUserApproval: boolean;
}

export interface ComparisonSource {
  name: string;
  content: string;
}

export interface ComparisonIssue {
  type: string;
  severity: RiskLevel;
  message: string;
  values: Record<string, string>;
  recommendation?: string;
}

export interface ComparisonResult {
  matches: boolean;
  issues: ComparisonIssue[];
  checked: string[];
}

export interface AnalysisExtras {
  sensitiveFindings?: SensitiveFinding[];
  promptInjectionFindings?: PromptInjectionFinding[];
  scan?: PreflightScanSummary;
  ruleSetConflicts?: RuleConflict[];
  scanFailed?: boolean;
}

export type { PromptInjectionFinding, ScanSeverity, SensitiveFinding, RuleConflictMatch };
