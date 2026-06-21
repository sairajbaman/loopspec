#!/usr/bin/env tsx
/**
 * LOOPSPEC AUTO-FIX DEMO
 * 
 * Takes the drift issues found by detectDrift() and generates
 * concrete, copy-pasteable code fixes for each one.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { detectDrift } = await import('../src/engines/live-sync/index.js');
const { createContext } = await import('../src/context.js');
const { readFile } = await import('../src/utils/files.js');
const { routeContext } = await import('../src/engines/context-router/index.js');

const demoDir = path.join(__dirname);
process.env.LOOPSPEC_PROJECT_DIR = demoDir;
const ctx = createContext();
await ctx.ensureLoopspecDir();

// ================================================================
// Simulate the loopspec_fix tool logic for each file
// (Same code as registerAutoFixTool but we call it directly)
// ================================================================

function generateFix(drift: any, fileContent: string, specContext: string): string {
  const { specExpectation } = drift;
  const lower = specExpectation.toLowerCase();

  // Auth missing
  if (lower.includes('auth')) {
    const isNextjs = fileContent.includes('next') || fileContent.includes("'use ");
    if (isNextjs) {
      return `Add auth check at the top of the component/page:

\`\`\`tsx
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

export default async function Page() {
  const session = await getServerSession();
  if (!session) redirect('/login');

  // ... rest of your component
}
\`\`\`

Or use middleware for route-level protection:
\`\`\`ts
// middleware.ts
export { default } from 'next-auth/middleware';
export const config = { matcher: ['/dashboard/:path*', '/settings/:path*'] };
\`\`\``;
    }
    return `Add authentication check before rendering:
- Verify session/token exists
- Redirect to login if unauthorized
- Wrap component with auth guard/HOC`;
  }

  // Loading state missing
  if (lower.includes('loading')) {
    return `Add loading state. Example:

\`\`\`tsx
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Option 1: Suspense boundary
<Suspense fallback={<Skeleton className="h-[200px] w-full" />}>
  <AsyncComponent />
</Suspense>

// Option 2: Loading state variable
const [isLoading, setIsLoading] = useState(true);
if (isLoading) return <LoadingSkeleton />;
\`\`\``;
  }

  // Error state missing
  if (lower.includes('error')) {
    return `Add error handling. Example:

\`\`\`tsx
// Option 1: Error boundary (create error.tsx for Next.js)
'use client';
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-4 text-center">
      <h2>Something went wrong</h2>
      <p className="text-muted-foreground">{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}

// Option 2: Inline error state
if (error) return <Alert variant="destructive">{error.message}</Alert>;
\`\`\``;
  }

  // Empty state missing
  if (lower.includes('empty')) {
    return `Add empty state when data is absent. Example:

\`\`\`tsx
if (!data || data.length === 0) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <EmptyIcon className="h-12 w-12 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-medium">No items yet</h3>
      <p className="text-muted-foreground">Get started by creating your first item.</p>
      <Button className="mt-4">Create New</Button>
    </div>
  );
}
\`\`\``;
  }

  // TypeScript any
  if (lower.includes('any') || lower.includes('typescript')) {
    return `Replace \`any\` types with proper types:

- If the type is truly unknown: use \`unknown\` + type narrowing
- If it's an API response: create an interface matching the response shape
- If it's a complex generic: use utility types (Record, Partial, Pick)
- If it's a third-party lib issue: use the lib's exported types or \`typeof\`

Example:
\`\`\`ts
// Bad
const data: any = await fetch('/api').then(r => r.json());

// Good
interface ApiResponse { items: Item[]; total: number; }
const data: ApiResponse = await fetch('/api').then(r => r.json());
\`\`\``;
  }

  // Named exports
  if (lower.includes('named export') || lower.includes('export default')) {
    return `Replace default export with named export:

\`\`\`diff
- export default function MyComponent() {
+ export function MyComponent() {
\`\`\`

This improves refactoring (rename propagation) and tree-shaking.`;
  }

  // Generic fallback
  return `Fix this drift based on the spec:\n\nSpec requirement: ${specExpectation}\n\nRelevant spec context:\n${specContext.slice(0, 1000)}\n\nGenerate code that satisfies the spec requirement.`;
}

// ================================================================
// Demo: Run fix on each broken file
// ================================================================

const files = [
  'demo-app/dashboard/page.tsx',
  'demo-app/api/invoices/route.ts',
  'demo-app/components/InvoiceCard.tsx',
  'demo-app/settings/page.tsx',
];

console.log('='.repeat(75));
console.log('  🔧 LOOPSPEC AUTO-FIX — LIVE DEMO');
console.log('  Drift Detection + Concrete Code Fix Suggestions');
console.log('='.repeat(75));

for (const file of files) {
  const drifts = await detectDrift(ctx, file);
  
  console.log('\n' + '█'.repeat(75));
  console.log(`  📁 ${file}`);
  console.log('█'.repeat(75));

  if (drifts.length === 0) {
    console.log('  ✅ No drift found.');
    continue;
  }

  const absPath = path.isAbsolute(file) ? file : path.join(ctx.projectDir, file);
  const fileContent = await readFile(absPath) || '';
  const specContext = await routeContext(ctx, `fix ${file}`, 3000);

  for (let i = 0; i < drifts.length; i++) {
    const d = drifts[i];
    const fix = generateFix(d, fileContent, specContext);
    const icon = d.severity === 'high' ? '🔴' : d.severity === 'medium' ? '🟡' : '🟢';

    console.log(`\n  ${icon} Fix ${i + 1}: ${d.specExpectation}`);
    console.log(`     ${'─'.repeat(65)}`);
    console.log(`     Issue: ${d.codeReality}`);
    console.log(`     ${'─'.repeat(65)}`);
    console.log(fix.split('\n').map(l => `     ${l}`).join('\n'));
    console.log();
  }
}

console.log('═'.repeat(75));
console.log('  ✅ Auto-fix demo complete.');
console.log('  Each drift issue now includes a concrete, copy-pasteable code fix.');
console.log('═'.repeat(75));
