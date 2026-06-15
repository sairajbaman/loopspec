import * as z from 'zod/v4';
import path from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { readFile } from '../utils/files.js';

export function registerPlanTool(server: McpServer, ctx: AppContext) {
  server.registerTool(
    'loopspec_plan',
    {
      title: 'Plan Feature',
      description: 'Break a feature into AI-sized tasks using spec context.',
      inputSchema: z.object({
        feature: z.string().describe('Feature to plan'),
        granularity: z.enum(['coarse', 'fine']).optional().describe('Task size (default: fine)'),
      }),
    },
    async ({ feature, granularity }) => {
      const plan = await readFile(path.join(ctx.loopspecDir, 'Plan.md'));
      const schema = await readFile(path.join(ctx.loopspecDir, 'Schema.md'));
      const flow = await readFile(path.join(ctx.loopspecDir, 'AppFlow.md'));

      const contextParts = [
        plan ? `## Existing Plan\n${plan.slice(0, 2000)}` : '',
        schema ? `## Schema (relevant)\n${schema.slice(0, 2000)}` : '',
        flow ? `## App Flow (relevant)\n${flow.slice(0, 2000)}` : '',
      ].filter(Boolean).join('\n\n');

      const detail = granularity === 'coarse' ? '3-5 high-level tasks' : '8-15 granular tasks each completable in one AI prompt';

      return {
        content: [{
          type: 'text',
          text: `Break this feature into ${detail}:\n\n**Feature:** ${feature}\n\n${contextParts}\n\n## Output Format\nFor each task:\n- Task N: [description]\n  - Files: [paths]\n  - Depends on: [task numbers]\n  - Complexity: simple | medium | complex`,
        }],
      };
    }
  );
}
