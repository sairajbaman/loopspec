#!/usr/bin/env node
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

// Import the spec engine directly
const { analyzeIdea } = await import('./src/engines/spec-engine/analyzer.js');
const { generateQuestions } = await import('./src/engines/spec-engine/questions.js');
const { generateSpec } = await import('./src/engines/spec-engine/generator.js');
const { loadStackPreset, stackPresetToContext, listAvailableStacks } = await import('./src/engines/spec-engine/stacks.js');

// ======== THE IDEA ========
const idea = "I want to build a marketplace where local artists can sell their original paintings, prints, and digital artwork directly to buyers. Artists should be able to create storefronts, upload their art with high-res images, set prices, and manage orders. Buyers can browse by category, search, leave reviews, and purchase securely. The platform takes a small commission on each sale.";

console.log('='.repeat(70));
console.log('LOOPSPEC SPEC ENGINE TEST');
console.log('='.repeat(70));
console.log(`\nIdea: "${idea}"\n`);

// Step 1: Analyze the idea
console.log('--- Step 1: Idea Analysis ---');
const analysis = analyzeIdea(idea);
console.log(JSON.stringify(analysis, null, 2));
console.log();

// Step 2: Generate questions (Vibe mode - 5 questions)
console.log('--- Step 2: Questions (Vibe Mode) ---');
const vibequestions = generateQuestions(analysis, 'vibe');
console.log(JSON.stringify(vibequestions, null, 2));
console.log();

// Step 3: Generate questions (Pro mode - 10 questions)
console.log('--- Step 2b: Questions (Pro Mode) ---');
const proQuestions = generateQuestions(analysis, 'pro');
console.log(JSON.stringify(proQuestions, null, 2));
console.log();

// Step 4: Create a mock context
const mockCtx = {
  projectDir: testDir,
  loopspecDir: testDir,
  db: null,
  getDb: async () => { throw new Error('no db'); },
  ensureLoopspecDir: async () => { await fs.mkdir(testDir, { recursive: true }); },
};

// Step 5: Load Next.js stack preset for stack DNA
console.log('--- Step 3: Stack Preset ---');
const preset = loadStackPreset('nextjs-supabase-shadcn');
const stackDna = preset ? stackPresetToContext(preset) : 'none';
console.log('Stack DNA loaded:', preset?.name || 'none');
console.log();

// Step 6: Generate the full spec with answers
console.log('--- Step 4: Generating 8 Spec Documents ---');
const answers = {
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

console.log(`\nGenerated ${Object.keys(result.documents).length} documents:\n`);

// Print all documents
for (const [filename, content] of Object.entries(result.documents)) {
  const lines = content.split('\n').length;
  const words = content.split(/\s+/).length;
  console.log(`  ✓ ${filename} (${lines} lines, ~${words} words)`);
}

console.log('\n' + '='.repeat(70));
console.log('DOCUMENT PREVIEWS');
console.log('='.repeat(70));

for (const [filename, content] of Object.entries(result.documents)) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`📄 ${filename}`);
  console.log(`${'─'.repeat(70)}`);
  
  // Show first 40 lines of each document
  const lines = content.split('\n');
  const preview = lines.slice(0, 40);
  console.log(preview.join('\n'));
  if (lines.length > 40) {
    console.log(`\n... [${lines.length - 40} more lines]`);
  }
}

// Save full output to files
await fs.mkdir(path.join(testDir, 'loopspec-generated'), { recursive: true });
for (const [filename, content] of Object.entries(result.documents)) {
  await fs.writeFile(path.join(testDir, 'loopspec-generated', filename), content);
}
await fs.writeFile(path.join(testDir, 'analysis.json'), JSON.stringify(result.analysis, null, 2));

console.log('\n' + '='.repeat(70));
console.log('✅ Full output saved to: loopspec-test-output/loopspec-generated/');
console.log('✅ Analysis saved to: loopspec-test-output/analysis.json');
console.log('='.repeat(70));
