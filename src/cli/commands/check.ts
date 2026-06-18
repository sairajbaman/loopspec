import path from 'node:path';
import { createContext } from '../../context.js';
import { detectDrift, formatDriftReport } from '../../engines/live-sync/index.js';
import { scoreTask, formatScorecard } from '../../engines/scorecard/index.js';
import { detectPreventiveViolations } from '../../engines/guardrails/preventive.js';
import { analyzeFileDrift } from '../../engines/ast/index.js';
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

  // AST-level deep analysis (TypeScript Compiler API)
  const absPath = path.resolve(ctx.projectDir, relPath);
  const astResult = relPath.match(/\.(ts|tsx|js|jsx)$/) ? analyzeFileDrift(absPath) : null;

  if (jsonMode) {
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
      ast: astResult ? {
        quality: astResult.quality,
        issues: astResult.issues.map(i => ({ line: i.line, category: i.category, severity: i.severity, message: i.message })),
      } : null,
      drifts: drifts.map(d => ({ category: d.category, severity: d.severity, message: d.specExpectation })),
      violations: violations.map(v => ({ level: v.level, message: v.message })),
      suggestions: score.suggestions,
      pass: score.overall >= 70,
    };
    console.log(JSON.stringify(output, null, 2));
  } else {
    // AST issues (precise, with line numbers)
    if (astResult && astResult.issues.length > 0) {
      log(`\n${severity('info')} AST Analysis (${astResult.issues.length} issues):`);
      for (const issue of astResult.issues) {
        const icon = issue.severity === 'critical' ? severity('error') : issue.severity === 'high' ? severity('error') : severity('warn');
        log(`  ${icon} L${issue.line}: ${issue.message}`);
        log(`    → ${issue.suggestion}`);
      }
      log(`\n  Quality: types ${astResult.quality.typeCoverage}% | error-handling ${astResult.quality.errorHandling}% | complexity ${astResult.quality.avgComplexity} avg`);
    } else if (astResult) {
      log(`\n${severity('ok')} AST: No issues. Quality: types ${astResult.quality.typeCoverage}% | error-handling ${astResult.quality.errorHandling}%`);
    }

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
