/**
 * Test Execution Engine
 * Actually runs tests, parses results, measures coverage.
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import type { AppContext } from '../../context.js';

export interface TestResult {
  ran: boolean;
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  duration: number; // ms
  coverage: CoverageResult | null;
  failures: TestFailure[];
  command: string;
}

export interface CoverageResult {
  lines: number;
  branches: number;
  functions: number;
  statements: number;
}

export interface TestFailure {
  name: string;
  message: string;
  file?: string;
}

type Runner = 'vitest' | 'jest' | 'mocha' | 'pytest' | 'unknown';

/**
 * Detect which test runner is configured in the project.
 */
function detectRunner(projectDir: string): { runner: Runner; command: string } {
  const pkg = readPkg(projectDir);

  // Check package.json scripts
  if (pkg?.scripts?.test) {
    const testScript = pkg.scripts.test;
    if (testScript.includes('vitest')) return { runner: 'vitest', command: 'npx vitest run --reporter=json' };
    if (testScript.includes('jest')) return { runner: 'jest', command: 'npx jest --json --silent' };
    if (testScript.includes('mocha')) return { runner: 'mocha', command: 'npx mocha --reporter=json' };
    if (testScript.includes('pytest')) return { runner: 'pytest', command: 'python -m pytest --tb=short -q' };
  }

  // Check for config files
  if (fs.existsSync(path.join(projectDir, 'vitest.config.ts')) || fs.existsSync(path.join(projectDir, 'vitest.config.js'))) {
    return { runner: 'vitest', command: 'npx vitest run --reporter=json' };
  }
  if (fs.existsSync(path.join(projectDir, 'jest.config.ts')) || fs.existsSync(path.join(projectDir, 'jest.config.js'))) {
    return { runner: 'jest', command: 'npx jest --json --silent' };
  }
  if (pkg?.devDependencies?.vitest || pkg?.dependencies?.vitest) {
    return { runner: 'vitest', command: 'npx vitest run --reporter=json' };
  }
  if (pkg?.devDependencies?.jest || pkg?.dependencies?.jest) {
    return { runner: 'jest', command: 'npx jest --json --silent' };
  }

  return { runner: 'unknown', command: 'npm test' };
}

/**
 * Run the project's test suite and return structured results.
 */
export async function runTests(ctx: AppContext, opts?: { coverage?: boolean; timeout?: number }): Promise<TestResult> {
  const { runner, command } = detectRunner(ctx.projectDir);
  const timeout = opts?.timeout || 60000;
  const withCoverage = opts?.coverage ?? false;

  let cmd = command;
  if (withCoverage) {
    if (runner === 'vitest') cmd = 'npx vitest run --reporter=json --coverage';
    else if (runner === 'jest') cmd = 'npx jest --json --silent --coverage';
  }

  const start = Date.now();
  let stdout = '';
  let exitCode = 0;

  try {
    stdout = execSync(cmd, {
      cwd: ctx.projectDir,
      encoding: 'utf-8',
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (e: any) {
    exitCode = e.status || 1;
    stdout = e.stdout || '';
  }

  const duration = Date.now() - start;

  // Parse results based on runner
  if (runner === 'vitest' || runner === 'jest') {
    return parseJsonTestOutput(stdout, duration, cmd, exitCode);
  }

  // Fallback: basic pass/fail from exit code
  return {
    ran: true,
    passed: exitCode === 0 ? 1 : 0,
    failed: exitCode !== 0 ? 1 : 0,
    skipped: 0,
    total: 1,
    duration,
    coverage: withCoverage ? parseCoverageFile(ctx.projectDir) : null,
    failures: exitCode !== 0 ? [{ name: 'test suite', message: 'Exit code ' + exitCode }] : [],
    command: cmd,
  };
}

function parseJsonTestOutput(stdout: string, duration: number, command: string, exitCode: number): TestResult {
  // Find JSON in output (might have non-JSON lines before/after)
  const jsonMatch = stdout.match(/\{[\s\S]*"numPassedTests"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[0]);
      const failures: TestFailure[] = [];
      if (data.testResults) {
        for (const suite of data.testResults) {
          for (const tc of (suite.assertionResults || [])) {
            if (tc.status === 'failed') {
              failures.push({ name: tc.fullName || tc.title, message: (tc.failureMessages || []).join('\n').slice(0, 200), file: suite.name });
            }
          }
        }
      }
      return {
        ran: true,
        passed: data.numPassedTests || 0,
        failed: data.numFailedTests || 0,
        skipped: data.numPendingTests || 0,
        total: data.numTotalTests || 0,
        duration,
        coverage: null,
        failures,
        command,
      };
    } catch {}
  }

  // Vitest JSON format
  const vitestMatch = stdout.match(/\{[\s\S]*"testResults"[\s\S]*\}/);
  if (vitestMatch) {
    try {
      const data = JSON.parse(vitestMatch[0]);
      let passed = 0, failed = 0, skipped = 0;
      const failures: TestFailure[] = [];
      for (const result of (data.testResults || [])) {
        for (const tc of (result.assertionResults || [])) {
          if (tc.status === 'passed') passed++;
          else if (tc.status === 'failed') { failed++; failures.push({ name: tc.fullName, message: tc.failureMessages?.[0]?.slice(0, 200) || '' }); }
          else skipped++;
        }
      }
      return { ran: true, passed, failed, skipped, total: passed + failed + skipped, duration, coverage: null, failures, command };
    } catch {}
  }

  // Fallback: parse from text output
  const passMatch = stdout.match(/(\d+)\s*(?:pass|passed)/i);
  const failMatch = stdout.match(/(\d+)\s*(?:fail|failed)/i);
  return {
    ran: true,
    passed: passMatch ? parseInt(passMatch[1]) : (exitCode === 0 ? 1 : 0),
    failed: failMatch ? parseInt(failMatch[1]) : (exitCode !== 0 ? 1 : 0),
    skipped: 0,
    total: (passMatch ? parseInt(passMatch[1]) : 0) + (failMatch ? parseInt(failMatch[1]) : 0) || 1,
    duration,
    coverage: null,
    failures: exitCode !== 0 ? [{ name: 'suite', message: stdout.slice(-300) }] : [],
    command,
  };
}

function parseCoverageFile(projectDir: string): CoverageResult | null {
  // Try standard coverage output locations
  const paths = [
    path.join(projectDir, 'coverage', 'coverage-summary.json'),
    path.join(projectDir, 'coverage', 'coverage-final.json'),
  ];

  for (const p of paths) {
    try {
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
      if (data.total) {
        return {
          lines: data.total.lines?.pct || 0,
          branches: data.total.branches?.pct || 0,
          functions: data.total.functions?.pct || 0,
          statements: data.total.statements?.pct || 0,
        };
      }
    } catch {}
  }
  return null;
}

function readPkg(dir: string): any {
  try { return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8')); } catch { return null; }
}

export function formatTestResult(result: TestResult): string {
  if (!result.ran) return '⚠ Tests not run (no test runner detected)';

  const status = result.failed === 0 ? '✅' : '❌';
  let out = `${status} Tests: ${result.passed} passed, ${result.failed} failed, ${result.total} total (${result.duration}ms)\n`;
  out += `  Command: ${result.command}\n`;

  if (result.coverage) {
    out += `  Coverage: lines ${result.coverage.lines}% | branches ${result.coverage.branches}% | functions ${result.coverage.functions}%\n`;
  }

  if (result.failures.length > 0) {
    out += `\n  Failures:\n`;
    for (const f of result.failures.slice(0, 5)) {
      out += `    ✗ ${f.name}\n      ${f.message.slice(0, 100)}\n`;
    }
  }

  return out;
}
