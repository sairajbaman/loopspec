import path from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { readFile } from '../utils/files.js';
import { getScoreTrends } from '../engines/scorecard/index.js';

const SPEC_DOCS = ['PRD', 'TRD', 'AppFlow', 'UIBrief', 'Schema', 'Plan', 'SKILL', 'DesignSystem'] as const;

export function registerAllResources(server: McpServer, ctx: AppContext) {
  // 8 spec document resources
  for (const doc of SPEC_DOCS) {
    const uri = `loopspec://spec/${doc.toLowerCase()}`;
    server.registerResource(doc.toLowerCase(), uri, {
      title: `${doc} Document`,
      description: `Current ${doc} specification`,
      mimeType: 'text/markdown',
    }, async () => {
      const content = await readFile(path.join(ctx.loopspecDir, `${doc}.md`));
      return { contents: [{ uri, text: content || `No ${doc}.md found. Run loopspec_init first.` }] };
    });
  }

  // Score resources
  server.registerResource('score-latest', 'loopspec://score/latest', {
    title: 'Latest Score',
    description: 'Most recent scorecard',
    mimeType: 'text/plain',
  }, async () => {
    try {
      const db = await ctx.getDb();
      const row = db.prepare('SELECT * FROM scores ORDER BY id DESC LIMIT 1').get() as Record<string, unknown> | undefined;
      const text = row ? JSON.stringify(row, null, 2) : 'No scores yet. Run loopspec_score after a task.';
      return { contents: [{ uri: 'loopspec://score/latest', text }] };
    } catch { return { contents: [{ uri: 'loopspec://score/latest', text: 'No scores yet.' }] }; }
  });

  server.registerResource('score-trends', 'loopspec://score/trends', {
    title: 'Score Trends',
    description: 'Score history over time',
    mimeType: 'text/plain',
  }, async () => {
    const trends = await getScoreTrends(ctx);
    return { contents: [{ uri: 'loopspec://score/trends', text: trends }] };
  });

  // Memory resources
  server.registerResource('memory-project', 'loopspec://memory/project', {
    title: 'Project Memory',
    description: 'Current project learnings',
    mimeType: 'text/plain',
  }, async () => {
    try {
      const db = await ctx.getDb();
      const rows = db.prepare('SELECT pattern, category, confidence FROM memory ORDER BY confidence DESC LIMIT 20').all() as { pattern: string; category: string; confidence: number }[];
      const text = rows.length ? rows.map((r) => `[${r.category}] ${r.pattern} (${r.confidence})`).join('\n') : 'No project memories yet.';
      return { contents: [{ uri: 'loopspec://memory/project', text }] };
    } catch { return { contents: [{ uri: 'loopspec://memory/project', text: 'No memories yet.' }] }; }
  });

  server.registerResource('memory-playbook', 'loopspec://memory/playbook', {
    title: 'Cross-Project Playbook',
    description: 'Patterns learned across projects',
    mimeType: 'text/plain',
  }, async () => {
    const os = await import('node:os');
    const content = await readFile(path.join(os.homedir(), '.loopspec', 'playbook', 'index.json'));
    if (!content) return { contents: [{ uri: 'loopspec://memory/playbook', text: 'No playbook patterns yet.' }] };
    const entries = JSON.parse(content) as { pattern: string; category: string; confidence: number }[];
    const text = entries.map((e) => `[${e.category}] ${e.pattern} (confidence: ${e.confidence})`).join('\n');
    return { contents: [{ uri: 'loopspec://memory/playbook', text }] };
  });
}
