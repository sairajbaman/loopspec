import path from 'node:path';
import fs from 'node:fs';
import type { AppContext } from '../../context.js';
import { readFile } from '../../utils/files.js';
import { parseMarkdownSections } from '../../utils/markdown.js';

export interface Prediction {
  category: string;
  label: string;
  patterns: string[];
  confidence: number; // 0-100 after comparison
}

export interface PredictionResult {
  task: string;
  predictions: Prediction[];
  score: number;
  summary: string;
}

const RULES: Record<string, { category: string; label: string; patterns: string[] }[]> = {
  form: [
    { category: 'fields', label: 'Form fields (inputs)', patterns: ['<input|<Input|<select|<textarea|FormField|TextField'] },
    { category: 'validation', label: 'Validation rules (Zod/schema)', patterns: ['z\\.|schema|validate|required|safeParse'] },
    { category: 'loading', label: 'Loading/submitting state', patterns: ['loading|isLoading|isPending|submitting|disabled'] },
    { category: 'error', label: 'Error display', patterns: ['error|isError|formState\\.errors|invalid|message'] },
    { category: 'success', label: 'Success handling/redirect', patterns: ['success|onSuccess|redirect|toast|router\\.push'] },
    { category: 'submit', label: 'Submit handler + API call', patterns: ['onSubmit|handleSubmit|action|fetch\\(|POST|mutation'] },
    { category: 'a11y', label: 'Accessibility (labels/aria)', patterns: ['label|aria-|htmlFor|role='] },
  ],
  payment: [
    { category: 'fields', label: 'Payment fields (card/amount)', patterns: ['card|cardNumber|expiry|cvc|cvv|amount|currency'] },
    { category: 'validation', label: 'Card validation', patterns: ['luhn|cardValid|expiry.*valid|cvc.*\\d{3}|format'] },
    { category: 'security', label: 'PCI compliance (tokenize/Elements)', patterns: ['stripe|Elements|tokenize|encrypt|pci|PaymentElement'] },
    { category: 'errors', label: 'Payment error handling', patterns: ['declined|insufficient|expired|invalid.*card|catch'] },
    { category: 'confirm', label: 'Confirmation/receipt', patterns: ['confirm|receipt|success|redirect|thank'] },
  ],
  webhook: [
    { category: 'verify', label: 'Signature verification', patterns: ['signature|verify|constructEvent|hmac|hash|crypto'] },
    { category: 'idempotency', label: 'Idempotency/duplicate check', patterns: ['idempotent|duplicate|processed|eventId|already'] },
    { category: 'routing', label: 'Event type routing', patterns: ['switch|event\\.type|case|eventType|handler'] },
    { category: 'response', label: 'Quick 200 response', patterns: ['200|status|ok|acknowledge|received|json\\('] },
    { category: 'async', label: 'Async processing (don\'t block)', patterns: ['queue|background|async|setTimeout|after.*respond'] },
  ],
  api: [
    { category: 'auth', label: 'Authentication check', patterns: ['getSession|auth\\(|requireAuth|middleware|token|getUser'] },
    { category: 'validation', label: 'Input validation', patterns: ['z\\.|schema|safeParse|validate|body|params'] },
    { category: 'errors', label: 'Error handling (try/catch)', patterns: ['try|catch|throw|Error|status\\(4|status\\(5'] },
    { category: 'response', label: 'Structured response', patterns: ['return.*json|Response|NextResponse|status\\(2|res\\.'] },
    { category: 'types', label: 'Type safety', patterns: ['interface|type\\s+\\w+|z\\.infer|as\\s+\\w+'] },
  ],
  auth: [
    { category: 'hash', label: 'Password hashing (bcrypt/argon2)', patterns: ['bcrypt|argon2|hash|scrypt|salt|compare'] },
    { category: 'session', label: 'Session/token management', patterns: ['session|cookie|jwt|token|setSession|createSession'] },
    { category: 'validation', label: 'Input validation (email/password)', patterns: ['email|password.*length|z\\.string|min\\(|validate'] },
    { category: 'rate', label: 'Rate limiting / brute force protection', patterns: ['rate|limit|attempts|lockout|throttle|brute'] },
    { category: 'errors', label: 'Auth error responses', patterns: ['invalid.*credentials|unauthorized|401|forbidden|403'] },
  ],
  page: [
    { category: 'loading', label: 'Loading UI (skeleton/spinner)', patterns: ['loading|Skeleton|Spinner|Suspense|isPending'] },
    { category: 'error', label: 'Error boundary/display', patterns: ['error|ErrorBoundary|error\\.tsx|catch|fallback'] },
    { category: 'empty', label: 'Empty state', patterns: ['empty|no.*found|length.*0|isEmpty|nothing'] },
    { category: 'seo', label: 'SEO metadata', patterns: ['metadata|title|description|generateMetadata|Head|og:'] },
    { category: 'a11y', label: 'Accessibility', patterns: ['aria-|role=|alt=|sr-only|semantic|heading'] },
  ],
  crud: [
    { category: 'create', label: 'Create operation (POST)', patterns: ['POST|create|insert|add|new'] },
    { category: 'read', label: 'Read operations (GET list+detail)', patterns: ['GET|findMany|findAll|list|getById|findOne'] },
    { category: 'update', label: 'Update operation (PUT/PATCH)', patterns: ['PUT|PATCH|update|save|edit'] },
    { category: 'delete', label: 'Delete operation (DELETE)', patterns: ['DELETE|delete|remove|destroy'] },
    { category: 'validation', label: 'Input validation per operation', patterns: ['z\\.|validate|schema|safeParse'] },
  ],
};

export async function predict(ctx: AppContext, task: string): Promise<string[]> {
  const lower = task.toLowerCase();
  const expectations: string[] = [];

  for (const [keyword, rules] of Object.entries(RULES)) {
    if (lower.includes(keyword)) {
      for (const rule of rules) expectations.push(rule.label);
    }
  }

  // Enrich from Schema.md
  const schema = await readFile(path.join(ctx.loopspecDir, 'Schema.md'));
  if (schema) {
    const sections = parseMarkdownSections(schema);
    for (const s of sections) {
      if (task.split(/\s+/).some(w => s.heading.toLowerCase().includes(w.toLowerCase()))) {
        const fields = s.content.match(/\|\s*(\w+)\s*\|/g)?.map(f => f.replace(/\|/g, '').trim()).filter(f => f && f !== 'Field' && !f.startsWith('-'));
        if (fields?.length) expectations.push(`Expected fields from spec: ${fields.join(', ')}`);
      }
    }
  }

  if (expectations.length === 0) {
    expectations.push('Implementation complete', 'Error handling', 'Type safety', 'Tests');
  }

  return expectations;
}

export async function compareWithPredictions(ctx: AppContext, task: string, files: string[]): Promise<PredictionResult> {
  const lower = task.toLowerCase();
  const predictions: Prediction[] = [];

  let allContent = '';
  for (const f of files) {
    try { allContent += fs.readFileSync(path.resolve(ctx.projectDir, f), 'utf-8') + '\n'; } catch {}
  }

  for (const [keyword, rules] of Object.entries(RULES)) {
    if (!lower.includes(keyword)) continue;
    for (const rule of rules) {
      let matched = 0;
      for (const p of rule.patterns) {
        try { if (new RegExp(p, 'i').test(allContent)) matched++; } catch {}
      }
      predictions.push({
        category: rule.category,
        label: rule.label,
        patterns: rule.patterns,
        confidence: Math.round((matched / rule.patterns.length) * 100),
      });
    }
  }

  const total = predictions.length || 1;
  const satisfied = predictions.filter(p => p.confidence > 0).length;
  const score = Math.round((satisfied / total) * 100);

  const missing = predictions.filter(p => p.confidence === 0).map(p => p.label);
  const summary = missing.length === 0
    ? `✓ All ${total} predicted requirements satisfied.`
    : `${satisfied}/${total} predictions met. Missing:\n${missing.map(m => `  • ${m}`).join('\n')}`;

  return { task, predictions, score, summary };
}

export function formatExpectations(expectations: string[], task: string): string {
  let text = `## Predictions for: "${task}"\n\nBefore coding, these are expected:\n\n`;
  text += expectations.map(e => `  ○ ${e}`).join('\n');
  text += `\n\nAfter writing code, use loopspec_predict action:"compare" to verify completeness.`;
  return text;
}

export function formatComparison(result: PredictionResult): string {
  let text = `## Prediction vs Reality: "${result.task}"\n\nCompleteness: ${result.score}/100\n\n`;
  for (const p of result.predictions) {
    text += `  ${p.confidence > 0 ? '✓' : '✗'} ${p.label} (${p.confidence}%)\n`;
  }
  text += `\n${result.summary}`;
  return text;
}
