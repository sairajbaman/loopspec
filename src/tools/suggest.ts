import * as z from 'zod/v4';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { getScoreTrends } from '../engines/scorecard/index.js';

const execAsync = promisify(exec);

export function registerSuggestTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_suggest', {
    title: 'Proactive Suggestions',
    description: 'Get improvement suggestions based on project state.',
    inputSchema: z.object({ scope: z.string().optional() }),
  }, async () => {
    const suggestions: string[] = [];
    const trends = await getScoreTrends(ctx, 5);
    if (trends.includes('No scores')) {
      suggestions.push('Run loopspec_score after your next task to start tracking quality');
    } else {
      suggestions.push(`Recent scores:\n${trends}`);
    }
    suggestions.push('Run loopspec_drift on recently changed files to check for spec deviations');
    suggestions.push('Run loopspec_compound after completing tasks to build project memory');
    return { content: [{ type: 'text', text: `## 💡 Suggestions\n\n${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n\n')}` }] };
  });
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
