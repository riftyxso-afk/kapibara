# Changelog

All notable changes to Kapibara are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-10-24

### Added

- Four-decision preflight engine: `ALLOW`, `WARN`, `REQUIRE_APPROVAL`, `BLOCK`.
- Deterministic action classifier with 21 action profiles.
- Six-factor risk scoring with issue and rule floors.
- Target signals for secrets, `.env` files, private keys, backups, databases,
  financial documents, certificates, generated files, and production targets.
- Local secret scanner with 19 pattern families, placeholder suppression,
  redaction, size limits, and workspace path confinement.
- Prompt-injection scanner for instruction-like content in untrusted data.
- Markdown rule engine with `BLOCK`, `APPROVAL`, `WARN`, and `ALLOW` sections,
  inline effects, topic inference, precedence, conflict resolution, and
  overridable block rules.
- `balanced`, `developer`, and `strict` rule profiles, with markdown mirrors in
  `rules/`.
- Consistency checker for amounts, currencies, dates, versions, Node.js
  versions, URLs, emails, filenames, identifiers, percentages, and quantities.
- MCP server with exactly five read-only tools:
  `kapibara_preflight`, `kapibara_action_risk`, `kapibara_compare`,
  `kapibara_scan_sensitive`, and `kapibara_rules_check`.
- Stdio CLI with `--cwd`, `--quiet`, `--version`, and `--help`.
- Optional sanitized JSONL audit log with retention.
- Six agent skills: preflight-check, action-risk, sensitive-data-check,
  consistency-check, second-opinion, and setup.
- Fifteen end-to-end decision evals.
- JSON Schemas, examples, documentation, Claude Code plugin manifest, and CI.
- 161 tests across policy, scanners, core, and MCP.
