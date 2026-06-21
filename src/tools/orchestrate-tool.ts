import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { createPlan, spawnSubLoop, startLoop, completeLoop, getNextActions, getPlanStatus, cancelLoop } from '../engines/orchestrator/index.js';

export function registerOrchestrateTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_orchestrate', {
    title: 'Cross-Agent Orchestrator',
    description: 'Higher-level loop that spawns and manages sub-loops. One loop can create child loops, forming a tree of autonomous work.',
    inputSchema: z.object({
      action: z.enum(['create', 'spawn', 'start', 'complete', 'next', 'status', 'cancel']),
      planId: z.string().optional(),
      loopId: z.string().optional(),
      parentLoopId: z.string().optional(),
      goal: z.string().optional(),
      name: z.string().optional(),
      success: z.boolean().optional(),
      result: z.string().optional(),
      maxDepth: z.number().optional(),
      maxLoops: z.number().optional(),
    }),
  }, async (args) => {
    switch (args.action) {
      case 'create': {
        if (!args.goal) return { content: [{ type: 'text', text: '❌ `goal` required' }] };
        const plan = await createPlan(ctx, args.goal, args.maxDepth, args.maxLoops);
        const root = plan.loops[0];
        return { content: [{ type: 'text', text: `✓ Orchestration plan created: ${plan.id}\nRoot goal: ${plan.rootGoal}\nRoot loop: ${root.id}\nMax depth: ${plan.maxDepth} | Max loops: ${plan.maxLoops}\n\nSpawn sub-loops with action=spawn, parentLoopId=${root.id}` }] };
      }
      case 'spawn': {
        if (!args.planId || !args.parentLoopId || !args.goal) return { content: [{ type: 'text', text: '❌ `planId`, `parentLoopId`, `goal` required' }] };
        const sub = await spawnSubLoop(ctx, args.planId, args.parentLoopId, args.name || 'sub-loop', args.goal);
        return { content: [{ type: 'text', text: `✓ Sub-loop spawned: ${sub.id}\nParent: ${sub.parentId}\nDepth: ${sub.depth}\nGoal: ${sub.goal}\n\nCall action=start loopId=${sub.id} to begin.` }] };
      }
      case 'start': {
        if (!args.planId || !args.loopId) return { content: [{ type: 'text', text: '❌ `planId`, `loopId` required' }] };
        const loop = await startLoop(ctx, args.planId, args.loopId);
        return { content: [{ type: 'text', text: `✓ Loop ${loop.id} started.\nGoal: ${loop.goal}\nDepth: ${loop.depth}` }] };
      }
      case 'complete': {
        if (!args.planId || !args.loopId || args.success === undefined) return { content: [{ type: 'text', text: '❌ `planId`, `loopId`, `success` required' }] };
        const plan = await completeLoop(ctx, args.planId, args.loopId, args.success, args.result);
        return { content: [{ type: 'text', text: `✓ Loop completed (${args.success ? 'success' : 'failed'}).\nPlan status: ${plan.status}\nLoops: ${plan.loops.filter(l => l.status === 'done').length}/${plan.loops.length} done` }] };
      }
      case 'next': {
        if (!args.planId) return { content: [{ type: 'text', text: '❌ `planId` required' }] };
        const actions = await getNextActions(ctx, args.planId);
        if (actions.length === 0) return { content: [{ type: 'text', text: '✓ No pending loops. All work complete or blocked.' }] };
        const lines = actions.map(a => `• ${a.loopId} [depth ${a.depth}]: ${a.goal.slice(0, 80)}${a.parentResult ? `\n  Parent result: ${a.parentResult.slice(0, 60)}` : ''}`);
        return { content: [{ type: 'text', text: `## Next Loops to Execute (${actions.length})\n${lines.join('\n')}\n\nCall action=start for each.` }] };
      }
      case 'cancel': {
        if (!args.planId || !args.loopId) return { content: [{ type: 'text', text: '❌ `planId`, `loopId` required' }] };
        const plan = await cancelLoop(ctx, args.planId, args.loopId);
        return { content: [{ type: 'text', text: `✓ Loop ${args.loopId} and its children cancelled.\nPlan status: ${plan.status}` }] };
      }
      case 'status': {
        const data = await getPlanStatus(ctx, args.planId);
        if (!data) return { content: [{ type: 'text', text: 'No orchestration plans found.' }] };
        if (Array.isArray(data)) {
          const lines = data.map(p => `• ${p.id} [${p.status}] — ${p.rootGoal.slice(0, 60)} (${p.loops.length} loops)`);
          return { content: [{ type: 'text', text: `## Plans\n${lines.join('\n')}` }] };
        }
        const tree = buildTree(data.loops);
        return { content: [{ type: 'text', text: `## Plan: ${data.id}\nGoal: ${data.rootGoal}\nStatus: ${data.status}\n\n${tree}` }] };
      }
      default:
        return { content: [{ type: 'text', text: '❌ Unknown action' }] };
    }
  });
}

function buildTree(loops: Array<{ id: string; name: string; status: string; depth: number; goal: string }>): string {
  return loops.map(l => {
    const indent = '  '.repeat(l.depth);
    const icon = l.status === 'done' ? '✓' : l.status === 'failed' ? '✗' : l.status === 'running' ? '▶' : '○';
    return `${indent}${icon} ${l.name} [${l.status}]: ${l.goal.slice(0, 50)}`;
  }).join('\n');
}
