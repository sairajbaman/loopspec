import path from 'node:path';
import fs from 'node:fs';
import type { AppContext } from '../../context.js';
import { detectDrift } from '../live-sync/index.js';
import { detectPreventiveViolations, type Violation } from '../guardrails/preventive.js';
import type { TuiState } from '../../cli/output.js';

export interface WatchEvent {
  file: string;
  message: string;
  level: 'error' | 'warn' | 'info' | 'ok';
  suggestion?: string;
  category?: string;
}

interface WatcherCallbacks {
  onEvent: (event: WatchEvent) => void;
}

interface WatcherInstance {
  start(): void;
  stop(): void;
  runOnce(): Promise<void>;
  getState(): TuiState;
}

const IGNORE = ['node_modules', '.git', 'dist', '.next', '.loopspec', 'build', 'out'];
const EXTENSIONS = ['.ts', '.tsx', '.jsx', '.svelte', '.vue', '.js'];

export async function createWatcher(ctx: AppContext, callbacks: WatcherCallbacks): Promise<WatcherInstance> {
  let watcher: any = null;
  const state: TuiState = { watchedFiles: [], goals: [], issues: [], score: 0 };
  let debounceTimer: NodeJS.Timeout | null = null;

  async function analyzeFile(filePath: string) {
    const relPath = path.relative(ctx.projectDir, filePath);
    const ext = path.extname(filePath);
    if (!EXTENSIONS.includes(ext)) return;
    if (IGNORE.some(i => relPath.includes(i))) return;

    // Track file
    if (!state.watchedFiles.includes(relPath)) {
      state.watchedFiles.push(relPath);
    }

    // 1. Drift detection
    try {
      const drifts = await detectDrift(ctx, relPath);
      for (const d of drifts) {
        const event: WatchEvent = {
          file: relPath,
          message: `${d.category}: ${d.specExpectation}`,
          level: d.severity === 'critical' ? 'error' : d.severity === 'high' ? 'error' : 'warn',
          suggestion: d.suggestion,
          category: d.category,
        };
        state.issues.push({ file: relPath, message: event.message, level: event.level });
        callbacks.onEvent(event);
      }
    } catch {}

    // 2. Preventive guardrails
    try {
      const violations = await detectPreventiveViolations(ctx, relPath);
      for (const v of violations) {
        const event: WatchEvent = {
          file: relPath,
          message: v.message,
          level: v.level,
          suggestion: v.suggestion,
        };
        state.issues.push({ file: relPath, message: v.message, level: v.level });
        callbacks.onEvent(event);
      }
    } catch {}
  }

  return {
    start() {
      // Dynamic import chokidar (ES module)
      import('chokidar').then(({ watch }) => {
        const globs = ['src/**/*', 'app/**/*', 'pages/**/*', 'lib/**/*', 'components/**/*'];
        watcher = watch(globs, {
          cwd: ctx.projectDir,
          ignored: IGNORE.map(i => `**/${i}/**`),
          persistent: true,
          ignoreInitial: true,
          awaitWriteFinish: { stabilityThreshold: 300 },
        });

        watcher.on('change', (file: string) => {
          // Debounce rapid saves
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            analyzeFile(path.resolve(ctx.projectDir, file));
          }, 300);
        });

        watcher.on('add', (file: string) => {
          const relPath = path.relative(ctx.projectDir, path.resolve(ctx.projectDir, file));
          if (!state.watchedFiles.includes(relPath)) {
            state.watchedFiles.push(relPath);
          }
        });
      }).catch(err => {
        callbacks.onEvent({ file: '', message: `Watcher init failed: ${err.message}`, level: 'error' });
      });
    },

    stop() {
      if (watcher) watcher.close();
      if (debounceTimer) clearTimeout(debounceTimer);
    },

    async runOnce() {
      // Single-pass: find recently modified files and analyze them
      const since = Date.now() - 5 * 60 * 1000; // last 5 minutes
      const files = getRecentFiles(ctx.projectDir, since);
      for (const f of files.slice(0, 20)) {
        await analyzeFile(f);
      }
    },

    getState() {
      return state;
    },
  };
}

function getRecentFiles(dir: string, since: number): string[] {
  const results: string[] = [];
  function walk(d: string) {
    try {
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const entry of entries) {
        if (IGNORE.includes(entry.name) || entry.name.startsWith('.')) continue;
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (EXTENSIONS.includes(path.extname(entry.name))) {
          try {
            if (fs.statSync(full).mtimeMs > since) results.push(full);
          } catch {}
        }
      }
    } catch {}
  }
  walk(dir);
  return results;
}
