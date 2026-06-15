import path from 'node:path';
import type { AppContext } from '../../context.js';
import { writeFile } from '../../utils/files.js';
import { analyzeIdea, type ProjectAnalysis } from './analyzer.js';
import { generateQuestions, type Mode, type Question } from './questions.js';
import { generatePrdPrompt } from './templates/prd.js';
import { generateTrdPrompt } from './templates/trd.js';
import { generateAppFlowPrompt } from './templates/appflow.js';
import { generateUiBriefPrompt } from './templates/uibrief.js';
import { generateSchemaPrompt } from './templates/schema.js';
import { generatePlanPrompt } from './templates/plan.js';
import { generateSkillPrompt } from './templates/skill.js';
import { generateDesignSystemPrompt } from './templates/designsystem.js';
import { loadTemplateConfig, getActiveDocuments, applyCustomSections, getCustomTemplate } from './templates/customize.js';

export interface SpecResult {
  analysis: ProjectAnalysis;
  questions?: Question[];
  documents?: Record<string, string>;
}

export async function generateSpec(
  ctx: AppContext,
  idea: string,
  mode: Mode = 'pro',
  answers?: Record<string, string>,
  stackDna?: string
): Promise<SpecResult> {
  const analysis = analyzeIdea(idea);

  if (!answers) {
    const questions = generateQuestions(analysis, mode);
    return { analysis, questions };
  }

  const config = await loadTemplateConfig(ctx);
  const activeDocs = getActiveDocuments(config);

  const generators: Record<string, () => string> = {
    'PRD.md': () => generatePrdPrompt(analysis, answers),
    'TRD.md': () => generateTrdPrompt(analysis, answers, stackDna),
    'AppFlow.md': () => generateAppFlowPrompt(analysis, answers),
    'UIBrief.md': () => generateUiBriefPrompt(analysis, answers),
    'Schema.md': () => generateSchemaPrompt(analysis, answers, stackDna),
    'Plan.md': () => generatePlanPrompt(analysis, answers),
    'SKILL.md': () => generateSkillPrompt(analysis, answers, stackDna),
    'DesignSystem.md': () => generateDesignSystemPrompt(analysis, answers),
  };

  const documents: Record<string, string> = {};
  for (const docName of activeDocs) {
    // Use custom template if provided, otherwise generate
    const customTemplate = getCustomTemplate(docName, config);
    let content: string;

    if (customTemplate) {
      // Replace placeholders in custom template
      content = customTemplate
        .replace(/\{\{industry\}\}/g, analysis.industry)
        .replace(/\{\{productType\}\}/g, analysis.productType)
        .replace(/\{\{complexity\}\}/g, analysis.complexity)
        .replace(/\{\{targetUser\}\}/g, answers.target_user || analysis.targetUser)
        .replace(/\{\{coreFeature\}\}/g, answers.core_feature || '')
        .replace(/\{\{stack\}\}/g, answers.stack || analysis.impliedStack || 'nextjs-supabase-shadcn');
    } else if (generators[docName]) {
      content = generators[docName]();
    } else {
      continue; // unknown document, skip
    }

    // Apply custom sections
    content = applyCustomSections(content, docName, config);
    documents[docName] = content;
  }

  await ctx.ensureLoopspecDir();
  for (const [filename, content] of Object.entries(documents)) {
    await writeFile(path.join(ctx.loopspecDir, filename), content);
  }

  return { analysis, documents };
}
