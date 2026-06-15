import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { searchPlaybook } from '../engines/memory/index.js';
import { STACK_PRESETS } from '../engines/spec-engine/stacks-data.js';
import { getTopPatterns } from '../engines/memory/bayesian.js';

/**
 * Industry-standard patterns that LoopSpec "knows" from aggregated best practices.
 * These simulate cross-project learning until real telemetry exists.
 */
const INDUSTRY_PATTERNS: Record<string, { pattern: string; confidence: number; source: string }[]> = {
  fintech: [
    { pattern: 'Always use row-level security (RLS) for multi-tenant data isolation', confidence: 0.95, source: 'Common across 90%+ of fintech projects' },
    { pattern: 'Rate limit auth endpoints (max 5 attempts per minute per IP)', confidence: 0.92, source: 'OWASP + PCI-DSS compliance' },
    { pattern: 'Use decimal/bigint for money — never floating point', confidence: 0.98, source: 'IEEE 754 rounding errors break financial calculations' },
    { pattern: 'Audit log every write operation on financial data', confidence: 0.88, source: 'Regulatory compliance requirement' },
    { pattern: 'Implement idempotency keys for payment endpoints', confidence: 0.90, source: 'Stripe, PayPal, every payment processor requires this' },
  ],
  healthcare: [
    { pattern: 'Encrypt all PII at rest and in transit (AES-256 + TLS 1.3)', confidence: 0.97, source: 'HIPAA requirement' },
    { pattern: 'Implement audit trails for all patient data access', confidence: 0.95, source: 'HIPAA audit requirement' },
    { pattern: 'Session timeout after 15 minutes of inactivity', confidence: 0.88, source: 'HIPAA security rule' },
    { pattern: 'Never log patient identifiers in application logs', confidence: 0.94, source: 'PHI exposure prevention' },
    { pattern: 'Role-based access: doctors vs nurses vs admin vs patient', confidence: 0.91, source: 'Minimum necessary principle' },
  ],
  ecommerce: [
    { pattern: 'Implement optimistic inventory locking for checkout', confidence: 0.87, source: 'Prevents overselling at scale' },
    { pattern: 'Cache product catalog aggressively (CDN + stale-while-revalidate)', confidence: 0.90, source: 'Performance critical for conversion' },
    { pattern: 'Never store full credit card numbers — use tokenization (Stripe/Braintree)', confidence: 0.99, source: 'PCI-DSS compliance' },
    { pattern: 'Implement abandoned cart recovery with email triggers', confidence: 0.82, source: '10-15% revenue recovery typical' },
    { pattern: 'A/B test checkout flow changes before full rollout', confidence: 0.85, source: 'Checkout is too revenue-critical for guessing' },
  ],
  saas: [
    { pattern: 'Multi-tenant architecture from day 1 — never retrofit', confidence: 0.93, source: 'Retrofitting multi-tenancy is 10x harder than building it in' },
    { pattern: 'Feature flags for gradual rollouts (LaunchDarkly/Unleash pattern)', confidence: 0.88, source: 'De-risks deployments' },
    { pattern: 'Implement usage-based metering if on consumption pricing', confidence: 0.80, source: 'Required for accurate billing' },
    { pattern: 'Webhook delivery with retry and exponential backoff', confidence: 0.91, source: 'Integration reliability' },
    { pattern: 'Health check endpoint at /api/health for monitoring', confidence: 0.95, source: 'Universal SaaS requirement' },
  ],
  education: [
    { pattern: 'Track progress with granular completion states (not just pass/fail)', confidence: 0.86, source: 'Learner motivation through progress visibility' },
    { pattern: 'Support offline-first for mobile learning scenarios', confidence: 0.78, source: 'Connectivity issues in education contexts' },
    { pattern: 'COPPA compliance if targeting under-13 users', confidence: 0.95, source: 'Legal requirement (US)' },
    { pattern: 'Implement spaced repetition for retention features', confidence: 0.82, source: 'Evidence-based learning science' },
  ],
  social: [
    { pattern: 'Implement content moderation pipeline (auto + human review)', confidence: 0.92, source: 'Legal liability + platform health' },
    { pattern: 'Rate limit posting endpoints aggressively (anti-spam)', confidence: 0.90, source: 'Spam prevention essential from day 1' },
    { pattern: 'Implement block/mute at the database level, not just UI', confidence: 0.88, source: 'Security boundary, not just UX' },
    { pattern: 'Paginate feeds with cursor-based pagination (not offset)', confidence: 0.91, source: 'Offset breaks with real-time inserts' },
  ],
};

export function registerInferTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_infer', {
    title: 'Cross-Project Pattern Inference',
    description: 'Get recommended patterns based on your industry + stack. Combines industry best practices with patterns learned from your other projects.',
    inputSchema: z.object({
      industry: z.string().optional().describe('Industry (fintech, healthcare, ecommerce, saas, education, social)'),
      stack: z.string().optional().describe('Stack name (for stack-specific recommendations)'),
      topic: z.string().optional().describe('Specific topic to focus on (e.g. "auth", "payments", "caching")'),
    }),
  }, async (args) => {
    const { industry, stack, topic } = args as { industry?: string; stack?: string; topic?: string };

    const sections: string[] = [];

    // 1. Industry patterns
    if (industry && INDUSTRY_PATTERNS[industry]) {
      const patterns = INDUSTRY_PATTERNS[industry];
      const filtered = topic ? patterns.filter((p) => p.pattern.toLowerCase().includes(topic.toLowerCase())) : patterns;
      if (filtered.length > 0) {
        sections.push(`## 🏭 Industry Patterns: ${industry}\n\n${filtered.map((p, i) => `${i + 1}. **${p.pattern}**\n   Confidence: ${(p.confidence * 100).toFixed(0)}% | Source: ${p.source}`).join('\n\n')}`);
      }
    }

    // 2. Stack-specific anti-patterns
    if (stack && STACK_PRESETS[stack]) {
      const preset = STACK_PRESETS[stack];
      sections.push(`## 🧬 Stack DNA: ${preset.name}\n\n**Anti-patterns to avoid:**\n${preset.anti_patterns.map((a) => `- ❌ ${a}`).join('\n')}\n\n**Key patterns:**\n${Object.entries(preset.patterns).map(([k, v]) => `- **${k}:** ${v}`).join('\n')}`);
    }

    // 3. Cross-project playbook matches
    const playbookTopic = topic || industry || 'general';
    const playbook = await searchPlaybook(playbookTopic, 5);
    if (playbook.length > 0) {
      sections.push(`## 📚 From Your Playbook\n\nPatterns learned from your other projects:\n${playbook.map((p, i) => `${i + 1}. [${p.category}] ${p.pattern} (confidence: ${(p.confidence * 100).toFixed(0)}%)`).join('\n')}`);
    }

    // 4. Project memory (Bayesian top patterns)
    try {
      const topLocal = await getTopPatterns(ctx, undefined, 5);
      if (topLocal.length > 0) {
        sections.push(`## 🧠 This Project's Top Patterns\n\n${topLocal.map((p, i) => `${i + 1}. [${p.category}] ${p.pattern} (Bayesian: ${(p.confidence * 100).toFixed(0)}%)`).join('\n')}`);
      }
    } catch {}

    if (sections.length === 0) {
      return { content: [{ type: 'text' as const, text: 'Provide an industry, stack, or topic to get pattern recommendations.' }] };
    }

    return {
      content: [{
        type: 'text' as const,
        text: `## 🎯 Pattern Recommendations\n\n${sections.join('\n\n---\n\n')}\n\n---\n_Apply these patterns early. Use \`loopspec_compound\` to record which ones you adopt._`,
      }],
    };
  });
}
