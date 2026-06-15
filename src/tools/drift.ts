import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { detectDrift, formatDriftReport, generateUpdatePrompt } from '../engines/live-sync/index.js';

export function registerDriftTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_drift', {
    title: 'Detect Drift',
    description: 'Check if code has drifted from the spec.',
    inputSchema: z.object({ file: z.string().optional(), directory: z.string().optional() }),
  }, async ({ file, directory }) => {
    const target = file || directory || '.';
    const drifts = await detectDrift(ctx, target);
    return { content: [{ type: 'text', text: formatDriftReport(drifts) }] };
  });
}

export function registerUpdateTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_update', {
    title: 'Update Spec from Code',
    description: 'Generate prompts to update spec documents based on code changes.',
    inputSchema: z.object({
      files: z.array(z.string()).describe('Files that were changed'),
      description: z.string().optional().describe('What changed'),
    }),
  }, async ({ files, description }) => {
    const prompt = generateUpdatePrompt(files, description);
    return { content: [{ type: 'text', text: prompt }] };
  });
}
