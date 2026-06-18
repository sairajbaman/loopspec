import path from 'node:path';
import { createContext } from '../../context.js';
import { detectDrift, formatDriftReport } from '../../engines/live-sync/index.js';
import { scoreTask, formatScorecard } from '../../engines/scorecard/index.js';
import { detectPreventiveViolations } from '../../engines/guardrails/preventive.js';
import { log, severity } from '../output.js';

export async function runCheckCommand(file: string, flags: Record<string, string | boolean>) {
  const ctx = createContext();
  const relPath = path.relative(ctx.projectDir, path.resolve(file));

  log(`\n${severity('info')} Checking: ${relPath}\n`);

  // Drift detection
  const drifts = await detectDrift(ctx, relPath);
  if (drifts.length > 0) {
    log(formatDriftReport(drifts));
  } else {
    log(`${severity('ok')} No drift detected`);
  }

  // Preventive guardrails
  const violations = await detectPreventiveViolations(ctx, relPath);
  if (violations.length > 0) {
    log('');
    for (const v of violations) {
      log(`${severity(v.level)} ${v.message}`);
      if (v.suggestion) log(`  → ${v.suggestion}`);
    }
  }

  // Score
  const score = await scoreTask(ctx, `check ${relPath}`, [relPath]);
  log(`\n${severity('info')} Score: ${score.overall}/100`);
  if (flags.verbose || flags.v) {
    log(formatScorecard(score, relPath));
  }

  log('');
}
