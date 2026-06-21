import { createContext } from '../../context.js';
import { createPlan, getNextActions, getPlanStatus } from '../../engines/orchestrator/index.js';

export async function runOrchestrateCommand(positional: string[], flags: Record<string, string | boolean>) {
  const ctx = createContext();
  const sub = positional[0];

  switch (sub) {
    case 'create': {
      const goal = positional.slice(1).join(' ') || (flags.goal as string);
      if (!goal) { console.log('Usage: loopspec orchestrate create "<high-level goal>"'); return; }
      const plan = await createPlan(ctx, goal, Number(flags.depth) || 3, Number(flags.max) || 10);
      console.log(`✓ Orchestration plan: ${plan.id}`);
      console.log(`  Root goal: ${plan.rootGoal}`);
      console.log(`  Root loop: ${plan.loops[0].id}`);
      console.log(`  Max depth: ${plan.maxDepth} | Max loops: ${plan.maxLoops}`);
      break;
    }
    case 'next': {
      const planId = positional[1] || (flags.plan as string);
      if (!planId) { console.log('Usage: loopspec orchestrate next <plan-id>'); return; }
      const actions = await getNextActions(ctx, planId);
      if (actions.length === 0) { console.log('✓ No pending loops.'); return; }
      console.log(`Next loops (${actions.length}):`);
      for (const a of actions) console.log(`  • ${a.loopId} [depth ${a.depth}]: ${a.goal.slice(0, 80)}`);
      break;
    }
    case 'status': {
      const data = await getPlanStatus(ctx, positional[1]);
      if (!data) { console.log('No plans found.'); return; }
      if (Array.isArray(data)) {
        for (const p of data) console.log(`  ${p.id} [${p.status}] — ${p.rootGoal.slice(0, 60)} (${p.loops.length} loops)`);
      } else {
        console.log(`Plan: ${data.id} [${data.status}]`);
        console.log(`Goal: ${data.rootGoal}`);
        for (const l of data.loops) {
          const indent = '  '.repeat(l.depth + 1);
          const icon = l.status === 'done' ? '✓' : l.status === 'failed' ? '✗' : l.status === 'running' ? '▶' : '○';
          console.log(`${indent}${icon} ${l.name}: ${l.goal.slice(0, 50)}`);
        }
      }
      break;
    }
    default:
      console.log('Usage: loopspec orchestrate <create|next|status>');
  }
}
