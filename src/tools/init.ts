import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { generateSpec } from '../engines/spec-engine/index.js';
import { loadStackPreset, stackPresetToContext } from '../engines/spec-engine/stacks.js';

export function registerInitTool(server: McpServer, ctx: AppContext) {
  server.registerTool(
    'loopspec_init',
    {
      title: 'Initialize LoopSpec',
      description: 'Generate all 8 spec documents from a project idea. Call without answers to get clarifying questions first, then call again with answers to generate.',
      inputSchema: z.object({
        idea: z.string().describe('Project idea description'),
        stack: z.string().optional().describe('Stack preset name (e.g. nextjs-supabase-shadcn, t3-stack)'),
        mode: z.enum(['vibe', 'pro', 'team']).optional().describe('Generation mode depth'),
        answers: z.record(z.string(), z.string()).optional().describe('Answers to clarifying questions'),
      }),
    },
    async (args) => {
      const { idea, stack, mode, answers } = args as { idea: string; stack?: string; mode?: 'vibe' | 'pro' | 'team'; answers?: Record<string, string> };
      let stackDna: string | undefined;
      if (stack) {
        const preset = loadStackPreset(stack);
        if (preset) stackDna = stackPresetToContext(preset);
      }

      const result = await generateSpec(ctx, idea, mode || 'pro', answers || undefined, stackDna);

      if (result.questions) {
        const qText = result.questions.map((q, i) => {
          let line = `${i + 1}. [${q.id}] ${q.text}`;
          if (q.options) line += ` (options: ${q.options.join(', ')})`;
          if (q.default) line += ` [default: ${q.default}]`;
          return line;
        }).join('\n');

        return {
          content: [{
            type: 'text' as const,
            text: `## Project Analysis\n- Product type: ${result.analysis.productType}\n- Industry: ${result.analysis.industry}\n- Complexity: ${result.analysis.complexity}\n- Implied stack: ${result.analysis.impliedStack || 'none detected'}\n\n## Clarifying Questions\nPlease answer these to generate your spec:\n\n${qText}\n\nCall loopspec_init again with the \`answers\` parameter filled in.`,
          }],
        };
      }

      const docList = Object.keys(result.documents!).map((f) => `  ✓ .loopspec/${f}`).join('\n');
      return {
        content: [{
          type: 'text' as const,
          text: `## LoopSpec Initialized!\n\nGenerated 8 documents:\n${docList}\n\nNext steps:\n1. Review generated docs (they are structured prompts for you to fill)\n2. Use \`loopspec_context\` to get task-specific context\n3. Use \`loopspec_preflight\` before starting tasks`,
        }],
      };
    }
  );
}
