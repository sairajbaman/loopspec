import path from 'node:path';
import type { AppContext } from '../../context.js';
import { readFile } from '../../utils/files.js';
import { parseMarkdownSections } from '../../utils/markdown.js';

export interface DriftItem {
  file: string;
  specExpectation: string;
  codeReality: string;
  severity: 'low' | 'medium' | 'high';
  suggestion: string;
  category: string;
}

// Pattern groups for structural analysis
const PATTERNS = {
  auth: [
    /(?:getSession|getUser|auth\(\)|createClient|useSession|getServerSession|requireAuth|protect|middleware)/,
    /(?:cookies\(\)|headers\(\)).*(?:token|session|bearer)/is,
    /(?:redirect|throw|return).*(?:unauthorized|unauthenticated|401|login)/i,
  ],
  authCommentedOut: [/(?:\/\*|\/\/)\s*(?:TODO|FIXME).*auth/i],
  errorHandling: [
    /(?:try\s*\{|\.catch\(|onError|ErrorBoundary|error\.tsx|fallback)/,
    /(?:if\s*\(\s*(?:error|err|isError)|throw\s+new\s+\w*Error)/,
  ],
  loading: [
    /(?:loading|isLoading|isPending|Skeleton|Spinner|Suspense|fallback)/,
    /(?:useState.*loading|useTransition|startTransition)/,
  ],
  empty: [
    /(?:\.length\s*===?\s*0|isEmpty|no\s+\w+\s+(?:found|yet)|empty.*state)/i,
    /(?:if\s*\(\s*!?\w+\.length|data\s*&&\s*data\.length)/,
  ],
  validation: [
    /(?:z\.\w+|zod|yup|joi|validate|safeParse|parse\()/i,
    /(?:if\s*\(!?\w+\)\s*(?:throw|return)|\.refine\(|\.superRefine\()/,
  ],
  typeStrict: [/:\s*(?:string|number|boolean|interface|type\s+\w+|Record<|Array<)/],
  typeAny: [/:\s*any(?:\s|;|,|\)|\])/g, /@ts-ignore|@ts-nocheck/g],
  defaultExport: [/^export\s+default\s+/m],
  stateManagement: [
    /(?:useState|useReducer|useContext|createContext|create\(\)|defineStore|writable|signal)/,
    /(?:atom\(|selector\(|slice\(|configureStore|createSlice)/,
  ],
  apiRoute: [
    /(?:GET|POST|PUT|PATCH|DELETE|app\.\w+\(|router\.\w+\(|export\s+async\s+function\s+(?:GET|POST|PUT|PATCH|DELETE))/,
  ],
};

function hasPattern(content: string, patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(content));
}

function countMatches(content: string, patterns: RegExp[]): number {
  let count = 0;
  for (const p of patterns) {
    const g = new RegExp(p.source, p.flags.includes('g') ? p.flags : p.flags + 'g');
    count += (content.match(g) || []).length;
  }
  return count;
}

interface Expectations {
  requiresAuth: boolean;
  requiredStates: string[];
  requiresValidation: boolean;
  namedExports: boolean;
  strictTypes: boolean;
  isApiRoute: boolean;
  screenName?: string;
}

function extractExpectations(flow: string | null, skill: string | null, schema: string | null, filePath: string): Expectations {
  const exp: Expectations = {
    requiresAuth: false,
    requiredStates: ['loading', 'error'],
    requiresValidation: false,
    namedExports: false,
    strictTypes: false,
    isApiRoute: false,
  };

  const baseName = path.basename(filePath).replace(/\.\w+$/, '').toLowerCase();
  const isPage = /(?:page|route|\/app\/)/.test(filePath);
  const isComponent = filePath.endsWith('.tsx') || filePath.endsWith('.jsx');
  const isApi = /(?:api|route|controller|handler)/.test(filePath);

  exp.isApiRoute = isApi;
  if (isApi) exp.requiresValidation = true;

  // Auth from AppFlow
  if (flow) {
    const sections = parseMarkdownSections(flow);
    for (const s of sections) {
      const text = (s.heading + ' ' + s.content).toLowerCase();
      if (text.includes(baseName) || text.includes(baseName.replace(/-/g, ' '))) {
        exp.screenName = s.heading;
        if (text.includes('protected') || text.includes('auth')) exp.requiresAuth = true;
        const statesMatch = s.content.match(/states?[:\s|]+([^\n|]+)/i);
        if (statesMatch) {
          exp.requiredStates = statesMatch[1].split(/[,;|]/).map(s => s.trim().toLowerCase()).filter(Boolean);
        }
      }
    }
  }

  // Protected routes by path
  if (isPage && /(?:dashboard|admin|settings|profile|account)/.test(filePath)) {
    exp.requiresAuth = true;
  }

  // Pages should handle empty state
  if ((isPage || isComponent) && !exp.requiredStates.includes('empty')) {
    exp.requiredStates.push('empty');
  }

  // SKILL conventions
  if (skill) {
    const lower = skill.toLowerCase();
    if (lower.includes('named export') || lower.includes('no default export')) exp.namedExports = true;
    if (lower.includes('strict') || lower.includes('no `any`') || lower.includes('no any')) exp.strictTypes = true;
  }

  // Schema check: if schema defines endpoints, API routes should validate
  if (schema && isApi) exp.requiresValidation = true;

  return exp;
}

// Check API contract drift: do endpoints in code match what schema says?
function checkApiContractDrift(content: string, schema: string | null, filePath: string): DriftItem[] {
  if (!schema || !PATTERNS.apiRoute.some(p => p.test(content))) return [];
  const drifts: DriftItem[] = [];

  // Check if API route has no response type definition
  if (!content.match(/(?:Response|NextResponse|json\(|send\(|res\.status)/)) {
    drifts.push({
      file: filePath,
      specExpectation: 'API routes should return typed responses (per Schema.md)',
      codeReality: 'No response object or json() call found',
      severity: 'medium',
      suggestion: 'Return NextResponse.json() or res.json() with typed payload',
      category: 'api-contract',
    });
  }

  // Check if API route handles errors
  if (!hasPattern(content, PATTERNS.errorHandling)) {
    drifts.push({
      file: filePath,
      specExpectation: 'API routes must handle errors (try/catch or error middleware)',
      codeReality: 'No error handling pattern found in API route',
      severity: 'high',
      suggestion: 'Wrap handler in try/catch, return appropriate HTTP error codes',
      category: 'api-contract',
    });
  }

  return drifts;
}

// Check route file naming drift
function checkRouteDrift(filePath: string, flow: string | null): DriftItem[] {
  if (!flow || !filePath.includes('/app/')) return [];
  const drifts: DriftItem[] = [];

  // Extract routes from AppFlow tables
  const routeMatches = flow.match(/\|\s*\/[\w\-/:]+\s*\|/g) || [];
  const specRoutes = routeMatches.map(m => m.replace(/\|/g, '').trim());

  // Check if this file's route is referenced in spec
  const fileRoute = filePath
    .replace(/.*\/app/, '')
    .replace(/\/page\.\w+$/, '')
    .replace(/\/route\.\w+$/, '')
    .replace(/\([\w-]+\)\//g, ''); // strip route groups

  if (fileRoute && specRoutes.length > 0) {
    // Only flag if spec is comprehensive and this route is missing
    if (specRoutes.length > 5 && !specRoutes.some(r => r.includes(fileRoute.replace(/\//g, '/')))) {
      drifts.push({
        file: filePath,
        specExpectation: 'Route should be documented in AppFlow.md',
        codeReality: `Route ${fileRoute} not found in spec (${specRoutes.length} routes documented)`,
        severity: 'low',
        suggestion: 'Add this route to AppFlow.md or verify it\'s intentionally undocumented',
        category: 'route-drift',
      });
    }
  }

  return drifts;
}

// Check state management patterns
function checkStateManagement(content: string, filePath: string): DriftItem[] {
  if (!filePath.match(/\.(tsx|jsx)$/) || filePath.includes('test')) return [];
  const drifts: DriftItem[] = [];

  // Prop drilling detection: more than 5 props passed through
  const propCount = (content.match(/\w+:\s*\w+[,;]/g) || []).length;
  const hasContext = hasPattern(content, [/useContext|createContext|Provider/]);
  if (propCount > 8 && !hasContext) {
    drifts.push({
      file: filePath,
      specExpectation: 'Complex state should use Context or state management library',
      codeReality: `High prop count (${propCount}) without context/store — possible prop drilling`,
      severity: 'low',
      suggestion: 'Consider extracting shared state into Context or a store (zustand/jotai)',
      category: 'state-management',
    });
  }

  return drifts;
}

export async function detectDrift(ctx: AppContext, filePath: string): Promise<DriftItem[]> {
  const drifts: DriftItem[] = [];
  const absPath = path.isAbsolute(filePath) ? filePath : path.join(ctx.projectDir, filePath);
  const content = await readFile(absPath);

  if (!content) {
    return [{ file: filePath, specExpectation: 'File should exist', codeReality: 'File not found', severity: 'high', suggestion: 'Create the file per spec', category: 'missing-file' }];
  }

  const flow = await readFile(path.join(ctx.loopspecDir, 'AppFlow.md'));
  const skill = await readFile(path.join(ctx.loopspecDir, 'SKILL.md'));
  const schema = await readFile(path.join(ctx.loopspecDir, 'Schema.md'));
  const exp = extractExpectations(flow, skill, schema, filePath);

  // Auth check
  if (exp.requiresAuth && !hasPattern(content, PATTERNS.auth)) {
    drifts.push({
      file: filePath,
      specExpectation: `Auth required${exp.screenName ? ` (AppFlow: ${exp.screenName})` : ' (protected route)'}`,
      codeReality: 'No auth check, session validation, or middleware protection found',
      severity: 'high',
      suggestion: 'Add getSession()/auth() check or wrap with auth middleware',
      category: 'auth',
    });
  }

  // Commented-out auth
  if (exp.requiresAuth && hasPattern(content, PATTERNS.authCommentedOut) && !hasPattern(content, PATTERNS.auth)) {
    drifts.push({
      file: filePath,
      specExpectation: 'Auth should be active, not commented out',
      codeReality: 'Found TODO/FIXME referencing auth — incomplete implementation',
      severity: 'high',
      suggestion: 'Implement the auth check instead of leaving a TODO',
      category: 'auth',
    });
  }

  // Required UI states
  const isUIFile = filePath.match(/\.(tsx|jsx|svelte|vue)$/);
  if (isUIFile) {
    for (const state of exp.requiredStates) {
      const key = state as keyof typeof PATTERNS;
      if (PATTERNS[key] && !hasPattern(content, PATTERNS[key] as RegExp[])) {
        drifts.push({
          file: filePath,
          specExpectation: `"${state}" state required`,
          codeReality: `No ${state} state pattern found`,
          severity: state === 'error' ? 'high' : 'medium',
          suggestion: state === 'loading' ? 'Add Suspense boundary or loading skeleton'
            : state === 'error' ? 'Add try/catch, ErrorBoundary, or error state'
            : state === 'empty' ? 'Add empty state UI when data is empty'
            : `Add ${state} state handling`,
          category: 'ui-states',
        });
      }
    }
  }

  // Validation on API routes
  if (exp.requiresValidation && !hasPattern(content, PATTERNS.validation)) {
    drifts.push({
      file: filePath,
      specExpectation: 'API routes must validate input',
      codeReality: 'No validation (Zod/Yup/Joi) found in API handler',
      severity: 'high',
      suggestion: 'Add input validation with Zod: `const body = schema.parse(await req.json())`',
      category: 'validation',
    });
  }

  // TypeScript strictness
  if (exp.strictTypes) {
    const anyCount = countMatches(content, PATTERNS.typeAny);
    if (anyCount > 0) {
      drifts.push({
        file: filePath,
        specExpectation: 'No `any` types (per SKILL.md)',
        codeReality: `${anyCount} instance(s) of \`any\` or @ts-ignore`,
        severity: anyCount > 3 ? 'high' : 'medium',
        suggestion: 'Replace `any` with proper types or `unknown` + narrowing',
        category: 'type-safety',
      });
    }
  }

  // Named exports
  if (exp.namedExports && isUIFile && hasPattern(content, PATTERNS.defaultExport)) {
    drifts.push({
      file: filePath,
      specExpectation: 'Named exports only (per SKILL.md)',
      codeReality: 'Uses `export default`',
      severity: 'low',
      suggestion: 'Change to `export function ComponentName` or `export const ComponentName`',
      category: 'conventions',
    });
  }

  // API contract drift
  drifts.push(...checkApiContractDrift(content, schema, filePath));

  // Route drift
  drifts.push(...checkRouteDrift(filePath, flow));

  // State management
  drifts.push(...checkStateManagement(content, filePath));

  return drifts;
}

export function formatDriftReport(drifts: DriftItem[]): string {
  if (drifts.length === 0) return '✅ No drift detected. Code aligns with spec.';

  const byLevel = { high: 0, medium: 0, low: 0 };
  const byCategory: Record<string, number> = {};
  for (const d of drifts) {
    byLevel[d.severity]++;
    byCategory[d.category] = (byCategory[d.category] || 0) + 1;
  }

  let report = `## Drift Report — ${drifts.length} issue${drifts.length > 1 ? 's' : ''}\n\n`;
  report += `**Severity:** ${byLevel.high} high, ${byLevel.medium} medium, ${byLevel.low} low\n`;
  report += `**Categories:** ${Object.entries(byCategory).map(([k, v]) => `${k}(${v})`).join(', ')}\n\n`;

  const sorted = drifts.sort((a, b) => ['high', 'medium', 'low'].indexOf(a.severity) - ['high', 'medium', 'low'].indexOf(b.severity));

  for (const d of sorted) {
    const icon = d.severity === 'high' ? '🔴' : d.severity === 'medium' ? '🟡' : '🟢';
    report += `${icon} **${d.severity.toUpperCase()}** [${d.category}] — \`${d.file}\`\n`;
    report += `   Spec: ${d.specExpectation}\n`;
    report += `   Code: ${d.codeReality}\n`;
    report += `   Fix: ${d.suggestion}\n\n`;
  }

  return report;
}

export function generateUpdatePrompt(files: string[], description?: string): string {
  return `Update the following spec documents based on code changes:

**Files changed:** ${files.join(', ')}
${description ? `**Description:** ${description}` : ''}

Review these files and update:
1. **AppFlow.md** — Add any new screens, states, or transitions discovered
2. **Schema.md** — Document any new API endpoints or data models
3. **SKILL.md** — Record any new patterns or conventions used

Rules:
- Only update sections that are affected by the changes
- Keep existing content intact
- Use the same format/structure as existing sections
- Note the date of the update`;
}
