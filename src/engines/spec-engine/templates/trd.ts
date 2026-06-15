import type { ProjectAnalysis } from '../analyzer.js';

interface FileNode {
  name: string;
  type: 'file' | 'dir';
  desc?: string;
  children?: FileNode[];
}

function generateFileStructure(analysis: ProjectAnalysis, answers: Record<string, string>, stackDna?: string): FileNode[] {
  const stack = answers.stack || analysis.impliedStack || 'nextjs-supabase-shadcn';

  if (stack.includes('next') || stack.includes('t3')) {
    return [
      { name: 'src/', type: 'dir', children: [
        { name: 'app/', type: 'dir', desc: 'App Router pages', children: [
          { name: '(auth)/', type: 'dir', desc: 'Auth group layout', children: [
            { name: 'login/page.tsx', type: 'file' },
            { name: 'signup/page.tsx', type: 'file' },
          ]},
          { name: '(dashboard)/', type: 'dir', desc: 'Protected group layout', children: [
            { name: 'layout.tsx', type: 'file', desc: 'Auth-gated layout' },
            { name: 'page.tsx', type: 'file', desc: 'Dashboard home' },
          ]},
          { name: 'api/', type: 'dir', children: [
            { name: 'auth/', type: 'dir', children: [{ name: 'route.ts', type: 'file' }] },
          ]},
          { name: 'layout.tsx', type: 'file', desc: 'Root layout' },
          { name: 'page.tsx', type: 'file', desc: 'Landing/home' },
        ]},
        { name: 'components/', type: 'dir', children: [
          { name: 'ui/', type: 'dir', desc: 'Reusable primitives' },
          { name: 'forms/', type: 'dir', desc: 'Form components' },
          { name: 'layout/', type: 'dir', desc: 'Layout shells' },
        ]},
        { name: 'lib/', type: 'dir', children: [
          { name: 'db.ts', type: 'file', desc: 'Database client' },
          { name: 'auth.ts', type: 'file', desc: 'Auth helpers' },
          { name: 'validations.ts', type: 'file', desc: 'Zod schemas' },
        ]},
        { name: 'hooks/', type: 'dir', desc: 'Custom React hooks' },
        { name: 'types/', type: 'dir', desc: 'Shared TypeScript types' },
      ]},
      { name: 'public/', type: 'dir' },
      { name: 'tests/', type: 'dir' },
    ];
  }

  if (stack.includes('python') || stack.includes('fastapi') || stack.includes('django')) {
    return [
      { name: 'app/', type: 'dir', children: [
        { name: 'api/', type: 'dir', children: [
          { name: 'routes/', type: 'dir' },
          { name: 'deps.py', type: 'file', desc: 'Dependencies/auth' },
        ]},
        { name: 'models/', type: 'dir', desc: 'SQLAlchemy/Django models' },
        { name: 'schemas/', type: 'dir', desc: 'Pydantic schemas' },
        { name: 'services/', type: 'dir', desc: 'Business logic' },
        { name: 'core/', type: 'dir', children: [
          { name: 'config.py', type: 'file' },
          { name: 'security.py', type: 'file' },
        ]},
        { name: 'main.py', type: 'file', desc: 'App entrypoint' },
      ]},
      { name: 'tests/', type: 'dir' },
      { name: 'alembic/', type: 'dir', desc: 'Migrations' },
    ];
  }

  // Generic fallback
  return [
    { name: 'src/', type: 'dir', children: [
      { name: 'routes/', type: 'dir' },
      { name: 'components/', type: 'dir' },
      { name: 'lib/', type: 'dir' },
      { name: 'types/', type: 'dir' },
    ]},
    { name: 'tests/', type: 'dir' },
  ];
}

function renderTree(nodes: FileNode[], indent = ''): string {
  let out = '';
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const isLast = i === nodes.length - 1;
    const prefix = isLast ? '└── ' : '├── ';
    const desc = node.desc ? `  # ${node.desc}` : '';
    out += `${indent}${prefix}${node.name}${desc}\n`;
    if (node.children) {
      const childIndent = indent + (isLast ? '    ' : '│   ');
      out += renderTree(node.children, childIndent);
    }
  }
  return out;
}

function generateNfrs(analysis: ProjectAnalysis, answers: Record<string, string>): string {
  const scale = answers.scale || '< 100';
  const perf = scale === '10000+'
    ? { lcp: '1.5s', bundle: '150KB', response: '100ms', uptime: '99.9%' }
    : scale === '1000-10000'
    ? { lcp: '2.0s', bundle: '200KB', response: '200ms', uptime: '99.5%' }
    : { lcp: '2.5s', bundle: '250KB', response: '500ms', uptime: '99%' };

  return `| Metric | Target | Measurement |
|--------|--------|-------------|
| LCP | < ${perf.lcp} | Lighthouse CI |
| JS Bundle | < ${perf.bundle} gzipped | Build output |
| API Response (p95) | < ${perf.response} | Server logs |
| Uptime | ${perf.uptime} | Monitoring |
| Error Rate | < 0.1% | Error tracking |`;
}

export function generateTrdPrompt(analysis: ProjectAnalysis, answers: Record<string, string>, stackDna?: string): string {
  const stack = answers.stack || analysis.impliedStack || 'nextjs-supabase-shadcn';
  const fileTree = renderTree(generateFileStructure(analysis, answers, stackDna));
  const nfrs = generateNfrs(analysis, answers);
  const stackContext = stackDna ? `\n## Stack DNA\n${stackDna}\n` : '';

  return `# Technical Requirements — ${answers.core_feature || analysis.productType}

## Stack Decision
- **Framework:** ${stack}
- **Hosting:** ${answers.hosting || 'Vercel'}
- **Scale target:** ${answers.scale || '< 100'} users
- **Real-time:** ${answers.realtime || 'false'}
${stackContext}
## File Structure

\`\`\`
${fileTree}\`\`\`

## Non-Functional Requirements

${nfrs}

## Security
- Auth: ${answers.auth || 'email/password'}
- Tokens: httpOnly cookies, short-lived access + refresh
- Input validation: Zod on API boundary
- Rate limiting: per-IP on auth routes (5/min)
- CSP headers: strict, no inline scripts

## Constraints
- Node >= 20, TypeScript strict mode
- Browser: last 2 versions + Safari 15+
- Mobile: responsive, touch targets >= 44px

---

> **AI Instructions:** When implementing:
> - Follow the file structure above exactly
> - Create files as you encounter new features
> - Keep the NFR targets as your performance budget
> - Add integrations under \`src/lib/\` with typed clients`;
}
