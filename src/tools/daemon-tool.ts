import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { initDaemon, enableDaemon, disableDaemon, addDaemonTask, removeDaemonTask, tick, recordCompletion, getDaemonStatus } from '../engines/daemon/index.js';

export function registerDaemonTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_daemon', {
    title: 'Autonomous Daemon',
    description: 'Long-running loop that wakes up on schedule, runs tasks (security scans, drift checks, docs updates, tests), and learns without human involvement.',
    inputSchema: z.object({
      action: z.enum(['init', 'enable', 'disable', 'add-task', 'remove-task', 'tick', 'complete', 'status']),
      taskId: z.string().optional(),
      name: z.string().optional(),
      description: z.string().optional(),
      taskAction: z.enum(['security-scan', 'docs-update', 'test-run', 'drift-check', 'compound-learn', 'deploy', 'custom']).optional(),
      schedule: z.enum(['hourly', 'daily', 'weekly', 'on-push']).optional(),
      success: z.boolean().optional(),
      output: z.string().optional(),
    }),
  }, async (args) => {
    switch (args.action) {
      case 'init': {
        const state = await initDaemon(ctx);
        return { content: [{ type: 'text', text: `✓ Daemon initialized. ${state.tasks.length} default tasks.\nEnabled: ${state.enabled}\n\nUse action=enable to start.` }] };
      }
      case 'enable': {
        const state = await enableDaemon(ctx);
        return { content: [{ type: 'text', text: `✓ Daemon ENABLED. ${state.tasks.filter(t => t.enabled).length} active tasks.\nCall action=tick periodically to trigger scheduled tasks.` }] };
      }
      case 'disable': {
        await disableDaemon(ctx);
        return { content: [{ type: 'text', text: '✓ Daemon disabled.' }] };
      }
      case 'add-task': {
        if (!args.name || !args.taskAction) return { content: [{ type: 'text', text: '❌ `name` and `taskAction` required' }] };
        const schedType = args.schedule === 'on-push' ? 'on-push' : 'cron-like';
        const state = await addDaemonTask(ctx, {
          name: args.name,
          description: args.description || args.name,
          schedule: { type: schedType, pattern: args.schedule || 'daily' },
          action: args.taskAction,
          enabled: true,
        });
        return { content: [{ type: 'text', text: `✓ Task "${args.name}" added. Total: ${state.tasks.length}` }] };
      }
      case 'remove-task': {
        if (!args.taskId) return { content: [{ type: 'text', text: '❌ `taskId` required' }] };
        const state = await removeDaemonTask(ctx, args.taskId);
        return { content: [{ type: 'text', text: `✓ Task removed. Remaining: ${state.tasks.length}` }] };
      }
      case 'tick': {
        const { triggered, state } = await tick(ctx);
        if (triggered.length === 0) return { content: [{ type: 'text', text: `✓ Tick complete. No tasks due.\nLast tick: ${new Date(state.lastTick).toISOString()}` }] };
        const lines = triggered.map(t => `• ${t.name} (${t.action}) — execute now`);
        return { content: [{ type: 'text', text: `## Triggered Tasks (${triggered.length})\n${lines.join('\n')}\n\nExecute each and call action=complete with taskId + success.` }] };
      }
      case 'complete': {
        if (!args.taskId || args.success === undefined) return { content: [{ type: 'text', text: '❌ `taskId` and `success` required' }] };
        await recordCompletion(ctx, args.taskId, args.success, args.output);
        return { content: [{ type: 'text', text: `✓ Task ${args.taskId} marked ${args.success ? 'success' : 'failed'}.` }] };
      }
      case 'status': {
        const state = await getDaemonStatus(ctx);
        const taskLines = state.tasks.map(t => `  ${t.enabled ? '●' : '○'} ${t.name} [${t.action}] — ${t.schedule.pattern || t.schedule.type}`);
        const recentRuns = state.history.slice(-5).reverse().map(h => `  ${h.status === 'success' ? '✓' : h.status === 'failed' ? '✗' : '…'} ${h.taskId} (${new Date(h.startedAt).toLocaleString()})`);
        return { content: [{ type: 'text', text: `## Daemon Status\nEnabled: ${state.enabled}\nLast tick: ${new Date(state.lastTick).toISOString()}\n\nTasks (${state.tasks.length}):\n${taskLines.join('\n')}\n\nRecent runs:\n${recentRuns.join('\n') || '  (none)'}` }] };
      }
      default:
        return { content: [{ type: 'text', text: '❌ Unknown action' }] };
    }
  });
}
