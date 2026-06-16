export interface GuardrailRule {
  category: 'security' | 'design' | 'general' | 'performance' | 'testing' | 'state-management';
  rule: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  autoFix?: string;
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
      { category: 'security', rule: 'Always use parameterized queries, never string concatenation for SQL', severity: 'critical', autoFix: 'Replace string interpolation with $1/$2 params or ORM methods' },
      { category: 'security', rule: 'Validate and sanitize all user inputs on the server side', severity: 'critical', autoFix: 'Add Zod schema: z.object({...}).parse(req.body)' },
      { category: 'security', rule: 'Never store passwords in plaintext — use bcrypt or argon2', severity: 'critical', autoFix: 'import { hash } from "bcryptjs"; await hash(password, 12)' },
      { category: 'security', rule: 'Implement rate limiting on authentication endpoints', severity: 'high', autoFix: 'Add rate-limiter-flexible or upstash/ratelimit middleware' },
      { category: 'security', rule: 'Use CSRF tokens for state-changing operations', severity: 'high' },
      { category: 'security', rule: 'Set secure, httpOnly, sameSite flags on session cookies', severity: 'high', autoFix: 'Set cookie options: { httpOnly: true, secure: true, sameSite: "lax" }' },
      { category: 'security', rule: 'Never expose stack traces or internal errors to users', severity: 'medium', autoFix: 'Wrap handler in try/catch, return generic error message' },
      { category: 'security', rule: 'Validate file uploads — check MIME type, size, and extension', severity: 'high' },
      { category: 'security', rule: 'Use Content-Security-Policy headers', severity: 'medium' },
      { category: 'security', rule: 'Never store secrets in client-side code or version control', severity: 'critical', autoFix: 'Move to .env.local and add to .gitignore' },
    ],
  },
  'accessibility-wcag': {
    name: 'accessibility-wcag',
    description: 'WCAG 2.1 AA compliance rules',
    rules: [
      { category: 'design', rule: 'All text must have minimum 4.5:1 contrast ratio (3:1 for large text)', severity: 'high' },
      { category: 'design', rule: 'All interactive elements must have visible focus indicators', severity: 'high', autoFix: 'Add focus-visible:ring-2 ring-offset-2 ring-primary' },
      { category: 'design', rule: 'All images must have meaningful alt text (or alt="" for decorative)', severity: 'medium', autoFix: 'Add alt="description" to <img> tags' },
      { category: 'design', rule: 'Form inputs must have associated labels', severity: 'high', autoFix: 'Add <label htmlFor="id"> or aria-label attribute' },
      { category: 'design', rule: 'Color must not be the only way to convey information', severity: 'medium' },
      { category: 'design', rule: 'Page must be navigable by keyboard alone', severity: 'high' },
      { category: 'design', rule: 'Respect prefers-reduced-motion for animations', severity: 'medium', autoFix: '@media (prefers-reduced-motion: reduce) { animation: none }' },
      { category: 'design', rule: 'Touch targets must be at least 44x44 pixels', severity: 'medium' },
      { category: 'design', rule: 'Use semantic HTML elements (nav, main, article, aside)', severity: 'low', autoFix: 'Replace <div> with appropriate semantic element' },
      { category: 'design', rule: 'ARIA attributes must be valid and necessary (don\'t over-use)', severity: 'low' },
    ],
  },
  'react-patterns': {
    name: 'react-patterns',
    description: 'React/Next.js best practice rules',
    rules: [
      { category: 'general', rule: 'Prefer Server Components — only add \'use client\' when using hooks/events', severity: 'medium' },
      { category: 'general', rule: 'Extract reusable logic into custom hooks', severity: 'low' },
      { category: 'general', rule: 'Use React.memo only after measuring performance issues', severity: 'low' },
      { category: 'general', rule: 'Never mutate state directly — always use setter functions', severity: 'high', autoFix: 'Replace obj.prop = x with setObj(prev => ({...prev, prop: x}))' },
      { category: 'general', rule: 'Keep components under 200 lines — split if larger', severity: 'medium' },
      { category: 'general', rule: 'Use named exports for components (not default exports)', severity: 'low', autoFix: 'Replace "export default" with "export function ComponentName"' },
      { category: 'general', rule: 'Co-locate related files (component + test + styles)', severity: 'low' },
      { category: 'general', rule: 'Use Suspense boundaries for async data loading', severity: 'medium', autoFix: 'Wrap async component with <Suspense fallback={<Loading />}>' },
      { category: 'general', rule: 'Handle all Promise rejections (no unhandled async errors)', severity: 'high', autoFix: 'Add .catch() or wrap in try/catch with error state' },
      { category: 'general', rule: 'Avoid prop drilling beyond 2 levels — use composition or context', severity: 'medium' },
    ],
  },
  'performance-budget': {
    name: 'performance-budget',
    description: 'Web performance budget rules',
    rules: [
      { category: 'performance', rule: 'Bundle size under 200KB gzipped for initial load', severity: 'high' },
      { category: 'performance', rule: 'LCP (Largest Contentful Paint) under 2.5 seconds', severity: 'high' },
      { category: 'performance', rule: 'CLS (Cumulative Layout Shift) under 0.1', severity: 'medium' },
      { category: 'performance', rule: 'INP (Interaction to Next Paint) under 200ms', severity: 'medium' },
      { category: 'performance', rule: 'Lazy-load images below the fold', severity: 'medium', autoFix: 'Add loading="lazy" to <img> elements below fold' },
      { category: 'performance', rule: 'Use dynamic imports for routes and heavy components', severity: 'medium', autoFix: 'const Component = lazy(() => import("./Component"))' },
      { category: 'performance', rule: 'Avoid layout thrashing — batch DOM reads then writes', severity: 'low' },
      { category: 'performance', rule: 'Cache API responses where appropriate (stale-while-revalidate)', severity: 'medium' },
      { category: 'performance', rule: 'Use appropriate image formats (WebP/AVIF) with srcset', severity: 'low', autoFix: 'Use next/image or <picture> with WebP source' },
      { category: 'performance', rule: 'Minimize third-party scripts — audit with Lighthouse', severity: 'medium' },
    ],
  },
  'testing-quality': {
    name: 'testing-quality',
    description: 'Testing best practices and coverage rules',
    rules: [
      { category: 'testing', rule: 'All API routes must have integration tests', severity: 'high', autoFix: 'Create __tests__/api/route.test.ts with supertest' },
      { category: 'testing', rule: 'Test both happy path and error cases for every function', severity: 'medium' },
      { category: 'testing', rule: 'Mock external services — never hit real APIs in tests', severity: 'high', autoFix: 'Use vi.mock() or msw for HTTP mocking' },
      { category: 'testing', rule: 'Use descriptive test names: "should [expected behavior] when [condition]"', severity: 'low' },
      { category: 'testing', rule: 'Test edge cases: empty arrays, null values, max lengths, special characters', severity: 'medium' },
      { category: 'testing', rule: 'Avoid testing implementation details — test behavior and output', severity: 'medium' },
      { category: 'testing', rule: 'Each test must be independent — no shared mutable state between tests', severity: 'high' },
      { category: 'testing', rule: 'Aim for >80% coverage on business logic, >60% on UI components', severity: 'medium' },
      { category: 'testing', rule: 'Use factories/fixtures for test data, not hardcoded objects', severity: 'low' },
      { category: 'testing', rule: 'Run tests in CI — fail the build on test failure', severity: 'high', autoFix: 'Add npm test to CI pipeline with --ci flag' },
    ],
  },
  'state-management': {
    name: 'state-management',
    description: 'State management patterns and anti-patterns',
    rules: [
      { category: 'state-management', rule: 'Keep server state and client state separate (react-query/SWR for server)', severity: 'high', autoFix: 'Use useQuery/useSWR for server data instead of useState + useEffect' },
      { category: 'state-management', rule: 'Colocate state — lift only when truly shared by siblings', severity: 'medium' },
      { category: 'state-management', rule: 'Derive computed values from state — don\'t store duplicates', severity: 'medium', autoFix: 'Replace useState(computed) with useMemo(() => derive(state))' },
      { category: 'state-management', rule: 'Use reducers for complex state with multiple sub-values', severity: 'medium', autoFix: 'Replace multiple useState with useReducer + action types' },
      { category: 'state-management', rule: 'Never store UI state in global store (modal open, tooltip visible)', severity: 'low' },
      { category: 'state-management', rule: 'Use optimistic updates for better perceived performance', severity: 'low' },
      { category: 'state-management', rule: 'Normalize nested data structures in stores', severity: 'medium' },
      { category: 'state-management', rule: 'Type all state — no `any` in store definitions', severity: 'high', autoFix: 'Add explicit TypeScript interface for store state shape' },
      { category: 'state-management', rule: 'Use selectors to prevent unnecessary re-renders from store', severity: 'medium', autoFix: 'Use useStore(state => state.specificField) instead of useStore()' },
      { category: 'state-management', rule: 'Handle loading/error/success states explicitly for async operations', severity: 'high' },
    ],
  },
};
