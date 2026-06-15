import path from 'node:path';
import type Database from 'better-sqlite3';
import { initDb } from './utils/db.js';
import { ensureDir } from './utils/files.js';

export interface AppContext {
  projectDir: string;
  loopspecDir: string;
  db: Database.Database | null;
  getDb(): Promise<Database.Database>;
  ensureLoopspecDir(): Promise<void>;
}

export function createContext(projectDir?: string): AppContext {
  const dir = projectDir || process.env.LOOPSPEC_PROJECT_DIR || process.cwd();
  const resolved = path.resolve(dir);
  const loopspecDir = path.resolve(resolved, '.loopspec');

  const ctx: AppContext = {
    projectDir: resolved,
    loopspecDir,
    db: null,
    async getDb() {
      if (!ctx.db) {
        ctx.db = await initDb(loopspecDir);
      }
      return ctx.db;
    },
    async ensureLoopspecDir() {
      await ensureDir(loopspecDir);
    },
  };
  return ctx;
}
