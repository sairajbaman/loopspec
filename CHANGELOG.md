# Changelog

## [0.3.0] - 2025-06-15

### Added
- **Hybrid spec generation** — Schema.md, TRD.md, AppFlow.md, PRD.md now produce real content (table definitions, file trees, API routes, screen tables, user stories) alongside prompts for creative sections
- **Real scorecard analysis** — Accessibility (img alt, labels, aria), design match (hardcoded colors, inline styles), spec compliance with positive+negative signals
- **7 drift detection categories** — Added api-contract, validation, route-drift, state-management
- **Multi-signal analyzer** — Weighted industry scoring, feature-based complexity, confidence scores, feature extraction
- **`loopspec_watch` tool** — File-change-triggered drift checking (scans recently modified files)
- **`loopspec_template` tool** — Full template customization (skip/add/replace sections, persistent config)
- **106 tests** across 8 test suites

### Changed
- Analyzer uses weighted multi-signal scoring instead of first-keyword-match
- Complexity estimation based on feature signals instead of word count
- Scorecard averages scores per-file with detailed breakdown
- Drift report groups by category with aggregated counts
- Generator respects template-config.json for document selection

### Fixed
- Scorecard no longer returns flat 75/80 for accessibility/designMatch
- Spec compliance now starts at 70 (neutral) with positive and negative signals
- Industry detection no longer misclassifies multi-domain ideas

## [0.2.0] - 2025-06-14

### Added
- Initial release
- 21 MCP tools
- Spec engine with analyzer + templates
- Context router with domain classification
- Drift detection (auth, types, exports, UI states)
- Scorecard with basic scoring
- Memory engine with Bayesian extraction
- Design engine (31 palettes, 21 fonts, 16 styles)
- Guardrail packs (security, a11y, React, performance)
- 11 stack DNA presets
- 31 tests
