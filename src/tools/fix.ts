import * as z from 'zod/v4';
import path from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { readFile } from '../utils/files.js';
import { detectDrift, type DriftItem } from '../engines/live-sync/index.js';
import { routeContext } from '../engines/context-router/index.js';

interface FixSuggestion {
  file: string;
  drift: DriftItem;
  fix: string; // The actual code/prompt to fix it
}

/**
 * Generate concrete fix suggestions based on drift type
 */
function generateFix(drift: DriftItem, fileContent: string, specContext: string): string {
  const { specExpectation, severity } = drift;
  const lower = specExpectation.toLowerCase();

  // Auth missing → generate auth wrapper
  if (lower.includes('auth')) {
    const isNextjs = fileContent.includes('next') || fileContent.includes("'use ");
    if (isNextjs) {
      return `Add auth check at the top of the component/page:

\`\`\`tsx
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth'; // or your auth lib

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
// Option 1: Error boundary (create error.tsx for Next.js App Router)
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

  // Generic fallback — use spec context to generate contextual suggestion
  return `Fix this drift based on the spec:\n\nSpec requirement: ${specExpectation}\n\nRelevant spec context:\n${specContext.slice(0, 1000)}\n\nGenerate code that satisfies the spec requirement.`;
}

export function registerAutoFixTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_fix', {
    title: 'Auto-Fix Drift',
    description: 'Detect drift AND generate concrete fix patches. Like loopspec_drift but with the solution included.',
    inputSchema: z.object({
      file: z.string().describe('File to fix'),
    }),
  }, async (args) => {
    const { file } = args as { file: string };
    const drifts = await detectDrift(ctx, file);

    if (drifts.length === 0) {
      return { content: [{ type: 'text' as const, text: `✅ No drift in ${file}. Nothing to fix.` }] };
    }

    const absPath = path.isAbsolute(file) ? file : path.join(ctx.projectDir, file);
    const fileContent = await readFile(absPath) || '';
    const specContext = await routeContext(ctx, `fix ${file}`, 3000);

    const fixes: FixSuggestion[] = drifts.map((drift) => ({
      file,
      drift,
      fix: generateFix(drift, fileContent, specContext),
    }));

    const output = fixes.map((f, i) => {
      const icon = f.drift.severity === 'high' ? '🔴' : f.drift.severity === 'medium' ? '🟡' : '🟢';
      return `### ${icon} Fix ${i + 1}: ${f.drift.specExpectation}\n\n**Issue:** ${f.drift.codeReality}\n\n${f.fix}`;
    }).join('\n\n---\n\n');

    return {
      content: [{
        type: 'text' as const,
        text: `## 🔧 Auto-Fix Suggestions for ${file}\n\n${drifts.length} issue${drifts.length > 1 ? 's' : ''} found with fixes:\n\n${output}`,
      }],
    };
  });
}
