import path from 'node:path';
import type { AppContext } from '../../context.js';
import { readFile } from '../../utils/files.js';
import { parseMarkdownSections } from '../../utils/markdown.js';
import { estimateTokens, truncateToTokenBudget } from '../../utils/tokens.js';

interface TaskClassification {
  domain: 'frontend' | 'backend' | 'fullstack' | 'design' | 'devops';
  entities: string[];
  keywords: string[];
}

export function classifyTask(task: string): TaskClassification {
  const lower = task.toLowerCase();
  const frontendKeywords = ['component', 'page', 'ui', 'button', 'form', 'layout', 'style', 'css', 'responsive', 'animation'];
  const backendKeywords = ['api', 'endpoint', 'database', 'migration', 'query', 'auth', 'middleware', 'cron', 'webhook'];
  const designKeywords = ['design', 'color', 'font', 'theme', 'token', 'brand'];
  const devopsKeywords = ['deploy', 'ci', 'docker', 'env', 'config', 'monitor'];

  const fScore = frontendKeywords.filter((k) => lower.includes(k)).length;
  const bScore = backendKeywords.filter((k) => lower.includes(k)).length;
  const dScore = designKeywords.filter((k) => lower.includes(k)).length;
  const oScore = devopsKeywords.filter((k) => lower.includes(k)).length;

  let domain: TaskClassification['domain'] = 'fullstack';
  if (dScore > fScore && dScore > bScore) domain = 'design';
  else if (oScore > fScore && oScore > bScore) domain = 'devops';
  else if (fScore > bScore + 1) domain = 'frontend';
  else if (bScore > fScore + 1) domain = 'backend';

  const words = lower.split(/\s+/).filter((w) => w.length > 3);
  return { domain, entities: words.slice(0, 5), keywords: words };
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
  const sections: string[] = [];
  let totalTokens = 0;

  // Always include SKILL.md first (conventions)
  const skill = await readFile(path.join(ctx.loopspecDir, 'SKILL.md'));
  if (skill) {
    const skillSlice = truncateToTokenBudget(skill, Math.floor(budget * 0.2));
    sections.push(`--- SKILL.md (conventions) ---\n${skillSlice}`);
    totalTokens += estimateTokens(skillSlice);
  }

  // Route relevant docs based on domain
  for (const [doc, domains] of Object.entries(DOC_RELEVANCE)) {
    if (doc === 'SKILL.md') continue;
    if (!domains.includes(classification.domain)) continue;
    if (totalTokens >= budget) break;

    const content = await readFile(path.join(ctx.loopspecDir, doc));
    if (!content) continue;

    // Extract only relevant sections
    const docSections = parseMarkdownSections(content);
    const relevant = docSections.filter((s) =>
      classification.entities.some((e) => s.heading.toLowerCase().includes(e) || s.content.toLowerCase().includes(e))
    );

    const slice = relevant.length > 0
      ? relevant.map((s) => `## ${s.heading}\n${s.content}`).join('\n\n')
      : truncateToTokenBudget(content, Math.floor(budget * 0.15));

    const tokens = estimateTokens(slice);
    if (totalTokens + tokens <= budget) {
      sections.push(`--- ${doc} ---\n${slice}`);
      totalTokens += tokens;
    }
  }

  return sections.join('\n\n') || 'No spec documents found. Run loopspec_init first.';
}
