import path from 'node:path';
import type { AppContext } from '../../../context.js';
import { readFile, writeFile, fileExists } from '../../../utils/files.js';

export interface TemplateConfig {
  // Which documents to generate (omit to use all defaults)
  documents?: string[];
  // Documents to skip
  skip?: string[];
  // Custom sections to add to specific documents
  customSections?: Record<string, CustomSection[]>;
  // Complete custom templates (replace default)
  customTemplates?: Record<string, string>;
}

export interface CustomSection {
  title: string;
  prompt: string;
  position?: 'before' | 'after'; // relative to which existing section
  anchor?: string; // section title to position relative to
}

const DEFAULT_DOCS = ['PRD.md', 'TRD.md', 'AppFlow.md', 'UIBrief.md', 'Schema.md', 'Plan.md', 'SKILL.md', 'DesignSystem.md'];

const CONFIG_FILE = 'template-config.json';

export async function loadTemplateConfig(ctx: AppContext): Promise<TemplateConfig> {
  const configPath = path.join(ctx.loopspecDir, CONFIG_FILE);
  const content = await readFile(configPath);
  if (!content) return {};
  try {
    return JSON.parse(content) as TemplateConfig;
  } catch {
    return {};
  }
}

export async function saveTemplateConfig(ctx: AppContext, config: TemplateConfig): Promise<void> {
  await ctx.ensureLoopspecDir();
  const configPath = path.join(ctx.loopspecDir, CONFIG_FILE);
  await writeFile(configPath, JSON.stringify(config, null, 2));
}

export function getActiveDocuments(config: TemplateConfig): string[] {
  let docs = config.documents || DEFAULT_DOCS;
  if (config.skip?.length) {
    docs = docs.filter(d => !config.skip!.includes(d));
  }
  return docs;
}

export function applyCustomSections(documentContent: string, docName: string, config: TemplateConfig): string {
  const customs = config.customSections?.[docName];
  if (!customs?.length) return documentContent;

  let result = documentContent;
  for (const section of customs) {
    const sectionMd = `\n\n## ${section.title}\n${section.prompt}\n`;

    if (section.anchor) {
      const anchorPattern = new RegExp(`(## ${section.anchor}[^]*?)(?=\n## |$)`, 'i');
      const match = result.match(anchorPattern);
      if (match) {
        if (section.position === 'before') {
          result = result.replace(match[0], sectionMd + '\n' + match[0]);
        } else {
          result = result.replace(match[0], match[0] + sectionMd);
        }
        continue;
      }
    }
    // Default: append at end
    result += sectionMd;
  }
  return result;
}

export function getCustomTemplate(docName: string, config: TemplateConfig): string | null {
  return config.customTemplates?.[docName] || null;
}

export function formatTemplateConfigSummary(config: TemplateConfig): string {
  const docs = getActiveDocuments(config);
  const skipped = config.skip || [];
  const customSections = Object.entries(config.customSections || {}).map(([doc, sections]) => `  ${doc}: +${sections.length} custom section(s)`);
  const customTemplates = Object.keys(config.customTemplates || {});

  let summary = `## Template Configuration\n\n`;
  summary += `**Active documents:** ${docs.join(', ')}\n`;
  if (skipped.length) summary += `**Skipped:** ${skipped.join(', ')}\n`;
  if (customSections.length) summary += `**Custom sections:**\n${customSections.join('\n')}\n`;
  if (customTemplates.length) summary += `**Custom templates:** ${customTemplates.join(', ')}\n`;
  return summary;
}
