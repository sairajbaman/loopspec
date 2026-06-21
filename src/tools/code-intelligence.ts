import * as z from 'zod/v4';
import path from 'node:path';
import fs from 'node:fs';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { buildGraph, loadGraph, impactAnalysis, queryGraph } from '../engines/graph/index.js';
import { loadProfile, updateProfile, formatProfile } from '../engines/profiler/index.js';
import { generateInjections, matchInjections } from '../engines/autocomplete/index.js';
import { proposeHealing, healSpec } from '../engines/self-heal/index.js';
import { verifyContracts, formatContractReport } from '../engines/contracts/index.js';
import { loadPlugins, installPlugin, removePlugin, listPlugins } from '../engines/plugins/index.js';
import { runInSandbox } from '../engines/sandbox/index.js';

export function registerGraphTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_graph', {
    title: 'Graph-of-Thought',
    description: 'Build/query project dependency graph. Actions: build, impact, query.',
    inputSchema: z.object({
      action: z.enum(['build', 'impact', 'query']),
      file: z.string().optional().describe('File for impact analysis'),
      query: z.string().optional().describe('Search query for nodes'),
    }),
  }, async ({ action, file, query }) => {
    switch (action) {
      case 'build': {
        const graph = await buildGraph(ctx);
        return { content: [{ type: 'text', text: `## Graph Built\n\nNodes: ${graph.nodes.length} (${graph.nodes.filter(n => n.type === 'file').length} files, ${graph.nodes.filter(n => n.type === 'function').length} functions, ${graph.nodes.filter(n => n.type === 'type').length} types, ${graph.nodes.filter(n => n.type === 'component').length} components, ${graph.nodes.filter(n => n.type === 'route').length} routes)\nEdges: ${graph.edges.length}\n\nStored in .loopspec/graph/graph.json` }] };
      }
      case 'impact': {
        if (!file) return { content: [{ type: 'text', text: 'Provide "file" for impact analysis.' }] };
        let graph = await loadGraph(ctx);
        if (!graph) graph = await buildGraph(ctx);
        const result = impactAnalysis(graph, file);
        return { content: [{ type: 'text', text: `## Impact Analysis\n\n${result.summary}` }] };
      }
      case 'query': {
        if (!query) return { content: [{ type: 'text', text: 'Provide "query" to search the graph.' }] };
        let graph = await loadGraph(ctx);
        if (!graph) graph = await buildGraph(ctx);
        const results = queryGraph(graph, query);
        const list = results.slice(0, 15).map(n => `  • [${n.type}] ${n.name} (${n.file}${n.line ? `:${n.line}` : ''})`).join('\n');
        return { content: [{ type: 'text', text: `## Graph Query: "${query}"\n\n${results.length} results:\n${list}` }] };
      }
    }
  });
}

export function registerProfilerTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_profile', {
    title: 'Model Profiler',
    description: 'View/update the model blind-spot profile. Actions: show, update.',
    inputSchema: z.object({
      action: z.enum(['show', 'update']),
      files: z.array(z.string()).optional().describe('Files to analyze for update'),
    }),
  }, async ({ action, files }) => {
    if (action === 'show') {
      const profile = await loadProfile(ctx);
      return { content: [{ type: 'text', text: formatProfile(profile) }] };
    }
    // update
    const fileContents = new Map<string, string>();
    for (const f of (files || [])) {
      try { fileContents.set(f, fs.readFileSync(path.resolve(ctx.projectDir, f), 'utf-8')); } catch {}
    }
    const profile = await updateProfile(ctx, fileContents);
    return { content: [{ type: 'text', text: `Profile updated (${profile.totalSessions} sessions).\n\n${formatProfile(profile)}` }] };
  });
}

export function registerAutocompleteTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_autocomplete', {
    title: 'Spec Autocomplete',
    description: 'Get spec-derived code injections for current context. Pre-fills schemas, types, and route signatures from your spec.',
    inputSchema: z.object({
      file: z.string().describe('Current file path'),
      context: z.string().optional().describe('Surrounding code context'),
    }),
  }, async ({ file, context }) => {
    const injections = await generateInjections(ctx);
    let content = '';
    try { content = fs.readFileSync(path.resolve(ctx.projectDir, file), 'utf-8'); } catch {}
    const matches = matchInjections(injections, { file, content: (context || '') + content });
    if (matches.length === 0) return { content: [{ type: 'text', text: 'No spec injections match current context.' }] };
    const text = matches.map(m => `### From ${m.source}\n\`\`\`typescript\n${m.content}\n\`\`\``).join('\n\n');
    return { content: [{ type: 'text', text: `## Spec Autocomplete — ${matches.length} suggestions\n\n${text}` }] };
  });
}

export function registerSelfHealTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_heal', {
    title: 'Self-Heal Spec',
    description: 'When drift is detected, choose to update spec (accept) or fix code (revert). Keeps spec alive.',
    inputSchema: z.object({
      file: z.string().describe('File with drift'),
      action: z.enum(['propose', 'accept', 'ignore']).optional(),
      driftIndex: z.number().optional().describe('Which drift item to act on (0-based)'),
    }),
  }, async ({ file, action, driftIndex }) => {
    if (!action || action === 'propose') {
      const { drifts, proposals } = await proposeHealing(ctx, file);
      if (drifts.length === 0) return { content: [{ type: 'text', text: `✓ No drift in ${file}.` }] };
      return { content: [{ type: 'text', text: `## Self-Heal Proposals for ${file}\n\n${proposals.join('\n\n')}\n\nUse loopspec_heal with action "accept" or "ignore" and driftIndex to apply.` }] };
    }

    const { drifts } = await proposeHealing(ctx, file);
    const idx = driftIndex || 0;
    if (idx >= drifts.length) return { content: [{ type: 'text', text: 'Invalid driftIndex.' }] };

    const healAction = action === 'accept' ? 'update_spec' : 'ignore';
    const result = await healSpec(ctx, [{ drift: drifts[idx], action: healAction }]);

    let text = `✓ ${healAction === 'update_spec' ? 'Spec updated' : 'Exception added'} for: ${drifts[idx].category}`;
    if (result.rippleEffects.length > 0) {
      text += `\n\n⚠ Ripple effects:\n${result.rippleEffects.map(r => `  • ${r}`).join('\n')}`;
    }
    return { content: [{ type: 'text', text }] };
  });
}

export function registerContractsTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_contracts', {
    title: 'API Contracts',
    description: 'Verify frontend/backend match at API boundaries. Checks auth, validation, undocumented routes.',
    inputSchema: z.object({}),
  }, async () => {
    const violations = await verifyContracts(ctx);
    return { content: [{ type: 'text', text: formatContractReport(violations) }] };
  });
}

export function registerPluginTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_plugin', {
    title: 'Plugin Manager',
    description: 'Install/remove/list plugins. Plugins add rules, goals, and score modifiers.',
    inputSchema: z.object({
      action: z.enum(['install', 'remove', 'list']),
      name: z.string().optional(),
    }),
  }, async ({ action, name }) => {
    switch (action) {
      case 'install': {
        if (!name) return { content: [{ type: 'text', text: 'Provide plugin name.' }] };
        const r = await installPlugin(ctx, name);
        return { content: [{ type: 'text', text: r.message }] };
      }
      case 'remove': {
        if (!name) return { content: [{ type: 'text', text: 'Provide plugin name.' }] };
        const r = await removePlugin(ctx, name);
        return { content: [{ type: 'text', text: r.message }] };
      }
      case 'list': {
        const r = await listPlugins(ctx);
        let text = '## Plugins\n\n';
        if (r.installed.length) text += `Installed: ${r.installed.join(', ')}\n`;
        if (r.available.length) text += `Available: ${r.available.join(', ')}\n`;
        return { content: [{ type: 'text', text }] };
      }
    }
  });
}

export function registerSandboxTool(server: McpServer, _ctx: AppContext) {
  server.registerTool('loopspec_sandbox', {
    title: 'Live Sandbox',
    description: 'Execute JS/TS snippets in an isolated sandbox. Returns output or errors.',
    inputSchema: z.object({
      code: z.string().describe('JavaScript code to execute'),
      testCases: z.array(z.object({ input: z.string(), expected: z.string(), description: z.string() })).optional(),
    }),
  }, async ({ code, testCases }) => {
    const results = await runInSandbox(code, testCases);
    const text = results.map(r => `${r.success ? '✓' : '✗'} ${r.output}${r.error ? ` (Error: ${r.error})` : ''} [${r.duration}ms]`).join('\n');
    return { content: [{ type: 'text', text: `## Sandbox Results\n\n${text}` }] };
  });
}
