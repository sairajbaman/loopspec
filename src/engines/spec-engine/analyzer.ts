export interface ProjectAnalysis {
  productType: string;
  targetUser: string;
  industry: string;
  impliedStack: string | null;
  complexity: 'simple' | 'medium' | 'complex';
  keywords: string[];
  features: string[];
  confidence: { industry: number; complexity: number };
}

const INDUSTRY_SIGNALS: Record<string, { keywords: string[]; weight: number }[]> = {
  fintech: [
    { keywords: ['invoice', 'payment', 'billing', 'transaction'], weight: 3 },
    { keywords: ['finance', 'wallet', 'crypto', 'trading', 'bank'], weight: 2 },
    { keywords: ['money', 'revenue', 'subscription', 'pricing', 'stripe'], weight: 1 },
  ],
  healthcare: [
    { keywords: ['patient', 'doctor', 'appointment', 'medical', 'clinic'], weight: 3 },
    { keywords: ['health', 'hospital', 'diagnosis', 'prescription', 'ehr'], weight: 2 },
    { keywords: ['wellness', 'therapy', 'telehealth', 'records'], weight: 1 },
  ],
  ecommerce: [
    { keywords: ['shop', 'cart', 'checkout', 'product', 'order'], weight: 3 },
    { keywords: ['store', 'marketplace', 'catalog', 'inventory', 'shipping'], weight: 2 },
    { keywords: ['seller', 'buyer', 'listing', 'review', 'wishlist'], weight: 1 },
  ],
  education: [
    { keywords: ['course', 'student', 'lesson', 'quiz', 'enrollment'], weight: 3 },
    { keywords: ['learn', 'teacher', 'classroom', 'grade', 'lms'], weight: 2 },
    { keywords: ['school', 'tutorial', 'progress', 'certificate'], weight: 1 },
  ],
  saas: [
    { keywords: ['dashboard', 'analytics', 'saas', 'multi-tenant'], weight: 3 },
    { keywords: ['subscription', 'workspace', 'team', 'organization'], weight: 2 },
    { keywords: ['platform', 'tool', 'integration', 'api', 'webhook'], weight: 1 },
  ],
  social: [
    { keywords: ['social', 'chat', 'message', 'feed', 'post', 'comment'], weight: 3 },
    { keywords: ['community', 'follow', 'like', 'share', 'notification'], weight: 2 },
    { keywords: ['profile', 'friend', 'group', 'content'], weight: 1 },
  ],
  productivity: [
    { keywords: ['task', 'project', 'kanban', 'workflow', 'automation'], weight: 3 },
    { keywords: ['schedule', 'calendar', 'reminder', 'deadline', 'sprint'], weight: 2 },
    { keywords: ['collaborate', 'assign', 'priority', 'board', 'backlog'], weight: 1 },
  ],
};

const PRODUCT_TYPES: Record<string, { keywords: string[]; weight: number }[]> = {
  'web-app': [
    { keywords: ['app', 'platform', 'dashboard', 'portal', 'tool'], weight: 2 },
    { keywords: ['system', 'solution', 'manage', 'track'], weight: 1 },
  ],
  'mobile-app': [
    { keywords: ['mobile', 'ios', 'android', 'native', 'phone'], weight: 3 },
    { keywords: ['push notification', 'offline', 'gesture'], weight: 2 },
  ],
  'api': [
    { keywords: ['api', 'backend', 'service', 'microservice', 'endpoint'], weight: 3 },
    { keywords: ['rest', 'graphql', 'webhook', 'integration'], weight: 2 },
  ],
  'marketplace': [
    { keywords: ['marketplace', 'two-sided', 'matching', 'connect'], weight: 3 },
    { keywords: ['buyer', 'seller', 'listing', 'commission'], weight: 2 },
  ],
  'landing': [
    { keywords: ['landing', 'website', 'portfolio', 'blog'], weight: 3 },
    { keywords: ['page', 'static', 'showcase', 'marketing'], weight: 1 },
  ],
};

const STACK_HINTS: Record<string, string> = {
  'react': 'nextjs-supabase-shadcn',
  'next.js': 'nextjs-supabase-shadcn',
  'nextjs': 'nextjs-supabase-shadcn',
  'next': 'nextjs-supabase-shadcn',
  'vue': 'vue-nuxt-pinia',
  'nuxt': 'vue-nuxt-pinia',
  'svelte': 'sveltekit-drizzle',
  'sveltekit': 'sveltekit-drizzle',
  'flutter': 'flutter-firebase',
  'react native': 'react-native-expo',
  'expo': 'react-native-expo',
  'django': 'django-htmx',
  'python': 'python-fastapi',
  'fastapi': 'python-fastapi',
  'trpc': 't3-stack',
  't3': 't3-stack',
  'prisma': 't3-stack',
  'go': 'go-fiber',
  'golang': 'go-fiber',
  'rust': 'rust-axum',
  'spring': 'spring-boot',
  'java': 'spring-boot',
};

// Complexity indicators beyond word count
const COMPLEXITY_SIGNALS = {
  high: [
    'real-time', 'realtime', 'websocket', 'multi-tenant', 'role-based',
    'integration', 'third-party', 'payment', 'oauth', 'sso',
    'microservice', 'queue', 'cron', 'migration', 'i18n',
    'offline', 'sync', 'collaboration', 'versioning', 'audit',
  ],
  medium: [
    'auth', 'dashboard', 'notification', 'search', 'filter',
    'upload', 'email', 'export', 'import', 'settings',
    'profile', 'permission', 'invite', 'comment', 'report',
  ],
};

function scoreSignals(text: string, signals: Record<string, { keywords: string[]; weight: number }[]>): { winner: string; score: number; total: number } {
  const scores: Record<string, number> = {};
  let maxScore = 0;
  let winner = '';

  for (const [category, groups] of Object.entries(signals)) {
    scores[category] = 0;
    for (const group of groups) {
      for (const kw of group.keywords) {
        if (text.includes(kw)) scores[category] += group.weight;
      }
    }
    if (scores[category] > maxScore) {
      maxScore = scores[category];
      winner = category;
    }
  }

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  return { winner, score: maxScore, total };
}

function extractFeatures(text: string): string[] {
  const features: string[] = [];
  // Look for listed features (comma-separated, "and"-separated, or bullet-like)
  const listPattern = /(?:with|features?|includes?|has)\s*[:.]?\s*(.+?)(?:\.|$)/gi;
  let match;
  while ((match = listPattern.exec(text)) !== null) {
    const items = match[1].split(/,\s*|\s+and\s+/).map(s => s.trim()).filter(s => s.length > 2 && s.length < 50);
    features.push(...items);
  }
  return features.slice(0, 10); // cap at 10
}

export function analyzeIdea(idea: string): ProjectAnalysis {
  const lower = idea.toLowerCase();

  // Multi-signal industry detection
  const industryResult = scoreSignals(lower, INDUSTRY_SIGNALS);
  const industry = industryResult.winner || 'saas';
  const industryConfidence = industryResult.total > 0 ? Math.min(1, industryResult.score / (industryResult.total * 0.6)) : 0.3;

  // Multi-signal product type
  const productResult = scoreSignals(lower, PRODUCT_TYPES);
  const productType = productResult.winner || 'web-app';

  // Stack detection
  let impliedStack: string | null = null;
  for (const [hint, stack] of Object.entries(STACK_HINTS)) {
    if (lower.includes(hint)) { impliedStack = stack; break; }
  }

  // Multi-signal complexity estimation
  const highSignals = COMPLEXITY_SIGNALS.high.filter(s => lower.includes(s)).length;
  const medSignals = COMPLEXITY_SIGNALS.medium.filter(s => lower.includes(s)).length;
  const wordCount = lower.split(/\s+/).length;
  const featureCount = extractFeatures(lower).length;

  let complexityScore = 0;
  complexityScore += highSignals * 3;
  complexityScore += medSignals * 1.5;
  complexityScore += featureCount * 1;
  complexityScore += Math.floor(wordCount / 15); // word length adds minor signal

  let complexity: 'simple' | 'medium' | 'complex';
  if (complexityScore >= 8) complexity = 'complex';
  else if (complexityScore >= 3) complexity = 'medium';
  else complexity = 'simple';

  const complexityConfidence = Math.min(1, (highSignals + medSignals + featureCount) / 5);

  // Target user extraction — multi-pattern
  const targetUser = extractTargetUser(lower);

  // Keywords: meaningful words only
  const stopWords = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'will', 'can', 'app', 'build', 'create', 'make', 'want', 'need', 'where', 'they', 'their', 'them', 'into', 'like', 'just', 'some', 'more', 'also', 'than', 'then', 'very', 'about']);
  const keywords = lower.split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));

  return {
    productType,
    targetUser,
    industry,
    impliedStack,
    complexity,
    keywords: keywords.slice(0, 15),
    features: extractFeatures(lower),
    confidence: { industry: industryConfidence, complexity: complexityConfidence },
  };
}

function extractTargetUser(text: string): string {
  const patterns = [
    /for (\w+(?:\s+\w+)?)\s+(?:who|that|to)/,
    /(?:help|enable|let)\s+(\w+(?:\s+\w+)?)\s+/,
    /(\w+s)\s+can\s+/,
    /where\s+(\w+s?)\s+/,
    /for\s+(\w+s)\b/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1].length > 3 && m[1].length < 30) return m[1];
  }
  return 'general users';
}
