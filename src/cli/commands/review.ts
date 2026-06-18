import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { createContext } from '../../context.js';
import { detectDrift } from '../../engines/live-sync/index.js';
import { scoreTask } from '../../engines/scorecard/index.js';
import { checkTestGate } from '../../engines/test-gate/index.js';
import { log, severity } from '../output.js';

function isGitRepo(dir: string): boolean {
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd: dir, stdio: 'pipe' });
    return true;
  } catch { return false; }
}

function findSourceFiles(dir: string): string[] {
  const files: string[] = [];
  const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.svelte', '.vue'];
  const IGNORE = ['node_modules', '.git', 'dist', '.next', 'build', '.loopspec'];
  (function walk(d) {
    try {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (IGNORE.includes(e.name) || e.name.startsWith('.')) continue;
        const f = path.join(d, e.name);
        if (e.isDirectory()) walk(f);
        else if (EXTS.includes(path.extname(e.name))) files.push(path.relative(dir, f).replace(/\\/g, '/'));
      }
    } catch {}
  })(dir);
  return files;
}

export async function runReviewCommand(flags: Record<string, string | boolean>) {
  const ctx = createContext();
  const base = (flags.pr as string) || 'main';

  let changedFiles: string[] = [];

  if (isGitRepo(ctx.projectDir)) {
    log(`\n${severity('info')} Review — comparing against ${base}\n`);
    try {
      const diff = execSync(`git diff --name-only ${base}`, { cwd: ctx.projectDir, encoding: 'utf-8' });
      changedFiles = diff.split('\n').filter(f => f.trim() && /\.(ts|tsx|jsx|svelte|vue)$/.test(f));
    } catch {
      // Branch might not exist, fall back to all source files
      log(`${severity('warn')} Branch "${base}" not found. Reviewing all source files.\n`);
      changedFiles = findSourceFiles(ctx.projectDir);
    }
  } else {
    // Not a git repo — review all source files
    log(`\n${severity('info')} Review — no git repo detected, reviewing all source files\n`);
    changedFiles = findSourceFiles(ctx.projectDir);
  }

  if (changedFiles.length === 0) {
    log(`${severity('ok')} No source files found to review.`);
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

  const avg = Math.round(totalScore / Math.min(changedFiles.length, 30));
  log(`\n  Average score: ${avg}/100`);
  log(`  Total drift issues: ${totalDrifts}`);

  // Test gate
  const testResult = await checkTestGate(ctx, changedFiles.slice(0, 30));
  if (testResult.missing.length > 0) {
    log(`\n${severity('warn')} Missing tests for:`);
    for (const m of testResult.missing) {
      log(`    • ${m}`);
    }
  }

  log('');
}
