import path from 'node:path';
import type { AppContext } from '../../context.js';
import { readFile } from '../../utils/files.js';
import { parseMarkdownSections } from '../../utils/markdown.js';
import { estimateTokens, truncateToTokenBudget } from '../../utils/tokens.js';

interface TaskClassification {
  domain: 'frontend' | 'backend' | 'fullstack' | 'design' | 'devops';
  entities: string[];
  keywords: string[];
  complexity: 'low' | 'medium' | 'high';
  dependencies: string[];
}

const KEYWORD_GROUPS = {
  frontend: ['component', 'page', 'ui', 'button', 'form', 'layout', 'style', 'css', 'responsive', 'animation', 'modal', 'sidebar', 'navbar', 'card', 'table', 'list', 'grid', 'flex', 'hook', 'state', 'props', 'render'],
  backend: ['api', 'endpoint', 'database', 'migration', 'query', 'auth', 'middleware', 'cron', 'webhook', 'route', 'controller', 'service', 'repository', 'schema', 'validation', 'jwt', 'session', 'rls', 'sql'],
  design: ['design', 'color', 'font', 'theme', 'token', 'brand', 'palette', 'spacing', 'typography', 'icon'],
  devops: ['deploy', 'ci', 'docker', 'env', 'config', 'monitor', 'pipeline', 'terraform', 'nginx', 'ssl'],
};

// File/feature dependency map — when task mentions X, include Y
const DEPENDENCY_MAP: Record<string, string[]> = {
  'auth': ['Schema.md', 'SKILL.md', 'TRD.md'],
  'api': ['Schema.md', 'SKILL.md', 'TRD.md'],
  'endpoint': ['Schema.md', 'SKILL.md'],
  'form': ['Schema.md', 'AppFlow.md', 'SKILL.md'],
  'page': ['AppFlow.md', 'SKILL.md', 'DesignSystem.md'],
  'component': ['SKILL.md', 'DesignSystem.md', 'UIBrief.md'],
  'database': ['Schema.md', 'TRD.md'],
  'migration': ['Schema.md', 'TRD.md'],
  'deploy': ['TRD.md', 'SKILL.md'],
  'test': ['Schema.md', 'SKILL.md', 'TRD.md'],
  'style': ['DesignSystem.md', 'UIBrief.md', 'SKILL.md'],
  'navigation': ['AppFlow.md', 'SKILL.md'],
  'dashboard': ['AppFlow.md', 'Schema.md', 'DesignSystem.md'],
  'settings': ['AppFlow.md', 'Schema.md', 'SKILL.md'],
};

export function classifyTask(task: string): TaskClassification {
  const lower = task.toLowerCase();
  const words = lower.split(/[\s,./]+/).filter((w) => w.length > 2);

  const scores = { frontend: 0, backend: 0, design: 0, devops: 0 };
  for (const [domain, keywords] of Object.entries(KEYWORD_GROUPS)) {
    scores[domain as keyof typeof scores] = keywords.filter((k) => lower.includes(k)).length;
  }

  let domain: TaskClassification['domain'] = 'fullstack';
  const max = Math.max(scores.frontend, scores.backend, scores.design, scores.devops);
  if (max === 0) domain = 'fullstack';
  else if (scores.design === max) domain = 'design';
  else if (scores.devops === max) domain = 'devops';
  else if (scores.frontend > scores.backend + 1) domain = 'frontend';
  else if (scores.backend > scores.frontend + 1) domain = 'backend';

  // Complexity estimation
  const complexitySignals = ['refactor', 'integrate', 'migrate', 'architecture', 'redesign', 'overhaul', 'system'];
  const complexityScore = complexitySignals.filter(s => lower.includes(s)).length + (words.length > 20 ? 1 : 0);
  const complexity = complexityScore >= 2 ? 'high' : complexityScore >= 1 ? 'medium' : 'low';

  // Dependency resolution
  const dependencies: string[] = [];
  for (const [trigger, docs] of Object.entries(DEPENDENCY_MAP)) {
    if (lower.includes(trigger)) {
      for (const doc of docs) {
        if (!dependencies.includes(doc)) dependencies.push(doc);
      }
    }
  }

  return { domain, entities: words.slice(0, 8), keywords: words, complexity, dependencies };
}

// Relevance score: how relevant is a section to the task (0-1)
function scoreRelevance(sectionText: string, classification: TaskClassification): number {
  const lower = sectionText.toLowerCase();
  let score = 0;
  let maxPossible = 0;

  // Entity matches (highest weight)
  for (const entity of classification.entities) {
    maxPossible += 3;
    if (lower.includes(entity)) score += 3;
  }

  // Keyword matches
  for (const kw of classification.keywords.slice(0, 15)) {
    maxPossible += 1;
    if (lower.includes(kw)) score += 1;
  }

  return maxPossible > 0 ? score / maxPossible : 0;
}

// Dynamic token allocation based on complexity
function allocateTokenBudget(budget: number, complexity: TaskClassification['complexity']): { skill: number; primary: number; secondary: number } {
  switch (complexity) {
    case 'high':
      return { skill: Math.floor(budget * 0.15), primary: Math.floor(budget * 0.55), secondary: Math.floor(budget * 0.30) };
    case 'medium':
      return { skill: Math.floor(budget * 0.20), primary: Math.floor(budget * 0.50), secondary: Math.floor(budget * 0.30) };
    case 'low':
      return { skill: Math.floor(budget * 0.25), primary: Math.floor(budget * 0.50), secondary: Math.floor(budget * 0.25) };
  }
}

const DOC_RELEVANCE: Record<string, TaskClassification['domain'][]> = {
  'UIBrief.md': ['frontend', 'design', 'fullstack'],
  'AppFlow.md': ['frontend', 'fullstack', 'backend'],
  'Schema.md': ['backend', 'fullstack'],
  'SKILL.md': ['frontend', 'backend', 'fullstack', 'design', 'devops'],
  'DesignSystem.md': ['frontend', 'design'],
  'TRD.md': ['backend', 'devops', 'fullstack'],
  'PRD.md': ['fullstack'],
  'Plan.md': [],
};

export async function routeContext(ctx: AppContext, task: string, budget: number = 15000): Promise<string> {
  const classification = classifyTask(task);
  const tokenAlloc = allocateTokenBudget(budget, classification.complexity);
  const sections: string[] = [];
  let totalTokens = 0;

  // Always include SKILL.md first (conventions)
  const skill = await readFile(path.join(ctx.loopspecDir, 'SKILL.md'));
  if (skill) {
    const skillSlice = truncateToTokenBudget(skill, tokenAlloc.skill);
    sections.push(`--- SKILL.md (conventions) ---\n${skillSlice}`);
    totalTokens += estimateTokens(skillSlice);
  }

  // Build prioritized doc list: dependency-required docs first, then domain-relevant
  const docPriority: { doc: string; priority: number }[] = [];
  for (const [doc, domains] of Object.entries(DOC_RELEVANCE)) {
    if (doc === 'SKILL.md') continue;
    let priority = 0;
    // Dependency boost (task explicitly needs this doc)
    if (classification.dependencies.includes(doc)) priority += 10;
    // Domain relevance
    if (domains.includes(classification.domain)) priority += 5;
    // Fullstack always gets some access
    if (classification.domain === 'fullstack') priority += 2;
    if (priority > 0) docPriority.push({ doc, priority });
  }

  // Sort by priority descending
  docPriority.sort((a, b) => b.priority - a.priority);

  // Route docs with relevance-scored section extraction
  for (const { doc, priority } of docPriority) {
    if (totalTokens >= budget) break;
    const content = await readFile(path.join(ctx.loopspecDir, doc));
    if (!content) continue;

    const isPrimary = priority >= 10;
    const maxTokens = isPrimary ? tokenAlloc.primary : tokenAlloc.secondary;
    const remaining = budget - totalTokens;
    const docBudget = Math.min(maxTokens, remaining);
    if (docBudget < 100) break;

    // Score and rank sections by relevance
    const docSections = parseMarkdownSections(content);
    const scored = docSections
      .map(s => ({ ...s, score: scoreRelevance(s.heading + ' ' + s.content, classification) }))
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score);

    let slice: string;
    if (scored.length > 0) {
      // Include top-scored sections within budget
      const parts: string[] = [];
      let used = 0;
      for (const s of scored) {
        const text = `## ${s.heading}\n${s.content}`;
        const tokens = estimateTokens(text);
        if (used + tokens > docBudget) break;
        parts.push(text);
        used += tokens;
      }
      slice = parts.join('\n\n');
    } else {
      // No section-level match — include truncated doc overview
      slice = truncateToTokenBudget(content, Math.min(docBudget, Math.floor(budget * 0.1)));
    }

    if (slice) {
      const tokens = estimateTokens(slice);
      sections.push(`--- ${doc} (relevance: ${isPrimary ? 'high' : 'medium'}) ---\n${slice}`);
      totalTokens += tokens;
    }
  }

  // Append routing metadata
  const meta = `\n--- Context Routing ---\nDomain: ${classification.domain} | Complexity: ${classification.complexity} | Tokens used: ~${totalTokens}/${budget}`;
  sections.push(meta);

  return sections.join('\n\n') || 'No spec documents found. Run loopspec_init first.';
}
