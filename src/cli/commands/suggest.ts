import { createContext } from '../../context.js';
import { routeContext } from '../../engines/context-router/index.js';
import { getGuidance } from '../../engines/guidance/index.js';
import { log, severity } from '../output.js';

export async function runSuggestCommand(task: string, _flags: Record<string, string | boolean>) {
  const ctx = createContext();

  log(`\n${severity('info')} Suggestion for: "${task}"\n`);

  const context = await routeContext(ctx, task, 8000);
  const guidance = await getGuidance(ctx, task);

  if (guidance.specSections.length > 0) {
    log('  Relevant spec sections:');
    for (const s of guidance.specSections) {
      log(`    • ${s}`);
    }
    log('');
  }

  if (guidance.pastDecisions.length > 0) {
    log('  Past decisions on similar work:');
    for (const d of guidance.pastDecisions) {
      log(`    • ${d}`);
    }
    log('');
  }

  if (guidance.commonMistakes.length > 0) {
    log('  Common pitfalls:');
    for (const m of guidance.commonMistakes) {
      log(`    ⚠ ${m}`);
    }
    log('');
  }

  log('  Context (for AI):');
  log(`    ${context.slice(0, 500)}${context.length > 500 ? '...' : ''}`);
  log('');
}
