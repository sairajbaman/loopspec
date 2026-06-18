/**
 * Structured Spec Engine
 * Converts markdown specs into machine-readable JSON schemas
 * and auto-generates TypeScript types from Schema.md.
 */
import path from 'node:path';
import fs from 'node:fs';
import type { AppContext } from '../../context.js';
import { readFile, writeFile, ensureDir } from '../../utils/files.js';
import { parseMarkdownSections } from '../../utils/markdown.js';

export interface StructuredSpec {
  version: string;
  generatedAt: string;
  schema: SchemaDefinition;
  routes: RouteDefinition[];
  types: TypeDefinition[];
  conventions: ConventionRule[];
}

export interface SchemaDefinition {
  tables: TableDef[];
  enums: EnumDef[];
}

export interface TableDef {
  name: string;
  fields: FieldDef[];
  primaryKey: string;
}

export interface FieldDef {
  name: string;
  type: string;
  required: boolean;
  unique?: boolean;
  default?: string;
  references?: string;
}

export interface EnumDef {
  name: string;
  values: string[];
}

export interface RouteDefinition {
  method: string;
  path: string;
  auth: boolean;
  params?: string[];
  body?: string; // type name
  response?: string; // type name
}

export interface TypeDefinition {
  name: string;
  fields: { name: string; type: string; optional: boolean }[];
}

export interface ConventionRule {
  id: string;
  rule: string;
  severity: 'must' | 'should' | 'prefer';
}

/**
 * Parse Schema.md into structured table/field definitions.
 */
function parseSchema(content: string): SchemaDefinition {
  const tables: TableDef[] = [];
  const enums: EnumDef[] = [];
  const sections = parseMarkdownSections(content);

  for (const section of sections) {
    // Look for table definitions in markdown tables
    const tableMatch = section.heading.match(/(\w+)\s*(?:table|model|entity)/i) || section.heading.match(/^(\w+)$/);
    if (!tableMatch) continue;

    const tableName = tableMatch[1];
    const fields: FieldDef[] = [];

    // Parse markdown table rows: | field | type | required | ... |
    const rows = section.content.match(/\|[^|]+\|[^|]+\|[^|\n]+\|/g) || [];
    for (const row of rows) {
      const cols = row.split('|').map(c => c.trim()).filter(Boolean);
      if (cols.length < 2 || cols[0].match(/^[-]+$/) || cols[0].toLowerCase() === 'field') continue;
      fields.push({
        name: cols[0],
        type: mapType(cols[1] || 'string'),
        required: cols[2] ? !cols[2].toLowerCase().includes('optional') : true,
        unique: cols.some(c => c.toLowerCase().includes('unique')),
        default: cols.find(c => c.toLowerCase().startsWith('default'))?.replace(/default[:\s]*/i, ''),
      });
    }

    // Parse field lists: - fieldName: type (required)
    const fieldLines = section.content.match(/^[-*]\s+(\w+)[:\s]+(.+)$/gm) || [];
    if (fields.length === 0) {
      for (const line of fieldLines) {
        const m = line.match(/^[-*]\s+(\w+)[:\s]+(\w+)(.*)$/);
        if (m) {
          fields.push({
            name: m[1],
            type: mapType(m[2]),
            required: !m[3]?.toLowerCase().includes('optional'),
          });
        }
      }
    }

    // Detect enums: status: "active" | "inactive" | "pending"
    for (const f of fields) {
      if (f.type.includes('|') || section.content.match(new RegExp(`${f.name}.*(?:"|')\\w+(?:"|')\\s*\\|`))) {
        const enumValues = section.content.match(new RegExp(`${f.name}[^\\n]*(?:"|')(\\w+)(?:"|')`, 'g'));
        if (enumValues && enumValues.length >= 2) {
          const values = enumValues.map(v => v.match(/(?:"|')(\w+)(?:"|')/)?.[1]).filter(Boolean) as string[];
          if (values.length >= 2) {
            enums.push({ name: `${tableName}${capitalize(f.name)}`, values });
            f.type = `${tableName}${capitalize(f.name)}`;
          }
        }
      }
    }

    if (fields.length > 0) {
      tables.push({ name: tableName, fields, primaryKey: fields.find(f => f.name === 'id')?.name || 'id' });
    }
  }

  return { tables, enums };
}

/**
 * Parse TRD/AppFlow for route definitions.
 */
function parseRoutes(trd: string | null, appflow: string | null): RouteDefinition[] {
  const routes: RouteDefinition[] = [];
  const content = (trd || '') + (appflow || '');

  // Match: GET /api/users → or | GET | /api/users | ...
  const patterns = [
    /(?:^|\|)\s*(GET|POST|PUT|PATCH|DELETE)\s+([/\w:{}[\]-]+)/gm,
    /\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|\s*([/\w:{}[\]-]+)\s*\|/gm,
  ];

  for (const re of patterns) {
    let m;
    while ((m = re.exec(content))) {
      const existing = routes.find(r => r.method === m![1] && r.path === m![2]);
      if (!existing) {
        routes.push({
          method: m[1],
          path: m[2],
          auth: content.includes('protected') || content.includes('auth') || m[2].includes('admin'),
          params: (m[2].match(/:(\w+)|\{(\w+)\}/g) || []).map(p => p.replace(/[:{}]/g, '')),
        });
      }
    }
  }

  return routes;
}

/**
 * Generate TypeScript type definitions from structured spec.
 */
export function generateTypes(spec: StructuredSpec): string {
  let output = `// Auto-generated by LoopSpec from Schema.md\n// DO NOT EDIT — regenerate with: loopspec spec types\n\n`;

  // Enums
  for (const e of spec.schema.enums) {
    output += `export type ${e.name} = ${e.values.map(v => `'${v}'`).join(' | ')};\n\n`;
  }

  // Table types
  for (const table of spec.schema.tables) {
    output += `export interface ${capitalize(table.name)} {\n`;
    for (const field of table.fields) {
      const optional = field.required ? '' : '?';
      output += `  ${field.name}${optional}: ${tsType(field.type)};\n`;
    }
    output += `}\n\n`;

    // Create input type (without id, createdAt, updatedAt)
    const inputFields = table.fields.filter(f => !['id', 'createdAt', 'updatedAt', 'created_at', 'updated_at'].includes(f.name));
    if (inputFields.length > 0) {
      output += `export interface Create${capitalize(table.name)}Input {\n`;
      for (const field of inputFields) {
        const optional = field.required ? '' : '?';
        output += `  ${field.name}${optional}: ${tsType(field.type)};\n`;
      }
      output += `}\n\n`;
    }
  }

  // Route types
  if (spec.routes.length > 0) {
    output += `// API Routes\n`;
    output += `export type ApiRoutes = {\n`;
    for (const route of spec.routes) {
      output += `  '${route.method} ${route.path}': { auth: ${route.auth}; params: [${route.params?.map(p => `'${p}'`).join(', ') || ''}] };\n`;
    }
    output += `};\n`;
  }

  return output;
}

/**
 * Build a complete structured spec from markdown files.
 */
export async function buildStructuredSpec(ctx: AppContext): Promise<StructuredSpec> {
  const schemaContent = await readFile(path.join(ctx.loopspecDir, 'Schema.md'));
  const trdContent = await readFile(path.join(ctx.loopspecDir, 'TRD.md'));
  const appflowContent = await readFile(path.join(ctx.loopspecDir, 'AppFlow.md'));
  const skillContent = await readFile(path.join(ctx.loopspecDir, 'SKILL.md'));

  const schema = schemaContent ? parseSchema(schemaContent) : { tables: [], enums: [] };
  const routes = parseRoutes(trdContent, appflowContent);
  const conventions = parseConventions(skillContent);

  const types: TypeDefinition[] = schema.tables.map(t => ({
    name: capitalize(t.name),
    fields: t.fields.map(f => ({ name: f.name, type: tsType(f.type), optional: !f.required })),
  }));

  const spec: StructuredSpec = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    schema,
    routes,
    types,
    conventions,
  };

  // Write structured output
  const outDir = path.join(ctx.loopspecDir, 'structured');
  await ensureDir(outDir);
  await writeFile(path.join(outDir, 'spec.json'), JSON.stringify(spec, null, 2));
  await writeFile(path.join(outDir, 'types.ts'), generateTypes(spec));

  return spec;
}

function parseConventions(skill: string | null): ConventionRule[] {
  if (!skill) return [];
  const rules: ConventionRule[] = [];
  const lines = skill.split('\n');

  for (const line of lines) {
    const never = line.match(/\*\*[Nn]ever\*\*\s+(.+)/);
    if (never) { rules.push({ id: `never-${rules.length}`, rule: never[1], severity: 'must' }); continue; }
    const always = line.match(/\*\*[Aa]lways\*\*\s+(.+)/);
    if (always) { rules.push({ id: `always-${rules.length}`, rule: always[1], severity: 'must' }); continue; }
    const prefer = line.match(/[Pp]refer\s+(.+)/);
    if (prefer) { rules.push({ id: `prefer-${rules.length}`, rule: prefer[1], severity: 'prefer' }); }
  }

  return rules;
}

function mapType(raw: string): string {
  const t = raw.toLowerCase().trim();
  if (t.includes('uuid') || t.includes('id')) return 'string';
  if (t.includes('int') || t.includes('number') || t.includes('decimal') || t.includes('float')) return 'number';
  if (t.includes('bool')) return 'boolean';
  if (t.includes('date') || t.includes('time')) return 'Date';
  if (t.includes('json') || t.includes('object')) return 'Record<string, unknown>';
  if (t.includes('array') || t.includes('[]')) return 'unknown[]';
  if (t.includes('text') || t.includes('string') || t.includes('varchar') || t.includes('char')) return 'string';
  return raw;
}

function tsType(type: string): string {
  switch (type) {
    case 'string': return 'string';
    case 'number': return 'number';
    case 'boolean': return 'boolean';
    case 'Date': return 'Date';
    case 'Record<string, unknown>': return 'Record<string, unknown>';
    default: return type;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
