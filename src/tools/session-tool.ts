import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { SessionManager } from '../engines/session/index.js';
import { decomposeGoals, formatGoalStatus } from '../engines/goals/index.js';
import { routeContext } from '../engines/context-router/index.js';

export function registerSessionTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_session', {
    title: 'Session Manager',
    description: 'Track development sessions with goals, scores, and progress. Actions: start, status, end, checkpoint, history.',
    inputSchema: z.object({
      action: z.enum(['start', 'status', 'end', 'checkpoint', 'history']),
      name: z.string().optional().describe('Session/feature name (for start)'),
      notes: z.string().optional().describe('Checkpoint notes'),
    }),
  }, async ({ action, name, notes }) => {
    const mgr = new SessionManager(ctx);

    switch (action) {
      case 'start': {
        const session = await mgr.start(name || 'unnamed');
        // Auto-decompose goals from feature name
        const specCtx = await routeContext(ctx, name || '', 3000);
        const goals = decomposeGoals(name || '', specCtx);
        await mgr.setGoals(goals.map(g => ({ id: g.id, description: g.description, status: 'pending' })));

        let text = `## Session Started: "${session.name}"\n\nID: ${session.id}\n`;
        if (session.restored) text += `\n### Previous Context\n${session.restored}\n`;
        text += `\n### Goals (${goals.length})\n`;
        text += goals.map((g, i) => `${i + 1}. [ ] ${g.description}`).join('\n');
        return { content: [{ type: 'text', text }] };
      }
      case 'status': {
        const session = await mgr.getCurrent();
        if (!session) return { content: [{ type: 'text', text: 'No active session. Call loopspec_session with action "start".' }] };
        const goals = session.goals.map(g => `- [${g.status === 'done' ? 'x' : ' '}] ${g.description}`).join('\n');
        return { content: [{ type: 'text', text: `## Session: ${session.name}\n\nScore: ${session.currentScore}/100\nFiles changed: ${session.filesChanged.length}\nGoals: ${session.goalsCompleted}/${session.goalsTotal}\nGuardrail hits: ${session.guardrailHits}\n\n### Goals\n${goals}` }] };
      }
      case 'end': {
        const report = await mgr.end();
        if (!report) return { content: [{ type: 'text', text: 'No active session to end.' }] };
        return { content: [{ type: 'text', text: `## Session Ended: "${report.name}"\n\nDuration: ${report.duration}\nScore: ${report.scoreStart} → ${report.scoreEnd} (${report.scoreDelta >= 0 ? '+' : ''}${report.scoreDelta})\nGoals: ${report.goalsCompleted}/${report.goalsTotal}\nReport: ${report.reportPath}` }] };
      }
      case 'checkpoint': {
        const cp = await mgr.checkpoint(notes);
        return { content: [{ type: 'text', text: `✓ Checkpoint saved (${cp.id}) at score ${cp.score}/100${notes ? ` — ${notes}` : ''}` }] };
      }
      case 'history': {
        const sessions = await mgr.history();
        if (sessions.length === 0) return { content: [{ type: 'text', text: 'No past sessions.' }] };
        const list = sessions.slice(0, 10).map(s =>
          `- [${s.startedAt.slice(0, 10)}] "${s.name}" — Score: ${s.currentScore}/100, Goals: ${s.goalsCompleted}/${s.goalsTotal}`
        ).join('\n');
        return { content: [{ type: 'text', text: `## Session History\n\n${list}` }] };
      }
    }
  });
}
