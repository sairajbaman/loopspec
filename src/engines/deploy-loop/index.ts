import path from 'node:path';
import type { AppContext } from '../../context.js';
import { readFile, writeFile } from '../../utils/files.js';
import { parseYaml, dumpYaml } from '../../utils/yaml.js';

export type PipelineStage = 'build' | 'test' | 'lint' | 'security' | 'deploy' | 'verify' | 'monitor' | 'rollback';

export interface StageResult {
  stage: PipelineStage;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  startedAt?: number;
  completedAt?: number;
  output?: string;
}

export interface DeployConfig {
  stages: PipelineStage[];
  environment: 'preview' | 'staging' | 'production';
  autoRollback: boolean;
  requireApproval: boolean;
  monitorDuration: number;
  healthCheckUrl?: string;
}

export interface DeployRun {
  id: string;
  config: DeployConfig;
  stages: StageResult[];
  status: 'pending' | 'running' | 'passed' | 'failed' | 'rolled-back';
  startedAt: number;
  completedAt?: number;
  triggeredBy: 'manual' | 'daemon' | 'push';
}

const DEFAULT_CONFIG: DeployConfig = {
  stages: ['build', 'test', 'lint', 'security', 'deploy', 'verify', 'monitor'],
  environment: 'preview',
  autoRollback: true,
  requireApproval: true,
  monitorDuration: 60000,
};

export async function initDeployLoop(ctx: AppContext, config?: Partial<DeployConfig>): Promise<DeployConfig> {
  await ctx.ensureLoopspecDir();
  const merged = { ...DEFAULT_CONFIG, ...config };
  await writeFile(path.join(ctx.loopspecDir, 'deploy-config.yaml'), dumpYaml(merged));
  return merged;
}

export async function startDeploy(ctx: AppContext, triggeredBy: DeployRun['triggeredBy'] = 'manual', config?: Partial<DeployConfig>): Promise<DeployRun> {
  const saved = await loadDeployConfig(ctx);
  const merged = { ...DEFAULT_CONFIG, ...saved, ...config };
  const run: DeployRun = {
    id: `deploy_${Date.now()}`,
    config: merged,
    stages: merged.stages.map(s => ({ stage: s, status: 'pending' as const })),
    status: 'pending',
    startedAt: Date.now(),
    triggeredBy,
  };
  await saveDeployRun(ctx, run);
  return run;
}

export async function advanceStage(ctx: AppContext, deployId: string): Promise<{ current: StageResult | null; run: DeployRun; needsApproval: boolean }> {
  const run = await loadDeployRun(ctx, deployId);
  if (!run) throw new Error(`Deploy ${deployId} not found`);
  const current = run.stages.find(s => s.status === 'pending') || null;
  if (!current) return { current: null, run, needsApproval: false };
  current.status = 'running';
  current.startedAt = Date.now();
  run.status = 'running';
  const needsApproval = current.stage === 'deploy' && run.config.requireApproval && run.config.environment === 'production';
  await saveDeployRun(ctx, run);
  return { current, run, needsApproval };
}

export async function completeStage(ctx: AppContext, deployId: string, stage: PipelineStage, passed: boolean, output?: string): Promise<DeployRun> {
  const run = await loadDeployRun(ctx, deployId);
  if (!run) throw new Error(`Deploy ${deployId} not found`);
  const s = run.stages.find(st => st.stage === stage);
  if (!s) throw new Error(`Stage ${stage} not found`);
  s.status = passed ? 'passed' : 'failed';
  s.completedAt = Date.now();
  s.output = output?.slice(0, 2000);
  if (!passed) {
    for (const r of run.stages.filter(st => st.status === 'pending')) r.status = 'skipped';
    run.status = run.config.autoRollback && stage === 'verify' ? 'rolled-back' : 'failed';
    run.completedAt = Date.now();
  }
  if (run.stages.every(st => st.status === 'passed')) {
    run.status = 'passed';
    run.completedAt = Date.now();
  }
  await saveDeployRun(ctx, run);
  return run;
}

export async function getDeployStatus(ctx: AppContext, deployId?: string): Promise<DeployRun | DeployRun[] | null> {
  if (deployId) return loadDeployRun(ctx, deployId);
  return loadAllDeploys(ctx);
}

export function stageInstructions(stage: PipelineStage, config: DeployConfig): string {
  const map: Record<PipelineStage, string> = {
    build: 'Run project build. Check for compilation errors.',
    test: 'Run full test suite. All tests must pass.',
    lint: 'Run linter/formatter. No errors allowed.',
    security: 'Run security scan (dependency audit + OWASP checks).',
    deploy: `Deploy to ${config.environment}.${config.requireApproval ? ' ⚠️ Requires human approval.' : ''}`,
    verify: `Post-deploy verification.${config.healthCheckUrl ? ` Health: ${config.healthCheckUrl}` : ''}`,
    monitor: `Monitor for ${config.monitorDuration / 1000}s for errors/regressions.`,
    rollback: 'Rollback to previous version. Verify rollback succeeded.',
  };
  return map[stage];
}

async function loadDeployConfig(ctx: AppContext): Promise<DeployConfig | null> {
  const content = await readFile(path.join(ctx.loopspecDir, 'deploy-config.yaml'));
  if (!content) return null;
  return parseYaml<DeployConfig>(content);
}

async function saveDeployRun(ctx: AppContext, run: DeployRun): Promise<void> {
  await writeFile(path.join(ctx.loopspecDir, 'deploys', `${run.id}.yaml`), dumpYaml(run));
}

async function loadDeployRun(ctx: AppContext, id: string): Promise<DeployRun | null> {
  const content = await readFile(path.join(ctx.loopspecDir, 'deploys', `${id}.yaml`));
  if (!content) return null;
  return parseYaml<DeployRun>(content);
}

async function loadAllDeploys(ctx: AppContext): Promise<DeployRun[]> {
  const dir = path.join(ctx.loopspecDir, 'deploys');
  try {
    const { readdirSync } = await import('node:fs');
    const files = readdirSync(dir).filter(f => f.endsWith('.yaml'));
    const runs: DeployRun[] = [];
    for (const f of files) {
      const content = await readFile(path.join(dir, f));
      if (content) runs.push(parseYaml<DeployRun>(content));
    }
    return runs.sort((a, b) => b.startedAt - a.startedAt).slice(0, 20);
  } catch { return []; }
}
