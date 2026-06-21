import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { createContext } from '../../src/context.js';
import { initDaemon, enableDaemon, disableDaemon, addDaemonTask, removeDaemonTask, tick, recordCompletion, getDaemonStatus } from '../../src/engines/daemon/index.js';

const TEST_DIR = path.join(process.cwd(), '.test-daemon-' + Date.now());

function makeCtx() { return createContext(TEST_DIR); }

describe('Autonomous Daemon Engine', () => {
  beforeEach(() => { fs.mkdirSync(path.join(TEST_DIR, '.loopspec'), { recursive: true }); });

  it('initializes with default tasks', async () => {
    const ctx = makeCtx();
    const state = await initDaemon(ctx);
    expect(state.enabled).toBe(false);
    expect(state.tasks.length).toBeGreaterThan(0);
    expect(state.tasks.some(t => t.action === 'security-scan')).toBe(true);
  });

  it('enables the daemon', async () => {
    const ctx = makeCtx();
    await initDaemon(ctx);
    const state = await enableDaemon(ctx);
    expect(state.enabled).toBe(true);
  });

  it('disables the daemon', async () => {
    const ctx = makeCtx();
    await initDaemon(ctx);
    await enableDaemon(ctx);
    const state = await disableDaemon(ctx);
    expect(state.enabled).toBe(false);
  });

  it('adds a custom task', async () => {
    const ctx = makeCtx();
    await initDaemon(ctx);
    const state = await addDaemonTask(ctx, {
      name: 'Custom Check',
      description: 'A custom task',
      schedule: { type: 'cron-like', pattern: 'hourly' },
      action: 'custom',
      enabled: true,
    });
    expect(state.tasks.some(t => t.name === 'Custom Check')).toBe(true);
  });

  it('removes a task', async () => {
    const ctx = makeCtx();
    const state = await initDaemon(ctx);
    const taskId = state.tasks[0].id;
    const updated = await removeDaemonTask(ctx, taskId);
    expect(updated.tasks.find(t => t.id === taskId)).toBeUndefined();
  });

  it('tick does nothing when disabled', async () => {
    const ctx = makeCtx();
    await initDaemon(ctx);
    const { triggered } = await tick(ctx);
    expect(triggered).toHaveLength(0);
  });

  it('tick triggers due tasks when enabled', async () => {
    const ctx = makeCtx();
    await initDaemon(ctx);
    await enableDaemon(ctx);
    // All default tasks should trigger since no prior runs
    const { triggered } = await tick(ctx);
    // At least drift and security should trigger (daily, never run before)
    expect(triggered.length).toBeGreaterThan(0);
  });

  it('records completion', async () => {
    const ctx = makeCtx();
    await initDaemon(ctx);
    await enableDaemon(ctx);
    const { triggered } = await tick(ctx);
    // Use the first triggered task's id
    const taskId = triggered.length > 0 ? triggered[0].id : 'daemon_security';
    const state = await recordCompletion(ctx, taskId, true, 'No issues found');
    const run = state.history.find(h => h.taskId === taskId && h.status === 'success');
    expect(run).toBeDefined();
    expect(run!.output).toBe('No issues found');
  });

  it('gets daemon status', async () => {
    const ctx = makeCtx();
    await initDaemon(ctx);
    const state = await getDaemonStatus(ctx);
    expect(state).toBeDefined();
    expect(state.tasks).toBeDefined();
  });

  afterAll(() => { fs.rmSync(TEST_DIR, { recursive: true, force: true }); });
});
