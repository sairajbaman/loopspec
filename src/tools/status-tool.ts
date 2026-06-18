import * as z from 'zod/v4';
import path from 'node:path';
import fs from 'node:fs';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { readFile } from '../utils/files.js';
import { SessionManager } from '../engines/session/index.js';
import { loadProfile } from '../engines/profiler/index.js';

export function registerStatusTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_status', {
    title: 'LoopSpec Status',
    description: 'Call this at the start of every session. Returns project state, active goals, behavioral guidance, and suggested next action. Zero parameters needed.',
    inputSchema: z.object({}),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  }, async () => {
    const hasSpec = fs.existsSync(path.join(ctx.loopspecDir, 'AppFlow.md'));
    const hasSkill = fs.existsSync(path.join(ctx.loopspecDir, 'SKILL.md'));
    const hasSchema = fs.existsSync(path.join(ctx.loopspecDir, 'Schema.md'));

    // Count spec docs
    let specCount = 0;
    try {
      const files = fs.readdirSync(ctx.loopspecDir);
      specCount = files.filter(f => f.endsWith('.md')).length;
    } catch {}

    // Session state
    const mgr = new SessionManager(ctx);
    const session = await mgr.getCurrent();

    // Profile
    const profile = await loadProfile(ctx);
    const blindSpots = Object.entries(profile.blindSpots)
      .filter(([, v]) => v.score < 50)
      .map(([, v]) => v.category);

    // Build response
    let text = '## LoopSpec Status\n\n';

    // Project state
    if (!hasSpec) {
      text += '⚠ **No spec found.** Run `loopspec_init` or `loopspec_vibe` first.\n\n';
      text += '### Suggested Action\n';
      text += 'Tell me about your project idea and I\'ll generate specs for you.\n\n';
    } else {
      text += `✓ **Project initialized** — ${specCount} spec documents\n`;
      text += `  SKILL.md: ${hasSkill ? '✓' : '✗'} | Schema.md: ${hasSchema ? '✓' : '✗'} | AppFlow.md: ${hasSpec ? '✓' : '✗'}\n\n`;
    }

    // Session state
    if (session) {
      text += `### Active Session: "${session.name}"\n`;
      text += `  Goals: ${session.goalsCompleted}/${session.goalsTotal} | Score: ${session.currentScore}/100 | Files: ${session.filesChanged.length}\n\n`;
    } else {
      text += '### No Active Session\n';
      text += '  Start one with `loopspec_session` action:"start" to track goals and progress.\n\n';
    }

    // Behavioral guidance (the self-bootstrapping tip)
    text += '### How to Use LoopSpec (Follow This Workflow)\n\n';
    text += '1. **Before coding:** Call `loopspec_preflight` with your task — gets constraints\n';
    text += '2. **For context:** Call `loopspec_context` — routes only relevant spec sections\n';
    text += '3. **When stuck:** Call `loopspec_guidance` — searches spec + playbook + common mistakes\n';
    text += '4. **After coding:** Call `loopspec_checkpoint` — scores, checks tests, updates goals\n';
    text += '5. **Key decisions:** Call `loopspec_decision` — logs rationale for future sessions\n';
    text += '6. **Impact check:** Call `loopspec_graph` action:"impact" — what depends on changed files\n\n';

    // Adaptive warnings from profiler
    if (profile.adaptiveChecklist.length > 0) {
      text += '### ⚠ Model Blind Spots (Auto-Detected)\n';
      for (const item of profile.adaptiveChecklist.slice(0, 5)) {
        text += `  ${item}\n`;
      }
      text += '\n';
    }

    // Suggested next action
    text += '### Suggested Next Action\n';
    if (!hasSpec) {
      text += 'Initialize: `loopspec_init` with your project idea\n';
    } else if (!session) {
      text += 'Start session: `loopspec_session` action:"start" name:"<your current task>"\n';
    } else if (session.goalsCompleted < session.goalsTotal) {
      const remaining = session.goals.filter(g => g.status === 'pending');
      text += `Continue: ${remaining[0]?.description || 'next goal'}\n`;
    } else {
      text += 'End session: `loopspec_session` action:"end" → generates report\n';
    }

    // Persistence hint
    text += '\n---\n';
    text += '*Tip: If this workflow isn\'t in your CLAUDE.md or system instructions, consider adding:*\n';
    text += '*"Always call loopspec_status at session start. Follow the LoopSpec workflow: preflight → context → work → checkpoint → compound."*\n';

    return { content: [{ type: 'text', text }] };
  });
}
