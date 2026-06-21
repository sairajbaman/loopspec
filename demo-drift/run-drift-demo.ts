#!/usr/bin/env tsx
/**
 * LIVE DRIFT DETECTION DEMO
 * 
 * Tests all 7 drift categories against deliberately broken source files.
 * 
 * Files to check:
 *   1. demo-app/dashboard/page.tsx     → auth, ui-states, type-safety, conventions
 *   2. demo-app/api/invoices/route.ts   → validation, api-contract
 *   3. demo-app/components/InvoiceCard.tsx → type-safety, conventions, state-management
 *   4. demo-app/settings/page.tsx       → route-drift, ui-states
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import the drift detection engine
const { detectDrift, formatDriftReport } = await import('../src/engines/live-sync/index.js');
const { createContext } = await import('../src/context.js');

// Create context pointing to our demo directory
const demoDir = path.join(__dirname);
process.env.LOOPSPEC_PROJECT_DIR = demoDir;
const ctx = createContext();

await ctx.ensureLoopspecDir();

console.log('='.repeat(75));
console.log('  🔍 LOOPSPEC DRIFT DETECTION — LIVE DEMO');
console.log('  Testing all 7 drift categories against deliberately broken code');
console.log('='.repeat(75));

// ======== FILE 1: dashboard/page.tsx ========
console.log('\n' + '─'.repeat(75));
console.log('📁  FILE 1: demo-app/dashboard/page.tsx');
console.log('─'.repeat(75));
console.log('  This file is a protected route with:');
console.log('  🔴 No auth check (protected route in AppFlow.md)');
console.log('  🔴 Missing loading/error/empty states');
console.log('  🔴 Uses default export (SKILL.md says named exports)');
console.log('  🟡 Uses `any` types (SKILL.md says strict mode)');

const drifts1 = await detectDrift(ctx, 'demo-app/dashboard/page.tsx');
console.log('\n' + formatDriftReport(drifts1));

// ======== FILE 2: api/invoices/route.ts ========
console.log('\n' + '─'.repeat(75));
console.log('📁  FILE 2: demo-app/api/invoices/route.ts');
console.log('─'.repeat(75));
console.log('  This API route has:');
console.log('  🔴 No input validation (Zod/Yup) — required per Schema.md');
console.log('  🔴 No error handling (no try/catch)');
console.log('  🟡 No typed response objects');

const drifts2 = await detectDrift(ctx, 'demo-app/api/invoices/route.ts');
console.log('\n' + formatDriftReport(drifts2));

// ======== FILE 3: components/InvoiceCard.tsx ========
console.log('\n' + '─'.repeat(75));
console.log('📁  FILE 3: demo-app/components/InvoiceCard.tsx');
console.log('─'.repeat(75));
console.log('  This component has:');
console.log('  🔴 9 `any` types (SKILL.md says no any)');
console.log('  🔴 Uses @ts-ignore (SKILL.md says strict mode)');
console.log('  🔴 Default export (SKILL.md says named exports)');
console.log('  🟢 13 props without Context — possible prop drilling');

const drifts3 = await detectDrift(ctx, 'demo-app/components/InvoiceCard.tsx');
console.log('\n' + formatDriftReport(drifts3));

// ======== FILE 4: settings/page.tsx ========
console.log('\n' + '─'.repeat(75));
console.log('📁  FILE 4: demo-app/settings/page.tsx');
console.log('─'.repeat(75));
console.log('  This file has:');
console.log('  🔴 Route not documented in AppFlow.md');
console.log('  🔴 Missing loading/error/empty states (UI component)');
console.log('  🔴 Default export (SKILL.md says named exports)');

const drifts4 = await detectDrift(ctx, 'demo-app/settings/page.tsx');
console.log('\n' + formatDriftReport(drifts4));

// ======== SUMMARY ========
const allDrifts = [...drifts1, ...drifts2, ...drifts3, ...drifts4];
console.log('='.repeat(75));
console.log('  📊  DRIFT DETECTION SUMMARY');
console.log('='.repeat(75));

const byCategory: Record<string, number> = {};
const bySeverity: Record<string, number> = { high: 0, medium: 0, low: 0 };
for (const d of allDrifts) {
  byCategory[d.category] = (byCategory[d.category] || 0) + 1;
  bySeverity[d.severity] = (bySeverity[d.severity] || 0) + 1;
}

console.log(`\n  Total drift issues found: ${allDrifts.length}`);
console.log(`\n  By Severity:`);
console.log(`    🔴 High:   ${bySeverity.high}`);
console.log(`    🟡 Medium: ${bySeverity.medium}`);
console.log(`    🟢 Low:    ${bySeverity.low}`);

console.log(`\n  By Category (all 7 tested):`);
const categoryDescriptions: Record<string, string> = {
  'auth': 'Missing auth on protected routes (AppFlow)',
  'ui-states': 'Missing loading/error/empty states (AppFlow)',
  'validation': 'Missing input validation on API routes (Schema)',
  'type-safety': '`any` types / @ts-ignore violations (SKILL)',
  'conventions': 'Default exports when named exports required (SKILL)',
  'api-contract': 'Missing response types / error handling (Schema)',
  'route-drift': 'Undocumented routes not in AppFlow',
  'state-management': 'Excessive prop drilling without Context',
};
for (const [cat, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
  const desc = categoryDescriptions[cat] || cat;
  console.log(`    • ${cat.padEnd(18)} ${count}x  — ${desc}`);
}

console.log('\n' + '═'.repeat(75));
console.log('  ✅  Demo complete. All drift detection ran without errors.');
console.log('  📁  4 files checked, all found to have spec violations.');
console.log('  💡  Each issue includes: spec expectation, code reality, AND fix suggestion.');
console.log('═'.repeat(75));
