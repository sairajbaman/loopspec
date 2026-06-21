import path from 'node:path';
import type { AppContext } from '../../context.js';
import { readFile, writeFile } from '../../utils/files.js';
import { parseYaml, dumpYaml } from '../../utils/yaml.js';

export interface SwarmAgent {
  id: string;
  role: 'maker' | 'checker' | 'planner' | 'deployer' | 'monitor' | 'custom';
  status: 'idle' | 'running' | 'done' | 'failed' | 'waiting';
  task?: string;
  result?: string;
  error?: string;
  retries: number;
  startedAt?: number;
  completedAt?: number;
}

export interface SwarmConfig {
  strategy: 'parallel' | 'pipeline' | 'fan-out-fan-in' | 'round-robin';
  maxConcurrent: number;
  maxRetries: number;
  humanApproval: 'never' | 'on-deploy' | 'on-failure' | 'always';
  verifyAfterEach: boolean;
  timeout: number;
}

export interface SwarmRun {
  id: string;
  goal: string;
  config: SwarmConfig;
  agents: SwarmAgent[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  startedAt: number;
  completedAt?: number;
  iterations: number;
  results: Array<{ agentId: string; task: string; output: string; success: boolean }>;
}

const DEFAULT_CONFIG: SwarmConfig = {
  strategy: 'pipeline',
  maxConcurrent: 3,
  maxRetries: 2,
  humanApproval: 'on-failure',
  verifyAfterEach: true,
  timeout: 120000,
};

export async function initSwarm(ctx: AppContext, goal: string, config?: Partial<SwarmConfig>): Promise<SwarmRun> {
  await ctx.ensureLoopspecDir();
  const merged = { ...DEFAULT_CONFIG, ...config };
  const run: SwarmRun = {
    id: `swarm_${Date.now()}`,
    goal,
    config: merged,
    agents: [],
    status: 'pending',
    startedAt: Date.now(),
    iterations: 0,
    results: [],
  };
  await saveSwarmState(ctx, run);
  return run;
}

export async function addAgent(ctx: AppContext, swarmId: string, agent: Omit<SwarmAgent, 'retries' | 'status'>): Promise<SwarmRun> {
  const run = await loadSwarmState(ctx, swarmId);
  if (!run) throw new Error(`Swarm ${swarmId} not found`);
  run.agents.push({ ...agent, status: 'idle', retries: 0 });
  await saveSwarmState(ctx, run);
  return run;
}

export async function assignTask(ctx: AppContext, swarmId: string, agentId: string, task: string): Promise<SwarmAgent> {
  const run = await loadSwarmState(ctx, swarmId);
  if (!run) throw new Error(`Swarm ${swarmId} not found`);
  const agent = run.agents.find(a => a.id === agentId);
  if (!agent) throw new Error(`Agent ${agentId} not found`);
  agent.task = task;
  agent.status = 'running';
  agent.startedAt = Date.now();
  run.status = 'running';
  await saveSwarmState(ctx, run);
  return agent;
}

export async function reportResult(ctx: AppContext, swarmId: string, agentId: string, result: string, success: boolean): Promise<SwarmRun> {
  const run = await loadSwarmState(ctx, swarmId);
  if (!run) throw new Error(`Swarm ${swarmId} not found`);
  const agent = run.agents.find(a => a.id === agentId);
  if (!agent) throw new Error(`Agent ${agentId} not found`);

  agent.completedAt = Date.now();
  if (success) {
    agent.status = 'done';
    agent.result = result;
  } else {
    agent.retries++;
    agent.status = agent.retries >= run.config.maxRetries ? 'failed' : 'waiting';
    agent.error = result;
  }

  run.results.push({ agentId, task: agent.task || '', output: result, success });
  run.iterations++;

  const allDone = run.agents.every(a => a.status === 'done' || a.status === 'failed');
  if (allDone) {
    run.status = run.agents.some(a => a.status === 'failed') ? 'failed' : 'completed';
    run.completedAt = Date.now();
  }
  await saveSwarmState(ctx, run);
  return run;
}

export async function orchestrate(ctx: AppContext, swarmId: string): Promise<{ nextActions: Array<{ agentId: string; action: string; task?: string }> }> {
  const run = await loadSwarmState(ctx, swarmId);
  if (!run) throw new Error(`Swarm ${swarmId} not found`);
  const nextActions: Array<{ agentId: string; action: string; task?: string }> = [];

  if (run.config.strategy === 'parallel') {
    for (const agent of run.agents.filter(a => a.status === 'idle' || a.status === 'waiting')) {
      nextActions.push({ agentId: agent.id, action: 'execute', task: agent.task });
    }
  } else if (run.config.strategy === 'pipeline') {
    const idx = run.agents.findIndex(a => a.status === 'idle' || a.status === 'waiting');
    if (idx >= 0) {
      const agent = run.agents[idx];
      const prev = idx > 0 ? run.agents[idx - 1]?.result : undefined;
      nextActions.push({ agentId: agent.id, action: 'execute', task: prev ? `${agent.task}\n\nPrevious: ${prev}` : agent.task });
    }
  } else {
    const idle = run.agents.filter(a => a.status === 'idle' || a.status === 'waiting');
    const running = run.agents.filter(a => a.status === 'running');
    const batch = idle.slice(0, run.config.maxConcurrent - running.length);
    for (const agent of batch) {
      nextActions.push({ agentId: agent.id, action: 'execute', task: agent.task });
    }
  }
  return { nextActions };
}

export async function getSwarmStatus(ctx: AppContext, swarmId?: string): Promise<SwarmRun | SwarmRun[] | null> {
  if (swarmId) return loadSwarmState(ctx, swarmId);
  return loadAllSwarms(ctx);
}

export async function pauseSwarm(ctx: AppContext, swarmId: string): Promise<SwarmRun> {
  const run = await loadSwarmState(ctx, swarmId);
  if (!run) throw new Error(`Swarm ${swarmId} not found`);
  run.status = 'paused';
  await saveSwarmState(ctx, run);
  return run;
}

async function saveSwarmState(ctx: AppContext, run: SwarmRun): Promise<void> {
  const filePath = path.join(ctx.loopspecDir, 'swarm', `${run.id}.yaml`);
  await writeFile(filePath, dumpYaml(run));
}

async function loadSwarmState(ctx: AppContext, swarmId: string): Promise<SwarmRun | null> {
  const content = await readFile(path.join(ctx.loopspecDir, 'swarm', `${swarmId}.yaml`));
  if (!content) return null;
  return parseYaml<SwarmRun>(content);
}

async function loadAllSwarms(ctx: AppContext): Promise<SwarmRun[]> {
  const dir = path.join(ctx.loopspecDir, 'swarm');
  try {
    const { readdirSync } = await import('node:fs');
    const files = readdirSync(dir).filter(f => f.endsWith('.yaml'));
    const runs: SwarmRun[] = [];
    for (const f of files) {
      const content = await readFile(path.join(dir, f));
      if (content) runs.push(parseYaml<SwarmRun>(content));
    }
    return runs.sort((a, b) => b.startedAt - a.startedAt);
  } catch { return []; }
}
