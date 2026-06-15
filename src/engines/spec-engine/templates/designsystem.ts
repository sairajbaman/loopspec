import type { ProjectAnalysis } from '../analyzer.js';

export function generateDesignSystemPrompt(analysis: ProjectAnalysis, answers: Record<string, string>): string {
  return `Generate a DesignSystem.md with code-ready design tokens.

## Context
- Industry: ${analysis.industry}
- Design vibe: ${answers.design_vibe || 'clean and professional'}

## Sections Required
### CSS Custom Properties
Complete set: --color-primary, --color-secondary, etc. in :root and [data-theme="dark"].

### Tailwind Config Extension
JSON for tailwind.config.js extend block.

### Typography
Google Font CDN links + font-family declarations.

### Spacing & Layout
Base-4 scale.

### Component Tokens
Border radius, shadows, transitions per component type.

### Accessibility
Contrast ratios verified, focus ring style, reduced-motion rules.`;
}
