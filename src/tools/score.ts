import * as z from 'zod/v4';
import path from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { scoreTask, formatScorecard, persistScore } from '../engines/scorecard/index.js';
import { routeContext } from '../engines/context-router/index.js';
import { readFile } from '../utils/files.js';

export function registerScoreTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_score', {
    title: 'Score Output',
    description: 'Score AI-generated code against spec compliance.',
    inputSchema: z.object({
      task: z.string().describe('Task that was completed'),
      files: z.array(z.string()).describe('Files to score'),
    }),
  }, async ({ task, files }) => {
    const score = await scoreTask(ctx, task, files);
    await persistScore(ctx, task, files[0] || null, score);
    return { content: [{ type: 'text', text: formatScorecard(score, task) }] };
  });
}

export function registerVerifyTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_verify', {
    title: 'Verify (Checker)',
    description: 'Get an adversarial checker prompt to review code against spec.',
    inputSchema: z.object({
      task: z.string().describe('Task to verify'),
      files: z.array(z.string()).describe('Files to check'),
    }),
  }, async ({ task, files }) => {
    const specContext = await routeContext(ctx, task, 5000);
    const fileContents = [];
    for (const f of files.slice(0, 3)) {
      const c = await readFile(path.join(ctx.projectDir, f));
      if (c) fileContents.push(`--- ${f} ---\n${c.slice(0, 3000)}`);
    }

    return {
      content: [{
        type: 'text',
        text: `## ADVERSARIAL CODE REVIEW\n\nYou are a strict code reviewer. Find ALL issues.\n\n### Task Spec\n${specContext.slice(0, 3000)}\n\n### Code to Review\n${fileContents.join('\n\n')}\n\n### Check for:\n1. Does it match the spec requirements?\n2. Missing states (loading, error, empty)?\n3. Security vulnerabilities?\n4. Accessibility issues?\n5. Anti-patterns used?\n6. Missing edge cases?\n\nBe thorough and critical. List every issue found.`,
      }],
    };
  });
}
