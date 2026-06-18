import path from 'node:path';
import type { AppContext } from '../../context.js';
import { readFile } from '../../utils/files.js';
import { parseMarkdownSections } from '../../utils/markdown.js';

export interface Injection {
  trigger: string; // what context triggers this
  content: string; // the injected spec data
  source: string;  // which spec doc it came from
}

export async function generateInjections(ctx: AppContext): Promise<Injection[]> {
  const injections: Injection[] = [];

  // 1. From Schema.md — extract table fields → Zod schemas + API signatures
  const schema = await readFile(path.join(ctx.loopspecDir, 'Schema.md'));
  if (schema) {
    injections.push(...extractSchemaInjections(schema));
  }

  // 2. From AppFlow.md — extract routes → auth/states requirements
  const flow = await readFile(path.join(ctx.loopspecDir, 'AppFlow.md'));
  if (flow) {
    injections.push(...extractFlowInjections(flow));
  }

  // 3. From SKILL.md — extract conventions as inline comments
  const skill = await readFile(path.join(ctx.loopspecDir, 'SKILL.md'));
  if (skill) {
    injections.push(...extractSkillInjections(skill));
  }

  return injections;
}

export function matchInjections(injections: Injection[], context: { file: string; content: string }): Injection[] {
  const matches: Injection[] = [];
  const lower = context.content.toLowerCase() + ' ' + context.file.toLowerCase();

  for (const inj of injections) {
    const triggers = inj.trigger.toLowerCase().split('|');
    if (triggers.some(t => lower.includes(t))) {
      matches.push(inj);
    }
  }

  return matches.slice(0, 5); // cap at 5 injections
}

function extractSchemaInjections(schema: string): Injection[] {
  const injections: Injection[] = [];
  const sections = parseMarkdownSections(schema);

  for (const section of sections) {
    // Extract table definitions → generate Zod schema suggestions
    const tableMatch = section.heading.match(/Table:\s*`?(\w+)`?/i);
    if (tableMatch) {
      const tableName = tableMatch[1];
      const fields = extractTableFields(section.content);
      if (fields.length > 0) {
        const zodSchema = fields.map(f => `  ${f.name}: ${fieldToZod(f)},`).join('\n');
        injections.push({
          trigger: `${tableName}|${tableName}Schema|${tableName}Input`,
          content: `// From Schema.md — ${tableName} validation\nconst ${tableName}Schema = z.object({\n${zodSchema}\n});`,
          source: 'Schema.md',
        });

        // TypeScript interface
        const tsFields = fields.map(f => `  ${f.name}: ${fieldToTs(f)};`).join('\n');
        injections.push({
          trigger: `${tableName}|interface ${tableName}|type ${tableName}`,
          content: `// From Schema.md\ninterface ${capitalize(tableName)} {\n${tsFields}\n}`,
          source: 'Schema.md',
        });
      }
    }

    // Extract API endpoints → generate route handler signatures
    const apiRows = section.content.match(/\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|\s*`?([^|`]+)`?\s*\|\s*([^|]*)\|\s*([^|]*)\|/gi);
    if (apiRows) {
      for (const row of apiRows) {
        const parts = row.split('|').map(p => p.trim()).filter(Boolean);
        if (parts.length >= 3) {
          const method = parts[0].toUpperCase();
          const endpoint = parts[1].replace(/`/g, '');
          const auth = parts[2]?.includes('✓') ? 'required' : 'none';
          injections.push({
            trigger: `${endpoint}|${method.toLowerCase()} ${endpoint}`,
            content: `// ${method} ${endpoint}\n// Auth: ${auth}\n// From Schema.md`,
            source: 'Schema.md',
          });
        }
      }
    }
  }

  return injections;
}

function extractFlowInjections(flow: string): Injection[] {
  const injections: Injection[] = [];
  const sections = parseMarkdownSections(flow);

  for (const section of sections) {
    // Extract screen/page requirements
    const statesMatch = section.content.match(/States?:\s*\[?([^\]\n]+)/i);
    const authMatch = section.content.match(/Auth:\s*(\w+)/i);
    const routeMatch = section.content.match(/Route:\s*([^\n]+)/i);

    if (statesMatch || authMatch || routeMatch) {
      const trigger = section.heading.toLowerCase().replace(/[^a-z0-9]/g, '');
      let content = `// From AppFlow.md — ${section.heading}\n`;
      if (authMatch) content += `// Auth: ${authMatch[1]}\n`;
      if (statesMatch) content += `// Required states: ${statesMatch[1]}\n`;
      if (routeMatch) content += `// Route: ${routeMatch[1]}\n`;

      injections.push({ trigger: trigger + '|' + section.heading.toLowerCase(), content, source: 'AppFlow.md' });
    }
  }

  return injections;
}

function extractSkillInjections(skill: string): Injection[] {
  const injections: Injection[] = [];
  const sections = parseMarkdownSections(skill);

  const convSection = sections.find(s => s.heading.toLowerCase().includes('convention'));
  if (convSection) {
    const rules = convSection.content.split('\n').filter(l => l.startsWith('-')).map(l => l.slice(1).trim());
    if (rules.length > 0) {
      injections.push({
        trigger: 'new file|create|export|function|component',
        content: `// SKILL.md conventions:\n${rules.slice(0, 5).map(r => `// - ${r}`).join('\n')}`,
        source: 'SKILL.md',
      });
    }
  }

  return injections;
}

interface TableField { name: string; type: string; constraints: string; }

function extractTableFields(content: string): TableField[] {
  const fields: TableField[] = [];
  const rows = content.match(/\|\s*(\w+)\s*\|\s*(\w+[^|]*)\|\s*([^|]*)\|/g);
  if (!rows) return fields;
  for (const row of rows) {
    const parts = row.split('|').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 3 && parts[0] !== 'Field' && parts[0] !== '---') {
      fields.push({ name: parts[0], type: parts[1], constraints: parts[2] || '' });
    }
  }
  return fields;
}

function fieldToZod(f: TableField): string {
  const t = f.type.toLowerCase();
  if (t.includes('uuid')) return 'z.string().uuid()';
  if (t.includes('text') || t.includes('varchar')) return f.constraints.includes('NOT NULL') ? 'z.string().min(1)' : 'z.string().optional()';
  if (t.includes('numeric') || t.includes('int') || t.includes('decimal')) return 'z.number()';
  if (t.includes('bool')) return 'z.boolean()';
  if (t.includes('date') || t.includes('timestamp')) return 'z.string().datetime()';
  if (t.includes('json')) return 'z.record(z.unknown())';
  return 'z.string()';
}

function fieldToTs(f: TableField): string {
  const t = f.type.toLowerCase();
  if (t.includes('uuid') || t.includes('text') || t.includes('varchar') || t.includes('date')) return 'string';
  if (t.includes('numeric') || t.includes('int') || t.includes('decimal')) return 'number';
  if (t.includes('bool')) return 'boolean';
  if (t.includes('json')) return 'Record<string, unknown>';
  return 'string';
}

function capitalize(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
