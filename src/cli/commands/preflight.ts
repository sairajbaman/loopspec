import { createContext } from '../../context.js';
import { evaluateGuardrails, formatGuardrails } from '../../engines/guardrails/index.js';
import { log, severity } from '../output.js';

export async function runPreflightCommand(task: string, _flags: Record<string, string | boolean>) {
  const ctx = createContext();

  log(`${severity('info')} Pre-flight check for: "${task}"\n`);

  const result = await evaluateGuardrails(ctx, task);
  log(formatGuardrails(result));
}
