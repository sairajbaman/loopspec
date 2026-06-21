import type { AppContext } from '../../context.js';
import { routeContext } from '../context-router/index.js';
import { evaluateGuardrails, formatGuardrails } from '../guardrails/index.js';
import { searchMemory, searchPlaybook } from '../memory/index.js';
import { loadProfile } from '../profiler/index.js';

interface AmplifiedPrompt {
  original: string;
  thinking: string;
  constraints: string;
  context: string;
  antiPatterns: string;
  successCriteria: string;
  full: string;
}

export async function amplifyPrompt(ctx: AppContext, raw: string): Promise<AmplifiedPrompt> {
  const [context, guardrails, playbook, profile] = await Promise.all([
    routeContext(ctx, raw, 8000),
    evaluateGuardrails(ctx, raw),
    searchPlaybook(ctx, raw).catch(() => []),
    loadProfile(ctx).catch(() => null),
  ]);

  const thinking = buildThinkingFrame(raw);
  const constraints = formatGuardrails(guardrails);
  const antiPatterns = buildAntiPatterns(raw, playbook, profile);
  const successCriteria = buildSuccessCriteria(raw);

  const full = [
    `## TASK\n${raw}`,
    `\n## THINK STEP-BY-STEP\n${thinking}`,
    constraints ? `\n## CONSTRAINTS\n${constraints}` : '',
    antiPatterns ? `\n## AVOID THESE (learned from past sessions)\n${antiPatterns}` : '',
    `\n## SUCCESS CRITERIA\n${successCriteria}`,
    context ? `\n## RELEVANT CONTEXT\n${context.slice(0, 6000)}` : '',
  ].filter(Boolean).join('\n');

  return { original: raw, thinking, constraints, context: context.slice(0, 2000), antiPatterns, successCriteria, full };
}

function buildThinkingFrame(prompt: string): string {
  const lower = prompt.toLowerCase();
  const steps: string[] = [];

  steps.push('1. Understand EXACTLY what is being asked — restate the goal in one sentence.');

  if (hasAny(lower, ['build', 'create', 'implement', 'add', 'make', 'write'])) {
    steps.push('2. Identify all the pieces needed (files, functions, types, imports).');
    steps.push('3. Determine the correct ORDER to build them (dependencies first).');
    steps.push('4. For each piece, consider: edge cases, error states, validation.');
    steps.push('5. Before writing, ask: "What could go wrong? What am I forgetting?"');
  } else if (hasAny(lower, ['fix', 'bug', 'error', 'broken', 'issue', 'debug'])) {
    steps.push('2. Reproduce: what is the exact error/symptom?');
    steps.push('3. Hypothesize: what are the top 3 most likely root causes?');
    steps.push('4. Verify: check each hypothesis with evidence (logs, code, state).');
    steps.push('5. Fix the ROOT cause, not just the symptom.');
    steps.push('6. Verify the fix doesn\'t break anything else.');
  } else if (hasAny(lower, ['refactor', 'improve', 'optimize', 'clean'])) {
    steps.push('2. Identify the current structure and what\'s wrong with it.');
    steps.push('3. Define the target state — what does "better" look like specifically?');
    steps.push('4. Plan incremental steps that keep the code working at each step.');
    steps.push('5. Verify no behavior changes (tests pass before AND after).');
  } else if (hasAny(lower, ['explain', 'how', 'why', 'what'])) {
    steps.push('2. Break the concept into layers (high-level → details).');
    steps.push('3. Use a concrete example to illustrate.');
    steps.push('4. Anticipate follow-up questions and address them.');
  } else {
    steps.push('2. Break this into smaller sub-problems.');
    steps.push('3. Solve each sub-problem independently.');
    steps.push('4. Integrate the solutions and verify the whole.');
    steps.push('5. Check: did I actually answer what was asked?');
  }

  return steps.join('\n');
}

function buildAntiPatterns(prompt: string, playbook: any[], profile: any): string {
  const patterns: string[] = [];

  // From playbook (past learnings)
  if (playbook?.length > 0) {
    for (const p of playbook.slice(0, 3)) {
      if (p.lesson) patterns.push(`• ${p.lesson}`);
      else if (p.pattern) patterns.push(`• ${p.pattern}`);
    }
  }

  // From profiler (blind spots)
  if (profile?.blindSpots) {
    const spots = Object.values(profile.blindSpots) as Array<{ category: string; score: number; missed: number; hit: number }>;
    const weak = spots.filter(s => s.score < 60).sort((a, b) => a.score - b.score).slice(0, 3);
    for (const w of weak) {
      const rate = Math.round((w.missed / (w.missed + w.hit)) * 100);
      patterns.push(`• ⚠️ You tend to miss: ${w.category} (${rate}% miss rate)`);
    }
  }

  return patterns.join('\n') || '';
}

function buildSuccessCriteria(prompt: string): string {
  const lower = prompt.toLowerCase();
  const criteria: string[] = [];

  criteria.push('- [ ] Directly solves what was asked (no scope creep)');
  criteria.push('- [ ] Handles error/edge cases');

  if (hasAny(lower, ['build', 'create', 'implement', 'component', 'page', 'form'])) {
    criteria.push('- [ ] Loading, error, empty, and success states');
    criteria.push('- [ ] Accessible (keyboard nav, screen reader, contrast)');
    criteria.push('- [ ] Type-safe (no `any`)');
  }
  if (hasAny(lower, ['api', 'endpoint', 'route', 'handler'])) {
    criteria.push('- [ ] Input validated');
    criteria.push('- [ ] Auth/permissions checked');
    criteria.push('- [ ] Proper HTTP status codes');
  }
  if (hasAny(lower, ['deploy', 'production', 'ship'])) {
    criteria.push('- [ ] Environment variables, no hardcoded secrets');
    criteria.push('- [ ] Tests pass');
  }

  criteria.push('- [ ] Code is complete and runnable (not pseudo-code)');
  return criteria.join('\n');
}

function hasAny(text: string, keywords: string[]): boolean {
  return keywords.some(k => text.includes(k));
}
