import path from 'node:path';
import type { AppContext } from '../../context.js';
import { readFile, writeFile } from '../../utils/files.js';
import { parseYaml, dumpYaml } from '../../utils/yaml.js';

export interface DaemonSchedule {
  type: 'interval' | 'cron-like' | 'on-change' | 'on-push';
  intervalMs?: number;
  pattern?: string;
}

export interface DaemonTask {
  id: string;
  name: string;
  description: string;
  schedule: DaemonSchedule;
  action: 'security-scan' | 'docs-update' | 'test-run' | 'drift-check' | 'compound-learn' | 'deploy' | 'custom';
  enabled: boolean;
}

export interface DaemonRun {
  taskId: string;
  startedAt: number;
  completedAt?: number;
  status: 'running' | 'success' | 'failed';
  output?: string;
}

export interface DaemonState {
  enabled: boolean;
  tasks: DaemonTask[];
  history: DaemonRun[];
  lastTick: number;
}

export async function initDaemon(ctx: AppContext): Promise<DaemonState> {
  await ctx.ensureLoopspecDir();
  const existing = await loadState(ctx);
  if (existing) return existing;
  const state: DaemonState = { enabled: false, tasks: defaultTasks(), history: [], lastTick: Date.now() };
  await saveState(ctx, state);
  return state;
}

export async function enableDaemon(ctx: AppContext): Promise<DaemonState> {
  const state = await loadOrInit(ctx);
  state.enabled = true;
  state.lastTick = Date.now();
  await saveState(ctx, state);
  return state;
}

export async function disableDaemon(ctx: AppContext): Promise<DaemonState> {
  const state = await loadOrInit(ctx);
  state.enabled = false;
  await saveState(ctx, state);
  return state;
}

export async function addDaemonTask(ctx: AppContext, task: Omit<DaemonTask, 'id'>): Promise<DaemonState> {
  const state = await loadOrInit(ctx);
  state.tasks.push({ ...task, id: `task_${Date.now()}` });
  await saveState(ctx, state);
  return state;
}

export async function removeDaemonTask(ctx: AppContext, taskId: string): Promise<DaemonState> {
  const state = await loadOrInit(ctx);
  state.tasks = state.tasks.filter(t => t.id !== taskId);
  await saveState(ctx, state);
  return state;
}

export async function tick(ctx: AppContext): Promise<{ triggered: DaemonTask[]; state: DaemonState }> {
  const state = await loadOrInit(ctx);
  if (!state.enabled) return { triggered: [], state };
  const now = Date.now();
  const triggered: DaemonTask[] = [];

  for (const task of state.tasks.filter(t => t.enabled)) {
    if (shouldRun(task, state, now)) {
      triggered.push(task);
      state.history.push({ taskId: task.id, startedAt: now, status: 'running' });
    }
  }
  state.lastTick = now;
  if (state.history.length > 100) state.history = state.history.slice(-100);
  await saveState(ctx, state);
  return { triggered, state };
}

export async function recordCompletion(ctx: AppContext, taskId: string, success: boolean, output?: string): Promise<DaemonState> {
  const state = await loadOrInit(ctx);
  const run = [...state.history].reverse().find(h => h.taskId === taskId && h.status === 'running');
  if (run) {
    run.status = success ? 'success' : 'failed';
    run.completedAt = Date.now();
    run.output = output?.slice(0, 2000);
  }
  await saveState(ctx, state);
  return state;
}

export async function getDaemonStatus(ctx: AppContext): Promise<DaemonState> {
  return loadOrInit(ctx);
}

function shouldRun(task: DaemonTask, state: DaemonState, now: number): boolean {
  const lastRun = [...state.history].reverse().find(h => h.taskId === task.id && h.status !== 'running');
  const elapsed = now - (lastRun?.completedAt || 0);
  if (task.schedule.type === 'interval') return elapsed >= (task.schedule.intervalMs || 3600000);
  if (task.schedule.type === 'cron-like') {
    const ms = task.schedule.pattern === 'hourly' ? 3600000 : task.schedule.pattern === 'weekly' ? 604800000 : 86400000;
    return elapsed >= ms;
  }
  return false;
}

function defaultTasks(): DaemonTask[] {
  return [
    { id: 'daemon_security', name: 'Security Scan', description: 'Run security guardrails on changed files', schedule: { type: 'cron-like', pattern: 'daily' }, action: 'security-scan', enabled: true },
    { id: 'daemon_drift', name: 'Drift Check', description: 'Check source files for spec drift', schedule: { type: 'cron-like', pattern: 'daily' }, action: 'drift-check', enabled: true },
    { id: 'daemon_docs', name: 'Docs Update', description: 'Auto-update docs from code changes', schedule: { type: 'cron-like', pattern: 'weekly' }, action: 'docs-update', enabled: false },
    { id: 'daemon_learn', name: 'Compound Learn', description: 'Extract patterns from recent work', schedule: { type: 'cron-like', pattern: 'daily' }, action: 'compound-learn', enabled: true },
    { id: 'daemon_tests', name: 'Test Runner', description: 'Run test suite on push', schedule: { type: 'on-push' }, action: 'test-run', enabled: true },
  ];
}

async function saveState(ctx: AppContext, state: DaemonState): Promise<void> {
  await writeFile(path.join(ctx.loopspecDir, 'daemon.yaml'), dumpYaml(state));
}

async function loadState(ctx: AppContext): Promise<DaemonState | null> {
  const content = await readFile(path.join(ctx.loopspecDir, 'daemon.yaml'));
  if (!content) return null;
  return parseYaml<DaemonState>(content);
}

async function loadOrInit(ctx: AppContext): Promise<DaemonState> {
  return (await loadState(ctx)) || initDaemon(ctx);
}
