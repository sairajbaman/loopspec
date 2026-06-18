import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { getGuidance } from '../engines/guidance/index.js';

export function registerGuidanceTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_guidance', {
    title: 'Smart Guidance',
    description: 'Get context-aware help when stuck. Searches spec, playbook, past decisions, and common mistakes.',
    inputSchema: z.object({
      topic: z.string().describe('What you need help with (e.g., "Stripe webhook signature", "form validation")'),
    }),
  }, async ({ topic }) => {
    const guidance = await getGuidance(ctx, topic);

    let text = `## Guidance: ${topic}\n\n`;

    if (guidance.specSections.length > 0) {
      text += `### From Your Spec\n${guidance.specSections.map(s => `- ${s}`).join('\n')}\n\n`;
    }

    if (guidance.pastDecisions.length > 0) {
      text += `### Past Decisions\n${guidance.pastDecisions.map(d => `- ${d}`).join('\n')}\n\n`;
    }

    if (guidance.playbook.length > 0) {
      text += `### Learned Patterns\n${guidance.playbook.map(p => `- ${p}`).join('\n')}\n\n`;
    }

    if (guidance.commonMistakes.length > 0) {
      text += `### Common Mistakes to Avoid\n${guidance.commonMistakes.map(m => `- ⚠ ${m}`).join('\n')}\n`;
    }

    if (text.trim() === `## Guidance: ${topic}`) {
      text += `No guidance found for "${topic}". Try a more specific topic.`;
    }

    return { content: [{ type: 'text', text }] };
  });
}
