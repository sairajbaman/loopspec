import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { createContext } from '../../src/context.js';
import { createPlan, spawnSubLoop, startLoop, completeLoop, getNextActions, getPlanStatus, cancelLoop } from '../../src/engines/orchestrator/index.js';

const TEST_DIR = path.join(process.cwd(), '.test-orch-' + Date.now());

function makeCtx() { return createContext(TEST_DIR); }

describe('Cross-Agent Orchestrator Engine', () => {
  beforeEach(() => { fs.mkdirSync(path.join(TEST_DIR, '.loopspec', 'orchestration'), { recursive: true }); });

  it('creates a plan with root loop', async () => {
    const ctx = makeCtx();
    const plan = await createPlan(ctx, 'Build SaaS every day');
    expect(plan.id).toMatch(/^orch_/);
    expect(plan.rootGoal).toBe('Build SaaS every day');
    expect(plan.loops).toHaveLength(1);
    expect(plan.loops[0].parentId).toBeNull();
    expect(plan.loops[0].status).toBe('running');
  });

  it('spawns a sub-loop', async () => {
    const ctx = makeCtx();
    const plan = await createPlan(ctx, 'root goal');
    const root = plan.loops[0];
    const sub = await spawnSubLoop(ctx, plan.id, root.id, 'frontend', 'Build React frontend');
    expect(sub.parentId).toBe(root.id);
    expect(sub.depth).toBe(1);
    expect(sub.status).toBe('pending');
  });

  it('enforces max depth', async () => {
    const ctx = makeCtx();
    const plan = await createPlan(ctx, 'root', 1); // max depth 1
    const root = plan.loops[0];
    const sub = await spawnSubLoop(ctx, plan.id, root.id, 'child', 'child goal');
    await expect(spawnSubLoop(ctx, plan.id, sub.id, 'grandchild', 'too deep'))
      .rejects.toThrow('Max depth');
  });

  it('enforces max loops', async () => {
    const ctx = makeCtx();
    const plan = await createPlan(ctx, 'root', 5, 2); // max 2 loops (root counts)
    const root = plan.loops[0];
    await spawnSubLoop(ctx, plan.id, root.id, 'a', 'a');
    await expect(spawnSubLoop(ctx, plan.id, root.id, 'b', 'b'))
      .rejects.toThrow('Max loops');
  });

  it('starts a loop', async () => {
    const ctx = makeCtx();
    const plan = await createPlan(ctx, 'root');
    const root = plan.loops[0];
    const sub = await spawnSubLoop(ctx, plan.id, root.id, 'sub', 'do thing');
    const started = await startLoop(ctx, plan.id, sub.id);
    expect(started.status).toBe('running');
  });

  it('completes a loop successfully', async () => {
    const ctx = makeCtx();
    const plan = await createPlan(ctx, 'root');
    const root = plan.loops[0];
    const sub = await spawnSubLoop(ctx, plan.id, root.id, 'sub', 'task');
    await startLoop(ctx, plan.id, sub.id);
    await completeLoop(ctx, plan.id, sub.id, true, 'done');
    const updated = await getPlanStatus(ctx, plan.id);
    const loop = (updated as any).loops.find((l: any) => l.id === sub.id);
    expect(loop.status).toBe('done');
    expect(loop.result).toBe('done');
  });

  it('marks plan completed when all loops done', async () => {
    const ctx = makeCtx();
    const plan = await createPlan(ctx, 'root');
    const root = plan.loops[0];
    // Complete the root
    const updated = await completeLoop(ctx, plan.id, root.id, true, 'all done');
    expect(updated.status).toBe('completed');
  });

  it('gets next actions for pending loops', async () => {
    const ctx = makeCtx();
    const plan = await createPlan(ctx, 'root');
    const root = plan.loops[0];
    await spawnSubLoop(ctx, plan.id, root.id, 'a', 'task a');
    await spawnSubLoop(ctx, plan.id, root.id, 'b', 'task b');
    const actions = await getNextActions(ctx, plan.id);
    expect(actions.length).toBe(2);
  });

  it('cancels a loop and its children', async () => {
    const ctx = makeCtx();
    const plan = await createPlan(ctx, 'root');
    const root = plan.loops[0];
    const sub = await spawnSubLoop(ctx, plan.id, root.id, 'sub', 'task');
    await spawnSubLoop(ctx, plan.id, sub.id, 'deep', 'deep task');
    const updated = await cancelLoop(ctx, plan.id, sub.id);
    const cancelled = updated.loops.filter(l => l.status === 'cancelled');
    expect(cancelled.length).toBe(2); // sub + deep
  });

  it('retrieves plan status', async () => {
    const ctx = makeCtx();
    await createPlan(ctx, 'plan 1');
    const all = await getPlanStatus(ctx);
    expect(Array.isArray(all)).toBe(true);
    expect((all as any[]).length).toBeGreaterThan(0);
  });

  afterAll(() => { fs.rmSync(TEST_DIR, { recursive: true, force: true }); });
});
