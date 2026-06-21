import * as z from 'zod/v4';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { getScoreTrends } from '../engines/scorecard/index.js';

const execAsync = promisify(exec);

export function registerSuggestTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_suggest', {
    title: 'Proactive Suggestions',
    description: 'Analyze the ACTUAL project and suggest improvements based on real code issues found.',
    inputSchema: z.object({ scope: z.string().optional() }),
  }, async ({ scope }) => {
    const suggestions: string[] = [];

    // 1. Analyze actual project files
    const projectIssues = analyzeProject(ctx.projectDir, scope);
    for (const issue of projectIssues) suggestions.push(issue);

    // 2. Include score trends if available
    const trends = await getScoreTrends(ctx, 5);
    if (!trends.includes('No scores')) {
      suggestions.push(`Score history: ${trends}`);
    }

    if (suggestions.length === 0) {
      suggestions.push('No issues detected in current project scope.');
    }

    return { content: [{ type: 'text', text: `## Project-Specific Suggestions\n\n${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n\n')}` }] };
  });
}

function analyzeProject(projectDir: string, scope?: string): string[] {
  const issues: string[] = [];
  const srcDir = scope ? path.resolve(projectDir, scope) : projectDir;

  try {
    const files = walkTs(srcDir, 3);

    // Check for real issues
    let hasTests = false;
    let consoleLogs = 0;
    let anyTypes = 0;
    let todoCount = 0;
    let missingErrorHandling = 0;

    for (const file of files.slice(0, 50)) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        if (file.includes('.test.') || file.includes('.spec.') || file.includes('__tests__')) hasTests = true;
        consoleLogs += (content.match(/console\.(log|debug)\(/g) || []).length;
        anyTypes += (content.match(/:\s*any\b/g) || []).length;
        todoCount += (content.match(/\/\/\s*TODO/gi) || []).length;
        // Functions without try/catch that do async work
        const asyncFns = (content.match(/async\s+\w+/g) || []).length;
        const tryCatches = (content.match(/try\s*\{/g) || []).length;
        if (asyncFns > 0 && tryCatches === 0) missingErrorHandling++;
      } catch {}
    }

    if (!hasTests && files.length > 3) issues.push(`⚠️ No test files found. Add tests for: ${files.slice(0, 3).map(f => path.basename(f)).join(', ')}`);
    if (consoleLogs > 0) issues.push(`🔍 Found ${consoleLogs} console.log/debug statements — remove before production`);
    if (anyTypes > 0) issues.push(`📝 Found ${anyTypes} \`any\` types — add proper typing for safety`);
    if (todoCount > 0) issues.push(`📌 Found ${todoCount} TODOs — resolve or track as issues`);
    if (missingErrorHandling > 0) issues.push(`⚡ ${missingErrorHandling} async files without error handling — add try/catch`);

    // Check for package.json issues
    const pkgPath = path.join(projectDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (!pkg.scripts?.test) issues.push('📦 No test script in package.json');
      if (!pkg.scripts?.lint) issues.push('📦 No lint script — add eslint/biome');
    }
  } catch {}

  return issues;
}

function walkTs(dir: string, maxDepth: number, depth = 0): string[] {
  if (depth > maxDepth) return [];
  const files: string[] = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) files.push(...walkTs(full, maxDepth, depth + 1));
      else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) files.push(full);
    }
  } catch {}
  return files;
}

export function registerWorktreeTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_worktree', {
    title: 'Manage Worktrees',
    description: 'Create, list, or remove git worktrees for isolated agent work.',
    inputSchema: z.object({
      action: z.enum(['create', 'list', 'remove']),
      name: z.string().optional(),
      branch: z.string().optional(),
    }),
  }, async ({ action, name, branch }) => {
    try {
      if (action === 'list') {
        const { stdout } = await execAsync('git worktree list', { cwd: ctx.projectDir });
        return { content: [{ type: 'text', text: stdout || 'No worktrees found.' }] };
      }
      if (action === 'create' && name) {
        const branchName = branch || `agent-${name}`;
        await execAsync(`git branch ${branchName} HEAD 2>nul || echo exists`, { cwd: ctx.projectDir });
        await execAsync(`git worktree add ../${name} ${branchName}`, { cwd: ctx.projectDir });
        return { content: [{ type: 'text', text: `✓ Created worktree: ../${name} on branch ${branchName}` }] };
      }
      if (action === 'remove' && name) {
        await execAsync(`git worktree remove ../${name}`, { cwd: ctx.projectDir });
        return { content: [{ type: 'text', text: `✓ Removed worktree: ../${name}` }] };
      }
      return { content: [{ type: 'text', text: 'Provide a name for create/remove actions.' }], isError: true };
    } catch (e: any) {
      return { content: [{ type: 'text', text: `Git error: ${e.message}` }], isError: true };
    }
  });
}
