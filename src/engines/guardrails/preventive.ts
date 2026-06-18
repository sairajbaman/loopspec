import path from 'node:path';
import fs from 'node:fs';
import type { AppContext } from '../../context.js';
import { readFile } from '../../utils/files.js';
import { parseMarkdownSections } from '../../utils/markdown.js';

export interface Violation {
  message: string;
  level: 'error' | 'warn';
  suggestion?: string;
  line?: number;
  pattern: string;
}

interface PreventiveRule {
  pattern: RegExp;
  message: string;
  level: 'error' | 'warn';
  suggestion?: string;
  category: string;
}

// Built-in rules (always active)
const BUILTIN_RULES: PreventiveRule[] = [
  { pattern: /:\s*any(?:\s|;|,|\)|$)/gm, message: 'No `any` types — use proper type or `unknown`', level: 'error', suggestion: 'Replace with specific type or `unknown`', category: 'type-safety' },
  { pattern: /@ts-ignore/g, message: '@ts-ignore suppresses type checking', level: 'warn', suggestion: 'Fix the type error or use @ts-expect-error with comment', category: 'type-safety' },
  { pattern: /console\.log\(/g, message: 'console.log in production code', level: 'warn', suggestion: 'Remove or replace with proper logger', category: 'code-quality' },
  { pattern: /export\s+default\s+function/gm, message: 'Default export detected', level: 'warn', suggestion: 'Use named export for better refactoring support', category: 'conventions' },
  { pattern: /onClick=\{[^}]*\}\s*(?:\/?>)\s*(?=.*<(?:div|span)\b)/gms, message: 'onClick on non-interactive element', level: 'warn', suggestion: 'Use <button> or add role + keyboard handler', category: 'accessibility' },
];

// File size threshold
const MAX_LINES = 500;

export async function detectPreventiveViolations(ctx: AppContext, relPath: string): Promise<Violation[]> {
  const fullPath = path.resolve(ctx.projectDir, relPath);
  let content: string;
  try {
    content = fs.readFileSync(fullPath, 'utf-8');
  } catch {
    return [];
  }

  const violations: Violation[] = [];

  // Load exceptions
  const exceptions = await loadExceptions(ctx);
  const fileExceptions = exceptions[relPath] || [];

  // Load SKILL.md conventions to derive dynamic rules
  const dynamicRules = await getDynamicRules(ctx);

  const allRules = [...BUILTIN_RULES, ...dynamicRules];

  for (const rule of allRules) {
    // Skip if excepted
    if (fileExceptions.includes(rule.category)) continue;

    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const line = content.slice(0, match.index).split('\n').length;
      violations.push({
        message: rule.message,
        level: rule.level,
        suggestion: rule.suggestion,
        line,
        pattern: rule.category,
      });
      // Only report first match per rule to avoid spam
      break;
    }
  }

  // File size check
  const lines = content.split('\n').length;
  if (lines > MAX_LINES) {
    violations.push({
      message: `File is ${lines} lines (>${MAX_LINES}). Consider splitting.`,
      level: 'warn',
      suggestion: 'Extract sub-components or utility functions',
      pattern: 'file-size',
    });
  }

  return violations;
}

async function getDynamicRules(ctx: AppContext): Promise<PreventiveRule[]> {
  const rules: PreventiveRule[] = [];
  const skill = await readFile(path.join(ctx.loopspecDir, 'SKILL.md'));
  if (!skill) return rules;

  // Extract conventions that map to patterns
  if (/named\s+export/i.test(skill) && !BUILTIN_RULES.some(r => r.category === 'conventions')) {
    // Already covered by builtin
  }
  if (/no\s+(?:inline\s+)?styles?/i.test(skill)) {
    rules.push({ pattern: /style=\{?\{/g, message: 'SKILL.md: No inline styles', level: 'warn', suggestion: 'Use Tailwind/CSS classes', category: 'conventions' });
  }
  if (/prefer.*server\s+component/i.test(skill)) {
    rules.push({ pattern: /['"]use client['"]/g, message: 'SKILL.md: Prefer server components', level: 'warn', suggestion: 'Move client logic to a child component', category: 'conventions' });
  }

  return rules;
}

async function loadExceptions(ctx: AppContext): Promise<Record<string, string[]>> {
  const exPath = path.join(ctx.loopspecDir, 'exceptions.json');
  const content = await readFile(exPath);
  if (!content) return {};
  try {
    return JSON.parse(content);
  } catch {
    return {};
  }
}
