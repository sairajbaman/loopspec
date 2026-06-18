import { createContext } from '../../context.js';
import { predict, compareWithPredictions, formatExpectations, formatComparison } from '../../engines/predict/index.js';
import { log, severity } from '../output.js';

export async function runPredictCommand(positional: string[], flags: Record<string, string | boolean>) {
  const ctx = createContext();
  const task = positional.join(' ');

  if (!task) {
    log('Usage: loopspec predict "<task description>"');
    log('       loopspec predict compare --files "src/file.ts"');
    return;
  }

  if (positional[0] === 'compare') {
    const filesRaw = (flags.files as string) || '';
    const files = filesRaw.split(',').map(f => f.trim()).filter(Boolean);
    if (files.length === 0) {
      log(`${severity('warn')} Pass --files "src/a.ts,src/b.ts" to compare against predictions.`);
      return;
    }
    const taskDesc = positional.slice(1).join(' ') || 'implementation';
    const result = await compareWithPredictions(ctx, taskDesc, files);
    log(formatComparison(result));
  } else {
    const expectations = await predict(ctx, task);
    log(formatExpectations(expectations, task));
  }
}
