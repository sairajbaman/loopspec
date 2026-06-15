import * as z from 'zod/v4';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { readFile, writeFile, fileExists } from '../utils/files.js';

interface DetectedConventions {
  stack: { framework?: string; language?: string; orm?: string; ui?: string; auth?: string; test?: string };
  commands: { install?: string; dev?: string; build?: string; test?: string; lint?: string };
  patterns: string[];
  antiPatterns: string[];
  fileStructure: string[];
  naming: { components?: string; files?: string; variables?: string };
}

const FRAMEWORK_SIGNALS: Record<string, { files: string[]; deps: string[] }> = {
  'Next.js': { files: ['next.config.js', 'next.config.ts', 'next.config.mjs'], deps: ['next'] },
  'Nuxt': { files: ['nuxt.config.ts', 'nuxt.config.js'], deps: ['nuxt'] },
  'SvelteKit': { files: ['svelte.config.js'], deps: ['@sveltejs/kit'] },
  'Remix': { files: ['remix.config.js'], deps: ['@remix-run/node'] },
  'Vite + React': { files: ['vite.config.ts'], deps: ['react', 'vite'] },
  'Express': { files: [], deps: ['express'] },
  'FastAPI': { files: ['main.py'], deps: ['fastapi'] },
  'Django': { files: ['manage.py'], deps: ['django'] },
  'Flutter': { files: ['pubspec.yaml'], deps: [] },
  'React Native': { files: ['app.json'], deps: ['react-native'] },
};

const ORM_SIGNALS: Record<string, string[]> = {
  'Prisma': ['prisma', '@prisma/client'],
  'Drizzle': ['drizzle-orm'],
  'Supabase': ['@supabase/supabase-js'],
  'SQLAlchemy': ['sqlalchemy'],
  'TypeORM': ['typeorm'],
  'Sequelize': ['sequelize'],
};

const UI_SIGNALS: Record<string, string[]> = {
  'shadcn/ui': ['@radix-ui/react-dialog', '@radix-ui/react-slot'],
  'Tailwind CSS': ['tailwindcss'],
  'Material UI': ['@mui/material'],
  'Chakra UI': ['@chakra-ui/react'],
  'Ant Design': ['antd'],
};

async function scanDirectory(dir: string, depth = 2): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') continue;
      const full = path.join(dir, entry.name);
      results.push(entry.name);
      if (entry.isDirectory() && depth > 0) {
        const sub = await scanDirectory(full, depth - 1);
        results.push(...sub.map((s) => `${entry.name}/${s}`));
      }
    }
  } catch {}
  return results;
}

async function detectFromPackageJson(projectDir: string): Promise<Partial<DetectedConventions>> {
  const pkg = await readFile(path.join(projectDir, 'package.json'));
  if (!pkg) return {};

  const parsed = JSON.parse(pkg);
  const allDeps = { ...parsed.dependencies, ...parsed.devDependencies };
  const depNames = Object.keys(allDeps);

  const result: Partial<DetectedConventions> = { stack: {}, commands: {}, patterns: [] };

  // Detect framework
  for (const [name, signals] of Object.entries(FRAMEWORK_SIGNALS)) {
    if (signals.deps.some((d) => depNames.includes(d))) {
      result.stack!.framework = name;
      break;
    }
  }

  // Detect ORM
  for (const [name, deps] of Object.entries(ORM_SIGNALS)) {
    if (deps.some((d) => depNames.includes(d))) {
      result.stack!.orm = name;
      break;
    }
  }

  // Detect UI
  for (const [name, deps] of Object.entries(UI_SIGNALS)) {
    if (deps.some((d) => depNames.includes(d))) {
      result.stack!.ui = name;
      break;
    }
  }

  // Detect language
  if (depNames.includes('typescript')) result.stack!.language = 'TypeScript';

  // Detect test framework
  if (depNames.includes('vitest')) result.stack!.test = 'Vitest';
  else if (depNames.includes('jest')) result.stack!.test = 'Jest';
  else if (depNames.includes('mocha')) result.stack!.test = 'Mocha';

  // Detect auth
  if (depNames.includes('next-auth') || depNames.includes('@auth/core')) result.stack!.auth = 'Auth.js';
  else if (depNames.includes('@clerk/nextjs')) result.stack!.auth = 'Clerk';
  else if (depNames.includes('lucia')) result.stack!.auth = 'Lucia';

  // Commands from scripts
  if (parsed.scripts) {
    result.commands = {
      install: parsed.packageManager ? `${parsed.packageManager.split('@')[0]} install` : 'npm install',
      dev: parsed.scripts.dev ? `npm run dev` : undefined,
      build: parsed.scripts.build ? `npm run build` : undefined,
      test: parsed.scripts.test ? `npm test` : undefined,
      lint: parsed.scripts.lint ? `npm run lint` : undefined,
    };
  }

  return result;
}

async function inferNamingConventions(projectDir: string): Promise<{ components?: string; files?: string }> {
  const files = await scanDirectory(projectDir, 1);
  const tsxFiles = files.filter((f) => f.endsWith('.tsx') || f.endsWith('.jsx'));

  if (tsxFiles.length === 0) return {};

  const pascalCase = tsxFiles.filter((f) => /^[A-Z]/.test(path.basename(f)));
  const kebabCase = tsxFiles.filter((f) => /^[a-z]+(-[a-z]+)+/.test(path.basename(f)));

  if (pascalCase.length > kebabCase.length) return { components: 'PascalCase', files: 'PascalCase.tsx' };
  if (kebabCase.length > pascalCase.length) return { components: 'PascalCase', files: 'kebab-case.tsx' };
  return { components: 'PascalCase', files: 'mixed' };
}

async function inferPatternsFromCode(projectDir: string): Promise<{ patterns: string[]; antiPatterns: string[] }> {
  const patterns: string[] = [];
  const antiPatterns: string[] = [];
  const files = await scanDirectory(projectDir, 2);

  // Check for common patterns
  if (files.some((f) => f.includes('middleware'))) patterns.push('Uses middleware pattern for cross-cutting concerns');
  if (files.some((f) => f.includes('hooks/') || f.includes('composables/'))) patterns.push('Custom hooks/composables for reusable logic');
  if (files.some((f) => f.includes('.test.') || f.includes('.spec.'))) patterns.push('Co-located test files');
  if (files.some((f) => f.includes('lib/') || f.includes('utils/'))) patterns.push('Shared utilities in lib/ or utils/');
  if (files.some((f) => f === 'src')) patterns.push('Source code in src/ directory');

  // Check tsconfig for strictness
  const tsconfig = await readFile(path.join(projectDir, 'tsconfig.json'));
  if (tsconfig) {
    if (tsconfig.includes('"strict": true') || tsconfig.includes('"strict":true')) {
      patterns.push('TypeScript strict mode enabled');
      antiPatterns.push('Never use `any` type — use `unknown` + type narrowing');
      antiPatterns.push('Never use @ts-ignore — fix the type error properly');
    }
  }

  // Check for eslint
  if (files.some((f) => f.includes('eslint'))) {
    patterns.push('ESLint configured for code quality');
  }

  // Check for env handling
  if (files.some((f) => f === '.env.example' || f === '.env.local')) {
    patterns.push('Environment variables documented in .env.example');
    antiPatterns.push('Never commit .env files with real secrets');
  }

  return { patterns, antiPatterns };
}

function generateSkillContent(conv: DetectedConventions, projectDir: string): string {
  const projectName = path.basename(projectDir);

  return `# ${projectName} — SKILL.md
> Auto-detected by LoopSpec from existing codebase. Review and adjust.

## Tech Stack
${conv.stack.framework ? `- Framework: ${conv.stack.framework}` : ''}
${conv.stack.language ? `- Language: ${conv.stack.language}` : ''}
${conv.stack.orm ? `- ORM/Database: ${conv.stack.orm}` : ''}
${conv.stack.ui ? `- UI Library: ${conv.stack.ui}` : ''}
${conv.stack.auth ? `- Auth: ${conv.stack.auth}` : ''}
${conv.stack.test ? `- Testing: ${conv.stack.test}` : ''}

## Commands
${conv.commands.install ? `- Install: \`${conv.commands.install}\`` : ''}
${conv.commands.dev ? `- Dev: \`${conv.commands.dev}\`` : ''}
${conv.commands.build ? `- Build: \`${conv.commands.build}\`` : ''}
${conv.commands.test ? `- Test: \`${conv.commands.test}\`` : ''}
${conv.commands.lint ? `- Lint: \`${conv.commands.lint}\`` : ''}

## Naming Conventions
${conv.naming.components ? `- Components: ${conv.naming.components}` : ''}
${conv.naming.files ? `- Files: ${conv.naming.files}` : ''}

## File Structure
\`\`\`
${conv.fileStructure.slice(0, 20).join('\n')}
\`\`\`

## Detected Patterns
${conv.patterns.map((p) => `- ${p}`).join('\n')}

## Anti-Patterns
${conv.antiPatterns.map((p) => `- ${p}`).join('\n')}

### Lessons Learned
_(auto-populated by LoopSpec compound engine)_
`.replace(/\n{3,}/g, '\n\n');
}

export function registerAutoDetectTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_detect', {
    title: 'Auto-Detect Conventions',
    description: 'Scan existing codebase, infer stack/conventions/patterns, generate SKILL.md. Run this on any repo to bootstrap LoopSpec instantly.',
    inputSchema: z.object({
      directory: z.string().optional().describe('Directory to scan (defaults to project root)'),
    }),
  }, async (args) => {
    const dir = (args as { directory?: string }).directory || ctx.projectDir;
    const absDir = path.isAbsolute(dir) ? dir : path.join(ctx.projectDir, dir);

    // Run all detection in parallel
    const [pkgConv, naming, codePatterns, fileStructure] = await Promise.all([
      detectFromPackageJson(absDir),
      inferNamingConventions(absDir),
      inferPatternsFromCode(absDir),
      scanDirectory(absDir, 1),
    ]);

    // Also check for framework config files
    const topFiles = await scanDirectory(absDir, 0);
    for (const [name, signals] of Object.entries(FRAMEWORK_SIGNALS)) {
      if (signals.files.some((f) => topFiles.includes(f))) {
        if (!pkgConv.stack) pkgConv.stack = {};
        pkgConv.stack.framework = name;
        break;
      }
    }

    const conventions: DetectedConventions = {
      stack: pkgConv.stack || {},
      commands: pkgConv.commands || {},
      patterns: [...(pkgConv.patterns || []), ...codePatterns.patterns],
      antiPatterns: codePatterns.antiPatterns,
      fileStructure: fileStructure.filter((f) => !f.includes('/')).slice(0, 15),
      naming,
    };

    const skillContent = generateSkillContent(conventions, absDir);

    // Write SKILL.md
    await ctx.ensureLoopspecDir();
    await writeFile(path.join(ctx.loopspecDir, 'SKILL.md'), skillContent);

    const summary = [
      conventions.stack.framework ? `Framework: ${conventions.stack.framework}` : null,
      conventions.stack.orm ? `ORM: ${conventions.stack.orm}` : null,
      conventions.stack.ui ? `UI: ${conventions.stack.ui}` : null,
      conventions.stack.auth ? `Auth: ${conventions.stack.auth}` : null,
      `${conventions.patterns.length} patterns detected`,
      `${conventions.antiPatterns.length} anti-patterns inferred`,
    ].filter(Boolean).join(' | ');

    return {
      content: [{
        type: 'text' as const,
        text: `## 🔍 Auto-Detection Complete\n\n${summary}\n\n**Generated:** \`.loopspec/SKILL.md\`\n\n${skillContent.slice(0, 2000)}`,
      }],
    };
  });
}
