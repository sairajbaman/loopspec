import path from 'node:path';
import type { AppContext } from '../../context.js';
import { readFile } from '../../utils/files.js';
import { parseMarkdownSections } from '../../utils/markdown.js';
import { GUARDRAIL_PACKS, type GuardrailPack } from './packs-data.js';

export interface GuardrailResult {
  specConstraints: string[];
  security: string[];
  design: string[];
  conventions: string[];
  antiPatterns: string[];
}

export function getAvailablePacks(): string[] {
  return Object.keys(GUARDRAIL_PACKS);
}

export function getGuardrailPack(name: string): GuardrailPack | null {
  return GUARDRAIL_PACKS[name] || null;
}

export async function evaluateGuardrails(ctx: AppContext, task: string): Promise<GuardrailResult> {
  const result: GuardrailResult = { specConstraints: [], security: [], design: [], conventions: [], antiPatterns: [] };

  // Extract from AppFlow (required states)
  const flow = await readFile(path.join(ctx.loopspecDir, 'AppFlow.md'));
  if (flow) {
    const sections = parseMarkdownSections(flow);
    for (const s of sections) {
      if (s.content.toLowerCase().includes(task.toLowerCase().split(' ')[0])) {
        const stateMatch = s.content.match(/States?:\s*\[?([^\]\n]+)/i);
        if (stateMatch) result.specConstraints.push(`Required states: ${stateMatch[1]}`);
      }
    }
  }

  // Extract from TRD (performance budgets)
  const trd = await readFile(path.join(ctx.loopspecDir, 'TRD.md'));
  if (trd) {
    if (trd.includes('LCP')) result.specConstraints.push('Performance: LCP < 2.5s per TRD');
    if (trd.includes('bundle')) result.specConstraints.push('Bundle size budget per TRD');
  }

  // Extract from SKILL (conventions + anti-patterns)
  const skill = await readFile(path.join(ctx.loopspecDir, 'SKILL.md'));
  if (skill) {
    const sections = parseMarkdownSections(skill);
    const convSection = sections.find((s) => s.heading.toLowerCase().includes('convention'));
    if (convSection) result.conventions = convSection.content.split('\n').filter((l) => l.startsWith('-')).slice(0, 5);
    const antiSection = sections.find((s) => s.heading.toLowerCase().includes('anti'));
    if (antiSection) result.antiPatterns = antiSection.content.split('\n').filter((l) => l.startsWith('-')).slice(0, 5);
  }

  // Load installed packs (stored as names in .loopspec/guardrails.json)
  const installedFile = await readFile(path.join(ctx.loopspecDir, 'guardrails.json'));
  const installedPacks: string[] = installedFile ? JSON.parse(installedFile) : [];
  for (const packName of installedPacks) {
    const pack = GUARDRAIL_PACKS[packName];
    if (!pack) continue;
    for (const r of pack.rules) {
      if (r.category === 'security') result.security.push(r.rule);
      else if (r.category === 'design') result.design.push(r.rule);
      else if (r.category === 'performance') result.specConstraints.push(r.rule);
      else result.conventions.push(r.rule);
    }
  }

  // Default security rules if none loaded
  if (result.security.length === 0) {
    result.security.push('Validate all user inputs', 'Use parameterized queries', 'Never expose secrets in client code');
  }
  // Default design rules
  if (result.design.length === 0) {
    result.design.push('Minimum contrast 4.5:1 for text', 'No emoji as icons — use SVG icon set', 'cursor-pointer on all clickable elements');
  }

  return result;
}

export function formatGuardrails(result: GuardrailResult): string {
  const sections = [
    result.specConstraints.length ? `🎯 SPEC CONSTRAINTS:\n${result.specConstraints.map((r) => `- ${r}`).join('\n')}` : '',
    result.security.length ? `🔒 SECURITY:\n${result.security.map((r) => `- ${r}`).join('\n')}` : '',
    result.design.length ? `🎨 DESIGN:\n${result.design.map((r) => `- ${r}`).join('\n')}` : '',
    result.conventions.length ? `📏 CONVENTIONS:\n${result.conventions.map((r) => `- ${r}`).join('\n')}` : '',
    result.antiPatterns.length ? `⚠️ ANTI-PATTERNS TO AVOID:\n${result.antiPatterns.map((r) => `- ${r}`).join('\n')}` : '',
  ].filter(Boolean);

  return `─── LOOPSPEC GUARDRAILS ───\n\n${sections.join('\n\n')}\n\n─── END GUARDRAILS ───`;
}
