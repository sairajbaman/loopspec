import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { createContext } from '../../src/context.js';
import { initDeployLoop, startDeploy, advanceStage, completeStage, getDeployStatus, stageInstructions } from '../../src/engines/deploy-loop/index.js';

const TEST_DIR = path.join(process.cwd(), '.test-deploy-' + Date.now());

function makeCtx() { return createContext(TEST_DIR); }

describe('Auto-Deploy Loop Engine', () => {
  beforeEach(() => { fs.mkdirSync(path.join(TEST_DIR, '.loopspec', 'deploys'), { recursive: true }); });

  it('initializes deploy config', async () => {
    const ctx = makeCtx();
    const config = await initDeployLoop(ctx);
    expect(config.stages).toContain('build');
    expect(config.stages).toContain('deploy');
    expect(config.environment).toBe('preview');
    expect(config.autoRollback).toBe(true);
  });

  it('starts a deploy run', async () => {
    const ctx = makeCtx();
    await initDeployLoop(ctx);
    const run = await startDeploy(ctx);
    expect(run.id).toMatch(/^deploy_/);
    expect(run.status).toBe('pending');
    expect(run.stages.every(s => s.status === 'pending')).toBe(true);
  });

  it('advances to next stage', async () => {
    const ctx = makeCtx();
    await initDeployLoop(ctx);
    const run = await startDeploy(ctx);
    const { current } = await advanceStage(ctx, run.id);
    expect(current).not.toBeNull();
    expect(current!.stage).toBe('build');
    expect(current!.status).toBe('running');
  });

  it('completes a stage successfully', async () => {
    const ctx = makeCtx();
    await initDeployLoop(ctx);
    const run = await startDeploy(ctx);
    await advanceStage(ctx, run.id);
    const updated = await completeStage(ctx, run.id, 'build', true, 'Build OK');
    const buildStage = updated.stages.find(s => s.stage === 'build');
    expect(buildStage!.status).toBe('passed');
  });

  it('fails pipeline on stage failure', async () => {
    const ctx = makeCtx();
    await initDeployLoop(ctx);
    const run = await startDeploy(ctx);
    await advanceStage(ctx, run.id);
    const updated = await completeStage(ctx, run.id, 'build', false, 'Compile error');
    expect(updated.status).toBe('failed');
    // Remaining stages should be skipped
    const skipped = updated.stages.filter(s => s.status === 'skipped');
    expect(skipped.length).toBeGreaterThan(0);
  });

  it('requires approval for production deploy', async () => {
    const ctx = makeCtx();
    await initDeployLoop(ctx, { environment: 'production' });
    const run = await startDeploy(ctx, 'manual', { environment: 'production' });
    // Advance through build, test, lint, security to reach deploy
    for (const stage of ['build', 'test', 'lint', 'security']) {
      await advanceStage(ctx, run.id);
      await completeStage(ctx, run.id, stage as any, true);
    }
    const { needsApproval } = await advanceStage(ctx, run.id);
    expect(needsApproval).toBe(true);
  });

  it('generates stage instructions', () => {
    const config = { stages: ['build' as const], environment: 'production' as const, autoRollback: true, requireApproval: true, monitorDuration: 60000 };
    const inst = stageInstructions('deploy', config);
    expect(inst).toContain('production');
    expect(inst).toContain('approval');
  });

  it('gets deploy status', async () => {
    const ctx = makeCtx();
    await initDeployLoop(ctx);
    await startDeploy(ctx);
    const all = await getDeployStatus(ctx);
    expect(Array.isArray(all)).toBe(true);
    expect((all as any[]).length).toBeGreaterThan(0);
  });

  afterAll(() => { fs.rmSync(TEST_DIR, { recursive: true, force: true }); });
});
