import type { ProjectAnalysis } from '../analyzer.js';

export function generateUiBriefPrompt(analysis: ProjectAnalysis, answers: Record<string, string>): string {
  const vibe = answers.design_vibe || 'clean and professional';
  const stack = answers.stack || analysis.impliedStack || 'nextjs-supabase-shadcn';
  const usesShadcn = stack.includes('shadcn');

  return `# UI/UX Brief

## Design Philosophy
${vibe} interface for ${analysis.industry} ${analysis.productType}. Focus on clarity, fast load times, and intuitive navigation for ${analysis.targetUser}.

## Color Tokens
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| Primary | #2563EB | #3B82F6 | CTAs, links, active states |
| Secondary | #1E40AF | #60A5FA | Secondary actions, headers |
| Accent | #F59E0B | #FBBF24 | Highlights, badges |
| Neutral | #0F172A | #F1F5F9 | Text, backgrounds |
| Success | #10B981 | #34D399 | Confirmations, positive |
| Warning | #F59E0B | #FBBF24 | Alerts, caution |
| Error | #EF4444 | #F87171 | Errors, destructive |

## Typography
- **Heading:** Inter (Google Fonts) — 600-700 weight
- **Body:** Inter — 400 weight, 1.6 line height
- **Mono:** JetBrains Mono — code blocks
- **Scale:** 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36px

## Spacing
Base unit: 4px. Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96px.

## Component Library
${usesShadcn ? '**shadcn/ui** — pre-built accessible components\n\nKey components needed:\n- Button, Input, Label, Card\n- Dialog, Sheet, Dropdown\n- Table, DataTable\n- Toast, Alert\n- Tabs, Accordion' : '**Tailwind CSS** — utility-first styling\n\nBuild custom components with:\n- Consistent padding/margin using spacing scale\n- Focus-visible states on all interactive elements\n- Dark mode via `dark:` variant'}

## Elevation/Shadows
| Level | CSS | Usage |
|-------|-----|-------|
| sm | 0 1px 2px rgba(0,0,0,0.05) | Cards, inputs |
| md | 0 4px 6px -1px rgba(0,0,0,0.1) | Dropdowns, popovers |
| lg | 0 10px 15px -3px rgba(0,0,0,0.1) | Modals, dialogs |
| xl | 0 20px 25px -5px rgba(0,0,0,0.1) | Toast notifications |

## Border Radius
| Name | Value | Usage |
|------|-------|-------|
| sm | 4px | Badges, tags |
| md | 8px | Cards, inputs, buttons |
| lg | 12px | Modals, large cards |
| full | 9999px | Avatars, pills |

## Motion
| Type | Duration | Easing | Usage |
|------|----------|--------|-------|
| Micro | 150ms | ease-out | Hover, focus, toggle |
| Normal | 300ms | ease-in-out | Expand, slide, fade |
| Page | 500ms | ease-in-out | Route transitions |

## Accessibility
- WCAG AA minimum: 4.5:1 text contrast, 3:1 UI elements
- Focus indicator: 2px ring, primary color, 2px offset
- All icons have aria-label or sr-only text
- Skip-to-content link on every page
- \`prefers-reduced-motion: reduce\` → disable animations

## Responsive Breakpoints
| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 640px | Single column, bottom nav |
| Tablet | 640-1024px | 2 columns, side drawer |
| Desktop | 1024-1440px | Sidebar + main content |
| Wide | > 1440px | Max-width container, centered |
`;
}
