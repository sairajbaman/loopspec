import { createContext } from '../../context.js';
import { SessionManager } from '../../engines/session/index.js';
import { decomposeGoals } from '../../engines/goals/index.js';
import { log, severity } from '../output.js';

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
      const report = await mgr.end();
      if (!report) {
        log(`${severity('warn')} No active session to end.`);
        return;
      }
      log(`${severity('ok')} Session ended: "${report.name}"`);
      log(`  Duration: ${report.duration}`);
      log(`  Score: ${report.scoreStart} → ${report.scoreEnd} (${report.scoreDelta >= 0 ? '+' : ''}${report.scoreDelta})`);
      log(`  Goals completed: ${report.goalsCompleted}/${report.goalsTotal}`);
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
