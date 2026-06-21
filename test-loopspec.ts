#!/usr/bin/env tsx
/**
 * Test LoopSpec spec engine with a real idea
 * Generates all 8 documents + shows the analysis result
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create a test output directory
const testDir = path.join(__dirname, 'loopspec-test-output');
await fs.mkdir(testDir, { recursive: true });

// Import the spec engine directly from TS source
const { analyzeIdea } = await import('./src/engines/spec-engine/analyzer.js');
const { generateQuestions } = await import('./src/engines/spec-engine/questions.js');
const { generateSpec } = await import('./src/engines/spec-engine/generator.js');
const { loadStackPreset, stackPresetToContext } = await import('./src/engines/spec-engine/stacks.js');

// ======== THE IDEA ========
const idea = "I want to build a marketplace where local artists can sell their original paintings, prints, and digital artwork directly to buyers. Artists should be able to create storefronts, upload their art with high-res images, set prices, and manage orders. Buyers can browse by category, search, leave reviews, and purchase securely. The platform takes a small commission on each sale.";

console.log('='.repeat(70));
console.log('LOOPSPEC SPEC ENGINE TEST - Art Marketplace Idea');
console.log('='.repeat(70));
console.log(`\nIdea: "${idea}"\n`);

// Step 1: Analyze the idea
console.log('--- Step 1: Idea Analysis ---');
const analysis = analyzeIdea(idea);
console.log(`  Product Type: ${analysis.productType}`);
console.log(`  Industry: ${analysis.industry} (confidence: ${analysis.confidence.industry})`);
console.log(`  Complexity: ${analysis.complexity} (confidence: ${analysis.confidence.complexity})`);
console.log(`  Target User: ${analysis.targetUser}`);
console.log(`  Implied Stack: ${analysis.impliedStack || 'none'}`);
console.log(`  Keywords: ${analysis.keywords.slice(0, 8).join(', ')}`);
console.log(`  Features: ${analysis.features.slice(0, 5).join(', ')}`);
console.log();

// Step 2: Generate questions (Pro mode - 10 questions)
console.log('--- Step 2: Clarifying Questions (Pro Mode) ---');
const proQuestions = generateQuestions(analysis, 'pro');
proQuestions.forEach((q, i) => {
  console.log(`  ${i+1}. [${q.id}] ${q.text}`);
  if (q.options) console.log(`     Options: ${q.options.join(', ')}`);
  if (q.default) console.log(`     Default: ${q.default}`);
});
console.log();

// Step 3: Create a mock context
const mockCtx = {
  projectDir: testDir,
  loopspecDir: testDir,
  db: null,
  getDb: async () => { throw new Error('no db'); },
  ensureLoopspecDir: async () => { await fs.mkdir(testDir, { recursive: true }); },
};

// Step 4: Load stack preset
console.log('--- Step 3: Stack Preset ---');
const preset = loadStackPreset('nextjs-supabase-shadcn');
const stackDna = preset ? stackPresetToContext(preset!) : '';
console.log(`  Loaded: ${preset?.name || 'none'}`);
console.log();

// Step 5: Generate the full spec with answers
console.log('--- Step 4: Generating 8 Spec Documents ---');
const answers: Record<string, string> = {
  target_user: 'local artists and art buyers',
  core_feature: 'art marketplace with storefronts and secure purchasing',
  auth: 'email/password',
  monetization: 'commission on sales',
  design_vibe: 'creative, vibrant, gallery-like',
  stack: 'nextjs-supabase-shadcn',
  hosting: 'Vercel',
  scale: '100-1000',
  realtime: 'true',
  third_party: 'Stripe payments, image optimization',
};

const result = await generateSpec(mockCtx, idea, 'pro', answers, stackDna);

const docStats: Record<string, { lines: number; words: number; chars: number; deterministic: boolean }> = {};

// Determine which documents are mostly deterministic vs AI prompts
const deterministicDocs = ['Schema.md', 'AppFlow.md', 'TRD.md'];

for (const [filename, content] of Object.entries(result.documents!)) {
  const lines = content.split('\n').length;
  const words = content.split(/\s+/).length;
  const chars = content.length;
  docStats[filename] = {
    lines, words, chars,
    deterministic: deterministicDocs.some(d => filename.includes(d))
  };
}

console.log(`\n  Generated ${Object.keys(result.documents!).length} documents:\n`);
for (const [filename, stats] of Object.entries(docStats)) {
  const icon = stats.deterministic ? '⚙️' : '📝';
  console.log(`  ${icon} ${filename.padEnd(20)} ${stats.lines} lines, ${stats.words} words, ${stats.chars} chars`);
}

const totalWords = Object.values(docStats).reduce((s, d) => s + d.words, 0);
const totalChars = Object.values(docStats).reduce((s, d) => s + d.chars, 0);
console.log(`\n  TOTAL: ${totalWords} words, ${totalChars} characters across ${Object.keys(result.documents!).length} documents`);

// Save full output to files
const outDir = path.join(testDir, 'loopspec-generated');
await fs.mkdir(outDir, { recursive: true });
for (const [filename, content] of Object.entries(result.documents!)) {
  await fs.writeFile(path.join(outDir, filename), content);
}
await fs.writeFile(path.join(testDir, 'analysis.json'), JSON.stringify(result.analysis, null, 2));
await fs.writeFile(path.join(testDir, 'stats.json'), JSON.stringify(docStats, null, 2));

console.log('\n' + '='.repeat(70));
console.log('✅ Full output saved to: loopspec-test-output/loopspec-generated/');
console.log('   Open those files to see the complete documents.');
console.log('='.repeat(70));
