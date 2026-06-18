import path from 'node:path';
import fs from 'node:fs';
import type { AppContext } from '../../context.js';
import { readFile } from '../../utils/files.js';
import { parseMarkdownSections } from '../../utils/markdown.js';

export interface ApiContract {
  method: string;
  path: string;
  auth: boolean;
  requestFields?: string[];
  responseFields?: string[];
  errors?: string[];
}

export interface ContractViolation {
  contract: ApiContract;
  file: string;
  issue: string;
  severity: 'high' | 'medium' | 'low';
}

export async function extractContracts(ctx: AppContext): Promise<ApiContract[]> {
  const contracts: ApiContract[] = [];
  const schema = await readFile(path.join(ctx.loopspecDir, 'Schema.md'));
  if (!schema) return contracts;

  // Parse API endpoint tables from Schema.md
  const rows = schema.match(/\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|\s*`?([^|`]+)`?\s*\|\s*([^|]*)\|\s*([^|]*)\|/gi);
  if (rows) {
    for (const row of rows) {
      const parts = row.split('|').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 3) {
        contracts.push({
          method: parts[0].toUpperCase(),
          path: parts[1].replace(/`/g, ''),
          auth: parts[2]?.includes('✓') || parts[2]?.toLowerCase().includes('yes') || false,
          responseFields: [],
          errors: ['400', '500'],
        });
      }
    }
  }

  // Extract request/response fields from table definitions
  const sections = parseMarkdownSections(schema);
  for (const section of sections) {
    const tableMatch = section.heading.match(/Table:\s*`?(\w+)`?/i);
    if (tableMatch) {
      const fields = section.content.match(/\|\s*(\w+)\s*\|/g)?.map(m => m.replace(/\|/g, '').trim()).filter(f => f && f !== 'Field' && !f.startsWith('-'));
      if (fields) {
        // Attach fields to related contracts
        const tableName = tableMatch[1];
        for (const c of contracts) {
          if (c.path.includes(tableName)) {
            c.responseFields = fields;
          }
        }
      }
    }
  }

  return contracts;
}

export async function verifyContracts(ctx: AppContext): Promise<ContractViolation[]> {
  const contracts = await extractContracts(ctx);
  if (contracts.length === 0) return [];

  const violations: ContractViolation[] = [];

  // Scan source files for API usage patterns
  const srcDirs = ['src', 'app', 'pages', 'lib'];
  for (const dir of srcDirs) {
    const fullDir = path.join(ctx.projectDir, dir);
    if (!fs.existsSync(fullDir)) continue;
    scanDir(fullDir, ctx.projectDir, contracts, violations);
  }

  return violations;
}

function scanDir(dir: string, projectDir: string, contracts: ApiContract[], violations: ContractViolation[]) {
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(full, projectDir, contracts, violations);
      } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        const content = fs.readFileSync(full, 'utf-8');
        const relPath = path.relative(projectDir, full).replace(/\\/g, '/');
        checkFileContracts(content, relPath, contracts, violations);
      }
    }
  } catch {}
}

function checkFileContracts(content: string, file: string, contracts: ApiContract[], violations: ContractViolation[]) {
  // Check: backend route handlers match contracts
  if (file.includes('route') || file.includes('api')) {
    for (const c of contracts) {
      const routeSegment = c.path.split('/').pop();
      if (!routeSegment || !file.includes(routeSegment)) continue;

      // Auth check
      if (c.auth && !/getSession|auth\(|requireAuth|middleware|getUser/i.test(content)) {
        violations.push({ contract: c, file, issue: `${c.method} ${c.path} requires auth but no auth check found`, severity: 'high' });
      }

      // Validation check for POST/PUT/PATCH
      if (['POST', 'PUT', 'PATCH'].includes(c.method) && !/z\.\w+|safeParse|validate|schema/i.test(content)) {
        violations.push({ contract: c, file, issue: `${c.method} ${c.path} needs input validation`, severity: 'high' });
      }
    }
  }

  // Check: frontend fetch calls match contract paths
  const fetchCalls = content.match(/fetch\s*\(\s*['"`]([^'"`]+)['"`]/g);
  if (fetchCalls) {
    for (const call of fetchCalls) {
      const urlMatch = call.match(/['"`]([^'"`]+)['"`]/);
      if (!urlMatch) continue;
      const url = urlMatch[1];
      // Check if this URL is documented
      const matchedContract = contracts.find(c => url.includes(c.path) || c.path.includes(url.replace(/^\/api/, '')));
      if (!matchedContract && url.startsWith('/api')) {
        violations.push({ contract: { method: 'GET', path: url, auth: false }, file, issue: `Undocumented API call: ${url}`, severity: 'low' });
      }
    }
  }
}

export function formatContractReport(violations: ContractViolation[]): string {
  if (violations.length === 0) return '✓ All API contracts verified.';
  let text = `## Contract Violations (${violations.length})\n\n`;
  for (const v of violations) {
    const icon = v.severity === 'high' ? '⛔' : v.severity === 'medium' ? '⚠' : 'ℹ';
    text += `${icon} [${v.severity}] ${v.issue}\n  File: ${v.file}\n\n`;
  }
  return text;
}
