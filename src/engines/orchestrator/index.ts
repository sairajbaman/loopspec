import path from 'node:path';
import type { AppContext } from '../../context.js';
import { readFile, writeFile } from '../../utils/files.js';
import { parseYaml, dumpYaml } from '../../utils/yaml.js';

export interface SubLoop {
  id: string;
  parentId: string | null;
  name: string;
  goal: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'cancelled';
  depth: number;
  children: string[];
  result?: string;
  startedAt: number;
  completedAt?: number;
}

export interface OrchestrationPlan {
  id: string;
  rootGoal: string;
  maxDepth: number;
  maxLoops: number;
  loops: SubLoop[];
  status: 'active' | 'completed' | 'failed';
  startedAt: number;
  completedAt?: number;
}

export async function createPlan(ctx: AppContext, rootGoal: string, maxDepth = 3, maxLoops = 10): Promise<OrchestrationPlan> {
  await ctx.ensureLoopspecDir();
  const plan: OrchestrationPlan = {
    id: `orch_${Date.now()}`,
    rootGoal,
    maxDepth,
    maxLoops,
    loops: [],
    status: 'active',
    startedAt: Date.now(),
  };
  // Create the root loop
  plan.loops.push({
    id: `loop_root_${Date.now()}`,
    parentId: null,
    name: 'root',
    goal: rootGoal,
    status: 'running',
    depth: 0,
    children: [],
    startedAt: Date.now(),
  });
  await savePlan(ctx, plan);
  return plan;
}

export async function spawnSubLoop(ctx: AppContext, planId: string, parentLoopId: string, name: string, goal: string): Promise<SubLoop> {
  const plan = await loadPlan(ctx, planId);
  if (!plan) throw new Error(`Plan ${planId} not found`);
  const parent = plan.loops.find(l => l.id === parentLoopId);
  if (!parent) throw new Error(`Parent loop ${parentLoopId} not found`);
  if (parent.depth + 1 > plan.maxDepth) throw new Error(`Max depth ${plan.maxDepth} reached`);
  if (plan.loops.length >= plan.maxLoops) throw new Error(`Max loops ${plan.maxLoops} reached`);

  const sub: SubLoop = {
    id: `loop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    parentId: parentLoopId,
    name,
    goal,
    status: 'pending',
    depth: parent.depth + 1,
    children: [],
    startedAt: Date.now(),
  };
  parent.children.push(sub.id);
  plan.loops.push(sub);
  await savePlan(ctx, plan);
  return sub;
}

export async function startLoop(ctx: AppContext, planId: string, loopId: string): Promise<SubLoop> {
  const plan = await loadPlan(ctx, planId);
  if (!plan) throw new Error(`Plan ${planId} not found`);
  const loop = plan.loops.find(l => l.id === loopId);
  if (!loop) throw new Error(`Loop ${loopId} not found`);
  loop.status = 'running';
  loop.startedAt = Date.now();
  await savePlan(ctx, plan);
  return loop;
}

export async function completeLoop(ctx: AppContext, planId: string, loopId: string, success: boolean, result?: string): Promise<OrchestrationPlan> {
  const plan = await loadPlan(ctx, planId);
  if (!plan) throw new Error(`Plan ${planId} not found`);
  const loop = plan.loops.find(l => l.id === loopId);
  if (!loop) throw new Error(`Loop ${loopId} not found`);
  loop.status = success ? 'done' : 'failed';
  loop.result = result?.slice(0, 2000);
  loop.completedAt = Date.now();

  // Check if root is done (all children done)
  const root = plan.loops.find(l => l.parentId === null);
  if (root) {
    const allDone = plan.loops.every(l => l.status === 'done' || l.status === 'failed' || l.status === 'cancelled');
    if (allDone) {
      root.status = plan.loops.some(l => l.status === 'failed') ? 'failed' : 'done';
      root.completedAt = Date.now();
      plan.status = root.status === 'done' ? 'completed' : 'failed';
      plan.completedAt = Date.now();
    }
  }
  await savePlan(ctx, plan);
  return plan;
}

export async function getNextActions(ctx: AppContext, planId: string): Promise<Array<{ loopId: string; goal: string; depth: number; parentResult?: string }>> {
  const plan = await loadPlan(ctx, planId);
  if (!plan) return [];
  const actions: Array<{ loopId: string; goal: string; depth: number; parentResult?: string }> = [];
  for (const loop of plan.loops.filter(l => l.status === 'pending')) {
    const parent = loop.parentId ? plan.loops.find(l => l.id === loop.parentId) : null;
    if (!parent || parent.status === 'running' || parent.status === 'done') {
      actions.push({ loopId: loop.id, goal: loop.goal, depth: loop.depth, parentResult: parent?.result });
    }
  }
  return actions;
}

export async function getPlanStatus(ctx: AppContext, planId?: string): Promise<OrchestrationPlan | OrchestrationPlan[] | null> {
  if (planId) return loadPlan(ctx, planId);
  return loadAllPlans(ctx);
}

export async function cancelLoop(ctx: AppContext, planId: string, loopId: string): Promise<OrchestrationPlan> {
  const plan = await loadPlan(ctx, planId);
  if (!plan) throw new Error(`Plan ${planId} not found`);
  const loop = plan.loops.find(l => l.id === loopId);
  if (loop) {
    loop.status = 'cancelled';
    loop.completedAt = Date.now();
    // Cancel all children
    const cancelChildren = (id: string) => {
      for (const child of plan.loops.filter(l => l.parentId === id)) {
        child.status = 'cancelled';
        child.completedAt = Date.now();
        cancelChildren(child.id);
      }
    };
    cancelChildren(loopId);
  }
  await savePlan(ctx, plan);
  return plan;
}

async function savePlan(ctx: AppContext, plan: OrchestrationPlan): Promise<void> {
  await writeFile(path.join(ctx.loopspecDir, 'orchestration', `${plan.id}.yaml`), dumpYaml(plan));
}

async function loadPlan(ctx: AppContext, id: string): Promise<OrchestrationPlan | null> {
  const content = await readFile(path.join(ctx.loopspecDir, 'orchestration', `${id}.yaml`));
  if (!content) return null;
  return parseYaml<OrchestrationPlan>(content);
}

async function loadAllPlans(ctx: AppContext): Promise<OrchestrationPlan[]> {
  const dir = path.join(ctx.loopspecDir, 'orchestration');
  try {
    const { readdirSync } = await import('node:fs');
    const files = readdirSync(dir).filter(f => f.endsWith('.yaml'));
    const plans: OrchestrationPlan[] = [];
    for (const f of files) {
      const content = await readFile(path.join(dir, f));
      if (content) plans.push(parseYaml<OrchestrationPlan>(content));
    }
    return plans.sort((a, b) => b.startedAt - a.startedAt).slice(0, 20);
  } catch { return []; }
}
