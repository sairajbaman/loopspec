import * as z from 'zod/v4';
import path from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { storeDecision, queryDecisions } from '../engines/decisions/index.js';
import { SessionManager } from '../engines/session/index.js';
import { scoreTask } from '../engines/scorecard/index.js';
import { checkTestGate } from '../engines/test-gate/index.js';

export function registerDecisionTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_decision', {
    title: 'Decision Log',
    description: 'Log a non-trivial architectural/design decision with rationale. Persisted for future sessions.',
    inputSchema: z.object({
      decision: z.string().describe('What was decided'),
      rationale: z.string().describe('Why this choice was made'),
      alternatives: z.array(z.string()).optional().describe('Rejected alternatives'),
      files: z.array(z.string()).optional().describe('Files affected'),
    }),
  }, async ({ decision, rationale, alternatives, files }) => {
    const mgr = new SessionManager(ctx);
    const session = await mgr.getCurrent();
    const sessionId = session?.id || 'no-session';

    await storeDecision(ctx, { decision, rationale, alternatives: alternatives || [], files: files || [], sessionId });

    return { content: [{ type: 'text', text: `✓ Decision logged: "${decision}"\n  Rationale: ${rationale}${alternatives?.length ? `\n  Rejected: ${alternatives.join(', ')}` : ''}` }] };
  });
}

export function registerCheckpointTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_checkpoint', {
    title: 'Checkpoint',
    description: 'Save progress: score current files, check test gate, update goals, store progress.',
    inputSchema: z.object({
      files: z.array(z.string()).describe('Files to score'),
      notes: z.string().optional(),
    }),
  }, async ({ files, notes }) => {
    const mgr = new SessionManager(ctx);
    const session = await mgr.getCurrent();

    // Score
    const score = await scoreTask(ctx, notes || 'checkpoint', files);
    if (session) await mgr.updateScore(score.overall);

    // Test gate
    const testResult = await checkTestGate(ctx, files);

    // Checkpoint
    if (session) await mgr.checkpoint(notes);

    // Track files
    for (const f of files) await mgr.trackFile(f);

    let text = `## Checkpoint${notes ? `: ${notes}` : ''}\n\n`;
    text += `Score: ${score.overall}/100\n`;

    if (testResult.missing.length > 0) {
      text += `\n### ⚠ Tests Required\n`;
      text += testResult.missing.map(m => `- ${m}`).join('\n');
      text += `\n\nTarget: ${testResult.target}% branch coverage\n`;
    } else {
      text += `\n✓ Test gate passed\n`;
    }

    if (session) {
      text += `\nSession progress: ${session.goalsCompleted}/${session.goalsTotal} goals`;
    }

    return { content: [{ type: 'text', text }] };
  });
}
