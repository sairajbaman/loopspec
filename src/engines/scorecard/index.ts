import path from 'node:path';
import fs from 'node:fs';
import type { AppContext } from '../../context.js';
import { readFile, listFiles } from '../../utils/files.js';
import { detectDrift } from '../live-sync/index.js';

export interface ScoreResult {
  specCompliance: number;
  patternMatch: number;
  driftScore: number;
  testCoverage: number;
  accessibility: number;
  designMatch: number;
  overall: number;
  suggestions: string[];
  breakdown: Record<string, string>;
}

// Real accessibility checks on source code
function scoreAccessibility(content: string, filePath: string): { score: number; issues: string[] } {
  if (!filePath.match(/\.(tsx|jsx|svelte|vue|html)$/)) return { score: 100, issues: [] };

  let score = 100;
  const issues: string[] = [];

  // Check img tags for alt attributes
  const imgs = content.match(/<img\b[^>]*>/gi) || [];
  const imgsWithoutAlt = imgs.filter(i => !i.includes('alt=') && !i.includes('alt ='));
  if (imgsWithoutAlt.length > 0) {
    score -= imgsWithoutAlt.length * 10;
    issues.push(`${imgsWithoutAlt.length} <img> without alt attribute`);
  }

  // Check form inputs for labels/aria
  const inputs = content.match(/<input\b[^>]*>/gi) || [];
  const unlabeled = inputs.filter(i => !i.includes('aria-label') && !i.includes('id='));
  if (unlabeled.length > 0) {
    score -= unlabeled.length * 5;
    issues.push(`${unlabeled.length} <input> possibly missing label association`);
  }

  // Check buttons for accessible text
  const emptyButtons = (content.match(/<button[^>]*>\s*<(?:svg|img|icon)/gi) || []).length;
  if (emptyButtons > 0) {
    score -= emptyButtons * 8;
    issues.push(`${emptyButtons} buttons with icon-only content (needs aria-label)`);
  }

  // Check for onClick on non-interactive elements
  const divClicks = (content.match(/<(?:div|span)\b[^>]*onClick/gi) || []).length;
  if (divClicks > 0) {
    score -= divClicks * 7;
    issues.push(`${divClicks} onClick on div/span (use <button> or add role/keyboard handlers)`);
  }

  // Check for color-only indicators
  const colorOnly = (content.match(/(?:text-red|text-green|text-yellow)-\d+/g) || []).length;
  const hasAriaOrIcon = content.includes('aria-live') || content.includes('sr-only') || content.includes('role="status"');
  if (colorOnly > 3 && !hasAriaOrIcon) {
    score -= 10;
    issues.push('Heavy color usage without aria-live or sr-only alternatives');
  }

  return { score: Math.max(0, score), issues };
}

// Check design system adherence
function scoreDesignMatch(content: string, designSystem: string | null): { score: number; issues: string[] } {
  let score = 100;
  const issues: string[] = [];

  // Check for hardcoded colors (should use design tokens)
  const hardcodedColors = (content.match(/#[0-9a-fA-F]{3,8}|rgb\(|rgba\(/g) || []).length;
  if (hardcodedColors > 3) {
    score -= Math.min(30, hardcodedColors * 3);
    issues.push(`${hardcodedColors} hardcoded color values (use design tokens/variables)`);
  }

  // Check for inline styles (bad for consistency)
  const inlineStyles = (content.match(/style=\{?\{|style="/g) || []).length;
  if (inlineStyles > 2) {
    score -= Math.min(20, inlineStyles * 4);
    issues.push(`${inlineStyles} inline styles (use className/utility classes)`);
  }

  // Check for magic numbers in spacing
  const magicPx = (content.match(/:\s*\d+px|margin:\s*\d|padding:\s*\d/g) || []).length;
  if (magicPx > 3) {
    score -= Math.min(15, magicPx * 3);
    issues.push(`${magicPx} magic pixel values (use spacing scale)`);
  }

  // If we have a design system doc, check for token usage
  if (designSystem) {
    const primaryColor = designSystem.match(/primary[:\s]+([#\w]+)/i)?.[1];
    if (primaryColor && !content.includes('primary') && content.match(/className/)) {
      score -= 10;
      issues.push('No primary color token usage found (check design system alignment)');
    }
  }

  return { score: Math.max(0, score), issues };
}

// Detect test coverage from file structure — actually checks filesystem
function scoreTestCoverage(files: string[], projectDir: string): { score: number; issues: string[] } {
  const issues: string[] = [];
  let testedCount = 0;
  let sourceCount = 0;

  for (const file of files) {
    // Skip test files, config files, type declaration files
    if (file.match(/\.(test|spec)\.\w+$/) || file.match(/\.(config|d)\.\w+$/) || file.includes('__tests__')) continue;
    if (!file.match(/\.(ts|tsx|js|jsx)$/)) continue;
    sourceCount++;

    const ext = path.extname(file);
    const base = file.replace(ext, '');
    const dir = path.dirname(path.isAbsolute(file) ? file : path.join(projectDir, file));
    const baseName = path.basename(file, ext);

    const possibleTests = [
      path.join(dir, `${baseName}.test${ext}`),
      path.join(dir, `${baseName}.spec${ext}`),
      path.join(dir, `${baseName}.test.ts`),
      path.join(dir, `${baseName}.test.tsx`),
      path.join(dir, '__tests__', `${baseName}.test${ext}`),
      path.join(dir, '__tests__', `${baseName}.test.ts`),
      path.join(projectDir, 'tests', `${baseName}.test.ts`),
      path.join(projectDir, 'tests', `${baseName}.test.tsx`),
      path.join(projectDir, '__tests__', `${baseName}.test.ts`),
    ];

    const hasTest = possibleTests.some(p => {
      try { return fs.existsSync(p); } catch { return false; }
    });

    if (hasTest) testedCount++;
  }

  sourceCount = Math.max(sourceCount, 1);
  const coverage = Math.round((testedCount / sourceCount) * 100);
  const score = Math.min(100, coverage);

  if (score < 60) issues.push(`Low test coverage: ${testedCount}/${sourceCount} source files have tests`);

  return { score, issues };
}

// Check spec compliance with positive + negative signals
async function scoreSpecCompliance(ctx: AppContext, content: string, filePath: string): Promise<{ score: number; issues: string[]; positives: string[] }> {
  let score = 50; // start neutral — earn your way up
  const issues: string[] = [];
  const positives: string[] = [];

  const skill = await readFile(path.join(ctx.loopspecDir, 'SKILL.md'));
  const schema = await readFile(path.join(ctx.loopspecDir, 'Schema.md'));
  const trd = await readFile(path.join(ctx.loopspecDir, 'TRD.md'));

  // ─── Positive signals (earn up to +50) ────────────────────────────────────

  // Types defined → strong positive
  if (content.match(/interface\s+\w+|type\s+\w+\s*=/)) {
    score += 10;
    positives.push('✓ Types/interfaces defined');
  }

  // Proper error handling
  if (content.match(/try\s*\{|\.catch\(|ErrorBoundary/)) {
    score += 8;
    positives.push('✓ Error handling present');
  }

  // Input validation
  if (content.match(/z\.\w+|zod|yup|joi|validate|safeParse/i)) {
    score += 8;
    positives.push('✓ Input validation');
  }

  // Loading/empty/error states handled
  const statePatterns = [/loading|isLoading|isPending|Skeleton|Spinner/i, /empty.*state|no.*found|\.length\s*===?\s*0/i, /error|isError|ErrorBoundary/i];
  const statesHandled = statePatterns.filter(p => p.test(content)).length;
  if (statesHandled >= 2) {
    score += 8;
    positives.push(`✓ UI states handled (${statesHandled}/3)`);
  }

  // Named exports (clean API surface)
  if (content.match(/export\s+(?:function|const|class|type|interface)\s+\w+/) && !content.match(/export\s+default/)) {
    score += 5;
    positives.push('✓ Named exports only');
  }

  // Follows file structure from TRD (route grouping, colocation)
  if (trd && filePath.match(/src\//)) {
    const fileDir = path.dirname(filePath);
    if (trd.toLowerCase().includes(fileDir.replace(/\\/g, '/'))) {
      score += 7;
      positives.push('✓ Follows TRD file structure');
    }
  }

  // Proper async patterns
  if (content.match(/async\s+function|await\s+/) && content.match(/try\s*\{/)) {
    score += 5;
    positives.push('✓ Async with error handling');
  }

  // No any types at all → strong positive
  if (!content.match(/:\s*any(?:\s|;|,|\)|\])/) && content.match(/:\s*\w/)) {
    score += 7;
    positives.push('✓ Strict types (no `any`)');
  }

  // ─── Negative signals (deduct up to -50) ──────────────────────────────────

  // console.log in production code
  if (content.match(/console\.\w+/) && !filePath.includes('test') && !filePath.includes('debug')) {
    score -= 5;
    issues.push('console.log in production code');
  }

  // TODO/FIXME markers
  const todos = (content.match(/(?:TODO|FIXME|HACK|XXX)/g) || []).length;
  if (todos > 0) {
    score -= todos * 3;
    issues.push(`${todos} TODO/FIXME markers — incomplete implementation`);
  }

  // SKILL convention violations
  if (skill) {
    if (skill.includes('no default export') && content.match(/export\s+default/)) {
      score -= 10;
      issues.push('Uses default export (SKILL.md says named exports only)');
    }
    if (skill.includes('strict') && content.match(/:\s*any(?:\s|;|,|\))/)) {
      score -= 10;
      issues.push('Uses `any` type (SKILL.md says strict mode)');
    }
  }

  // @ts-ignore
  if (content.match(/@ts-ignore|@ts-nocheck/)) {
    score -= 8;
    issues.push('Uses @ts-ignore/@ts-nocheck');
  }

  return { score: Math.max(0, Math.min(100, score)), issues, positives };
}

export async function scoreTask(ctx: AppContext, task: string, files: string[]): Promise<ScoreResult> {
  const suggestions: string[] = [];
  const breakdown: Record<string, string> = {};

  let totalSpecCompliance = 0;
  let totalAccessibility = 0;
  let totalDesignMatch = 0;
  let totalDrift = 100;
  let patternMatch = 85;
  let fileCount = 0;
  const allPositives: string[] = [];

  const designSystem = await readFile(path.join(ctx.loopspecDir, 'DesignSystem.md'));

  for (const file of files) {
    const absPath = path.isAbsolute(file) ? file : path.join(ctx.projectDir, file);
    const content = await readFile(absPath);
    if (!content) continue;
    fileCount++;

    // Drift
    const drifts = await detectDrift(ctx, file);
    totalDrift -= drifts.length * 15;

    // Spec compliance with positive signals
    const spec = await scoreSpecCompliance(ctx, content, file);
    totalSpecCompliance += spec.score;
    if (spec.issues.length) breakdown[`spec:${file}`] = spec.issues.join('; ');
    allPositives.push(...spec.positives);

    // Real accessibility analysis
    const a11y = scoreAccessibility(content, file);
    totalAccessibility += a11y.score;
    if (a11y.issues.length) breakdown[`a11y:${file}`] = a11y.issues.join('; ');

    // Real design match analysis
    const design = scoreDesignMatch(content, designSystem);
    totalDesignMatch += design.score;
    if (design.issues.length) breakdown[`design:${file}`] = design.issues.join('; ');

    // Pattern match
    if (content.includes('any')) patternMatch -= 3;
    if (content.includes('@ts-ignore')) patternMatch -= 8;
  }

  fileCount = Math.max(fileCount, 1);
  const specCompliance = Math.round(totalSpecCompliance / fileCount);
  const accessibility = Math.round(totalAccessibility / fileCount);
  const designMatch = Math.round(totalDesignMatch / fileCount);
  const driftScore = Math.max(0, Math.min(100, totalDrift));
  const testResult = scoreTestCoverage(files, ctx.projectDir);
  const testCoverage = testResult.score;

  patternMatch = Math.max(0, Math.min(100, patternMatch));
  const overall = Math.round(
    specCompliance * 0.25 + patternMatch * 0.10 + driftScore * 0.25 +
    testCoverage * 0.15 + accessibility * 0.15 + designMatch * 0.10
  );

  if (testCoverage < 60) suggestions.push('Add unit tests for changed files');
  if (driftScore < 80) suggestions.push('Fix drift — code deviates from spec');
  if (specCompliance < 70) suggestions.push('Review spec alignment — TODOs or missing types');
  if (accessibility < 80) suggestions.push('Fix accessibility — missing alt, labels, or ARIA');
  if (designMatch < 80) suggestions.push('Use design tokens — avoid hardcoded colors/spacing');
  if (patternMatch < 80) suggestions.push('Fix type safety — remove `any` and @ts-ignore');

  // Add unique positives to breakdown
  const uniquePositives = [...new Set(allPositives)];
  if (uniquePositives.length) breakdown['positives'] = uniquePositives.join('; ');

  return { specCompliance, patternMatch, driftScore, testCoverage, accessibility, designMatch, overall, suggestions, breakdown };
}

export function formatScorecard(score: ScoreResult, task: string): string {
  const bar = (n: number) => '█'.repeat(Math.floor(n / 10)) + '░'.repeat(10 - Math.floor(n / 10));
  const grade = (n: number) => n >= 90 ? 'A' : n >= 80 ? 'B' : n >= 70 ? 'C' : n >= 60 ? 'D' : 'F';

  let card = `## LoopSpec Scorecard — ${task.slice(0, 40)}

| Dimension | Score | Grade | Bar |
|-----------|-------|-------|-----|
| Spec Compliance | ${score.specCompliance}/100 | ${grade(score.specCompliance)} | ${bar(score.specCompliance)} |
| Pattern Match | ${score.patternMatch}/100 | ${grade(score.patternMatch)} | ${bar(score.patternMatch)} |
| Drift Score | ${score.driftScore}/100 | ${grade(score.driftScore)} | ${bar(score.driftScore)} |
| Test Coverage | ${score.testCoverage}/100 | ${grade(score.testCoverage)} | ${bar(score.testCoverage)} |
| Accessibility | ${score.accessibility}/100 | ${grade(score.accessibility)} | ${bar(score.accessibility)} |
| Design Match | ${score.designMatch}/100 | ${grade(score.designMatch)} | ${bar(score.designMatch)} |
| **Overall** | **${score.overall}/100** | **${grade(score.overall)}** | ${bar(score.overall)} |`;

  if (score.suggestions.length) {
    card += '\n\n### Suggestions\n' + score.suggestions.map(s => `- ${s}`).join('\n');
  }

  if (score.breakdown.positives) {
    card += '\n\n### What You Did Right\n' + score.breakdown.positives.split('; ').map(s => `- ${s}`).join('\n');
  }

  if (Object.keys(score.breakdown).length) {
    const issues = Object.entries(score.breakdown).filter(([k]) => k !== 'positives');
    if (issues.length) {
      card += '\n\n### Issues\n';
      for (const [key, val] of issues) {
        card += `- **${key}:** ${val}\n`;
      }
    }
  }

  return card;
}

export async function persistScore(ctx: AppContext, task: string, file: string | null, score: ScoreResult) {
  const db = await ctx.getDb();
  db.prepare(`INSERT INTO scores (task, file, spec_compliance, pattern_match, drift_score, test_coverage, accessibility, design_match, overall) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(task, file, score.specCompliance, score.patternMatch, score.driftScore, score.testCoverage, score.accessibility, score.designMatch, score.overall);
}

// ─── Configurable Thresholds ─────────────────────────────────────────────────

export interface ScoreThresholds {
  specCompliance: number;
  patternMatch: number;
  driftScore: number;
  testCoverage: number;
  accessibility: number;
  designMatch: number;
  overall: number;
}

export const DEFAULT_THRESHOLDS: ScoreThresholds = {
  specCompliance: 70,
  patternMatch: 75,
  driftScore: 80,
  testCoverage: 60,
  accessibility: 80,
  designMatch: 70,
  overall: 70,
};

export function evaluateThresholds(score: ScoreResult, thresholds: ScoreThresholds = DEFAULT_THRESHOLDS): { passed: boolean; failures: string[] } {
  const failures: string[] = [];
  if (score.specCompliance < thresholds.specCompliance) failures.push(`specCompliance: ${score.specCompliance} < ${thresholds.specCompliance}`);
  if (score.patternMatch < thresholds.patternMatch) failures.push(`patternMatch: ${score.patternMatch} < ${thresholds.patternMatch}`);
  if (score.driftScore < thresholds.driftScore) failures.push(`driftScore: ${score.driftScore} < ${thresholds.driftScore}`);
  if (score.testCoverage < thresholds.testCoverage) failures.push(`testCoverage: ${score.testCoverage} < ${thresholds.testCoverage}`);
  if (score.accessibility < thresholds.accessibility) failures.push(`accessibility: ${score.accessibility} < ${thresholds.accessibility}`);
  if (score.designMatch < thresholds.designMatch) failures.push(`designMatch: ${score.designMatch} < ${thresholds.designMatch}`);
  if (score.overall < thresholds.overall) failures.push(`overall: ${score.overall} < ${thresholds.overall}`);
  return { passed: failures.length === 0, failures };
}

// ─── Baseline Comparison ─────────────────────────────────────────────────────

export async function getProjectBaseline(ctx: AppContext): Promise<{ avg: number; count: number; best: number; worst: number } | null> {
  const db = await ctx.getDb();
  const row = db.prepare('SELECT AVG(overall) as avg, COUNT(*) as count, MAX(overall) as best, MIN(overall) as worst FROM scores').get() as { avg: number | null; count: number; best: number | null; worst: number | null } | undefined;
  if (!row || row.count === 0) return null;
  return { avg: Math.round(row.avg!), count: row.count, best: row.best!, worst: row.worst! };
}

export async function getScoreTrends(ctx: AppContext, limit = 10): Promise<string> {
  const db = await ctx.getDb();
  const rows = db.prepare('SELECT task, overall, created_at FROM scores ORDER BY id DESC LIMIT ?').all(limit) as { task: string; overall: number; created_at: string }[];
  if (rows.length === 0) return 'No scores recorded yet.';

  let out = '| Date | Task | Score | Trend |\n|------|------|-------|-------|\n';
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const prev = rows[i + 1];
    const trend = prev ? (r.overall > prev.overall ? '↑' : r.overall < prev.overall ? '↓' : '→') : '—';
    out += `| ${r.created_at} | ${r.task.slice(0, 30)} | ${r.overall}/100 | ${trend} |\n`;
  }
  return out;
}
