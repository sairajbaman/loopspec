import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createContext } from './context.js';
import { registerAllTools } from './tools/index.js';
import { registerAllResources } from './resources/index.js';
import { registerAllPrompts } from './prompts/index.js';

const isWindows = process.platform === 'win32';

function printHelp() {
  const cmd = isWindows ? 'cmd /c npx -y loopspec-mcp' : 'npx -y loopspec-mcp';
  console.log(`loopspec-mcp v2.0.0 - The Compound Intelligence Engine for AI Development

Usage:
  npx loopspec-mcp          Start MCP server (stdio transport)
  npx loopspec-mcp setup    Auto-detect AI tools + configure + verify
  npx loopspec-mcp start    Same as setup
  npx loopspec-mcp stop     Remove LoopSpec from all configured tools
  npx loopspec-mcp --help   Show this help

One-liner installs:
  Claude Code:  claude mcp add loopspec -- ${cmd}
  Gemini CLI:   gemini --mcp-server-path "${cmd}"

For CLI mode (sessions, watch, review), use:
  npx loopspec <command>
`);
}

function printSetupAlternatives() {
  const cmd = isWindows ? 'cmd /c npx -y loopspec-mcp' : 'npx -y loopspec-mcp';
  console.log(`
📋 Manual setup (if auto-config didn't work):

  Claude Code:
    claude mcp add loopspec -- ${cmd}

  Cursor (paste in .cursor/mcp.json):
    ${JSON.stringify({ mcpServers: { loopspec: { command: isWindows ? 'cmd' : 'npx', args: isWindows ? ['/c', 'npx', '-y', 'loopspec-mcp'] : ['-y', 'loopspec-mcp'] } } }, null, 2).split('\n').join('\n    ')}

  Gemini CLI:
    gemini --mcp-server-path "${cmd}"

  Any MCP client:
    Command: ${isWindows ? 'cmd' : 'npx'}
    Args: ${isWindows ? '/c npx -y loopspec-mcp' : '-y loopspec-mcp'}
`);
}

async function runSetup() {
  const { runStart } = await import('./cli/start.js');
  await runStart();
  printSetupAlternatives();
}

async function startMcpServer() {
  const server = new McpServer(
    { name: 'loopspec', version: '2.0.0' },
    {
      instructions:
        'LoopSpec is a compound intelligence engine for AI development. ' +
        'FIRST: Always call loopspec_status at the start of a conversation — it returns project state, goals, and behavioral guidance. ' +
        'TRIGGER: When user says "use loopspec", "check spec", "check my code", "loopspec", or asks about spec compliance — use the appropriate tool. ' +
        'WORKFLOW: loopspec_status → loopspec_session start → loopspec_preflight → loopspec_context → (work) → loopspec_checkpoint → loopspec_compound → loopspec_session end. ' +
        'QUICK: loopspec_context for task context. loopspec_guidance when stuck. loopspec_decision to log choices. loopspec_graph impact for change effects. loopspec_autocomplete for spec-derived code. ' +
        'ALWAYS: Call loopspec_preflight before coding. Call loopspec_checkpoint after completing work.',
    }
  );

  const ctx = createContext();
  registerAllTools(server, ctx);
  registerAllResources(server, ctx);
  registerAllPrompts(server, ctx);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('LoopSpec MCP server v2.0.0 running (42 tools, 12 resources, 4 prompts)');

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

  if (args[0] === 'setup' || args[0] === 'start') {
    await runSetup();
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
