import path from 'node:path';
import type { AppContext } from '../../context.js';
import { readFile, writeFile } from '../../utils/files.js';

export interface Decision {
  decision: string;
  rationale: string;
  alternatives: string[];
  files: string[];
  sessionId: string;
}

export async function storeDecision(ctx: AppContext, d: Decision): Promise<void> {
  // 1. Store in SQLite
  try {
    const db = await ctx.getDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS decisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        decision TEXT NOT NULL,
        rationale TEXT NOT NULL,
        alternatives TEXT DEFAULT '[]',
        files TEXT DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    db.prepare(`INSERT INTO decisions (session_id, decision, rationale, alternatives, files) VALUES (?, ?, ?, ?, ?)`)
      .run(d.sessionId, d.decision, d.rationale, JSON.stringify(d.alternatives), JSON.stringify(d.files));
  } catch { /* DB not available */ }

  // 2. Append to markdown
  const mdPath = path.join(ctx.loopspecDir, 'decisions.md');
  const existing = await readFile(mdPath) || '# Decision Log\n\n';
  const entry = `## ${d.decision}\n\n**Date:** ${new Date().toISOString().slice(0, 10)}  \n**Rationale:** ${d.rationale}  \n${d.alternatives.length ? `**Rejected:** ${d.alternatives.join(', ')}  \n` : ''}${d.files.length ? `**Files:** ${d.files.join(', ')}  \n` : ''}\n---\n\n`;
  await writeFile(mdPath, existing + entry);
}

export async function queryDecisions(ctx: AppContext, topic: string): Promise<Decision[]> {
  try {
    const db = await ctx.getDb();
    db.exec(`CREATE TABLE IF NOT EXISTS decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT, decision TEXT NOT NULL, rationale TEXT NOT NULL,
      alternatives TEXT DEFAULT '[]', files TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now'))
    )`);
    const rows = db.prepare(`SELECT * FROM decisions WHERE decision LIKE ? OR rationale LIKE ? ORDER BY created_at DESC LIMIT 10`)
      .all(`%${topic}%`, `%${topic}%`) as any[];
    return rows.map(r => ({
      decision: r.decision,
      rationale: r.rationale,
      alternatives: JSON.parse(r.alternatives || '[]'),
      files: JSON.parse(r.files || '[]'),
      sessionId: r.session_id,
    }));
  } catch {
    return [];
  }
}
