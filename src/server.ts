import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createContext } from './context.js';
import { registerAllTools } from './tools/index.js';
import { registerAllResources } from './resources/index.js';
import { registerAllPrompts } from './prompts/index.js';

function printHelp() {
  console.log(`loopspec-mcp - The Compound Intelligence Engine for AI Development

Usage:
  npx loopspec-mcp          Start MCP server (stdio transport)
  npx loopspec-mcp start    Auto-detect AI tools and configure LoopSpec
  npx loopspec-mcp stop     Remove LoopSpec from all configured tools
  npx loopspec-mcp --help   Show this help message
`);
}

async function startMcpServer() {
  const server = new McpServer(
    { name: 'loopspec', version: '0.3.0' },
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

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('LoopSpec MCP server running (28 tools, 12 resources, 4 prompts)');

  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  if (args[0] === 'start') {
    const { runStart } = await import('./cli/start.js');
    await runStart();
  } else if (args[0] === 'stop') {
    const { runStop } = await import('./cli/stop.js');
    await runStop();
  } else {
    await startMcpServer();
  }
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
