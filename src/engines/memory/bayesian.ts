/**
 * Bayesian Confidence Scoring
 *
 * Instead of static 0.5/0.7/0.9, patterns have a real probability that updates:
 * - Success (pattern applied, no issues) → confidence increases
 * - Failure (pattern applied, caused problems) → confidence decreases
 * - Decay (unused for a long time) → confidence slowly drops
 *
 * Uses Beta distribution: P(success) = α / (α + β)
 * - α = successes + prior_α
 * - β = failures + prior_β
 * - Prior: α=1, β=1 (uniform/uninformative)
 */

import type { AppContext } from '../../context.js';

export interface BayesianPattern {
  id: number;
  pattern: string;
  category: string;
  alpha: number;  // success count + prior
  beta: number;   // failure count + prior
  confidence: number; // derived: α / (α + β)
  usage_count: number;
  last_used: string;
  source_task: string;
}

/**
 * Calculate confidence from alpha/beta (mean of Beta distribution)
 */
export function betaConfidence(alpha: number, beta: number): number {
  return alpha / (alpha + beta);
}

/**
 * Calculate uncertainty (variance of Beta distribution)
 * High uncertainty = we don't have enough data
 */
export function betaUncertainty(alpha: number, beta: number): number {
  const n = alpha + beta;
  return (alpha * beta) / (n * n * (n + 1));
}

/**
 * Wilson score lower bound — better for ranking than raw mean
 * This is what Reddit uses for "best" comment ranking
 */
export function wilsonLowerBound(alpha: number, beta: number, z = 1.96): number {
  const n = alpha + beta - 2; // subtract priors
  if (n <= 0) return 0.5; // no data yet
  const p = (alpha - 1) / n; // observed success rate
  const denominator = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const offset = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
  return (centre - offset) / denominator;
}

/**
 * Initialize bayesian columns in the memory table
 */
export async function initBayesianSchema(ctx: AppContext) {
  const db = await ctx.getDb();

  // Add alpha/beta columns if they don't exist
  const columns = db.prepare("PRAGMA table_info(memory)").all() as { name: string }[];
  const colNames = columns.map((c) => c.name);

  if (!colNames.includes('alpha')) {
    db.exec(`
      ALTER TABLE memory ADD COLUMN alpha REAL DEFAULT 2.0;
      ALTER TABLE memory ADD COLUMN beta REAL DEFAULT 2.0;
      ALTER TABLE memory ADD COLUMN last_used TEXT DEFAULT (datetime('now'));
      ALTER TABLE memory ADD COLUMN successes INTEGER DEFAULT 1;
      ALTER TABLE memory ADD COLUMN failures INTEGER DEFAULT 0;
    `);
    // Migrate existing confidence to alpha/beta
    // confidence = α/(α+β), so if confidence=0.7 with prior (1,1): α=1+successes, β=1+failures
    // Approximate: α = confidence * 4 (assume 2 data points), β = (1-confidence) * 4
    db.exec(`
      UPDATE memory SET
        alpha = COALESCE(confidence * (usage_count + 2), 2.0),
        beta = COALESCE((1.0 - confidence) * (usage_count + 2), 2.0),
        successes = COALESCE(usage_count, 1),
        failures = 0,
        last_used = COALESCE(updated_at, datetime('now'))
      WHERE alpha IS NULL OR alpha = 2.0;
    `);
  }
}

/**
 * Record a success — pattern was used and worked well
 */
export async function recordSuccess(ctx: AppContext, patternId: number) {
  const db = await ctx.getDb();
  db.prepare(`
    UPDATE memory SET
      alpha = alpha + 1.0,
      successes = successes + 1,
      usage_count = usage_count + 1,
      confidence = (alpha + 1.0) / (alpha + 1.0 + beta),
      last_used = datetime('now'),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(patternId);
}

/**
 * Record a failure — pattern was used and caused issues
 */
export async function recordFailure(ctx: AppContext, patternId: number) {
  const db = await ctx.getDb();
  db.prepare(`
    UPDATE memory SET
      beta = beta + 1.0,
      failures = failures + 1,
      confidence = alpha / (alpha + beta + 1.0),
      last_used = datetime('now'),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(patternId);
}

/**
 * Apply time decay — patterns unused for 30+ days lose confidence slowly
 * Uses exponential decay: α_new = α * decay_factor
 */
export async function applyTimeDecay(ctx: AppContext, decayDays = 30, decayFactor = 0.95) {
  const db = await ctx.getDb();
  db.prepare(`
    UPDATE memory SET
      alpha = MAX(1.0, alpha * ?),
      confidence = MAX(1.0, alpha * ?) / (MAX(1.0, alpha * ?) + beta),
      updated_at = datetime('now')
    WHERE julianday('now') - julianday(last_used) > ?
  `).run(decayFactor, decayFactor, decayFactor, decayDays);
}

/**
 * Get patterns ranked by Wilson lower bound (not raw confidence)
 * This properly handles the exploration/exploitation tradeoff:
 * - Pattern with 2/2 successes ranks lower than 20/22 successes
 */
export async function getTopPatterns(ctx: AppContext, category?: string, limit = 10): Promise<BayesianPattern[]> {
  const db = await ctx.getDb();
  const where = category ? 'WHERE category = ?' : '';
  const params = category ? [category, limit] : [limit];

  const rows = db.prepare(`
    SELECT id, pattern, category, alpha, beta, confidence, usage_count, last_used, source_task
    FROM memory ${where}
    ORDER BY (alpha / (alpha + beta)) DESC
    LIMIT ?
  `).all(...params) as BayesianPattern[];

  // Re-rank by Wilson lower bound (better than raw mean for ranking)
  return rows.sort((a, b) => wilsonLowerBound(b.alpha, b.beta) - wilsonLowerBound(a.alpha, a.beta));
}

/**
 * Find patterns that need more data (high uncertainty)
 */
export async function getUncertainPatterns(ctx: AppContext, limit = 5): Promise<BayesianPattern[]> {
  const db = await ctx.getDb();
  return db.prepare(`
    SELECT id, pattern, category, alpha, beta, confidence, usage_count, last_used, source_task
    FROM memory
    WHERE (alpha + beta) < 6
    ORDER BY usage_count ASC
    LIMIT ?
  `).all(limit) as BayesianPattern[];
}
