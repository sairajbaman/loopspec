import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { amplifyPrompt } from '../engines/prompt-amplifier/index.js';

export function registerAmplifyTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_amplify', {
    title: 'Prompt Amplifier',
    description: 'Takes a raw prompt and makes it dramatically better — adds thinking structure, spec context, guardrails, anti-patterns from past sessions, and success criteria. Use this before any complex task.',
    inputSchema: z.object({
      prompt: z.string().describe('The raw user prompt to amplify'),
    }),
  }, async ({ prompt }) => {
    const result = await amplifyPrompt(ctx, prompt);
    return { content: [{ type: 'text', text: result.full }] };
  });
}
