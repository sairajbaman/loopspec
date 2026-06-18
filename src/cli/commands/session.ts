import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createContext } from '../../context.js';
import { SessionManager } from '../../engines/session/index.js';
import { decomposeGoals } from '../../engines/goals/index.js';
import { updateProfile } from '../../engines/profiler/index.js';
import { log, severity } from '../output.js';

function getGitChangedFiles(projectDir: string): string[] {
  try {
    // Get files changed since session start (staged + unstaged + untracked new files)
    const output = execSync('git diff --name-only HEAD 2>nul || git diff --name-only', {
      cwd: projectDir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    const staged = execSync('git diff --cached --name-only', {
      cwd: projectDir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    const untracked = execSync('git ls-files --others --exclude-standard', {
      cwd: projectDir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    const all = [output, staged, untracked].join('\n').split('\n').filter(Boolean);
    return [...new Set(all)];
  } catch {
    return [];
  }
}

export async function runSessionCommand(positional: string[], flags: Record<string, string | boolean>) {
  const ctx = createContext();
  const global = !!flags.global;
  const mgr = new SessionManager(ctx, { global });

  const action = positional[0] || 'status';

  switch (action) {
    case 'start': {
      const name = positional.slice(1).join(' ') || 'unnamed session';
      const session = await mgr.start(name);
      // Auto-decompose goals
      const goals = decomposeGoals(name);
      await mgr.setGoals(goals.map(g => ({ id: g.id, description: g.description, status: 'pending' })));
      log(`${severity('ok')} Session started: "${session.name}"`);
      log(`  ID: ${session.id}`);
      log(`  Goals: ${goals.length}`);
      for (let i = 0; i < goals.length; i++) {
        log(`    ${i + 1}. [ ] ${goals[i].description}`);
      }
      if (session.restored) {
        log(`\n${severity('info')} Restored from previous session:`);
        log(session.restored);
      }
      break;
    }
    case 'status': {
      const session = await mgr.getCurrent();
      if (!session) {
        log(`${severity('warn')} No active session. Run: loopspec session start "<name>"`);
        return;
      }
      log(`\n┌─ Session: ${session.name} ─────────────────`);
      log(`│  ID: ${session.id}`);
      log(`│  Started: ${session.startedAt}`);
      log(`│  Files changed: ${session.filesChanged.length}`);
      log(`│  Goals: ${session.goalsCompleted}/${session.goalsTotal}`);
      log(`│  Score: ${session.currentScore}/100`);
      log(`│  Guardrail hits: ${session.guardrailHits}`);
      log(`└──────────────────────────────────────`);
      break;
    }
    case 'end': {
      // Auto-detect files changed via git before ending
      const gitFiles = getGitChangedFiles(ctx.projectDir);
      if (gitFiles.length > 0) {
        for (const f of gitFiles) await mgr.trackFile(f);
      }

      // Update model profile with session file contents
      try {
        const sessionFiles = new Map<string, string>();
        const sourceFiles = gitFiles.filter(f => /\.(ts|tsx|js|jsx|svelte|vue)$/.test(f));
        for (const f of sourceFiles.slice(0, 30)) {
          const absPath = path.resolve(ctx.projectDir, f);
          try { sessionFiles.set(f, fs.readFileSync(absPath, 'utf-8')); } catch {}
        }
        if (sessionFiles.size > 0) await updateProfile(ctx, sessionFiles);
      } catch {}

      const report = await mgr.end();
      if (!report) {
        log(`${severity('warn')} No active session to end.`);
        return;
      }
      log(`${severity('ok')} Session ended: "${report.name}"`);
      log(`  Duration: ${report.duration}`);
      log(`  Score: ${report.scoreStart} → ${report.scoreEnd} (${report.scoreDelta >= 0 ? '+' : ''}${report.scoreDelta})`);
      log(`  Goals completed: ${report.goalsCompleted}/${report.goalsTotal}`);
      if (gitFiles.length > 0) log(`  Files tracked (git): ${gitFiles.length}`);
      log(`  Report saved: ${report.reportPath}`);
      break;
    }
    case 'history': {
      const sessions = await mgr.history();
      if (sessions.length === 0) {
        log(`${severity('info')} No past sessions found.`);
        return;
      }
      log(`\n  Past Sessions:`);
      for (const s of sessions) {
        const status = s.status === 'completed' ? '✓' : '◦';
        log(`  ${status} [${s.startedAt}] ${s.name} — Score: ${s.scoreEnd || '?'}/100`);
      }
      log('');
      break;
    }
    default:
      log(`Unknown session command: ${action}`);
      log('Usage: loopspec session [start|status|end|history]');
  }
}
