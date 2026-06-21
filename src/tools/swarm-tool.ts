import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { initSwarm, addAgent, assignTask, reportResult, orchestrate, getSwarmStatus, pauseSwarm } from '../engines/swarm/index.js';

export function registerSwarmTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_swarm', {
    title: 'Swarm Coordinator',
    description: 'Multi-agent orchestration — spawn, coordinate, and manage parallel agent loops working toward a goal.',
    inputSchema: z.object({
      action: z.enum(['init', 'add-agent', 'assign', 'report', 'orchestrate', 'status', 'pause']),
      goal: z.string().optional(),
      swarmId: z.string().optional(),
      agentId: z.string().optional(),
      role: z.enum(['maker', 'checker', 'planner', 'deployer', 'monitor', 'custom']).optional(),
      task: z.string().optional(),
      result: z.string().optional(),
      success: z.boolean().optional(),
      strategy: z.enum(['parallel', 'pipeline', 'fan-out-fan-in', 'round-robin']).optional(),
    }),
  }, async (args) => {
    switch (args.action) {
      case 'init': {
        if (!args.goal) return { content: [{ type: 'text', text: '❌ `goal` required for init' }] };
        const run = await initSwarm(ctx, args.goal, args.strategy ? { strategy: args.strategy } : undefined);
        return { content: [{ type: 'text', text: `✓ Swarm initialized: ${run.id}\nGoal: ${run.goal}\nStrategy: ${run.config.strategy}\n\nNext: Add agents with action=add-agent` }] };
      }
      case 'add-agent': {
        if (!args.swarmId || !args.agentId || !args.role) return { content: [{ type: 'text', text: '❌ `swarmId`, `agentId`, `role` required' }] };
        const run = await addAgent(ctx, args.swarmId, { id: args.agentId, role: args.role, task: args.task });
        return { content: [{ type: 'text', text: `✓ Agent ${args.agentId} (${args.role}) added to swarm\nTotal agents: ${run.agents.length}` }] };
      }
      case 'assign': {
        if (!args.swarmId || !args.agentId || !args.task) return { content: [{ type: 'text', text: '❌ `swarmId`, `agentId`, `task` required' }] };
        const agent = await assignTask(ctx, args.swarmId, args.agentId, args.task);
        return { content: [{ type: 'text', text: `✓ Task assigned to ${agent.id}: ${args.task.slice(0, 100)}` }] };
      }
      case 'report': {
        if (!args.swarmId || !args.agentId || args.success === undefined) return { content: [{ type: 'text', text: '❌ `swarmId`, `agentId`, `success` required' }] };
        const run = await reportResult(ctx, args.swarmId, args.agentId, args.result || '', args.success);
        return { content: [{ type: 'text', text: `✓ Result reported. Swarm status: ${run.status}\nIterations: ${run.iterations}\nAgents done: ${run.agents.filter(a => a.status === 'done').length}/${run.agents.length}` }] };
      }
      case 'orchestrate': {
        if (!args.swarmId) return { content: [{ type: 'text', text: '❌ `swarmId` required' }] };
        const { nextActions } = await orchestrate(ctx, args.swarmId);
        if (nextActions.length === 0) return { content: [{ type: 'text', text: '✓ No pending actions — swarm idle or complete.' }] };
        const lines = nextActions.map(a => `• ${a.agentId}: ${a.action} → ${(a.task || '').slice(0, 80)}`);
        return { content: [{ type: 'text', text: `## Next Actions (${nextActions.length})\n${lines.join('\n')}` }] };
      }
      case 'pause': {
        if (!args.swarmId) return { content: [{ type: 'text', text: '❌ `swarmId` required' }] };
        const run = await pauseSwarm(ctx, args.swarmId);
        return { content: [{ type: 'text', text: `✓ Swarm ${run.id} paused.` }] };
      }
      case 'status': {
        const data = await getSwarmStatus(ctx, args.swarmId);
        if (!data) return { content: [{ type: 'text', text: 'No swarms found.' }] };
        if (Array.isArray(data)) {
          const lines = data.map(r => `• ${r.id} [${r.status}] — ${r.goal.slice(0, 60)} (${r.agents.length} agents)`);
          return { content: [{ type: 'text', text: `## Swarms\n${lines.join('\n')}` }] };
        }
        const agentLines = data.agents.map(a => `  ${a.id} [${a.role}] — ${a.status}${a.task ? `: ${a.task.slice(0, 50)}` : ''}`);
        return { content: [{ type: 'text', text: `## Swarm: ${data.id}\nGoal: ${data.goal}\nStatus: ${data.status} | Strategy: ${data.config.strategy}\nIterations: ${data.iterations}\n\nAgents:\n${agentLines.join('\n')}` }] };
      }
      default:
        return { content: [{ type: 'text', text: '❌ Unknown action' }] };
    }
  });
}
