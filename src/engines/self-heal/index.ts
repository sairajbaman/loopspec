import path from 'node:path';
import type { AppContext } from '../../context.js';
import { readFile, writeFile } from '../../utils/files.js';
import { detectDrift, type DriftItem } from '../live-sync/index.js';
import { storeDecision } from '../decisions/index.js';
import { parseMarkdownSections } from '../../utils/markdown.js';

export interface HealAction {
  drift: DriftItem;
  action: 'update_spec' | 'revert_code' | 'ignore';
  specFile?: string;
  change?: string;
}

export interface HealResult {
  healed: HealAction[];
  rippleEffects: string[];
  decisionsLogged: number;
}

export async function proposeHealing(ctx: AppContext, file: string): Promise<{ drifts: DriftItem[]; proposals: string[] }> {
  const drifts = await detectDrift(ctx, file);
  const proposals = drifts.map(d =>
    `[${d.severity.toUpperCase()}] ${d.category}: ${d.specExpectation}\n` +
    `  Options:\n` +
    `  (a) Update spec to match code (accept drift)\n` +
    `  (b) Fix code to match spec (revert drift)\n` +
    `  (c) Add exception (ignore this rule for this file)`
  );
  return { drifts, proposals };
}

export async function healSpec(ctx: AppContext, actions: HealAction[]): Promise<HealResult> {
  const result: HealResult = { healed: [], rippleEffects: [], decisionsLogged: 0 };

  for (const action of actions) {
    switch (action.action) {
      case 'update_spec': {
        // Find which spec doc to update based on drift category
        const specFile = getSpecFileForCategory(action.drift.category);
        const specPath = path.join(ctx.loopspecDir, specFile);
        const content = await readFile(specPath);
        if (content) {
          const updated = applySpecUpdate(content, action.drift);
          await writeFile(specPath, updated);
          result.healed.push(action);

          // Check ripple effects
          const ripples = checkRippleEffects(ctx, action.drift);
          result.rippleEffects.push(...ripples);

          // Log decision
          await storeDecision(ctx, {
            decision: `Accepted drift: ${action.drift.category} in ${action.drift.file}`,
            rationale: `Code legitimately diverged. Spec updated to match: ${action.drift.codeReality}`,
            alternatives: ['Revert code to match spec', 'Add exception'],
            files: [action.drift.file, specFile],
            sessionId: 'self-heal',
          });
          result.decisionsLogged++;
        }
        break;
      }
      case 'ignore': {
        // Add to exceptions
        const exPath = path.join(ctx.loopspecDir, 'exceptions.json');
        const existing = await readFile(exPath);
        const exceptions: Record<string, string[]> = existing ? JSON.parse(existing) : {};
        if (!exceptions[action.drift.file]) exceptions[action.drift.file] = [];
        if (!exceptions[action.drift.file].includes(action.drift.category)) {
          exceptions[action.drift.file].push(action.drift.category);
        }
        await writeFile(exPath, JSON.stringify(exceptions, null, 2));
        result.healed.push(action);
        break;
      }
      case 'revert_code': {
        // We can't modify user code directly — return suggestion
        result.healed.push(action);
        break;
      }
    }
  }

  return result;
}

function getSpecFileForCategory(category: string): string {
  switch (category) {
    case 'auth': case 'validation': case 'api-contract': return 'Schema.md';
    case 'ui-states': case 'route-drift': return 'AppFlow.md';
    case 'conventions': case 'type-safety': return 'SKILL.md';
    default: return 'TRD.md';
  }
}

function applySpecUpdate(specContent: string, drift: DriftItem): string {
  // Append a note about the accepted change
  const note = `\n\n> **Updated ${new Date().toISOString().slice(0, 10)}:** ${drift.category} in \`${drift.file}\` — accepted: ${drift.codeReality}\n`;

  // Try to find the relevant section and append
  const sections = parseMarkdownSections(specContent);
  const relevantSection = sections.find(s =>
    s.heading.toLowerCase().includes(drift.category) ||
    s.content.toLowerCase().includes(drift.file.split('/').pop()?.replace(/\.\w+$/, '') || '')
  );

  if (relevantSection) {
    const sectionEnd = specContent.indexOf(relevantSection.content) + relevantSection.content.length;
    return specContent.slice(0, sectionEnd) + note + specContent.slice(sectionEnd);
  }

  // Fallback: append to end
  return specContent + note;
}

function checkRippleEffects(ctx: AppContext, drift: DriftItem): string[] {
  const effects: string[] = [];

  // Based on drift category, predict what else might break
  if (drift.category === 'auth') {
    effects.push('Check: other protected routes may need the same change');
  }
  if (drift.category === 'api-contract') {
    effects.push('Check: frontend code consuming this API may need type updates');
  }
  if (drift.category === 'type-safety') {
    effects.push('Check: interfaces imported by other files may need updating');
  }

  return effects;
}
