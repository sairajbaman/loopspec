import * as z from 'zod/v4';
import path from 'node:path';
import fs from 'node:fs';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { SessionManager } from '../engines/session/index.js';
import { decomposeGoals, verifyGoals, formatGoalStatus, type Goal } from '../engines/goals/index.js';
import { routeContext } from '../engines/context-router/index.js';

export function registerGoalTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_goal', {
    title: 'Goal Tracker',
    description: 'Create, check, and update goal checklists. Auto-verifies goals against code patterns.',
    inputSchema: z.object({
      action: z.enum(['create', 'check', 'update', 'list']),
      feature: z.string().optional().describe('Feature to decompose into goals (for create)'),
      goalId: z.string().optional().describe('Goal ID to update'),
      status: z.enum(['pending', 'done', 'blocked']).optional(),
      files: z.array(z.string()).optional().describe('Files to verify goals against (for check)'),
    }),
  }, async ({ action, feature, goalId, status, files }) => {
    const mgr = new SessionManager(ctx);

    switch (action) {
      case 'create': {
        if (!feature) return { content: [{ type: 'text', text: 'Provide a "feature" to decompose into goals.' }] };
        const specCtx = await routeContext(ctx, feature, 3000);
        const goals = decomposeGoals(feature, specCtx);
        await mgr.setGoals(goals.map(g => ({ id: g.id, description: g.description, status: 'pending' })));
        const list = goals.map((g, i) => `${i + 1}. [ ] ${g.description}`).join('\n');
        return { content: [{ type: 'text', text: `## Goals for: ${feature}\n\n${list}\n\n${goals.length} goals created. Use loopspec_goal action:"check" with files to auto-verify.` }] };
      }
      case 'check': {
        const session = await mgr.getCurrent();
        if (!session) return { content: [{ type: 'text', text: 'No active session. Start one first.' }] };

        // Read file contents for verification
        const fileContents = new Map<string, string>();
        const checkFiles = files || session.filesChanged;
        for (const f of checkFiles) {
          const fullPath = path.resolve(ctx.projectDir, f);
          try {
            fileContents.set(f, fs.readFileSync(fullPath, 'utf-8'));
          } catch {}
        }

        // Reconstruct Goal objects with patterns
        const specCtx = await routeContext(ctx, session.name, 2000);
        const fullGoals = decomposeGoals(session.name, specCtx);

        // Map session goals to full goals (match by description)
        const goalsWithPatterns: Goal[] = session.goals.map(sg => {
          const full = fullGoals.find(g => g.description === sg.description);
          return full || { id: sg.id, description: sg.description, status: sg.status, verifyPatterns: [], antiPatterns: [], fileGlobs: [] };
        });

        const results = verifyGoals(goalsWithPatterns, fileContents);

        // Update session goals
        for (const r of results) {
          if (r.status === 'done') await mgr.updateGoal(r.goalId, 'done');
        }

        return { content: [{ type: 'text', text: formatGoalStatus(results) }] };
      }
      case 'update': {
        if (!goalId || !status) return { content: [{ type: 'text', text: 'Provide goalId and status.' }] };
        await mgr.updateGoal(goalId, status);
        return { content: [{ type: 'text', text: `✓ Goal ${goalId} marked as ${status}.` }] };
      }
      case 'list': {
        const session = await mgr.getCurrent();
        if (!session) return { content: [{ type: 'text', text: 'No active session.' }] };
        const list = session.goals.map((g, i) => {
          const icon = g.status === 'done' ? 'x' : g.status === 'blocked' ? '!' : ' ';
          return `${i + 1}. [${icon}] ${g.description}`;
        }).join('\n');
        return { content: [{ type: 'text', text: `## Goals (${session.goalsCompleted}/${session.goalsTotal})\n\n${list}` }] };
      }
    }
  });
}
