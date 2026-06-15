import type { ProjectAnalysis } from '../analyzer.js';

export function generatePlanPrompt(analysis: ProjectAnalysis, answers: Record<string, string>): string {
  return `Generate an Implementation Plan in Markdown.

## Project Context
- Complexity: ${analysis.complexity}
- Stack: ${answers.stack || analysis.impliedStack || 'nextjs-supabase-shadcn'}
- Core feature: ${answers.core_feature || 'not specified'}

## Required Format
### Phase N: [Name] (estimated: X days)
- **Task N.1:** [Description]
  - Files: [list of files to create/modify]
  - Depends on: [previous task numbers]
  - AI prompt size: small | medium | large
- **Task N.2:** ...

## Guidelines
- Phase 1 is ALWAYS: Project setup + auth + basic layout
- Each task should be completable in a single AI prompt session
- Mark dependencies explicitly
- Include testing tasks after every 3-4 implementation tasks
- Typical v1 has 3-5 phases, 15-30 tasks
- Tag tasks with complexity: [simple] [medium] [complex]
- Last phase always includes: deployment, monitoring, documentation`;
}
