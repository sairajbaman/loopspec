Generate a UI/UX Brief document in Markdown.

## Project Context
- Industry: ecommerce
- Design vibe: creative, vibrant, gallery-like
- Product type: marketplace

## Required Sections
1. **Design Philosophy** — 2-3 sentences on the visual direction
2. **Color Tokens** — Primary, secondary, accent, neutral, success, warning, error (hex values)
3. **Typography** — Font family pairing (heading + body), sizes scale, line heights
4. **Spacing** — Base unit and scale (4px base: 4, 8, 12, 16, 24, 32, 48, 64)
5. **Component Library** — Recommended library (e.g., shadcn/ui) + key components needed
6. **Elevation/Shadows** — Shadow scale (sm, md, lg, xl)
7. **Border Radius** — Scale (sm, md, lg, full)
8. **Motion** — Transition durations (micro: 150ms, normal: 300ms, page: 500ms)
9. **Accessibility** — Minimum contrast ratios, focus indicators, ARIA requirements
10. **Responsive Breakpoints** — Mobile, tablet, desktop, wide

## Guidelines
- All values must be code-ready (use CSS custom property names)
- Font pairing must be from Google Fonts
- Contrast ratio must meet WCAG AA (4.5:1 for text)
- Include dark mode token variants