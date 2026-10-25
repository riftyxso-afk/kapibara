export class KapibaraError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "KapibaraError";
    this.code = code;
  }
}

export class KapibaraValidationError extends KapibaraError {
  readonly issues: string[];

  constructor(issues: string[], message = "Invalid Kapibara input") {
    super("validation_error", `${message}: ${issues.join("; ")}`);
    this.name = "KapibaraValidationError";
    this.issues = issues;
  }
}

export class ConfigError extends KapibaraError {
  readonly path: string;

  constructor(path: string, message: string, options?: ErrorOptions) {
    super("config_error", message, options);
    this.name = "ConfigError";
    this.path = path;
  }
}

export class ComparisonError extends KapibaraError {
  constructor(message: string) {
    super("comparison_error", message);
    this.name = "ComparisonError";
  }
}
