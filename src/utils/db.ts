import Database from 'better-sqlite3';
import path from 'node:path';
import { ensureDir } from './files.js';

export async function initDb(loopspecDir: string): Promise<Database.Database> {
  await ensureDir(loopspecDir);
  const dbPath = path.join(loopspecDir, 'metrics.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task TEXT NOT NULL,
      file TEXT,
      spec_compliance INTEGER DEFAULT 0,
      pattern_match INTEGER DEFAULT 0,
      drift_score INTEGER DEFAULT 0,
      test_coverage INTEGER DEFAULT 0,
      accessibility INTEGER DEFAULT 0,
      design_match INTEGER DEFAULT 0,
      overall INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pattern TEXT NOT NULL,
      category TEXT,
      confidence REAL DEFAULT 0.5,
      usage_count INTEGER DEFAULT 1,
      project TEXT,
      source_task TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS team_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member TEXT NOT NULL,
      task TEXT NOT NULL,
      overall INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  return db;
}
