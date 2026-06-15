import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { evaluateGuardrails, formatGuardrails } from '../engines/guardrails/index.js';

export function registerPreflightTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_preflight', {
    title: 'Pre-Flight Guardrails',
    description: 'Get constraints and guardrails for a task before starting work.',
    inputSchema: z.object({ task: z.string().describe('Task about to start') }),
  }, async ({ task }) => {
    const result = await evaluateGuardrails(ctx, task);
    return { content: [{ type: 'text', text: formatGuardrails(result) }] };
  });
}
