export interface GuardrailRule {
  category: 'security' | 'design' | 'general' | 'performance';
  rule: string;
}

export interface GuardrailPack {
  name: string;
  description: string;
  rules: GuardrailRule[];
}

export const GUARDRAIL_PACKS: Record<string, GuardrailPack> = {
  'security-owasp': {
    name: 'security-owasp',
    description: 'OWASP Top 10 prevention rules',
    rules: [
      { category: 'security', rule: 'Always use parameterized queries, never string concatenation for SQL' },
      { category: 'security', rule: 'Validate and sanitize all user inputs on the server side' },
      { category: 'security', rule: 'Never store passwords in plaintext — use bcrypt or argon2' },
      { category: 'security', rule: 'Implement rate limiting on authentication endpoints' },
      { category: 'security', rule: 'Use CSRF tokens for state-changing operations' },
      { category: 'security', rule: 'Set secure, httpOnly, sameSite flags on session cookies' },
      { category: 'security', rule: 'Never expose stack traces or internal errors to users' },
      { category: 'security', rule: 'Validate file uploads — check MIME type, size, and extension' },
      { category: 'security', rule: 'Use Content-Security-Policy headers' },
      { category: 'security', rule: 'Never store secrets in client-side code or version control' },
    ],
  },
  'accessibility-wcag': {
    name: 'accessibility-wcag',
    description: 'WCAG 2.1 AA compliance rules',
    rules: [
      { category: 'design', rule: 'All text must have minimum 4.5:1 contrast ratio (3:1 for large text)' },
      { category: 'design', rule: 'All interactive elements must have visible focus indicators' },
      { category: 'design', rule: 'All images must have meaningful alt text (or alt="" for decorative)' },
      { category: 'design', rule: 'Form inputs must have associated labels' },
      { category: 'design', rule: 'Color must not be the only way to convey information' },
      { category: 'design', rule: 'Page must be navigable by keyboard alone' },
      { category: 'design', rule: 'Respect prefers-reduced-motion for animations' },
      { category: 'design', rule: 'Touch targets must be at least 44x44 pixels' },
      { category: 'design', rule: 'Use semantic HTML elements (nav, main, article, aside)' },
      { category: 'design', rule: 'ARIA attributes must be valid and necessary (don\'t over-use)' },
    ],
  },
  'react-patterns': {
    name: 'react-patterns',
    description: 'React/Next.js best practice rules',
    rules: [
      { category: 'general', rule: 'Prefer Server Components — only add \'use client\' when using hooks/events' },
      { category: 'general', rule: 'Extract reusable logic into custom hooks' },
      { category: 'general', rule: 'Use React.memo only after measuring performance issues' },
      { category: 'general', rule: 'Never mutate state directly — always use setter functions' },
      { category: 'general', rule: 'Keep components under 200 lines — split if larger' },
      { category: 'general', rule: 'Use named exports for components (not default exports)' },
      { category: 'general', rule: 'Co-locate related files (component + test + styles)' },
      { category: 'general', rule: 'Use Suspense boundaries for async data loading' },
      { category: 'general', rule: 'Handle all Promise rejections (no unhandled async errors)' },
      { category: 'general', rule: 'Avoid prop drilling beyond 2 levels — use composition or context' },
    ],
  },
  'performance-budget': {
    name: 'performance-budget',
    description: 'Web performance budget rules',
    rules: [
      { category: 'performance', rule: 'Bundle size under 200KB gzipped for initial load' },
      { category: 'performance', rule: 'LCP (Largest Contentful Paint) under 2.5 seconds' },
      { category: 'performance', rule: 'CLS (Cumulative Layout Shift) under 0.1' },
      { category: 'performance', rule: 'INP (Interaction to Next Paint) under 200ms' },
      { category: 'performance', rule: 'Lazy-load images below the fold' },
      { category: 'performance', rule: 'Use dynamic imports for routes and heavy components' },
      { category: 'performance', rule: 'Avoid layout thrashing — batch DOM reads then writes' },
      { category: 'performance', rule: 'Cache API responses where appropriate (stale-while-revalidate)' },
      { category: 'performance', rule: 'Use appropriate image formats (WebP/AVIF) with srcset' },
      { category: 'performance', rule: 'Minimize third-party scripts — audit with Lighthouse' },
    ],
  },
};
