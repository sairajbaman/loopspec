import path from 'node:path';
import fs from 'node:fs';
import type { AppContext } from '../../context.js';

export interface TestGateResult {
  missing: string[];
  found: string[];
  target: number;
  suggestions: string[];
}

const TEST_PATTERNS = [
  (file: string) => file.replace(/\.(ts|tsx|js|jsx)$/, '.test.$1'),
  (file: string) => file.replace(/\.(ts|tsx|js|jsx)$/, '.spec.$1'),
  (file: string) => {
    const dir = path.dirname(file);
    const base = path.basename(file).replace(/\.(ts|tsx|js|jsx)$/, '.test.$1');
    return path.join(dir, '__tests__', base);
  },
];

// Suggest test types based on file path patterns
function suggestTestTypes(file: string): string {
  const lower = file.toLowerCase();
  if (lower.includes('page') || lower.includes('route')) return 'unit: rendering, states, navigation';
  if (lower.includes('api') || lower.includes('route')) return 'integration: request/response, validation errors, auth';
  if (lower.includes('hook') || lower.includes('use')) return 'unit: hook behavior, edge cases';
  if (lower.includes('util') || lower.includes('lib') || lower.includes('helper')) return 'unit: pure function inputs/outputs';
  if (lower.includes('component')) return 'unit: render, props, interactions';
  return 'unit: core behavior, edge cases';
}

export async function checkTestGate(ctx: AppContext, changedFiles: string[], target = 70): Promise<TestGateResult> {
  const result: TestGateResult = { missing: [], found: [], target, suggestions: [] };

  for (const file of changedFiles) {
    // Skip test files themselves, configs, types
    if (file.includes('.test.') || file.includes('.spec.') || file.includes('__tests__')) continue;
    if (file.endsWith('.d.ts') || file.includes('config') || file.includes('.json')) continue;
    if (!file.match(/\.(ts|tsx|js|jsx)$/)) continue;

    const fullPath = path.resolve(ctx.projectDir, file);
    let hasTest = false;

    for (const pattern of TEST_PATTERNS) {
      const testPath = path.resolve(ctx.projectDir, pattern(file));
      if (fs.existsSync(testPath)) {
        hasTest = true;
        result.found.push(file);
        break;
      }
    }

    if (!hasTest) {
      const testType = suggestTestTypes(file);
      result.missing.push(file);
      result.suggestions.push(`${file} (${testType})`);
    }
  }

  return result;
}
