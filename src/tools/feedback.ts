import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { initBayesianSchema, recordSuccess, recordFailure, getTopPatterns, applyTimeDecay, betaConfidence, wilsonLowerBound } from '../engines/memory/bayesian.js';

export function registerFeedbackTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_feedback', {
    title: 'Pattern Feedback',
    description: 'Report whether a learned pattern worked or failed. This updates Bayesian confidence — patterns that fail lose trust, patterns that succeed gain trust.',
    inputSchema: z.object({
      pattern_id: z.number().describe('ID of the pattern (from loopspec_playbook results)'),
      outcome: z.enum(['success', 'failure']).describe('Did the pattern work or cause issues?'),
      context: z.string().optional().describe('What happened'),
    }),
  }, async (args) => {
    const { pattern_id, outcome, context: note } = args as { pattern_id: number; outcome: string; context?: string };

    await initBayesianSchema(ctx);

    if (outcome === 'success') {
      await recordSuccess(ctx, pattern_id);
    } else {
      await recordFailure(ctx, pattern_id);
    }

    // Get updated pattern info
    const db = await ctx.getDb();
    const row = db.prepare('SELECT pattern, alpha, beta, confidence, successes, failures FROM memory WHERE id = ?').get(pattern_id) as { pattern: string; alpha: number; beta: number; confidence: number; successes: number; failures: number } | undefined;

    if (!row) return { content: [{ type: 'text' as const, text: `Pattern #${pattern_id} not found.` }], isError: true };

    const wilson = wilsonLowerBound(row.alpha, row.beta);

    return {
      content: [{
        type: 'text' as const,
        text: `## Feedback Recorded: ${outcome.toUpperCase()}\n\n**Pattern:** "${row.pattern}"\n\n| Metric | Value |\n|--------|-------|\n| Confidence | ${(row.confidence * 100).toFixed(1)}% |\n| Wilson Score | ${(wilson * 100).toFixed(1)}% |\n| Successes | ${row.successes} |\n| Failures | ${row.failures} |\n| α/β | ${row.alpha.toFixed(1)} / ${row.beta.toFixed(1)} |${note ? `\n\nNote: ${note}` : ''}`,
      }],
    };
  });
}

export function registerMemoryStatsTools(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_memory_stats', {
    title: 'Memory Statistics',
    description: 'View the state of compound memory — top patterns, uncertain patterns, decay status.',
    inputSchema: z.object({
      category: z.string().optional().describe('Filter by category'),
    }),
  }, async (args) => {
    const { category } = args as { category?: string };
    await initBayesianSchema(ctx);

    const top = await getTopPatterns(ctx, category, 10);
    await applyTimeDecay(ctx);

    if (top.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No patterns in memory yet. Use loopspec_compound after tasks to start building your brain.' }] };
    }

    const list = top.map((p, i) => {
      const wilson = wilsonLowerBound(p.alpha, p.beta);
      const bar = '█'.repeat(Math.floor(wilson * 10)) + '░'.repeat(10 - Math.floor(wilson * 10));
      return `${i + 1}. [#${p.id}] ${bar} ${(wilson * 100).toFixed(0)}% — ${p.pattern.slice(0, 60)}\n   ${p.category} | ${p.usage_count} uses | α=${p.alpha.toFixed(1)} β=${p.beta.toFixed(1)}`;
    }).join('\n\n');

    return {
      content: [{
        type: 'text' as const,
        text: `## 🧠 Memory (Bayesian Ranked)\n\nPatterns ranked by Wilson lower bound (not raw confidence).\nThis means well-tested patterns rank higher than lucky ones.\n\n${list}\n\n_Use loopspec_feedback to report success/failure and update rankings._`,
      }],
    };
  });
}
