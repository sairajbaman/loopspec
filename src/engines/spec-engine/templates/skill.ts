import type { ProjectAnalysis } from '../analyzer.js';

export function generateSkillPrompt(analysis: ProjectAnalysis, answers: Record<string, string>, stackDna?: string): string {
  const stack = answers.stack || analysis.impliedStack || 'nextjs-supabase-shadcn';
  const stackParts = stack.split('-');

  const framework = stackParts[0] || 'Next.js';
  const db = stackParts[1] || 'PostgreSQL';
  const ui = stackParts[2] || 'Tailwind CSS';

  return `# SKILL.md — Project Conventions

## Project Overview
${analysis.productType} for ${analysis.targetUser} in the ${analysis.industry} industry. Complexity: ${analysis.complexity}.

## Tech Stack
- **Framework:** ${framework}
- **Database:** ${db}
- **UI:** ${ui}
- **Language:** TypeScript (strict mode)
- **Validation:** Zod
- **Testing:** Vitest

## Coding Conventions
- **Strictness:** TypeScript strict mode, no \`any\` types
- **Naming:** camelCase for variables/functions, PascalCase for components/types
- **Imports:** Named exports only, no default exports
- **Components:** Function components with explicit return types
- **Files:** kebab-case filenames, collocate tests with source

## Commands
\`\`\`bash
npm install          # Install dependencies
npm run dev          # Start dev server
npm run build        # Production build
npm test             # Run tests
npm run lint         # Lint code
\`\`\`

## Architecture Decisions
- Server-first data fetching (RSC where available)
- Collocate related code (component + test + types in same dir)
- Thin API routes (validate → delegate → respond)
- Zod schemas shared between client and server

## File Structure
\`\`\`
src/
├── app/              # Routes and pages
├── components/       # Shared UI components
├── lib/              # Business logic and utilities
├── hooks/            # Custom React hooks
├── types/            # Shared TypeScript types
└── __tests__/        # Integration tests
\`\`\`

## Common Patterns
- **Add a page:** Create \`src/app/<route>/page.tsx\` with loading.tsx and error.tsx
- **Add an API route:** Create \`src/app/api/<name>/route.ts\` with Zod validation
- **Add a component:** Create \`src/components/<Name>.tsx\` with named export
- **Add a type:** Export from \`src/types/<domain>.ts\`

## Anti-Patterns
1. **Never** use \`any\` — use \`unknown\` with type narrowing instead
2. **Never** skip error handling in async functions
3. **Never** put business logic in UI components — extract to \`lib/\`
4. **Never** use \`export default\` — always use named exports
5. **Never** hardcode secrets — use environment variables
6. **Never** skip input validation on API routes
7. **Never** commit \`.env\` files — use \`.env.example\` templates

## Lessons Learned
_(Auto-populated by compound engine during sessions)_
${stackDna ? `\n## Stack DNA\n${stackDna}` : ''}`;
}
