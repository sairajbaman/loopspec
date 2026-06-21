import { createContext } from '../../context.js';
import { initSwarm, addAgent, orchestrate, getSwarmStatus } from '../../engines/swarm/index.js';

export async function runSwarmCommand(positional: string[], flags: Record<string, string | boolean>) {
  const ctx = createContext();
  const sub = positional[0];

  switch (sub) {
    case 'init': {
      const goal = positional.slice(1).join(' ') || (flags.goal as string);
      if (!goal) { console.log('Usage: loopspec swarm init "<goal>" [--strategy parallel|pipeline]'); return; }
      const run = await initSwarm(ctx, goal, { strategy: (flags.strategy as any) || 'pipeline' });
      console.log(`✓ Swarm initialized: ${run.id}`);
      console.log(`  Goal: ${run.goal}`);
      console.log(`  Strategy: ${run.config.strategy}`);
      break;
    }
    case 'add': {
      const swarmId = flags.swarm as string || positional[1];
      const role = (flags.role as string) || 'maker';
      const id = (flags.id as string) || `agent_${Date.now()}`;
      if (!swarmId) { console.log('Usage: loopspec swarm add --swarm <id> --role maker --id myagent'); return; }
      const run = await addAgent(ctx, swarmId, { id, role: role as any });
      console.log(`✓ Agent "${id}" (${role}) added. Total: ${run.agents.length}`);
      break;
    }
    case 'next': {
      const swarmId = positional[1] || (flags.swarm as string);
      if (!swarmId) { console.log('Usage: loopspec swarm next <swarm-id>'); return; }
      const { nextActions } = await orchestrate(ctx, swarmId);
      if (nextActions.length === 0) { console.log('✓ No pending actions.'); return; }
      console.log(`Next actions (${nextActions.length}):`);
      for (const a of nextActions) console.log(`  • ${a.agentId}: ${a.action} → ${(a.task || '').slice(0, 80)}`);
      break;
    }
    case 'status': {
      const data = await getSwarmStatus(ctx, positional[1]);
      if (!data) { console.log('No swarms found.'); return; }
      if (Array.isArray(data)) {
        for (const r of data) console.log(`  ${r.id} [${r.status}] — ${r.goal.slice(0, 60)} (${r.agents.length} agents)`);
      } else {
        console.log(`Swarm: ${data.id} [${data.status}]`);
        console.log(`Goal: ${data.goal}`);
        console.log(`Strategy: ${data.config.strategy} | Iterations: ${data.iterations}`);
        for (const a of data.agents) console.log(`  ${a.id} [${a.role}] ${a.status}`);
      }
      break;
    }
    default:
      console.log('Usage: loopspec swarm <init|add|next|status>');
  }
}
