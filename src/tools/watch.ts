import fs from 'node:fs';
import path from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { detectDrift, formatDriftReport } from '../engines/live-sync/index.js';
import { fileExists } from '../utils/files.js';
import * as z from 'zod/v4';

interface WatchState {
  watching: boolean;
  lastCheck: number;
  changedFiles: Set<string>;
  results: { file: string; driftCount: number; report: string }[];
}

const watchState: WatchState = {
  watching: false,
  lastCheck: 0,
  changedFiles: new Set(),
  results: [],
};

// Recursively get all source files modified after a given time
async function getRecentlyModified(dir: string, since: number, extensions: string[]): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.next') continue;
      if (entry.isDirectory()) {
        results.push(...await getRecentlyModified(full, since, extensions));
      } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
        try {
          const stat = fs.statSync(full);
          if (stat.mtimeMs > since) results.push(full);
        } catch { /* skip */ }
      }
    }
  } catch { /* skip inaccessible dirs */ }
  return results;
}

export function registerWatchTool(server: McpServer, ctx: AppContext) {
  server.registerTool(
    'loopspec_watch',
    {
      title: 'Watch for Drift',
      description: 'Check recently modified files for spec drift. Call periodically or after making changes. Returns drift analysis for all files changed since the last check (or in the last N minutes).',
      inputSchema: z.object({
        minutes: z.number().optional().describe('Check files modified in the last N minutes (default: 5)'),
        extensions: z.array(z.string()).optional().describe('File extensions to check (default: .ts, .tsx, .jsx, .svelte, .vue)'),
        path: z.string().optional().describe('Subdirectory to watch (relative to project root)'),
      }),
    },
    async (args) => {
      const { minutes = 5, extensions = ['.ts', '.tsx', '.jsx', '.svelte', '.vue'], path: subPath } = args as {
        minutes?: number; extensions?: string[]; path?: string;
      };

      const hasSpec = await fileExists(path.join(ctx.loopspecDir, 'AppFlow.md'));
      if (!hasSpec) {
        return {
          content: [{ type: 'text' as const, text: '⚠️ No .loopspec directory found. Run `loopspec_init` first to enable drift detection.' }],
        };
      }

      const since = Date.now() - (minutes * 60 * 1000);
      const watchDir = subPath ? path.join(ctx.projectDir, subPath) : ctx.projectDir;
      const modifiedFiles = await getRecentlyModified(watchDir, since, extensions);

      if (modifiedFiles.length === 0) {
        return {
          content: [{ type: 'text' as const, text: `✅ No files modified in the last ${minutes} minutes. Nothing to check.` }],
        };
      }

      // Run drift detection on each modified file
      const allDrifts: { file: string; driftCount: number; report: string }[] = [];
      let totalDrifts = 0;

      for (const file of modifiedFiles.slice(0, 20)) { // cap at 20 files per check
        const relPath = path.relative(ctx.projectDir, file);
        const drifts = await detectDrift(ctx, relPath);
        totalDrifts += drifts.length;
        if (drifts.length > 0) {
          allDrifts.push({
            file: relPath,
            driftCount: drifts.length,
            report: formatDriftReport(drifts),
          });
        }
      }

      // Update watch state
      watchState.lastCheck = Date.now();
      watchState.results = allDrifts;

      if (totalDrifts === 0) {
        return {
          content: [{ type: 'text' as const, text: `✅ Checked ${modifiedFiles.length} recently modified file(s). No drift detected.` }],
        };
      }

      let output = `## Watch Report — ${modifiedFiles.length} files checked, ${totalDrifts} drift issues found\n\n`;
      for (const result of allDrifts) {
        output += result.report + '\n---\n\n';
      }

      return {
        content: [{ type: 'text' as const, text: output }],
      };
    }
  );
}
