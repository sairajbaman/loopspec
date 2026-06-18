import type { ProjectAnalysis } from '../analyzer.js';

export function generatePlanPrompt(analysis: ProjectAnalysis, answers: Record<string, string>): string {
  const stack = answers.stack || analysis.impliedStack || 'nextjs-supabase-shadcn';
  const features = analysis.features.length > 0 ? analysis.features : ['core functionality', 'user management', 'data display'];
  const coreFeature = answers.core_feature || features[0] || 'main feature';
  const isComplex = analysis.complexity === 'complex';

  const phases = generatePhases(features, coreFeature, stack, isComplex);

  return `# Implementation Plan

## Project: ${analysis.productType} (${analysis.industry})
- **Complexity:** ${analysis.complexity}
- **Stack:** ${stack}
- **Core Feature:** ${coreFeature}
- **Estimated Phases:** ${phases.length}

---

${phases.map((phase, i) => formatPhase(phase, i + 1)).join('\n---\n\n')}
## Notes
- Each task is scoped to a single AI prompt session
- Run \`loopspec check <file>\` after completing each task
- Run \`loopspec session end\` after each phase for score tracking
`;
}

interface Phase { name: string; days: number; tasks: { desc: string; files: string[]; complexity: string }[]; }

function generatePhases(features: string[], core: string, stack: string, isComplex: boolean): Phase[] {
  const phases: Phase[] = [];

  // Phase 1: Setup
  phases.push({
    name: 'Project Setup & Auth',
    days: isComplex ? 2 : 1,
    tasks: [
      { desc: `Initialize ${stack} project with TypeScript strict mode`, files: ['package.json', 'tsconfig.json', 'tailwind.config.ts'], complexity: 'simple' },
      { desc: 'Set up database schema and migrations', files: ['src/lib/db.ts', 'prisma/schema.prisma'], complexity: 'medium' },
      { desc: 'Implement authentication (signup, login, session)', files: ['src/app/api/auth/[...nextauth]/route.ts', 'src/lib/auth.ts'], complexity: 'medium' },
      { desc: 'Create base layout with navigation', files: ['src/app/layout.tsx', 'src/components/Nav.tsx'], complexity: 'simple' },
    ],
  });

  // Phase 2: Core feature
  phases.push({
    name: `Core: ${core}`,
    days: isComplex ? 3 : 2,
    tasks: [
      { desc: `Define types and validation schemas for ${core}`, files: ['src/types/index.ts', 'src/lib/validations.ts'], complexity: 'simple' },
      { desc: `Create CRUD API routes for ${core}`, files: [`src/app/api/${core.toLowerCase().replace(/\s/g, '-')}/route.ts`], complexity: 'medium' },
      { desc: `Build list/table view for ${core}`, files: [`src/app/${core.toLowerCase().replace(/\s/g, '-')}/page.tsx`], complexity: 'medium' },
      { desc: `Build create/edit form for ${core}`, files: [`src/components/${core.replace(/\s/g, '')}Form.tsx`], complexity: 'medium' },
      { desc: `Add loading, error, and empty states`, files: ['src/app/loading.tsx', 'src/app/error.tsx'], complexity: 'simple' },
    ],
  });

  // Phase 3: Secondary features
  if (features.length > 1) {
    phases.push({
      name: 'Secondary Features',
      days: isComplex ? 3 : 2,
      tasks: features.slice(1, 4).map(f => ({
        desc: `Implement ${f}`,
        files: [`src/app/${f.toLowerCase().replace(/\s/g, '-')}/page.tsx`],
        complexity: 'medium' as string,
      })),
    });
  }

  // Phase 4: Polish
  phases.push({
    name: 'Testing & Polish',
    days: isComplex ? 2 : 1,
    tasks: [
      { desc: 'Add unit tests for core business logic', files: ['src/__tests__/'], complexity: 'medium' },
      { desc: 'Add integration tests for API routes', files: ['src/__tests__/api/'], complexity: 'medium' },
      { desc: 'Performance optimization (lazy loading, caching)', files: ['src/app/'], complexity: 'simple' },
      { desc: 'Deployment configuration', files: ['vercel.json', '.env.example', 'README.md'], complexity: 'simple' },
    ],
  });

  return phases;
}

function formatPhase(phase: Phase, num: number): string {
  let out = `## Phase ${num}: ${phase.name} (est. ${phase.days} day${phase.days > 1 ? 's' : ''})\n\n`;
  phase.tasks.forEach((t, i) => {
    out += `### Task ${num}.${i + 1}: ${t.desc} [${t.complexity}]\n`;
    out += `- Files: ${t.files.join(', ')}\n`;
    out += `- Depends on: ${i === 0 ? 'none' : `${num}.${i}`}\n\n`;
  });
  return out;
}
