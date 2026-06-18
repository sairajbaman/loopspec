import { execSync } from 'node:child_process';
import path from 'node:path';
import { createContext } from '../../context.js';
import { detectDrift } from '../../engines/live-sync/index.js';
import { scoreTask } from '../../engines/scorecard/index.js';
import { checkTestGate } from '../../engines/test-gate/index.js';
import { log, severity } from '../output.js';

export async function runReviewCommand(flags: Record<string, string | boolean>) {
  const ctx = createContext();
  const base = (flags.pr as string) || 'main';

  log(`\n${severity('info')} Review — comparing against ${base}\n`);

  let changedFiles: string[] = [];
  try {
    const diff = execSync(`git diff --name-only ${base}`, { cwd: ctx.projectDir, encoding: 'utf-8' });
    changedFiles = diff.split('\n').filter(f => f.trim() && /\.(ts|tsx|jsx|svelte|vue)$/.test(f));
  } catch {
    log(`${severity('error')} Failed to get git diff. Are you in a git repository?`);
    return;
  }

  if (changedFiles.length === 0) {
    log(`${severity('ok')} No source files changed vs ${base}.`);
    return;
  }

  log(`  Files to review: ${changedFiles.length}\n`);

  let totalScore = 0;
  let totalDrifts = 0;

  for (const file of changedFiles.slice(0, 30)) {
    const drifts = await detectDrift(ctx, file);
    const score = await scoreTask(ctx, `review ${file}`, [file]);
    totalScore += score.overall;
    totalDrifts += drifts.length;

    const icon = score.overall >= 80 ? severity('ok') : score.overall >= 60 ? severity('warn') : severity('error');
    log(`  ${icon} ${file} — ${score.overall}/100${drifts.length ? ` (${drifts.length} drift issues)` : ''}`);
  }

  const avg = Math.round(totalScore / changedFiles.length);
  log(`\n  Average score: ${avg}/100`);
  log(`  Total drift issues: ${totalDrifts}`);

  // Test gate
  const testResult = await checkTestGate(ctx, changedFiles);
  if (testResult.missing.length > 0) {
    log(`\n${severity('warn')} Missing tests for:`);
    for (const m of testResult.missing) {
      log(`    • ${m}`);
    }
  }

  log('');
}
