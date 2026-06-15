import type { ProjectAnalysis } from './analyzer.js';

export interface Question {
  id: string;
  text: string;
  type: 'text' | 'select' | 'boolean';
  options?: string[];
  default?: string;
}

export type Mode = 'vibe' | 'pro' | 'team';

export function generateQuestions(analysis: ProjectAnalysis, mode: Mode): Question[] {
  const base: Question[] = [
    { id: 'target_user', text: 'Who is the primary user?', type: 'text', default: analysis.targetUser },
    { id: 'core_feature', text: 'What is the single most important feature?', type: 'text' },
    { id: 'auth', text: 'Authentication needed?', type: 'select', options: ['email/password', 'social login', 'magic link', 'none'], default: 'email/password' },
    { id: 'monetization', text: 'How will this make money?', type: 'select', options: ['subscription', 'one-time', 'freemium', 'ads', 'not yet'], default: 'not yet' },
    { id: 'design_vibe', text: 'What should it feel like?', type: 'text', default: 'clean and professional' },
  ];

  if (mode === 'vibe') return base;

  const pro: Question[] = [
    { id: 'stack', text: 'Preferred stack?', type: 'text', default: analysis.impliedStack || 'nextjs-supabase-shadcn' },
    { id: 'hosting', text: 'Hosting preference?', type: 'select', options: ['Vercel', 'AWS', 'Railway', 'self-hosted', 'undecided'], default: 'Vercel' },
    { id: 'scale', text: 'Expected users at launch?', type: 'select', options: ['< 100', '100-1000', '1000-10000', '10000+'], default: '< 100' },
    { id: 'realtime', text: 'Need real-time features?', type: 'boolean', default: 'false' },
    { id: 'third_party', text: 'Key third-party integrations?', type: 'text', default: 'none' },
  ];

  if (mode === 'pro') return [...base, ...pro];

  const team: Question[] = [
    { id: 'team_size', text: 'How many team members?', type: 'text', default: '3' },
    { id: 'pr_policy', text: 'PR review policy?', type: 'select', options: ['human-required', 'agent-ok', 'mixed'], default: 'mixed' },
  ];

  return [...base, ...pro, ...team];
}
