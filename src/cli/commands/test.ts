import { createContext } from '../../context.js';
import { runTests, formatTestResult } from '../../engines/test-runner/index.js';
import { SessionManager } from '../../engines/session/index.js';
import { log, severity } from '../output.js';

export async function runTestCommand(flags: Record<string, string | boolean>) {
  const ctx = createContext();
  const withCoverage = !!flags.coverage || !!flags.cov;
  const jsonMode = !!flags.json;

  if (!jsonMode) log(`\n${severity('info')} Running tests${withCoverage ? ' (with coverage)' : ''}...\n`);

  const result = await runTests(ctx, { coverage: withCoverage });

  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    log(formatTestResult(result));
  }

  // Persist to session
  const sm = new SessionManager(ctx);
  const session = await sm.getCurrent();
  if (session) {
    // Update score based on test results
    const testScore = result.total > 0 ? Math.round((result.passed / result.total) * 100) : 0;
    await sm.updateScore(testScore);
  }

  // Exit with test exit code for CI
  if (result.failed > 0) process.exitCode = 1;
}
