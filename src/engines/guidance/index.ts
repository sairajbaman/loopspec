import path from 'node:path';
import type { AppContext } from '../../context.js';
import { readFile } from '../../utils/files.js';
import { parseMarkdownSections } from '../../utils/markdown.js';
import { searchMemory, searchPlaybook } from '../memory/index.js';
import { queryDecisions } from '../decisions/index.js';

export interface GuidanceResult {
  specSections: string[];
  pastDecisions: string[];
  playbook: string[];
  commonMistakes: string[];
}

// Common mistakes database by topic
const COMMON_MISTAKES: Record<string, string[]> = {
  stripe: [
    'Using parsed body instead of raw body for webhook signature verification',
    'Missing stripe-signature header validation',
    'No error handling for StripeSignatureVerificationError',
    'Not returning 200 quickly (process async, respond immediately)',
    'Missing idempotency key for retried events',
  ],
  auth: [
    'Storing passwords in plain text (use bcrypt/argon2)',
    'Missing rate limiting on login endpoint',
    'JWT secret in client-side code',
    'No session invalidation on password change',
    'Missing CSRF protection on state-changing endpoints',
  ],
  form: [
    'No client-side validation before submission',
    'Missing loading state during submission',
    'No error recovery (form resets on error)',
    'Uncontrolled inputs losing state on re-render',
    'Missing accessibility: labels, error announcements',
  ],
  database: [
    'N+1 queries in list endpoints',
    'Missing indexes on frequently queried columns',
    'No transaction for multi-table operations',
    'String concatenation in SQL (use parameterized queries)',
    'Missing soft delete (hard delete loses audit trail)',
  ],
  api: [
    'No input validation on request body',
    'Missing authentication middleware',
    'Returning 500 with stack trace to client',
    'No pagination on list endpoints',
    'Missing rate limiting',
  ],
  payment: [
    'Not verifying webhook signatures',
    'Processing duplicate webhook events',
    'Hardcoding currency/amount formats',
    'Missing error handling for declined payments',
    'No receipt/confirmation email after payment',
  ],
};

export async function getGuidance(ctx: AppContext, topic: string): Promise<GuidanceResult> {
  const result: GuidanceResult = { specSections: [], pastDecisions: [], playbook: [], commonMistakes: [] };

  // 1. Search spec documents for relevant sections
  const docs = ['TRD.md', 'Schema.md', 'AppFlow.md', 'SKILL.md'];
  for (const doc of docs) {
    const content = await readFile(path.join(ctx.loopspecDir, doc));
    if (!content) continue;
    const sections = parseMarkdownSections(content);
    for (const s of sections) {
      const sectionText = `${s.heading} ${s.content}`.toLowerCase();
      if (topic.toLowerCase().split(/\s+/).some(word => sectionText.includes(word))) {
        result.specSections.push(`[${doc}] ${s.heading}: ${s.content.slice(0, 200)}`);
        if (result.specSections.length >= 3) break;
      }
    }
  }

  // 2. Search past decisions
  const decisions = await queryDecisions(ctx, topic);
  for (const d of decisions.slice(0, 3)) {
    result.pastDecisions.push(`${d.decision} — ${d.rationale}`);
  }

  // 3. Search playbook (learned patterns)
  try {
    const patterns = await searchMemory(ctx, topic);
    const global = await searchPlaybook(topic);
    for (const p of [...patterns, ...global].slice(0, 3)) {
      result.playbook.push(`${p.pattern} (confidence: ${p.confidence})`);
    }
  } catch {}

  // 4. Common mistakes by keyword
  const lower = topic.toLowerCase();
  for (const [key, mistakes] of Object.entries(COMMON_MISTAKES)) {
    if (lower.includes(key)) {
      result.commonMistakes.push(...mistakes);
    }
  }

  return result;
}
