import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { generateSpec } from '../engines/spec-engine/index.js';

export function registerVibeTool(server: McpServer, ctx: AppContext) {
  server.registerTool(
    'loopspec_vibe',
    {
      title: 'Vibe Init',
      description: 'Quick project setup with minimal questions. Just describe your idea and get a complete spec immediately.',
      inputSchema: z.object({
        idea: z.string().describe('What you want to build (natural language)'),
        style: z.string().optional().describe('Design vibe keywords (e.g. "clean minimal dark")'),
      }),
    },
    async ({ idea, style }) => {
      const defaults: Record<string, string> = {
        target_user: 'general users',
        core_feature: 'core functionality',
        auth: 'email/password',
        monetization: 'not yet',
        design_vibe: style || 'clean and professional',
      };

      const result = await generateSpec(ctx, idea, 'vibe', defaults);
      const docList = Object.keys(result.documents!).map((f) => `  ✓ .loopspec/${f}`).join('\n');

      return {
        content: [{
          type: 'text',
          text: `## ⚡ Vibe Init Complete!\n\nGenerated 8 documents from your idea:\n${docList}\n\nYour AI brain is ready. Just start building — use \`loopspec_context\` for any task.`,
        }],
      };
    }
  );
}
