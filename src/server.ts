import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createContext } from './context.js';
import { registerAllTools } from './tools/index.js';
import { registerAllResources } from './resources/index.js';
import { registerAllPrompts } from './prompts/index.js';

const server = new McpServer(
  { name: 'loopspec', version: '0.2.0' },
  {
    instructions:
      'LoopSpec is a compound intelligence engine for AI development. ' +
      'Workflow: loopspec_init → loopspec_plan → loopspec_preflight → loopspec_context → (work) → loopspec_verify → loopspec_score → loopspec_compound. ' +
      'Use loopspec_vibe for quick setup. Use loopspec_detect on any repo to auto-generate SKILL.md from existing code. ' +
      'Use loopspec_feedback to report pattern success/failure (Bayesian learning). ' +
      'Use loopspec_enforce to install pre-commit hooks and CI quality gates. ' +
      'Use loopspec_memory_stats to see ranked patterns. ' +
      'Use loopspec_maker_prompt and loopspec_checker_prompt for maker-checker splits.',
  }
);

const ctx = createContext();

registerAllTools(server, ctx);
registerAllResources(server, ctx);
registerAllPrompts(server, ctx);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('LoopSpec MCP server running (28 tools, 12 resources, 4 prompts)');
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});

process.on('SIGINT', async () => {
  await server.close();
  process.exit(0);
});
