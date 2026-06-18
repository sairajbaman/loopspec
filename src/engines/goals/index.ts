import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AppContext } from '../../context.js';
import { readFile } from '../../utils/files.js';
import { parseMarkdownSections } from '../../utils/markdown.js';

export interface Goal {
  id: string;
  description: string;
  status: 'pending' | 'done' | 'blocked';
  parentId?: string;
  verifyPatterns: string[]; // regex patterns that prove this goal is met
  antiPatterns: string[];   // regex patterns that indicate a miss
  fileGlobs: string[];      // files where verification patterns should appear
  blockedBy?: string;
}

export interface GoalVerificationResult {
  goalId: string;
  description: string;
  status: 'done' | 'pending' | 'blocked';
  matched: string[];
  missing: string[];
  antiPatternHits: string[];
}

// Feature → goal decomposition rules (structural, no LLM)
const DECOMPOSE_RULES: Record<string, { description: string; verify: string[]; anti: string[] }[]> = {
  form: [
    { description: 'Schema validation (Zod/Yup)', verify: ['z\\.object|z\\.string|yup\\.object|safeParse|validate'], anti: [] },
    { description: 'UI form with all fields', verify: ['<form|<Form|useForm|handleSubmit'], anti: [] },
    { description: 'Loading state', verify: ['loading|isLoading|isPending|Spinner|Skeleton'], anti: [] },
    { description: 'Error state', verify: ['error|isError|ErrorBoundary|onError'], anti: [] },
    { description: 'Success state / redirect', verify: ['success|redirect|router\\.push|navigate'], anti: [] },
    { description: 'API integration', verify: ['fetch\\(|axios|useMutation|POST|createServerAction'], anti: [] },
    { description: 'Error handling + user feedback', verify: ['toast|alert|notification|catch'], anti: ['console\\.log'] },
  ],
  api: [
    { description: 'Input validation', verify: ['z\\.object|validate|safeParse|schema'], anti: [] },
    { description: 'Authentication check', verify: ['getSession|auth\\(|requireAuth|getUser|middleware'], anti: [] },
    { description: 'Error handling', verify: ['try\\s*\\{|catch|throw new'], anti: ['console\\.log'] },
    { description: 'Proper HTTP status codes', verify: ['status\\(|Response\\(|NextResponse'], anti: [] },
    { description: 'Type-safe response', verify: ['interface|type\\s+\\w+Response|z\\.infer'], anti: [': any'] },
  ],
  page: [
    { description: 'Loading state', verify: ['loading|Suspense|Skeleton|isPending'], anti: [] },
    { description: 'Error state', verify: ['error|ErrorBoundary|error\\.tsx'], anti: [] },
    { description: 'Empty state', verify: ['length\\s*===?\\s*0|isEmpty|no.*found|empty'], anti: [] },
    { description: 'Accessibility basics', verify: ['aria-|role=|alt=|label'], anti: ['onClick.*div|onClick.*span'] },
    { description: 'SEO metadata', verify: ['metadata|<title|<meta|generateMetadata|Head'], anti: [] },
  ],
  auth: [
    { description: 'Session management', verify: ['getSession|createSession|setSession|cookie'], anti: [] },
    { description: 'Password hashing', verify: ['bcrypt|argon2|hash|scrypt'], anti: ['plaintext|password.*=.*req'] },
    { description: 'Input validation', verify: ['z\\.string|validate|email|safeParse'], anti: [] },
    { description: 'Error handling', verify: ['try|catch|throw|invalid.*credentials'], anti: [] },
    { description: 'Rate limiting', verify: ['rateLimit|throttle|attempts|lockout'], anti: [] },
  ],
  webhook: [
    { description: 'Signature verification', verify: ['verify|constructEvent|signature|hmac'], anti: [] },
    { description: 'Idempotency check', verify: ['idempotency|idempotent|duplicate|processed'], anti: [] },
    { description: 'Error handling', verify: ['try|catch|throw'], anti: [] },
    { description: 'Return proper status', verify: ['200|status|ok|acknowledged'], anti: [] },
    { description: 'Event type handling', verify: ['switch|event\\.type|eventType|case'], anti: [] },
  ],
  crud: [
    { description: 'Create operation', verify: ['POST|create|insert|add'], anti: [] },
    { description: 'Read operation (list + detail)', verify: ['GET|findMany|findAll|list|getById'], anti: [] },
    { description: 'Update operation', verify: ['PUT|PATCH|update|save'], anti: [] },
    { description: 'Delete operation', verify: ['DELETE|delete|remove|destroy'], anti: [] },
    { description: 'Input validation', verify: ['z\\.|validate|schema|safeParse'], anti: [] },
    { description: 'Authorization check', verify: ['auth|session|permission|owner'], anti: [] },
  ],
};

export function decomposeGoals(feature: string, specContext?: string): Goal[] {
  const lower = feature.toLowerCase();
  const goals: Goal[] = [];

  // Match against rules
  let matched = false;
  for (const [keyword, rules] of Object.entries(DECOMPOSE_RULES)) {
    if (lower.includes(keyword)) {
      matched = true;
      for (const rule of rules) {
        goals.push({
          id: randomUUID().slice(0, 8),
          description: rule.description,
          status: 'pending',
          verifyPatterns: rule.verify,
          antiPatterns: rule.anti,
          fileGlobs: [],
        });
      }
    }
  }

  // Always add test goal
  goals.push({
    id: randomUUID().slice(0, 8),
    description: 'Test file with edge cases',
    status: 'pending',
    verifyPatterns: ['describe\\(|it\\(|test\\(|expect\\('],
    antiPatterns: [],
    fileGlobs: [],
  });

  // If no rules matched, produce generic goals
  if (!matched) {
    goals.unshift(
      { id: randomUUID().slice(0, 8), description: 'Implementation complete', status: 'pending', verifyPatterns: [], antiPatterns: [': any'], fileGlobs: [] },
      { id: randomUUID().slice(0, 8), description: 'Error handling', status: 'pending', verifyPatterns: ['try|catch|throw|error'], antiPatterns: [], fileGlobs: [] },
      { id: randomUUID().slice(0, 8), description: 'Type safety', status: 'pending', verifyPatterns: ['interface|type\\s+\\w+'], antiPatterns: [': any', '@ts-ignore'], fileGlobs: [] },
    );
  }

  // If spec context provided, try to extract additional goals from it
  if (specContext) {
    const extraGoals = extractGoalsFromSpec(specContext);
    goals.push(...extraGoals);
  }

  return goals;
}

function extractGoalsFromSpec(spec: string): Goal[] {
  const goals: Goal[] = [];
  const sections = parseMarkdownSections(spec);

  for (const section of sections) {
    // Look for checkbox-style items in spec
    const checkboxes = section.content.match(/[-*]\s*\[[ x]\]\s*.+/g);
    if (checkboxes) {
      for (const cb of checkboxes.slice(0, 5)) {
        const desc = cb.replace(/[-*]\s*\[[ x]\]\s*/, '').trim();
        goals.push({
          id: randomUUID().slice(0, 8),
          description: desc,
          status: 'pending',
          verifyPatterns: [],
          antiPatterns: [],
          fileGlobs: [],
        });
      }
    }
  }
  return goals;
}

export function verifyGoals(goals: Goal[], fileContents: Map<string, string>): GoalVerificationResult[] {
  const results: GoalVerificationResult[] = [];
  const allContent = [...fileContents.values()].join('\n');

  for (const goal of goals) {
    if (goal.status === 'blocked') {
      results.push({ goalId: goal.id, description: goal.description, status: 'blocked', matched: [], missing: [], antiPatternHits: [] });
      continue;
    }

    const matched: string[] = [];
    const missing: string[] = [];
    const antiPatternHits: string[] = [];

    // Check verify patterns
    for (const pattern of goal.verifyPatterns) {
      try {
        const re = new RegExp(pattern, 'i');
        if (re.test(allContent)) {
          matched.push(pattern);
        } else {
          missing.push(pattern);
        }
      } catch { /* invalid regex, skip */ }
    }

    // Check anti-patterns
    for (const pattern of goal.antiPatterns) {
      try {
        const re = new RegExp(pattern, 'gi');
        const hits = allContent.match(re);
        if (hits && hits.length > 0) {
          antiPatternHits.push(`${pattern} (${hits.length} occurrences)`);
        }
      } catch {}
    }

    // Determine status: done if all verify patterns matched (or no patterns defined)
    const done = goal.verifyPatterns.length === 0
      ? false // Can't auto-verify without patterns
      : missing.length === 0;

    results.push({
      goalId: goal.id,
      description: goal.description,
      status: done ? 'done' : 'pending',
      matched,
      missing,
      antiPatternHits,
    });
  }

  return results;
}

export function formatGoalStatus(results: GoalVerificationResult[]): string {
  const lines: string[] = ['## Goal Status\n'];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const icon = r.status === 'done' ? '✓' : r.status === 'blocked' ? '⊘' : '○';
    lines.push(`${i + 1}. [${icon}] ${r.description}`);
    if (r.antiPatternHits.length > 0) {
      lines.push(`   ⚠ Anti-pattern: ${r.antiPatternHits[0]}`);
    }
    if (r.missing.length > 0 && r.status === 'pending') {
      lines.push(`   Missing: ${r.missing.join(', ')}`);
    }
  }
  const done = results.filter(r => r.status === 'done').length;
  lines.push(`\nProgress: ${done}/${results.length}`);
  return lines.join('\n');
}
