import type { AppContext } from '../../context.js';
import { routeContext } from '../context-router/index.js';
import { evaluateGuardrails, formatGuardrails } from '../guardrails/index.js';
import { searchMemory, searchPlaybook } from '../memory/index.js';
import { loadProfile } from '../profiler/index.js';
import fs from 'node:fs';
import path from 'node:path';

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
  const projectContext = scanProjectForTask(ctx.projectDir, raw);

  const full = [
    `## TASK\n${raw}`,
    projectContext ? `\n## PROJECT CONTEXT (from actual files)\n${projectContext}` : '',
    `\n## THINK STEP-BY-STEP\n${thinking}`,
    constraints ? `\n## CONSTRAINTS\n${constraints}` : '',
    antiPatterns ? `\n## AVOID THESE (learned from past sessions)\n${antiPatterns}` : '',
    `\n## SUCCESS CRITERIA\n${successCriteria}`,
    context ? `\n## SPEC CONTEXT\n${context.slice(0, 4000)}` : '',
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

/** Scan real project files to extract context relevant to the task */
function scanProjectForTask(projectDir: string, task: string): string {
  const lines: string[] = [];
  const lower = task.toLowerCase();

  // Detect stack from package.json
  const pkgPath = path.join(projectDir, 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const stack: string[] = [];
    if (deps['next']) stack.push('Next.js');
    if (deps['react']) stack.push('React');
    if (deps['express']) stack.push('Express');
    if (deps['fastify']) stack.push('Fastify');
    if (deps['@supabase/supabase-js']) stack.push('Supabase');
    if (deps['prisma'] || deps['@prisma/client']) stack.push('Prisma');
    if (deps['drizzle-orm']) stack.push('Drizzle');
    if (deps['stripe']) stack.push('Stripe');
    if (deps['zod']) stack.push('Zod');
    if (stack.length) lines.push(`Stack: ${stack.join(', ')}`);
    if (pkg.scripts?.test) lines.push(`Test command: ${pkg.scripts.test}`);
  } catch {}

  // Find related files
  try {
    const keywords = lower.split(/\s+/).filter(w => w.length > 3);
    const srcFiles = walkSrc(projectDir, 2);
    const relevant = srcFiles.filter(f => keywords.some(k => f.toLowerCase().includes(k))).slice(0, 5);
    if (relevant.length) {
      lines.push(`Related files: ${relevant.map(f => path.relative(projectDir, f)).join(', ')}`);
    }

    // Extract existing patterns from related files
    for (const file of relevant.slice(0, 2)) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const imports = content.match(/^import .+ from ['"].+['"];?$/gm)?.slice(0, 5);
        if (imports?.length) lines.push(`Imports in ${path.basename(file)}: ${imports.join('; ')}`);
      } catch {}
    }
  } catch {}

  return lines.join('\n') || '';
}

function walkSrc(dir: string, maxDepth: number, depth = 0): string[] {
  if (depth > maxDepth) return [];
  const results: string[] = [];
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'dist') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) results.push(...walkSrc(full, maxDepth, depth + 1));
      else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) results.push(full);
    }
  } catch {}
  return results;
}
