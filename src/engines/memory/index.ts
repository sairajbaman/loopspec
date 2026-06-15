import path from 'node:path';
import os from 'node:os';
import type { AppContext } from '../../context.js';
import { readFile, writeFile, ensureDir } from '../../utils/files.js';

export interface Learning {
  pattern: string;
  category: string;
  confidence: number;
  source_task: string;
}

// Pattern extraction strategies — each tries to pull actionable learnings
const EXTRACTORS = [
  // 1. Explicit imperative patterns (strongest signal)
  {
    regex: /(?:always|never|prefer|avoid|ensure|require|must|should|don't|do not)\s+.{10,80}?(?:\.|,|$)/gi,
    confidence: 0.7,
  },
  // 2. "Because" patterns — capture rationale
  {
    regex: /(?:because|since|due to|the reason)\s+.{10,80}?(?:\.|,|$)/gi,
    confidence: 0.5,
    transform: (match: string) => `Remember: ${match.trim()}`,
  },
  // 3. Problem → Solution patterns
  {
    regex: /(?:fixed|solved|resolved|the fix was|the solution is|worked by)\s+.{10,80}?(?:\.|,|$)/gi,
    confidence: 0.6,
    transform: (match: string) => `Prefer: ${match.replace(/^(?:fixed|solved|resolved|the fix was|the solution is|worked by)\s+/i, '').trim()}`,
  },
  // 4. Error prevention patterns
  {
    regex: /(?:broke|failed|crashed|caused|issue was|bug was|problem was)\s+.{10,80}?(?:\.|,|$)/gi,
    confidence: 0.6,
    transform: (match: string) => `Avoid: ${match.replace(/^(?:broke|failed|crashed|caused|issue was|bug was|problem was)\s+/i, '').trim()}`,
  },
  // 5. "Instead of X, use Y" patterns
  {
    regex: /(?:instead of|rather than|don't use|use .+ instead)\s+.{5,60}?(?:\.|,|$)/gi,
    confidence: 0.7,
  },
  // 6. Performance/optimization insights
  {
    regex: /(?:faster|slower|more efficient|less memory|cached|lazy.?load|code.?split)\s+.{5,60}?(?:\.|,|$)/gi,
    confidence: 0.5,
    transform: (match: string) => `Performance: ${match.trim()}`,
  },
];

// Category detection with weighted keywords
const CATEGORY_SIGNALS: Record<string, { keywords: string[]; weight: number }[]> = {
  security: [
    { keywords: ['auth', 'session', 'token', 'password', 'encrypt', 'secret', 'cors', 'csrf', 'xss', 'injection', 'sanitize', 'validate', 'permission', 'role'], weight: 1 },
  ],
  performance: [
    { keywords: ['cache', 'lazy', 'bundle', 'render', 'memo', 'debounce', 'throttle', 'index', 'query', 'n+1', 'waterfall', 'prefetch', 'stream'], weight: 1 },
  ],
  design: [
    { keywords: ['color', 'font', 'spacing', 'layout', 'responsive', 'animation', 'css', 'tailwind', 'theme', 'dark mode', 'contrast', 'accessibility'], weight: 1 },
  ],
  architecture: [
    { keywords: ['pattern', 'structure', 'module', 'import', 'export', 'separation', 'dependency', 'coupling', 'abstraction', 'interface'], weight: 1 },
  ],
  testing: [
    { keywords: ['test', 'mock', 'stub', 'assert', 'coverage', 'integration', 'unit', 'e2e', 'fixture'], weight: 1 },
  ],
};

function categorize(text: string): string {
  const lower = text.toLowerCase();
  let bestCategory = 'general';
  let bestScore = 0;

  for (const [category, signals] of Object.entries(CATEGORY_SIGNALS)) {
    let score = 0;
    for (const signal of signals) {
      for (const kw of signal.keywords) {
        if (lower.includes(kw)) score += signal.weight;
      }
    }
    if (score > bestScore) {
      bestCategory = category;
      bestScore = score;
    }
  }
  return bestCategory;
}

function deduplicateLearnings(learnings: Learning[]): Learning[] {
  const seen = new Set<string>();
  return learnings.filter((l) => {
    // Normalize for dedup: lowercase, trim, remove punctuation
    const key = l.pattern.toLowerCase().replace(/[^\w\s]/g, '').trim();
    if (seen.has(key)) return false;
    // Also skip very short or very generic patterns
    if (key.split(' ').length < 4) return false;
    seen.add(key);
    return true;
  });
}

export async function extractLearnings(task: string, outcome: string, explicit?: string[]): Promise<Learning[]> {
  const learnings: Learning[] = [];

  // 1. Explicit learnings (user-provided) get highest confidence
  if (explicit) {
    for (const l of explicit) {
      if (l.trim().length > 10) {
        learnings.push({ pattern: l.trim(), category: categorize(l), confidence: 0.8, source_task: task });
      }
    }
  }

  // 2. Run all extractors against the outcome text
  for (const extractor of EXTRACTORS) {
    const matches = outcome.match(extractor.regex);
    if (matches) {
      for (const match of matches.slice(0, 3)) { // cap at 3 per extractor to avoid noise
        const pattern = extractor.transform ? extractor.transform(match) : match.trim();
        if (pattern.length > 15 && pattern.length < 200) {
          learnings.push({
            pattern,
            category: categorize(pattern),
            confidence: extractor.confidence,
            source_task: task,
          });
        }
      }
    }
  }

  // 3. If nothing was extracted, synthesize a summary learning from the task+outcome
  if (learnings.length === 0 && outcome.length > 20) {
    learnings.push({
      pattern: `Completed: ${task.slice(0, 60)} — ${outcome.slice(0, 100)}`,
      category: categorize(outcome),
      confidence: 0.4,
      source_task: task,
    });
  }

  return deduplicateLearnings(learnings).slice(0, 8); // max 8 learnings per task
}

export async function storeMemory(ctx: AppContext, learnings: Learning[]) {
  const db = await ctx.getDb();
  const insertStmt = db.prepare('INSERT INTO memory (pattern, category, confidence, source_task, project) VALUES (?, ?, ?, ?, ?)');
  const findStmt = db.prepare('SELECT id, confidence, usage_count FROM memory WHERE pattern = ? AND project = ?');
  const updateStmt = db.prepare('UPDATE memory SET confidence = MIN(confidence + 0.1, 1.0), usage_count = usage_count + 1, updated_at = datetime(\'now\') WHERE id = ?');

  for (const l of learnings) {
    // Check if pattern already exists — if so, boost confidence instead of duplicating
    const existing = findStmt.get(l.pattern, ctx.projectDir) as { id: number; confidence: number; usage_count: number } | undefined;
    if (existing) {
      updateStmt.run(existing.id);
    } else {
      insertStmt.run(l.pattern, l.category, l.confidence, l.source_task, ctx.projectDir);
    }
  }
}

export async function searchMemory(ctx: AppContext, topic: string, limit = 5): Promise<Learning[]> {
  const db = await ctx.getDb();
  // Search with LIKE across pattern and category — weighted by confidence and usage
  const words = topic.split(/\s+/).filter((w) => w.length > 2);
  const conditions = words.map(() => 'pattern LIKE ?').join(' OR ');
  const params = words.map((w) => `%${w}%`);

  const query = conditions
    ? `SELECT pattern, category, confidence, source_task FROM memory WHERE (${conditions}) AND project = ? ORDER BY confidence DESC, usage_count DESC LIMIT ?`
    : `SELECT pattern, category, confidence, source_task FROM memory WHERE project = ? ORDER BY confidence DESC LIMIT ?`;

  const rows = conditions
    ? db.prepare(query).all(...params, ctx.projectDir, limit) as Learning[]
    : db.prepare(query).all(ctx.projectDir, limit) as Learning[];

  return rows;
}

export async function searchPlaybook(topic: string, limit = 5): Promise<Learning[]> {
  const playbookDir = path.join(os.homedir(), '.loopspec', 'playbook');
  const indexFile = path.join(playbookDir, 'index.json');
  const content = await readFile(indexFile);
  if (!content) return [];

  const entries: Learning[] = JSON.parse(content);
  const words = topic.toLowerCase().split(/\s+/);

  return entries
    .filter((e) => words.some((w) => e.pattern.toLowerCase().includes(w) || e.category.includes(w)))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
}

export async function promoteToPlaybook(learnings: Learning[]) {
  const highConfidence = learnings.filter((l) => l.confidence >= 0.7);
  if (highConfidence.length === 0) return;

  const playbookDir = path.join(os.homedir(), '.loopspec', 'playbook');
  await ensureDir(playbookDir);
  const indexFile = path.join(playbookDir, 'index.json');
  const content = await readFile(indexFile);
  const existing: Learning[] = content ? JSON.parse(content) : [];

  // Dedup against existing playbook
  const existingPatterns = new Set(existing.map((e) => e.pattern.toLowerCase()));
  const newEntries = highConfidence.filter((l) => !existingPatterns.has(l.pattern.toLowerCase()));

  if (newEntries.length > 0) {
    existing.push(...newEntries);
    await writeFile(indexFile, JSON.stringify(existing, null, 2));
  }
}

export async function updateSkillMd(ctx: AppContext, learnings: Learning[]) {
  const skillPath = path.join(ctx.loopspecDir, 'SKILL.md');
  const current = await readFile(skillPath);
  if (!current) return;

  // Only promote high-confidence learnings to SKILL.md
  const worthy = learnings.filter((l) => l.confidence >= 0.6);
  if (worthy.length === 0) return;

  const newEntries = worthy.map((l) => `- [${l.category}] ${l.pattern} (confidence: ${l.confidence})`).join('\n');
  const marker = '### Lessons Learned';

  if (current.includes(marker)) {
    // Append under existing section, avoiding duplicates
    const existingSection = current.split(marker)[1] || '';
    const alreadyThere = worthy.filter((l) => existingSection.includes(l.pattern));
    const toAdd = worthy.filter((l) => !existingSection.includes(l.pattern));
    if (toAdd.length === 0) return;

    const addEntries = toAdd.map((l) => `- [${l.category}] ${l.pattern} (confidence: ${l.confidence})`).join('\n');
    const updated = current.replace(marker, `${marker}\n${addEntries}`);
    await writeFile(skillPath, updated);
  } else {
    await writeFile(skillPath, current + `\n\n${marker}\n${newEntries}`);
  }
}
