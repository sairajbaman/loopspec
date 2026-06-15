import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { routeContext } from '../engines/context-router/index.js';

export function registerAllPrompts(server: McpServer, ctx: AppContext) {
  server.registerPrompt('maker', {
    title: 'Maker Agent Prompt',
    description: 'Optimized maker prompt with spec context for implementing a task.',
    argsSchema: { task: z.string() },
  }, async ({ task }) => {
    const context = await routeContext(ctx, task as string, 10000);
    return {
      messages: [{
        role: 'user' as const,
        content: { type: 'text' as const, text: `You are a maker agent. Implement this task completely, following all project conventions.\n\n**Task:** ${task}\n\n## Project Context\n${context}\n\n## Rules\n- Write complete, working code\n- Follow all conventions in SKILL.md\n- Include loading, error, and empty states\n- Write tests where applicable\n- Use typed interfaces, no \`any\`` },
      }],
    };
  });

  server.registerPrompt('checker', {
    title: 'Checker Agent Prompt',
    description: 'Adversarial reviewer prompt for checking code against spec.',
    argsSchema: { task: z.string(), code: z.string() },
  }, async ({ task, code }) => {
    const context = await routeContext(ctx, task as string, 5000);
    return {
      messages: [{
        role: 'user' as const,
        content: { type: 'text' as const, text: `You are a strict checker agent. Find ALL issues in this code.\n\n**Task:** ${task}\n**Spec:** ${context.slice(0, 3000)}\n\n**Code:**\n${code}\n\nCheck: spec compliance, security, accessibility, patterns, edge cases. Rate each issue HIGH/MEDIUM/LOW.` },
      }],
    };
  });

  server.registerPrompt('reviewer', {
    title: 'PR Reviewer Prompt',
    description: 'Spec-aligned pull request review prompt.',
    argsSchema: { pr_diff: z.string() },
  }, async ({ pr_diff }) => {
    const context = await routeContext(ctx, 'code review', 5000);
    return {
      messages: [{
        role: 'user' as const,
        content: { type: 'text' as const, text: `Review this PR diff against the project spec.\n\n**Spec Context:**\n${context.slice(0, 3000)}\n\n**Diff:**\n${pr_diff}\n\nCheck:\n1. Spec compliance\n2. Security issues\n3. Naming conventions\n4. Missing tests\n5. Performance concerns\n\nApprove, request changes, or comment with specific line references.` },
      }],
    };
  });

  server.registerPrompt('compound', {
    title: 'Compound Learning Prompt',
    description: 'Extract learnings from a completed task.',
    argsSchema: { task: z.string(), outcome: z.string() },
  }, async ({ task, outcome }) => ({
    messages: [{
      role: 'user' as const,
      content: { type: 'text' as const, text: `Extract reusable patterns from this completed task.\n\n**Task:** ${task}\n**Outcome:** ${outcome}\n\nFor each learning, provide:\n1. The pattern (one sentence, starts with "Always" or "Never" or "Prefer")\n2. Category: security | design | performance | general\n3. Confidence: 0.5 (first time) | 0.7 (proven once) | 0.9 (proven multiple times)\n\nFormat as JSON array:\n[\n  { "pattern": "...", "category": "...", "confidence": 0.7 }\n]` },
    }],
  }));
}
