/**
 * Fine-Tuning Dataset Export Engine
 * Converts LoopSpec session data (drift patterns, fixes, conventions)
 * into JSONL training data for model fine-tuning.
 */
import path from 'node:path';
import fs from 'node:fs';
import type { AppContext } from '../../context.js';
import { readFile } from '../../utils/files.js';

export interface TrainingExample {
  system: string;
  instruction: string;
  completion: string;
  metadata: { source: string; category: string; quality: number };
}

export interface ExportResult {
  totalExamples: number;
  outputPath: string;
  breakdown: Record<string, number>;
}

/**
 * Export all session/memory data as fine-tuning JSONL.
 */
export async function exportFineTuningData(ctx: AppContext, outputPath?: string): Promise<ExportResult> {
  const examples: TrainingExample[] = [];
  const outPath = outputPath || path.join(ctx.loopspecDir, 'training-data.jsonl');

  // 1. Extract from drift patterns (what went wrong + how to fix)
  examples.push(...await extractDriftExamples(ctx));

  // 2. Extract from memory/learnings (what worked)
  examples.push(...await extractMemoryExamples(ctx));

  // 3. Extract from conventions (SKILL.md as system prompt)
  examples.push(...await extractConventionExamples(ctx));

  // 4. Extract from session history (goals + outcomes)
  examples.push(...await extractSessionExamples(ctx));

  // Write JSONL
  const lines = examples.map(ex => JSON.stringify({
    messages: [
      { role: 'system', content: ex.system },
      { role: 'user', content: ex.instruction },
      { role: 'assistant', content: ex.completion },
    ],
    metadata: ex.metadata,
  }));

  fs.writeFileSync(outPath, lines.join('\n') + '\n');

  const breakdown: Record<string, number> = {};
  for (const ex of examples) {
    breakdown[ex.metadata.category] = (breakdown[ex.metadata.category] || 0) + 1;
  }

  return { totalExamples: examples.length, outputPath: outPath, breakdown };
}

async function extractDriftExamples(ctx: AppContext): Promise<TrainingExample[]> {
  const examples: TrainingExample[] = [];

  try {
    const db = await ctx.getDb();
    // Query scores table for drift data
    const rows = db.prepare(`
      SELECT task, file, spec_compliance, drift_score, overall, created_at 
      FROM scores ORDER BY id DESC LIMIT 100
    `).all() as any[];

    for (const row of rows) {
      if (row.drift_score < 80 && row.file) {
        examples.push({
          system: 'You are a code quality reviewer. Identify spec violations and suggest fixes.',
          instruction: `Review the file "${row.file}" for spec compliance. Current drift score: ${row.drift_score}/100.`,
          completion: `The file has spec drift (score: ${row.drift_score}/100). Check for: missing auth checks on protected routes, missing input validation on API handlers, missing error handling in async functions, and type safety issues. Spec compliance: ${row.spec_compliance}/100.`,
          metadata: { source: 'scores', category: 'drift-detection', quality: row.overall / 100 },
        });
      }
    }
  } catch (e) {
    // DB table may not exist yet — expected on first run
    if (!(e as Error).message?.includes('no such table')) {
      console.error('[finetune] drift extraction error:', (e as Error).message);
    }
  }

  return examples;
}

async function extractMemoryExamples(ctx: AppContext): Promise<TrainingExample[]> {
  const examples: TrainingExample[] = [];

  try {
    const db = await ctx.getDb();
    const rows = db.prepare(`
      SELECT pattern, category, confidence, source_task 
      FROM learnings WHERE confidence > 0.5 ORDER BY confidence DESC LIMIT 50
    `).all() as any[];

    for (const row of rows) {
      examples.push({
        system: 'You are a development assistant with learned project patterns.',
        instruction: `What should I keep in mind when working on: ${row.source_task}?`,
        completion: `[${row.category}] ${row.pattern}`,
        metadata: { source: 'learnings', category: 'pattern-recall', quality: row.confidence },
      });
    }
  } catch (e) {
    if (!(e as Error).message?.includes('no such table')) {
      console.error('[finetune] memory extraction error:', (e as Error).message);
    }
  }

  return examples;
}

async function extractConventionExamples(ctx: AppContext): Promise<TrainingExample[]> {
  const examples: TrainingExample[] = [];

  const skill = await readFile(path.join(ctx.loopspecDir, 'SKILL.md'));
  if (!skill) return examples;

  // Extract anti-patterns as training data
  const antiPatterns = skill.match(/\d+\.\s+\*\*[Nn]ever\*\*\s+(.+)/g) || [];
  for (const pattern of antiPatterns) {
    const rule = pattern.replace(/\d+\.\s+\*\*[Nn]ever\*\*\s+/, '');
    examples.push({
      system: 'You follow strict project conventions from SKILL.md.',
      instruction: `Is this acceptable in our codebase?`,
      completion: `No — convention violation: ${rule}. This is an anti-pattern in this project.`,
      metadata: { source: 'skill', category: 'convention', quality: 1.0 },
    });
  }

  // Extract commands as training data
  const commands = skill.match(/```bash\n([\s\S]*?)```/g) || [];
  for (const block of commands) {
    const cmds = block.replace(/```bash\n|```/g, '').trim();
    examples.push({
      system: 'You know the project commands.',
      instruction: 'What are the project commands?',
      completion: cmds,
      metadata: { source: 'skill', category: 'commands', quality: 1.0 },
    });
  }

  return examples;
}

async function extractSessionExamples(ctx: AppContext): Promise<TrainingExample[]> {
  const examples: TrainingExample[] = [];

  try {
    const db = await ctx.getDb();
    const rows = db.prepare(`
      SELECT name, status, score_start, score_end, goals_total, goals_completed, files_changed
      FROM sessions WHERE status = 'completed' ORDER BY started_at DESC LIMIT 20
    `).all() as any[];

    for (const row of rows) {
      const scoreDelta = row.score_end - row.score_start;
      if (scoreDelta > 0) {
        examples.push({
          system: 'You are a development planner that decomposes tasks effectively.',
          instruction: `Plan: "${row.name}"`,
          completion: `Completed ${row.goals_completed}/${row.goals_total} goals. Changed ${JSON.parse(row.files_changed || '[]').length} files. Score improved: ${row.score_start} → ${row.score_end} (+${scoreDelta}).`,
          metadata: { source: 'sessions', category: 'task-planning', quality: scoreDelta / 100 },
        });
      }
    }
  } catch (e) {
    if (!(e as Error).message?.includes('no such table')) {
      console.error('[finetune] session extraction error:', (e as Error).message);
    }
  }

  return examples;
}
