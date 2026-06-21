/**
 * LLM Execution Bridge — uses MCP sampling to ask the HOST LLM to do real work.
 * 
 * When loopspec runs inside Claude Code → it calls Claude.
 * When loopspec runs inside Cursor → it calls whatever model Cursor is using.
 * When loopspec runs inside Kiro → it calls Kiro's model.
 * 
 * This is NOT a fake state machine. This actually executes tasks via the host AI.
 */
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
}

let _server: Server | null = null;

export function setServer(server: Server): void {
  _server = server;
}

export function getServer(): Server | null {
  return _server;
}

/**
 * Execute a task by requesting the host LLM to do it via MCP sampling.
 * Falls back to returning instructions if sampling is unavailable.
 */
export async function executeViaHostLLM(task: string, context?: string): Promise<ExecutionResult> {
  const server = _server;
  if (!server) {
    return { success: false, output: '', error: 'No MCP server connection — cannot sample host LLM' };
  }

  const systemPrompt = context
    ? `You are executing a sub-task as part of an autonomous loop. Context:\n${context}\n\nExecute the task completely. Return ONLY the result.`
    : 'You are executing a sub-task as part of an autonomous loop. Execute completely. Return ONLY the result.';

  try {
    const result = await server.createMessage({
      messages: [{ role: 'user', content: { type: 'text', text: task } }],
      systemPrompt,
      maxTokens: 4096,
      includeContext: 'thisServer',
    });

    // Extract text from response
    const text = result.content.type === 'text' ? result.content.text : JSON.stringify(result.content);
    return { success: true, output: text };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // If sampling not supported, return the task as instructions for manual execution
    if (msg.includes('not supported') || msg.includes('Method not found') || msg.includes('sampling')) {
      return {
        success: false,
        output: task,
        error: `Host does not support MCP sampling. Task returned as instructions for manual execution.`,
      };
    }
    return { success: false, output: '', error: `LLM execution failed: ${msg}` };
  }
}

/**
 * Execute multiple tasks sequentially, passing each result to the next.
 */
export async function executePipeline(tasks: string[], context?: string): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = [];
  let prevOutput = '';

  for (const task of tasks) {
    const fullContext = prevOutput
      ? `${context || ''}\n\nPrevious step output:\n${prevOutput}`
      : context;
    const result = await executeViaHostLLM(task, fullContext);
    results.push(result);
    if (!result.success) break;
    prevOutput = result.output;
  }
  return results;
}

/**
 * Check if the host supports LLM sampling.
 */
export function isSamplingAvailable(): boolean {
  return _server !== null;
}
