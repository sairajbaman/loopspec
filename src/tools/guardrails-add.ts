import * as z from 'zod/v4';
import path from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { readFile, writeFile } from '../utils/files.js';
import { getAvailablePacks, getGuardrailPack } from '../engines/guardrails/index.js';

export function registerGuardrailsAddTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_guardrails_add', {
    title: 'Add Guardrail Pack',
    description: 'Install a guardrail pack. Available: ' + getAvailablePacks().join(', '),
    inputSchema: z.object({ pack: z.string().describe('Pack name (security-owasp, accessibility-wcag, react-patterns, performance-budget)') }),
  }, async ({ pack }) => {
    const packData = getGuardrailPack(pack as string);
    if (!packData) {
      return { content: [{ type: 'text' as const, text: `Pack "${pack}" not found. Available: ${getAvailablePacks().join(', ')}` }], isError: true };
    }

    await ctx.ensureLoopspecDir();
    const installedPath = path.join(ctx.loopspecDir, 'guardrails.json');
    const existing = await readFile(installedPath);
    const installed: string[] = existing ? JSON.parse(existing) : [];

    if (!installed.includes(pack as string)) {
      installed.push(pack as string);
      await writeFile(installedPath, JSON.stringify(installed, null, 2));
    }

    return { content: [{ type: 'text' as const, text: `✓ Installed guardrail pack: ${packData.name} (${packData.rules.length} rules)\n\nRules added:\n${packData.rules.map((r) => `- [${r.category}] ${r.rule}`).join('\n')}` }] };
  });
}
