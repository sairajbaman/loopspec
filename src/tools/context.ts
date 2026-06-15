import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { routeContext } from '../engines/context-router/index.js';

export function registerContextTool(server: McpServer, ctx: AppContext) {
  server.registerTool(
    'loopspec_context',
    {
      title: 'Smart Context',
      description: 'Get task-aware context slice from your spec. Only returns relevant sections, respecting token budget.',
      inputSchema: z.object({
        task: z.string().describe('What you are about to work on'),
        budget: z.number().optional().describe('Max tokens for context (default: 15000)'),
      }),
    },
    async ({ task, budget }) => {
      const context = await routeContext(ctx, task, budget || 15000);
      return { content: [{ type: 'text', text: context }] };
    }
  );
}
