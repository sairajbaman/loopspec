import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { extractLearnings, storeMemory, updateSkillMd, promoteToPlaybook, searchMemory, searchPlaybook } from '../engines/memory/index.js';

export function registerCompoundTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_compound', {
    title: 'Compound Learning',
    description: 'Extract learnings from a completed task and update project memory.',
    inputSchema: z.object({
      task: z.string().describe('What task was completed'),
      outcome: z.string().describe('What happened — successes, fixes, patterns'),
      learnings: z.array(z.string()).optional().describe('Explicit lessons learned'),
    }),
  }, async ({ task, outcome, learnings: explicit }) => {
    const learnings = await extractLearnings(task, outcome, explicit);
    await storeMemory(ctx, learnings);
    await updateSkillMd(ctx, learnings);
    await promoteToPlaybook(learnings);
    const summary = learnings.map((l) => `  • ${l.pattern} (${l.category}, confidence: ${l.confidence})`).join('\n');
    return { content: [{ type: 'text', text: `## Compounded ${learnings.length} learnings\n\n${summary}\n\nSKILL.md updated. Playbook promoted patterns with confidence ≥ 0.8.` }] };
  });
}

export function registerPlaybookTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_playbook', {
    title: 'Search Playbook',
    description: 'Search cross-project memory for patterns on a topic.',
    inputSchema: z.object({ topic: z.string().describe('Topic to search for') }),
  }, async ({ topic }) => {
    const projectPatterns = await searchMemory(ctx, topic);
    const globalPatterns = await searchPlaybook(topic);
    const all = [...projectPatterns, ...globalPatterns];
    if (all.length === 0) return { content: [{ type: 'text', text: `No patterns found for "${topic}". Build more and compound to grow your playbook.` }] };
    const list = all.map((p, i) => `${i + 1}. "${p.pattern}"\n   Category: ${p.category} | Confidence: ${p.confidence}`).join('\n\n');
    return { content: [{ type: 'text', text: `## Playbook: ${topic}\n\n${list}` }] };
  });
}
