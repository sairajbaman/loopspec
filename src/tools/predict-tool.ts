import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { predict, compareWithPredictions, formatExpectations, formatComparison } from '../engines/predict/index.js';

export function registerPredictTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_predict', {
    title: 'Inverse Reasoning / Predict',
    description: 'Predict what code should contain BEFORE writing it, then compare after. Actions: "expect" (pre-code predictions) or "compare" (post-code gap analysis).',
    inputSchema: z.object({
      action: z.enum(['expect', 'compare']),
      task: z.string().describe('Task description (e.g., "payment form", "auth api", "webhook handler")'),
      files: z.array(z.string()).optional().describe('Files to compare against (for "compare" action)'),
    }),
  }, async ({ action, task, files }) => {
    if (action === 'expect') {
      const expectations = await predict(ctx, task);
      return { content: [{ type: 'text', text: formatExpectations(expectations, task) }] };
    }

    // compare
    if (!files || files.length === 0) {
      return { content: [{ type: 'text', text: 'Provide "files" to compare predictions against.' }] };
    }
    const result = await compareWithPredictions(ctx, task, files);
    return { content: [{ type: 'text', text: formatComparison(result) }] };
  });
}
