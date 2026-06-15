import type { ProjectAnalysis } from '../analyzer.js';

function generateScreens(analysis: ProjectAnalysis, answers: Record<string, string>): string {
  const auth = answers.auth || 'email/password';
  const hasAuth = auth !== 'none';
  const screens: string[] = [];

  if (hasAuth) {
    screens.push(`### Auth Flow
| Screen | Route | Auth | States |
|--------|-------|------|--------|
| Login | /login | public | default, loading, error, success → redirect |
| Signup | /signup | public | default, loading, validation-error, success |
| Forgot Password | /forgot-password | public | default, loading, email-sent |`);
  }

  // Industry-specific screens
  if (analysis.industry === 'fintech') {
    screens.push(`### Core Flow
| Screen | Route | Auth | States |
|--------|-------|------|--------|
| Dashboard | /dashboard | protected | loading, empty, data, error |
| Invoice List | /invoices | protected | loading, empty, filtered, data |
| Create Invoice | /invoices/new | protected | form, validation-error, submitting, success |
| Invoice Detail | /invoices/:id | protected | loading, data, not-found |
| Payments | /payments | protected | loading, empty, data |`);
  } else if (analysis.industry === 'ecommerce') {
    screens.push(`### Core Flow
| Screen | Route | Auth | States |
|--------|-------|------|--------|
| Product Catalog | /products | public | loading, empty, data, filtered |
| Product Detail | /products/:id | public | loading, data, not-found |
| Cart | /cart | public | empty, has-items |
| Checkout | /checkout | protected | address, payment, review, processing, confirmed |
| Order History | /orders | protected | loading, empty, data |`);
  } else if (analysis.industry === 'healthcare') {
    screens.push(`### Core Flow
| Screen | Route | Auth | States |
|--------|-------|------|--------|
| Dashboard | /dashboard | protected | loading, data, upcoming-apt |
| Book Appointment | /appointments/new | protected | select-provider, select-slot, confirm |
| Appointment Detail | /appointments/:id | protected | loading, data, cancelled |
| Provider List | /providers | protected | loading, filtered, empty |`);
  } else {
    screens.push(`### Core Flow
| Screen | Route | Auth | States |
|--------|-------|------|--------|
| Dashboard | /dashboard | protected | loading, empty, data, error |
| Create | /new | protected | form, validation-error, submitting, success |
| Detail | /:id | protected | loading, data, not-found, editing |
| Settings | /settings | protected | form, saving, saved |`);
  }

  screens.push(`### Shared States (apply to all protected routes)
- **Unauthenticated** → redirect to /login with return URL
- **Network Error** → toast notification + retry button
- **403 Forbidden** → access denied page
- **404 Not Found** → not found page with back navigation`);

  return screens.join('\n\n');
}

export function generateAppFlowPrompt(analysis: ProjectAnalysis, answers: Record<string, string>): string {
  const screens = generateScreens(analysis, answers);

  return `# App Flow — ${answers.core_feature || analysis.productType}

## User Journey
\`\`\`
${(answers.auth || 'email/password') !== 'none' ? 'Landing → Login/Signup → Dashboard → [Feature Screens] → Settings' : 'Landing → [Feature Screens]'}
\`\`\`

## Screens & States

${screens}

## Navigation
- Primary: sidebar (desktop) / bottom tabs (mobile)
- Secondary: breadcrumbs on detail pages
- Back: always available via browser history + explicit back button

## Transitions
- Page: fade (150ms)
- Modal: slide-up (200ms)
- Toast: slide-in from top-right (150ms), auto-dismiss 4s

---

> **AI Instructions:** When implementing each screen:
> 1. Handle ALL listed states (loading, empty, error, data)
> 2. Protected routes must check auth before rendering
> 3. Add skeleton loaders, not spinners
> 4. Empty states should have a clear CTA ("Create your first X")
> 5. Error states must offer retry action`;
}
