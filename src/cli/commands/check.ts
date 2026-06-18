import path from 'node:path';
import { createContext } from '../../context.js';
import { detectDrift, formatDriftReport } from '../../engines/live-sync/index.js';
import { scoreTask, formatScorecard } from '../../engines/scorecard/index.js';
import { detectPreventiveViolations } from '../../engines/guardrails/preventive.js';
import { SessionManager } from '../../engines/session/index.js';
import { log, severity } from '../output.js';

export async function runCheckCommand(file: string, flags: Record<string, string | boolean>) {
  const ctx = createContext();
  const relPath = path.relative(ctx.projectDir, path.resolve(file));
  const jsonMode = !!flags.json;

  if (!jsonMode) log(`\n${severity('info')} Checking: ${relPath}\n`);

  // Drift detection
  const drifts = await detectDrift(ctx, relPath);
  if (!jsonMode) {
    if (drifts.length > 0) {
      log(formatDriftReport(drifts));
    } else {
      log(`${severity('ok')} No drift detected`);
    }
  }

  // Preventive guardrails
  const violations = await detectPreventiveViolations(ctx, relPath);
  if (!jsonMode && violations.length > 0) {
    log('');
    for (const v of violations) {
      log(`${severity(v.level)} ${v.message}`);
      if (v.suggestion) log(`  → ${v.suggestion}`);
    }
  }

  // Score
  const score = await scoreTask(ctx, `check ${relPath}`, [relPath]);

  if (jsonMode) {
    // Machine-readable output for CI/scripting
    const output = {
      file: relPath,
      score: score.overall,
      dimensions: {
        specCompliance: score.specCompliance,
        patternMatch: score.patternMatch,
        driftScore: score.driftScore,
        testCoverage: score.testCoverage,
        accessibility: score.accessibility,
        designMatch: score.designMatch,
      },
      drifts: drifts.map(d => ({ category: d.category, severity: d.severity, message: d.specExpectation })),
      violations: violations.map(v => ({ level: v.level, message: v.message })),
      suggestions: score.suggestions,
      pass: score.overall >= 70,
    };
    console.log(JSON.stringify(output, null, 2));
  } else {
    log(`\n${severity('info')} Score: ${score.overall}/100`);
    if (flags.verbose || flags.v) {
      log(formatScorecard(score, relPath));
    }
    log('');
  }

  // Persist score to active session
  const sm = new SessionManager(ctx);
  await sm.updateScore(score.overall);
  await sm.trackFile(relPath);

  if (violations.length > 0) {
    for (const _v of violations) {
      await sm.addGuardrailHit();
    }
  }
}
