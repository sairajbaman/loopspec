import type { ProjectAnalysis } from '../analyzer.js';

function generateUserStories(analysis: ProjectAnalysis, answers: Record<string, string>): string {
  const user = answers.target_user || analysis.targetUser;
  const stories: string[] = [];
  const auth = answers.auth || 'email/password';

  if (auth !== 'none') {
    stories.push(`As a ${user}, I want to create an account so that I can access the platform.`);
    stories.push(`As a ${user}, I want to log in securely so that my data is protected.`);
  }

  if (analysis.industry === 'fintech') {
    stories.push(
      `As a ${user}, I want to create invoices so that I can bill my clients.`,
      `As a ${user}, I want to track payment status so that I know who has paid.`,
      `As a ${user}, I want to send payment reminders so that I get paid faster.`,
      `As a ${user}, I want to see revenue dashboards so that I understand my cash flow.`,
    );
  } else if (analysis.industry === 'ecommerce') {
    stories.push(
      `As a ${user}, I want to browse products so that I can find what I need.`,
      `As a ${user}, I want to add items to cart so that I can buy multiple items.`,
      `As a ${user}, I want to checkout securely so that my payment is safe.`,
      `As a ${user}, I want to track my orders so that I know when they arrive.`,
    );
  } else if (analysis.industry === 'healthcare') {
    stories.push(
      `As a ${user}, I want to book appointments so that I can see my provider.`,
      `As a ${user}, I want to view my schedule so that I don't miss appointments.`,
      `As a ${user}, I want to receive reminders so that I prepare for visits.`,
    );
  } else {
    stories.push(
      `As a ${user}, I want to create ${answers.core_feature || 'items'} so that I can organize my work.`,
      `As a ${user}, I want to view my dashboard so that I see what needs attention.`,
      `As a ${user}, I want to search and filter so that I find things quickly.`,
      `As a ${user}, I want to receive notifications so that I stay informed.`,
    );
  }

  return stories.map((s, i) => `${i + 1}. ${s}`).join('\n');
}

export function generatePrdPrompt(analysis: ProjectAnalysis, answers: Record<string, string>): string {
  const userStories = generateUserStories(analysis, answers);
  const monetization = answers.monetization || 'not yet decided';

  return `# PRD — ${answers.core_feature || analysis.productType}

## Overview
- **Product type:** ${analysis.productType}
- **Industry:** ${analysis.industry}
- **Target user:** ${answers.target_user || analysis.targetUser}
- **Complexity:** ${analysis.complexity}

## Core User Stories

${userStories}

## Success Metrics
| Metric | Target | How to Measure |
|--------|--------|---------------|
| Activation | 60% of signups complete core action in 24h | Analytics event |
| Retention | 40% weekly active (WAU/MAU) | Cohort analysis |
| Task completion | < 3 clicks to complete primary flow | UX audit |
${monetization !== 'not yet decided' ? `| Revenue | First paying customer within 30 days | Stripe dashboard |` : ''}

## Non-Goals (v1 will NOT include)
1. Mobile native app (web-responsive only)
2. Multi-language / i18n support
3. Advanced analytics / reporting
4. Third-party marketplace integrations
5. White-label / multi-tenant enterprise features

---

> **AI Instructions:** Expand this PRD with:
> - A specific problem statement (what is broken today for this user)
> - One detailed user persona with name, role, frustrations
> - Risks & assumptions section (what we're betting on)
> Keep it under 800 words total. Be specific, not generic.`;
}
