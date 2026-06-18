import type { ProjectAnalysis } from '../analyzer.js';

const PALETTES: Record<string, { primary: string; secondary: string; accent: string; neutral: string }> = {
  fintech: { primary: '#2563EB', secondary: '#1E40AF', accent: '#F59E0B', neutral: '#1E293B' },
  healthcare: { primary: '#059669', secondary: '#047857', accent: '#06B6D4', neutral: '#1E293B' },
  ecommerce: { primary: '#7C3AED', secondary: '#6D28D9', accent: '#F43F5E', neutral: '#1E293B' },
  education: { primary: '#2563EB', secondary: '#1D4ED8', accent: '#10B981', neutral: '#1E293B' },
  saas: { primary: '#6366F1', secondary: '#4F46E5', accent: '#EC4899', neutral: '#0F172A' },
  social: { primary: '#3B82F6', secondary: '#2563EB', accent: '#F97316', neutral: '#1E293B' },
  productivity: { primary: '#8B5CF6', secondary: '#7C3AED', accent: '#14B8A6', neutral: '#1E293B' },
};

export function generateDesignSystemPrompt(analysis: ProjectAnalysis, answers: Record<string, string>): string {
  const palette = PALETTES[analysis.industry] || PALETTES.saas;
  const vibe = answers.design_vibe || 'clean and professional';

  return `# Design System

## Design Philosophy
${vibe} aesthetic optimized for ${analysis.industry} ${analysis.productType}. Prioritizes clarity, accessibility, and consistent spacing.

## CSS Custom Properties

\`\`\`css
:root {
  /* Colors */
  --color-primary: ${palette.primary};
  --color-secondary: ${palette.secondary};
  --color-accent: ${palette.accent};
  --color-neutral: ${palette.neutral};
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --color-bg: #FFFFFF;
  --color-surface: #F8FAFC;
  --color-text: #0F172A;
  --color-muted: #64748B;
  --color-border: #E2E8F0;

  /* Typography */
  --font-heading: 'Inter', system-ui, sans-serif;
  --font-body: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Spacing (4px base) */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;

  /* Radii */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 300ms ease;
  --transition-slow: 500ms ease;
}

[data-theme="dark"] {
  --color-bg: #0F172A;
  --color-surface: #1E293B;
  --color-text: #F1F5F9;
  --color-muted: #94A3B8;
  --color-border: #334155;
}
\`\`\`

## Typography Scale

| Name | Size | Weight | Line Height |
|------|------|--------|-------------|
| h1 | 2.25rem | 700 | 1.2 |
| h2 | 1.875rem | 600 | 1.3 |
| h3 | 1.5rem | 600 | 1.4 |
| h4 | 1.25rem | 500 | 1.4 |
| body | 1rem | 400 | 1.6 |
| small | 0.875rem | 400 | 1.5 |
| caption | 0.75rem | 400 | 1.4 |

## Responsive Breakpoints

| Name | Width | Usage |
|------|-------|-------|
| sm | 640px | Mobile landscape |
| md | 768px | Tablet |
| lg | 1024px | Desktop |
| xl | 1280px | Wide desktop |
| 2xl | 1536px | Ultra-wide |

## Accessibility
- Minimum contrast ratio: 4.5:1 (WCAG AA)
- Focus ring: 2px solid var(--color-primary), 2px offset
- Reduced motion: \`prefers-reduced-motion: reduce\` disables all animations
- All interactive elements have visible focus states
`;
}
