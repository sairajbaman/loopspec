import type { ProjectAnalysis } from '../analyzer.js';

export function generateSkillPrompt(analysis: ProjectAnalysis, answers: Record<string, string>, stackDna?: string): string {
  const stackContext = stackDna ? `\n## Stack Conventions (from DNA preset)\n${stackDna}\n` : '';
  return `Generate a SKILL.md — the AI agent memory file for this project.

## Context
- Stack: ${answers.stack || analysis.impliedStack || 'nextjs-supabase-shadcn'}
- Industry: ${analysis.industry}
${stackContext}
## Sections Required
### Project Overview
One paragraph summary.

### Tech Stack
Exact framework, DB, ORM, auth, UI lib.

### Coding Conventions
- Strictness, naming, imports, component patterns

### Commands
- install, dev, build, test, lint, deploy

### Architecture Decisions
Key choices with one-line rationale.

### File Structure
Where code types live.

### Common Patterns
How to add page, endpoint, table.

### Anti-Patterns (at least 5)
Things to NEVER do.

### Lessons Learned
(empty — auto-populated by compound engine)`;
}
