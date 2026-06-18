import path from 'node:path';
import fs from 'node:fs';
import type { AppContext } from '../../context.js';
import { readFile } from '../../utils/files.js';
import { parseMarkdownSections } from '../../utils/markdown.js';

export interface DriftItem {
  file: string;
  specExpectation: string;
  codeReality: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestion: string;
  category: string;
  autoFixable?: boolean;
}

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
  // New: state management patterns
  contextProvider: [/(?:createContext|Provider|useContext)/],
  storeUsage: [/(?:useStore|useSelector|useDispatch|useAtom|create\(\)|defineStore)/],
  propDrilling: [/(?:props\.\w+\.\w+\.\w+|{\s*\w+,\s*\w+,\s*\w+,\s*\w+,\s*\w+)/],
  // New: test patterns
  testImports: [/(?:describe|it|test|expect|vi\.|jest\.|cy\.)/],
  // New: dependency patterns
  importStatement: [/^import\s+.*from\s+['"]([^./][^'"]*)['"]/gm],
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

  if (isPage && /(?:dashboard|admin|settings|profile|account)/.test(filePath)) {
    exp.requiresAuth = true;
  }

  if ((isPage || isComponent) && !exp.requiredStates.includes('empty')) {
    exp.requiredStates.push('empty');
  }

  if (skill) {
    const lower = skill.toLowerCase();
    if (lower.includes('named export') || lower.includes('no default export')) exp.namedExports = true;
    if (lower.includes('strict') || lower.includes('no `any`') || lower.includes('no any')) exp.strictTypes = true;
  }

  if (schema && isApi) exp.requiresValidation = true;

  return exp;
}

// ─── NEW: State Management Drift (deep analysis) ─────────────────────────────

function checkStateManagementDrift(content: string, filePath: string, skill: string | null): DriftItem[] {
  if (!filePath.match(/\.(tsx|jsx)$/) || filePath.includes('test') || filePath.includes('.test.')) return [];
  const drifts: DriftItem[] = [];

  // 1. Prop drilling: count destructured props in component signature
  const componentProps = content.match(/(?:function|const)\s+\w+\s*\(\s*\{([^}]{50,})\}/);
  if (componentProps) {
    const propCount = componentProps[1].split(',').length;
    const hasContext = hasPattern(content, PATTERNS.contextProvider) || hasPattern(content, PATTERNS.storeUsage);
    if (propCount >= 6 && !hasContext) {
      drifts.push({
        file: filePath,
        specExpectation: 'Components with 6+ props should use Context/store to avoid prop drilling',
        codeReality: `${propCount} props destructured without Context or store usage`,
        severity: 'medium',
        suggestion: 'Extract shared state into React Context, Zustand store, or Jotai atoms',
        category: 'state-management',
        autoFixable: false,
      });
    }
  }

  // 2. Multiple useState calls without consolidation
  const useStateCount = (content.match(/useState/g) || []).length;
  if (useStateCount >= 5) {
    const hasReducer = /useReducer/.test(content);
    if (!hasReducer) {
      drifts.push({
        file: filePath,
        specExpectation: 'Complex local state (5+ useState) should use useReducer or state machine',
        codeReality: `${useStateCount} useState calls — complex state logic may be fragile`,
        severity: 'low',
        suggestion: 'Consolidate related state with useReducer or a custom hook',
        category: 'state-management',
        autoFixable: false,
      });
    }
  }

  // 3. Global state in component files (should be in separate store files)
  const hasGlobalStore = /(?:create\(\)|configureStore|createSlice|atom\(|defineStore)/.test(content);
  const isStoreFile = /(?:store|atoms?|state|slice)/.test(path.basename(filePath));
  if (hasGlobalStore && !isStoreFile) {
    drifts.push({
      file: filePath,
      specExpectation: 'Global state definitions should live in dedicated store files',
      codeReality: 'Store/atom/slice defined inside a component file',
      severity: 'low',
      suggestion: 'Move store definition to a dedicated file (e.g., stores/ or atoms/ directory)',
      category: 'state-management',
      autoFixable: false,
    });
  }

  // 4. SKILL.md state management convention violations
  if (skill) {
    const lower = skill.toLowerCase();
    if (lower.includes('zustand') && hasPattern(content, [/useContext|createContext/]) && !hasPattern(content, PATTERNS.storeUsage)) {
      drifts.push({
        file: filePath,
        specExpectation: 'SKILL.md specifies Zustand for state management',
        codeReality: 'Uses React Context instead of Zustand store',
        severity: 'medium',
        suggestion: 'Replace Context with Zustand store per project conventions',
        category: 'state-management',
        autoFixable: false,
      });
    }
    if (lower.includes('jotai') && /redux|zustand|create\(\)/.test(content)) {
      drifts.push({
        file: filePath,
        specExpectation: 'SKILL.md specifies Jotai for state management',
        codeReality: 'Uses Redux/Zustand instead of Jotai atoms',
        severity: 'medium',
        suggestion: 'Replace with Jotai atoms per project conventions',
        category: 'state-management',
        autoFixable: false,
      });
    }
  }

  return drifts;
}

// ─── NEW: Test Coverage Gap Detection ────────────────────────────────────────

function checkTestCoverageGap(filePath: string, projectDir: string): DriftItem[] {
  const drifts: DriftItem[] = [];

  // Only check source files (not tests, configs, types)
  if (filePath.includes('.test.') || filePath.includes('.spec.') || filePath.includes('__tests__')) return [];
  if (filePath.match(/\.(d\.ts|config\.\w+|json)$/)) return [];
  if (!filePath.match(/\.(ts|tsx|js|jsx)$/)) return [];

  const baseName = path.basename(filePath).replace(/\.\w+$/, '');
  const dirName = path.dirname(filePath);

  // Check for corresponding test file
  const testPatterns = [
    path.join(dirName, `${baseName}.test.ts`),
    path.join(dirName, `${baseName}.test.tsx`),
    path.join(dirName, `${baseName}.spec.ts`),
    path.join(dirName, `${baseName}.spec.tsx`),
    path.join(dirName, '__tests__', `${baseName}.test.ts`),
    path.join(dirName, '__tests__', `${baseName}.test.tsx`),
    path.join(projectDir, 'tests', `${baseName}.test.ts`),
    path.join(projectDir, 'tests', path.relative(projectDir, dirName), `${baseName}.test.ts`),
  ];

  const hasTest = testPatterns.some(p => {
    try { return fs.existsSync(p); } catch { return false; }
  });

  if (!hasTest) {
    // Determine severity based on file type
    const isApi = /(?:api|route|controller|handler|service)/.test(filePath);
    const isUtil = /(?:util|helper|lib|hook)/.test(filePath);
    const isComponent = filePath.match(/\.(tsx|jsx)$/);

    let severity: DriftItem['severity'] = 'low';
    if (isApi) severity = 'high';
    else if (isUtil) severity = 'medium';

    drifts.push({
      file: filePath,
      specExpectation: `${isApi ? 'API routes' : isUtil ? 'Utility functions' : 'Components'} should have test coverage`,
      codeReality: 'No corresponding test file found',
      severity,
      suggestion: `Create ${baseName}.test.${filePath.endsWith('x') ? 'tsx' : 'ts'} with unit tests`,
      category: 'test-coverage',
      autoFixable: false,
    });
  }

  return drifts;
}

// ─── NEW: Dependency Drift (package.json vs spec) ────────────────────────────

async function checkDependencyDrift(ctx: AppContext): Promise<DriftItem[]> {
  const drifts: DriftItem[] = [];

  const pkgPath = path.join(ctx.projectDir, 'package.json');
  const trdContent = await readFile(path.join(ctx.loopspecDir, 'TRD.md'));
  const skillContent = await readFile(path.join(ctx.loopspecDir, 'SKILL.md'));

  let pkgJson: Record<string, unknown>;
  try {
    const raw = await readFile(pkgPath);
    if (!raw) return [];
    pkgJson = JSON.parse(raw);
  } catch { return []; }

  const deps = { ...(pkgJson.dependencies as Record<string, string> || {}), ...(pkgJson.devDependencies as Record<string, string> || {}) };
  const depNames = Object.keys(deps);

  // 1. Check for deprecated/problematic deps
  const problematic: Record<string, string> = {
    'moment': 'Use date-fns or dayjs instead (moment is deprecated and large)',
    'request': 'Use fetch or axios (request is deprecated)',
    'lodash': 'Import specific functions (lodash/get) to reduce bundle size',
    'left-pad': 'Use String.prototype.padStart()',
    'event-stream': 'Known supply chain attack vector — remove',
  };

  for (const [dep, reason] of Object.entries(problematic)) {
    if (depNames.includes(dep)) {
      drifts.push({
        file: 'package.json',
        specExpectation: 'Use modern, maintained dependencies',
        codeReality: `Using "${dep}" — ${reason}`,
        severity: dep === 'event-stream' ? 'critical' : 'low',
        suggestion: reason,
        category: 'dependency-drift',
        autoFixable: false,
      });
    }
  }

  // 2. Check for spec-mandated deps that are missing
  if (trdContent || skillContent) {
    const specText = ((trdContent || '') + (skillContent || '')).toLowerCase();
    const specMentions: Record<string, string> = {
      'zod': 'validation',
      'prisma': 'ORM/database',
      'drizzle': 'ORM/database',
      'nextauth': 'authentication',
      'next-auth': 'authentication',
      'tailwind': 'styling',
      'shadcn': 'component library',
      'vitest': 'testing',
      'jest': 'testing',
    };

    for (const [dep, purpose] of Object.entries(specMentions)) {
      if (specText.includes(dep) && !depNames.some(d => d.includes(dep))) {
        drifts.push({
          file: 'package.json',
          specExpectation: `Spec mentions ${dep} for ${purpose}`,
          codeReality: `"${dep}" referenced in spec but not installed`,
          severity: 'medium',
          suggestion: `Install: npm install ${dep}`,
          category: 'dependency-drift',
          autoFixable: true,
        });
      }
    }
  }

  // 3. Check for version pinning (security)
  for (const [dep, version] of Object.entries(deps)) {
    if (typeof version === 'string' && version.startsWith('*')) {
      drifts.push({
        file: 'package.json',
        specExpectation: 'Dependencies should have version constraints',
        codeReality: `"${dep}": "${version}" — wildcard version is dangerous`,
        severity: 'high',
        suggestion: `Pin to a specific range: "^${version.replace('*', '1.0.0')}"`,
        category: 'dependency-drift',
        autoFixable: true,
      });
    }
  }

  return drifts;
}

// ─── Existing checks (preserved) ────────────────────────────────────────────

function checkApiContractDrift(content: string, schema: string | null, filePath: string): DriftItem[] {
  if (!schema || !PATTERNS.apiRoute.some(p => p.test(content))) return [];
  const drifts: DriftItem[] = [];

  if (!content.match(/(?:Response|NextResponse|json\(|send\(|res\.status)/)) {
    drifts.push({
      file: filePath,
      specExpectation: 'API routes should return typed responses (per Schema.md)',
      codeReality: 'No response object or json() call found',
      severity: 'medium',
      suggestion: 'Return NextResponse.json() or res.json() with typed payload',
      category: 'api-contract',
      autoFixable: false,
    });
  }

  if (!hasPattern(content, PATTERNS.errorHandling)) {
    drifts.push({
      file: filePath,
      specExpectation: 'API routes must handle errors (try/catch or error middleware)',
      codeReality: 'No error handling pattern found in API route',
      severity: 'high',
      suggestion: 'Wrap handler in try/catch, return appropriate HTTP error codes',
      category: 'api-contract',
      autoFixable: false,
    });
  }

  // NEW: Check for missing rate limiting on write endpoints
  if (/(?:POST|PUT|PATCH|DELETE)/.test(content) && !/(?:rateLimit|throttle|RateLimiter)/.test(content)) {
    drifts.push({
      file: filePath,
      specExpectation: 'Write endpoints should have rate limiting',
      codeReality: 'No rate limiting pattern found on mutation endpoint',
      severity: 'low',
      suggestion: 'Add rate limiting middleware for POST/PUT/PATCH/DELETE handlers',
      category: 'api-contract',
      autoFixable: false,
    });
  }

  return drifts;
}

function checkRouteDrift(filePath: string, flow: string | null): DriftItem[] {
  if (!flow || !filePath.includes('/app/')) return [];
  const drifts: DriftItem[] = [];

  const routeMatches = flow.match(/\|\s*\/[\w\-/:]+\s*\|/g) || [];
  const specRoutes = routeMatches.map(m => m.replace(/\|/g, '').trim());

  const fileRoute = filePath
    .replace(/.*\/app/, '')
    .replace(/\/page\.\w+$/, '')
    .replace(/\/route\.\w+$/, '')
    .replace(/\([\w-]+\)\//g, '');

  if (fileRoute && specRoutes.length > 5 && !specRoutes.some(r => r.includes(fileRoute.replace(/\//g, '/')))) {
    drifts.push({
      file: filePath,
      specExpectation: 'Route should be documented in AppFlow.md',
      codeReality: `Route ${fileRoute} not found in spec (${specRoutes.length} routes documented)`,
      severity: 'low',
      suggestion: 'Add this route to AppFlow.md or verify it\'s intentionally undocumented',
      category: 'route-drift',
      autoFixable: false,
    });
  }

  return drifts;
}

// ─── Main Detection Function (upgraded) ──────────────────────────────────────

export async function detectDrift(ctx: AppContext, filePath: string): Promise<DriftItem[]> {
  const drifts: DriftItem[] = [];
  const absPath = path.isAbsolute(filePath) ? filePath : path.join(ctx.projectDir, filePath);
  const content = await readFile(absPath);

  if (!content) {
    return [{ file: filePath, specExpectation: 'File should exist', codeReality: 'File not found', severity: 'high', suggestion: 'Create the file per spec', category: 'missing-file', autoFixable: false }];
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
      autoFixable: false,
    });
  }

  if (exp.requiresAuth && hasPattern(content, PATTERNS.authCommentedOut) && !hasPattern(content, PATTERNS.auth)) {
    drifts.push({
      file: filePath,
      specExpectation: 'Auth should be active, not commented out',
      codeReality: 'Found TODO/FIXME referencing auth — incomplete implementation',
      severity: 'high',
      suggestion: 'Implement the auth check instead of leaving a TODO',
      category: 'auth',
      autoFixable: false,
    });
  }

  // UI states
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
          autoFixable: false,
        });
      }
    }
  }

  // Validation
  if (exp.requiresValidation && !hasPattern(content, PATTERNS.validation)) {
    drifts.push({
      file: filePath,
      specExpectation: 'API routes must validate input',
      codeReality: 'No validation (Zod/Yup/Joi) found in API handler',
      severity: 'high',
      suggestion: 'Add input validation with Zod: `const body = schema.parse(await req.json())`',
      category: 'validation',
      autoFixable: false,
    });
  }

  // Type safety
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
        autoFixable: false,
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
      autoFixable: true,
    });
  }

  // API contract drift
  drifts.push(...checkApiContractDrift(content, schema, filePath));

  // Route drift
  drifts.push(...checkRouteDrift(filePath, flow));

  // State management drift (NEW — deep analysis)
  drifts.push(...checkStateManagementDrift(content, filePath, skill));

  // Test coverage gap (NEW)
  drifts.push(...checkTestCoverageGap(filePath, ctx.projectDir));

  // Dependency drift — project-level, deduplicated per session
  if (!_depDriftCache.has(ctx.projectDir)) {
    const depDrifts = await checkDependencyDrift(ctx);
    _depDriftCache.set(ctx.projectDir, depDrifts);
  }
  drifts.push(...(_depDriftCache.get(ctx.projectDir) || []));

  return drifts;
}

// Cache dependency drift per project to avoid repeating per-file
const _depDriftCache = new Map<string, DriftItem[]>();

/** Clear the per-project dependency drift cache (call between sessions) */
export function clearDriftCache() { _depDriftCache.clear(); }

export function formatDriftReport(drifts: DriftItem[]): string {
  if (drifts.length === 0) return '✅ No drift detected. Code aligns with spec.';

  const byLevel = { critical: 0, high: 0, medium: 0, low: 0 };
  const byCategory: Record<string, number> = {};
  let autoFixCount = 0;
  for (const d of drifts) {
    byLevel[d.severity]++;
    byCategory[d.category] = (byCategory[d.category] || 0) + 1;
    if (d.autoFixable) autoFixCount++;
  }

  let report = `## Drift Report — ${drifts.length} issue${drifts.length > 1 ? 's' : ''}\n\n`;
  report += `**Severity:** ${byLevel.critical ? byLevel.critical + ' critical, ' : ''}${byLevel.high} high, ${byLevel.medium} medium, ${byLevel.low} low\n`;
  report += `**Categories:** ${Object.entries(byCategory).map(([k, v]) => `${k}(${v})`).join(', ')}\n`;
  if (autoFixCount > 0) report += `**Auto-fixable:** ${autoFixCount} issue${autoFixCount > 1 ? 's' : ''} (use loopspec_fix)\n`;
  report += '\n';

  const severityOrder = ['critical', 'high', 'medium', 'low'];
  const sorted = drifts.sort((a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity));

  for (const d of sorted) {
    const icon = d.severity === 'critical' ? '⛔' : d.severity === 'high' ? '🔴' : d.severity === 'medium' ? '🟡' : '🟢';
    const fix = d.autoFixable ? ' 🔧' : '';
    report += `${icon} **${d.severity.toUpperCase()}** [${d.category}] — \`${d.file}\`${fix}\n`;
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
