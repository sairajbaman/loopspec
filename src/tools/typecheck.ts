import * as z from 'zod/v4';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { fileExists } from '../utils/files.js';

const execAsync = promisify(exec);

interface TypecheckError {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Detect which typechecker is available in the project
 */
async function detectTypechecker(projectDir: string): Promise<{ cmd: string; name: string } | null> {
  // TypeScript (most common)
  if (await fileExists(path.join(projectDir, 'tsconfig.json'))) {
    // Check for project-local tsc first
    if (await fileExists(path.join(projectDir, 'node_modules', '.bin', 'tsc'))) {
      return { cmd: 'npx tsc --noEmit --pretty false', name: 'TypeScript' };
    }
    return { cmd: 'npx -y typescript --noEmit --pretty false', name: 'TypeScript' };
  }

  // Python type checking (pyright or mypy)
  if (await fileExists(path.join(projectDir, 'pyrightconfig.json')) || await fileExists(path.join(projectDir, 'pyproject.toml'))) {
    return { cmd: 'npx -y pyright --outputjson', name: 'Pyright' };
  }

  return null;
}

/**
 * Parse TypeScript compiler output into structured errors
 */
function parseTscOutput(output: string): TypecheckError[] {
  const errors: TypecheckError[] = [];
  // tsc format: src/file.ts(10,5): error TS2345: message
  const regex = /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(output)) !== null) {
    errors.push({
      file: match[1],
      line: parseInt(match[2]),
      column: parseInt(match[3]),
      severity: match[4] as 'error' | 'warning',
      code: match[5],
      message: match[6],
    });
  }
  return errors;
}

/**
 * Parse Pyright JSON output
 */
function parsePyrightOutput(output: string): TypecheckError[] {
  try {
    const data = JSON.parse(output);
    if (!data.generalDiagnostics) return [];
    return data.generalDiagnostics.map((d: any) => ({
      file: d.file || 'unknown',
      line: d.range?.start?.line || 0,
      column: d.range?.start?.character || 0,
      code: d.rule || 'pyright',
      message: d.message,
      severity: d.severity === 'error' ? 'error' : 'warning',
    }));
  } catch {
    return [];
  }
}

/**
 * Score contribution from typecheck results
 * Returns a penalty (0 to -50) that subtracts from the overall score
 */
function calculateTypecheckPenalty(errors: TypecheckError[], fileFilter?: string[]): { penalty: number; summary: string } {
  const relevant = fileFilter
    ? errors.filter((e) => fileFilter.some((f) => e.file.includes(f)))
    : errors;

  const errorCount = relevant.filter((e) => e.severity === 'error').length;
  const warningCount = relevant.filter((e) => e.severity === 'warning').length;

  // Scoring: each error = -5 (capped at -40), each warning = -1 (capped at -10)
  const errorPenalty = Math.min(errorCount * 5, 40);
  const warningPenalty = Math.min(warningCount, 10);
  const penalty = errorPenalty + warningPenalty;

  const summary = errorCount + warningCount === 0
    ? '✅ Zero type errors'
    : `${errorCount} errors, ${warningCount} warnings (score penalty: -${penalty})`;

  return { penalty, summary };
}

export function registerTypecheckTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_typecheck', {
    title: 'Live Type Check',
    description: 'Run the project typechecker (tsc/pyright) and feed results into the quality score. Returns structured error list with score impact.',
    inputSchema: z.object({
      files: z.array(z.string()).optional().describe('Only check these files (omit for full project)'),
      feedScore: z.boolean().optional().describe('Persist the typecheck result into the score (default: true)'),
    }),
  }, async (args) => {
    const { files, feedScore } = args as { files?: string[]; feedScore?: boolean };
    const checker = await detectTypechecker(ctx.projectDir);

    if (!checker) {
      return { content: [{ type: 'text' as const, text: 'No typechecker detected (no tsconfig.json or pyrightconfig.json found).' }], isError: true };
    }

    let errors: TypecheckError[] = [];
    let rawOutput = '';

    try {
      const { stdout, stderr } = await execAsync(checker.cmd, { cwd: ctx.projectDir, timeout: 60000 });
      rawOutput = stdout + stderr;

      if (checker.name === 'TypeScript') {
        errors = parseTscOutput(rawOutput);
      } else if (checker.name === 'Pyright') {
        errors = parsePyrightOutput(stdout);
      }
    } catch (e: any) {
      // tsc exits with code 1 when there are errors — that's expected
      rawOutput = (e.stdout || '') + (e.stderr || '');
      if (checker.name === 'TypeScript') {
        errors = parseTscOutput(rawOutput);
      }
      if (errors.length === 0) {
        return { content: [{ type: 'text' as const, text: `Typechecker failed to run:\n${rawOutput.slice(0, 500)}` }], isError: true };
      }
    }

    const { penalty, summary } = calculateTypecheckPenalty(errors, files);

    // Feed into score if requested
    if (feedScore !== false && penalty > 0) {
      try {
        const db = await ctx.getDb();
        // Update the most recent score's overall by the penalty
        db.prepare(`
          UPDATE scores SET
            overall = MAX(0, overall - ?),
            test_coverage = MAX(0, test_coverage - ?)
          WHERE id = (SELECT MAX(id) FROM scores)
        `).run(penalty, Math.floor(penalty / 2));
      } catch {}
    }

    // Format output
    const topErrors = errors
      .filter((e) => !files || files.some((f) => e.file.includes(f)))
      .slice(0, 15)
      .map((e) => `  ${e.severity === 'error' ? '🔴' : '🟡'} ${e.file}:${e.line} [${e.code}] ${e.message}`)
      .join('\n');

    return {
      content: [{
        type: 'text' as const,
        text: `## 🔬 Type Check: ${checker.name}\n\n${summary}\n\n${topErrors || '(no errors)'}\n\n${errors.length > 15 ? `... and ${errors.length - 15} more\n` : ''}${feedScore !== false ? `\n_Score impact: -${penalty} applied to latest scorecard._` : ''}`,
      }],
    };
  });
}
