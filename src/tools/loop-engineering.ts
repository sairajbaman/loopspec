import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { routeContext } from '../engines/context-router/index.js';
import { evaluateGuardrails, formatGuardrails } from '../engines/guardrails/index.js';

export function registerMakerPromptTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_maker_prompt', {
    title: 'Maker Prompt',
    description: 'Get an optimized maker prompt with full context for a task.',
    inputSchema: z.object({ task: z.string() }),
  }, async ({ task }) => {
    const context = await routeContext(ctx, task, 12000);
    const guardrails = await evaluateGuardrails(ctx, task);
    return { content: [{ type: 'text', text: `## MAKER INSTRUCTIONS\n\nImplement the following task. Follow all conventions and constraints.\n\n**Task:** ${task}\n\n${formatGuardrails(guardrails)}\n\n## CONTEXT\n${context}\n\n## RULES\n- Write complete, working code\n- Follow conventions in SKILL.md\n- Include all required states\n- Write tests if test framework exists\n- Do not use \`any\` types` }] };
  });
}

export function registerCheckerPromptTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_checker_prompt', {
    title: 'Checker Prompt',
    description: 'Get an adversarial checker prompt to review maker output.',
    inputSchema: z.object({ task: z.string(), files: z.array(z.string()) }),
  }, async ({ task, files }) => {
    const context = await routeContext(ctx, task, 5000);
    return { content: [{ type: 'text', text: `## ADVERSARIAL CHECKER\n\nYou are reviewing code for: ${task}\nFiles: ${files.join(', ')}\n\nSpec context:\n${context.slice(0, 3000)}\n\n## YOUR JOB\n1. Find EVERY deviation from spec\n2. Check security vulnerabilities\n3. Verify all states exist (loading, error, empty, success)\n4. Check accessibility\n5. Verify naming conventions\n6. Look for hardcoded values that should be configurable\n\nBe harsh. List every issue. Rate severity: HIGH/MEDIUM/LOW.` }] };
  });
}

export function registerRetryTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_retry', {
    title: 'Retry with Context',
    description: 'Re-attempt a failed task with error context.',
    inputSchema: z.object({ task: z.string(), previous_error: z.string(), attempt: z.number() }),
  }, async ({ task, previous_error, attempt }) => {
    const context = await routeContext(ctx, task, 8000);
    return { content: [{ type: 'text', text: `## RETRY ATTEMPT ${attempt}\n\n**Task:** ${task}\n\n**Previous error:**\n${previous_error}\n\n**Avoidance strategy:** Do NOT repeat the same approach. Try a different solution path.\n\n${context.slice(0, 4000)}\n\n${attempt >= 3 ? '⚠️ This is attempt 3+. Consider calling loopspec_escalate if stuck.' : ''}` }] };
  });
}

export function registerEscalateTool(server: McpServer, _ctx: AppContext) {
  server.registerTool('loopspec_escalate', {
    title: 'Escalate to Human',
    description: 'Flag a task for human review.',
    inputSchema: z.object({ task: z.string(), reason: z.string(), summary: z.string() }),
  }, async ({ task, reason, summary }) => {
    return { content: [{ type: 'text', text: `## 🚨 ESCALATION REQUIRED\n\n**Task:** ${task}\n**Reason:** ${reason}\n\n**Summary of attempts:**\n${summary}\n\n**Recommended action:** Human review needed before proceeding.` }] };
  });
}

export function registerDecomposeTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_decompose', {
    title: 'Decompose Task',
    description: 'Split a complex task into parallel sub-tasks.',
    inputSchema: z.object({ task: z.string() }),
  }, async ({ task }) => {
    const context = await routeContext(ctx, task, 5000);
    return { content: [{ type: 'text', text: `## DECOMPOSE: ${task}\n\nBreak this into parallel sub-tasks:\n\n${context.slice(0, 3000)}\n\n## Output Format\n\`\`\`json\n{\n  "subtasks": [\n    { "id": 1, "task": "...", "domain": "frontend|backend", "depends_on": [] },\n    ...\n  ]\n}\n\`\`\`\n\nRules:\n- Tasks with no dependencies can run in parallel\n- Each task should be completable in one prompt\n- Include a final "integration" task that depends on all others` }] };
  });
}

export function registerMergeReviewTool(server: McpServer, _ctx: AppContext) {
  server.registerTool('loopspec_merge_review', {
    title: 'Merge Review',
    description: 'Review and reconcile outputs from parallel sub-tasks.',
    inputSchema: z.object({ subtasks: z.array(z.object({ task: z.string(), result: z.string() })) }),
  }, async ({ subtasks }) => {
    const taskList = subtasks.map((s, i) => `### Sub-task ${i + 1}: ${s.task}\n${s.result.slice(0, 500)}`).join('\n\n');
    return { content: [{ type: 'text', text: `## MERGE REVIEW\n\nReview these parallel outputs for conflicts:\n\n${taskList}\n\n## Check for:\n1. Naming conflicts between sub-tasks\n2. Duplicate code or logic\n3. Missing integration points\n4. Inconsistent patterns across outputs\n5. Import conflicts\n\nProvide a merged, consistent result.` }] };
  });
}
