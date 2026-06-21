import { describe, it, expect, beforeEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { createContext } from '../../src/context.js';
import { initSwarm, addAgent, assignTask, reportResult, orchestrate, getSwarmStatus, pauseSwarm } from '../../src/engines/swarm/index.js';

const TEST_DIR = path.join(process.cwd(), '.test-swarm-' + Date.now());

function makeCtx() {
  return createContext(TEST_DIR);
}

describe('Swarm Coordinator Engine', () => {
  beforeEach(() => {
    fs.mkdirSync(path.join(TEST_DIR, '.loopspec', 'swarm'), { recursive: true });
  });

  it('initializes a swarm with defaults', async () => {
    const ctx = makeCtx();
    const run = await initSwarm(ctx, 'Build an e-commerce app');
    expect(run.id).toMatch(/^swarm_/);
    expect(run.goal).toBe('Build an e-commerce app');
    expect(run.config.strategy).toBe('pipeline');
    expect(run.status).toBe('pending');
    expect(run.agents).toHaveLength(0);
  });

  it('initializes with custom strategy', async () => {
    const ctx = makeCtx();
    const run = await initSwarm(ctx, 'test', { strategy: 'parallel', maxRetries: 5 });
    expect(run.config.strategy).toBe('parallel');
    expect(run.config.maxRetries).toBe(5);
  });

  it('adds agents to a swarm', async () => {
    const ctx = makeCtx();
    const run = await initSwarm(ctx, 'test goal');
    const updated = await addAgent(ctx, run.id, { id: 'planner-1', role: 'planner' });
    expect(updated.agents).toHaveLength(1);
    expect(updated.agents[0].id).toBe('planner-1');
    expect(updated.agents[0].status).toBe('idle');
  });

  it('assigns tasks to agents', async () => {
    const ctx = makeCtx();
    const run = await initSwarm(ctx, 'test');
    await addAgent(ctx, run.id, { id: 'maker-1', role: 'maker' });
    const agent = await assignTask(ctx, run.id, 'maker-1', 'Write auth module');
    expect(agent.status).toBe('running');
    expect(agent.task).toBe('Write auth module');
  });

  it('reports success results', async () => {
    const ctx = makeCtx();
    const run = await initSwarm(ctx, 'test');
    await addAgent(ctx, run.id, { id: 'a1', role: 'maker' });
    await assignTask(ctx, run.id, 'a1', 'task');
    const updated = await reportResult(ctx, run.id, 'a1', 'done', true);
    expect(updated.agents[0].status).toBe('done');
    expect(updated.iterations).toBe(1);
  });

  it('reports failure and retries', async () => {
    const ctx = makeCtx();
    const run = await initSwarm(ctx, 'test', { maxRetries: 2 });
    await addAgent(ctx, run.id, { id: 'a1', role: 'maker' });
    await assignTask(ctx, run.id, 'a1', 'task');
    const updated = await reportResult(ctx, run.id, 'a1', 'error msg', false);
    expect(updated.agents[0].status).toBe('waiting');
    expect(updated.agents[0].retries).toBe(1);
  });

  it('marks agent failed after max retries', async () => {
    const ctx = makeCtx();
    const run = await initSwarm(ctx, 'test', { maxRetries: 1 });
    await addAgent(ctx, run.id, { id: 'a1', role: 'maker' });
    await assignTask(ctx, run.id, 'a1', 'task');
    const updated = await reportResult(ctx, run.id, 'a1', 'error', false);
    expect(updated.agents[0].status).toBe('failed');
  });

  it('completes swarm when all agents done', async () => {
    const ctx = makeCtx();
    const run = await initSwarm(ctx, 'test');
    await addAgent(ctx, run.id, { id: 'a1', role: 'maker' });
    await assignTask(ctx, run.id, 'a1', 'task');
    const updated = await reportResult(ctx, run.id, 'a1', 'ok', true);
    expect(updated.status).toBe('completed');
  });

  it('orchestrates parallel strategy', async () => {
    const ctx = makeCtx();
    const run = await initSwarm(ctx, 'test', { strategy: 'parallel' });
    await addAgent(ctx, run.id, { id: 'a1', role: 'maker', task: 'frontend' });
    await addAgent(ctx, run.id, { id: 'a2', role: 'maker', task: 'backend' });
    const { nextActions } = await orchestrate(ctx, run.id);
    expect(nextActions).toHaveLength(2);
  });

  it('orchestrates pipeline strategy sequentially', async () => {
    const ctx = makeCtx();
    const run = await initSwarm(ctx, 'test', { strategy: 'pipeline' });
    await addAgent(ctx, run.id, { id: 'a1', role: 'planner', task: 'plan' });
    await addAgent(ctx, run.id, { id: 'a2', role: 'maker', task: 'build' });
    const { nextActions } = await orchestrate(ctx, run.id);
    expect(nextActions).toHaveLength(1);
    expect(nextActions[0].agentId).toBe('a1');
  });

  it('pauses a swarm', async () => {
    const ctx = makeCtx();
    const run = await initSwarm(ctx, 'test');
    const paused = await pauseSwarm(ctx, run.id);
    expect(paused.status).toBe('paused');
  });

  it('retrieves swarm status', async () => {
    const ctx = makeCtx();
    await initSwarm(ctx, 'goal 1');
    const all = await getSwarmStatus(ctx);
    expect(Array.isArray(all)).toBe(true);
    expect((all as any[]).length).toBeGreaterThan(0);
  });

  // cleanup
  afterAll(() => { fs.rmSync(TEST_DIR, { recursive: true, force: true }); });
});
