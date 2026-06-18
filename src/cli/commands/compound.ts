import { createContext } from '../../context.js';
import { SessionManager } from '../../engines/session/index.js';
import { extractLearnings, storeMemory } from '../../engines/memory/index.js';
import { log, severity } from '../output.js';

export async function runCompoundCommand(positional: string[], flags: Record<string, string | boolean>) {
  const ctx = createContext();
  const mgr = new SessionManager(ctx);
  const session = await mgr.getCurrent();

  const task = positional.join(' ') || (session ? session.name : 'development session');
  const outcome = flags.outcome as string || 'completed';

  log(`${severity('info')} Extracting learnings from: "${task}"`);

  const learnings = await extractLearnings(task, outcome);

  if (learnings.length === 0) {
    log(`${severity('warn')} No patterns extracted. Provide more context:`);
    log('  loopspec compound "built auth system" --outcome "worked well with middleware pattern"');
    return;
  }

  await storeMemory(ctx, learnings);

  log(`${severity('ok')} Stored ${learnings.length} pattern${learnings.length > 1 ? 's' : ''}:`);
  for (const l of learnings) {
    log(`  [${l.category}] ${l.pattern} (${Math.round(l.confidence * 100)}%)`);
  }
  log('');
}
