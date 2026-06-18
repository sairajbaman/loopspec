import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import fs from 'node:fs/promises';
import type { AppContext } from '../../context.js';
import { ensureDir, readFile, writeFile } from '../../utils/files.js';

export interface Session {
  id: string;
  name: string;
  status: 'active' | 'completed' | 'abandoned';
  startedAt: string;
  endedAt?: string;
  scoreStart: number;
  scoreEnd: number;
  currentScore: number;
  goalsTotal: number;
  goalsCompleted: number;
  guardrailHits: number;
  filesChanged: string[];
  checkpoints: Checkpoint[];
  goals: SessionGoal[];
  restored?: string;
}

export interface SessionGoal {
  id: string;
  description: string;
  status: 'pending' | 'done' | 'blocked';
}

export interface Checkpoint {
  id: string;
  timestamp: string;
  score: number;
  filesSnapshot: string[];
  notes?: string;
}

export interface SessionReport {
  name: string;
  duration: string;
  scoreStart: number;
  scoreEnd: number;
  scoreDelta: number;
  goalsCompleted: number;
  goalsTotal: number;
  reportPath: string;
}

interface SessionManagerOptions {
  global?: boolean;
}

export class SessionManager {
  private ctx: AppContext;
  private sessionsDir: string;
  private currentPath: string;

  constructor(ctx: AppContext, opts: SessionManagerOptions = {}) {
    this.ctx = ctx;
    this.sessionsDir = opts.global
      ? path.join(homedir(), '.loopspec', 'sessions')
      : path.join(ctx.loopspecDir, 'sessions');
    this.currentPath = path.join(ctx.loopspecDir, 'current-session.json');
  }

  async start(name: string): Promise<Session> {
    await ensureDir(this.sessionsDir);
    await ensureDir(this.ctx.loopspecDir);

    // Check for restorable sessions
    const restored = await this.getRestoreSummary();

    const session: Session = {
      id: randomUUID().slice(0, 8),
      name,
      status: 'active',
      startedAt: new Date().toISOString(),
      scoreStart: 0,
      scoreEnd: 0,
      currentScore: 0,
      goalsTotal: 0,
      goalsCompleted: 0,
      guardrailHits: 0,
      filesChanged: [],
      checkpoints: [],
      goals: [],
      restored: restored || undefined,
    };

    await this.persist(session);
    await writeFile(this.currentPath, JSON.stringify({ id: session.id }, null, 2));

    // Also persist to DB
    await this.persistToDb(session);

    return session;
  }

  async getCurrent(): Promise<Session | null> {
    const ref = await readFile(this.currentPath);
    if (!ref) return null;
    try {
      const { id } = JSON.parse(ref);
      return this.load(id);
    } catch {
      return null;
    }
  }

  async end(): Promise<SessionReport | null> {
    const session = await this.getCurrent();
    if (!session) return null;

    session.status = 'completed';
    session.endedAt = new Date().toISOString();
    session.scoreEnd = session.currentScore;

    await this.persist(session);
    await this.persistToDb(session);

    // Generate report
    const duration = this.formatDuration(session.startedAt, session.endedAt);
    const reportPath = path.join(this.sessionsDir, `${session.id}-report.md`);
    const report = this.generateReport(session, duration);
    await writeFile(reportPath, report);

    // Clear current
    try { await fs.unlink(this.currentPath); } catch {}

    return {
      name: session.name,
      duration,
      scoreStart: session.scoreStart,
      scoreEnd: session.scoreEnd,
      scoreDelta: session.scoreEnd - session.scoreStart,
      goalsCompleted: session.goals.filter(g => g.status === 'done').length,
      goalsTotal: session.goals.length,
      reportPath: path.relative(this.ctx.projectDir, reportPath),
    };
  }

  async checkpoint(notes?: string): Promise<Checkpoint> {
    const session = await this.getCurrent();
    if (!session) throw new Error('No active session');

    const cp: Checkpoint = {
      id: randomUUID().slice(0, 8),
      timestamp: new Date().toISOString(),
      score: session.currentScore,
      filesSnapshot: [...session.filesChanged],
      notes,
    };
    session.checkpoints.push(cp);
    await this.persist(session);
    return cp;
  }

  async updateScore(score: number) {
    const session = await this.getCurrent();
    if (!session) return;
    if (session.scoreStart === 0) session.scoreStart = score;
    session.currentScore = score;
    await this.persist(session);
  }

  async trackFile(file: string) {
    const session = await this.getCurrent();
    if (!session) return;
    if (!session.filesChanged.includes(file)) {
      session.filesChanged.push(file);
      await this.persist(session);
    }
  }

  async addGuardrailHit() {
    const session = await this.getCurrent();
    if (!session) return;
    session.guardrailHits++;
    await this.persist(session);
  }

  async setGoals(goals: SessionGoal[]) {
    const session = await this.getCurrent();
    if (!session) return;
    session.goals = goals;
    session.goalsTotal = goals.length;
    session.goalsCompleted = goals.filter(g => g.status === 'done').length;
    await this.persist(session);
  }

  async updateGoal(goalId: string, status: 'pending' | 'done' | 'blocked') {
    const session = await this.getCurrent();
    if (!session) return;
    const goal = session.goals.find(g => g.id === goalId);
    if (goal) {
      goal.status = status;
      session.goalsCompleted = session.goals.filter(g => g.status === 'done').length;
      await this.persist(session);
    }
  }

  async history(): Promise<Session[]> {
    try {
      const files = await fs.readdir(this.sessionsDir);
      const sessions: Session[] = [];
      for (const f of files) {
        if (f.endsWith('.json') && !f.includes('report') && f !== 'current-session.json') {
          const data = await readFile(path.join(this.sessionsDir, f));
          if (data) sessions.push(JSON.parse(data));
        }
      }
      return sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    } catch {
      return [];
    }
  }

  private async getRestoreSummary(): Promise<string | null> {
    const sessions = await this.history();
    const last = sessions.find(s => s.status === 'completed' || s.status === 'active');
    if (!last) return null;

    const done = last.goals.filter(g => g.status === 'done').map(g => g.description);
    const remaining = last.goals.filter(g => g.status !== 'done').map(g => g.description);

    if (done.length === 0 && remaining.length === 0) return null;

    let summary = `Previous session: "${last.name}" (${last.startedAt.slice(0, 10)})\n`;
    if (done.length) summary += `  Completed: ${done.join(', ')}\n`;
    if (remaining.length) summary += `  Remaining: ${remaining.join(', ')}\n`;
    summary += `  Last score: ${last.currentScore}/100`;
    return summary;
  }

  private async persist(session: Session) {
    await ensureDir(this.sessionsDir);
    await writeFile(
      path.join(this.sessionsDir, `${session.id}.json`),
      JSON.stringify(session, null, 2)
    );
  }

  private async persistToDb(session: Session) {
    try {
      const db = await this.ctx.getDb();
      db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          status TEXT NOT NULL,
          started_at TEXT NOT NULL,
          ended_at TEXT,
          score_start INTEGER DEFAULT 0,
          score_end INTEGER DEFAULT 0,
          goals_total INTEGER DEFAULT 0,
          goals_completed INTEGER DEFAULT 0,
          files_changed TEXT DEFAULT '[]',
          created_at TEXT DEFAULT (datetime('now'))
        )
      `);
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO sessions (id, name, status, started_at, ended_at, score_start, score_end, goals_total, goals_completed, files_changed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(session.id, session.name, session.status, session.startedAt, session.endedAt || null,
        session.scoreStart, session.scoreEnd, session.goalsTotal, session.goalsCompleted,
        JSON.stringify(session.filesChanged));
    } catch { /* DB not available in CLI-only mode */ }
  }

  private async load(id: string): Promise<Session | null> {
    const data = await readFile(path.join(this.sessionsDir, `${id}.json`));
    return data ? JSON.parse(data) : null;
  }

  private formatDuration(start: string, end: string): string {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const mins = Math.round(ms / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  private generateReport(session: Session, duration: string): string {
    const goals = session.goals.map(g => `- [${g.status === 'done' ? 'x' : ' '}] ${g.description}`).join('\n');
    return `# Session Report: ${session.name}

**ID:** ${session.id}  
**Duration:** ${duration}  
**Score:** ${session.scoreStart} → ${session.scoreEnd} (${session.scoreEnd - session.scoreStart >= 0 ? '+' : ''}${session.scoreEnd - session.scoreStart})

## Goals
${goals || 'No goals tracked.'}

## Files Changed (${session.filesChanged.length})
${session.filesChanged.map(f => `- ${f}`).join('\n') || 'None'}

## Checkpoints (${session.checkpoints.length})
${session.checkpoints.map(c => `- [${c.timestamp.slice(11, 16)}] Score: ${c.score}${c.notes ? ` — ${c.notes}` : ''}`).join('\n') || 'None'}

## Guardrail Violations: ${session.guardrailHits}
`;
  }
}
