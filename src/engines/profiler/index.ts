import path from 'node:path';
import fs from 'node:fs';
import type { AppContext } from '../../context.js';
import { readFile, writeFile } from '../../utils/files.js';

export interface BlindSpot {
  category: string;
  missed: number;
  hit: number;
  score: number; // 0-100
}

export interface ModelProfile {
  model: string;
  lastUpdated: string;
  totalSessions: number;
  blindSpots: Record<string, BlindSpot>;
  adaptiveChecklist: string[];
  antiPatternFrequency: Record<string, number>;
}

// Categories we track
const CATEGORIES: Record<string, { checkPattern: RegExp; label: string }> = {
  loadingStates: { checkPattern: /loading|isLoading|isPending|Skeleton|Spinner|Suspense/i, label: 'Loading states' },
  errorStates: { checkPattern: /error|isError|ErrorBoundary|onError|catch/i, label: 'Error handling' },
  emptyStates: { checkPattern: /\.length\s*===?\s*0|isEmpty|empty.*state|no.*found/i, label: 'Empty states' },
  validation: { checkPattern: /z\.\w+|safeParse|validate|schema/i, label: 'Input validation' },
  accessibility: { checkPattern: /aria-|role=|alt=|sr-only|label/i, label: 'Accessibility' },
  typeSafety: { checkPattern: /interface\s+\w+|type\s+\w+\s*=|z\.infer/i, label: 'Type safety' },
  testCoverage: { checkPattern: /describe\(|it\(|test\(|expect\(/i, label: 'Tests written' },
  errorHandling: { checkPattern: /try\s*\{|\.catch\(|throw\s+new/i, label: 'Try/catch usage' },
  authChecks: { checkPattern: /getSession|auth\(|requireAuth|middleware/i, label: 'Auth checks' },
};

const ANTI_PATTERNS: Record<string, RegExp> = {
  'any_types': /:\s*any(?:\s|;|,|\))/g,
  'ts_ignore': /@ts-ignore|@ts-nocheck/g,
  'console_log': /console\.log\(/g,
  'default_export': /export\s+default\s+function/g,
  'hardcoded_strings': /['"][a-z]{20,}['"]/g,
  'no_error_handling': /fetch\([^)]+\)(?!.*catch)/g,
};

export async function loadProfile(ctx: AppContext): Promise<ModelProfile> {
  const profilePath = path.join(ctx.loopspecDir, 'model-profile.json');
  try {
    const content = fs.readFileSync(profilePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return createDefaultProfile();
  }
}

export async function updateProfile(ctx: AppContext, sessionFiles: Map<string, string>): Promise<ModelProfile> {
  const profile = await loadProfile(ctx);
  profile.totalSessions++;
  profile.lastUpdated = new Date().toISOString();

  const allContent = [...sessionFiles.values()].join('\n');

  // Check each category
  for (const [key, { checkPattern }] of Object.entries(CATEGORIES)) {
    if (!profile.blindSpots[key]) {
      profile.blindSpots[key] = { category: key, missed: 0, hit: 0, score: 50 };
    }
    const spot = profile.blindSpots[key];
    if (checkPattern.test(allContent)) {
      spot.hit++;
    } else {
      spot.missed++;
    }
    spot.score = Math.round((spot.hit / (spot.hit + spot.missed)) * 100);
  }

  // Count anti-patterns
  for (const [key, pattern] of Object.entries(ANTI_PATTERNS)) {
    const re = new RegExp(pattern.source, pattern.flags);
    const matches = allContent.match(re);
    if (matches) {
      profile.antiPatternFrequency[key] = (profile.antiPatternFrequency[key] || 0) + matches.length;
    }
  }

  // Generate adaptive checklist from blind spots
  profile.adaptiveChecklist = generateChecklist(profile);

  // Persist
  await writeFile(path.join(ctx.loopspecDir, 'model-profile.json'), JSON.stringify(profile, null, 2));
  return profile;
}

export function generateChecklist(profile: ModelProfile): string[] {
  const checklist: string[] = [];
  const sorted = Object.entries(profile.blindSpots).sort((a, b) => a[1].score - b[1].score);

  for (const [key, spot] of sorted) {
    if (spot.score < 50) {
      const cat = CATEGORIES[key];
      if (cat) checklist.push(`⚠ ALWAYS include: ${cat.label} (you miss this ${100 - spot.score}% of the time)`);
    }
  }

  // Top anti-patterns
  const topAnti = Object.entries(profile.antiPatternFrequency).sort((a, b) => b[1] - a[1]).slice(0, 3);
  for (const [key, count] of topAnti) {
    if (count > 3) checklist.push(`⛔ STOP using: ${key.replace(/_/g, ' ')} (${count} occurrences recorded)`);
  }

  return checklist;
}

export function formatProfile(profile: ModelProfile): string {
  let text = `## Model Profile\n\nSessions: ${profile.totalSessions} | Updated: ${profile.lastUpdated?.slice(0, 10) || 'never'}\n\n`;

  text += '### Blind Spots\n';
  const sorted = Object.entries(profile.blindSpots).sort((a, b) => a[1].score - b[1].score);
  for (const [key, spot] of sorted) {
    const cat = CATEGORIES[key];
    const bar = '█'.repeat(Math.round(spot.score / 10)) + '░'.repeat(10 - Math.round(spot.score / 10));
    text += `  ${bar} ${spot.score}% ${cat?.label || key} (${spot.hit}✓ ${spot.missed}✗)\n`;
  }

  if (profile.adaptiveChecklist.length > 0) {
    text += '\n### Adaptive Checklist (auto-injected into preflight)\n';
    text += profile.adaptiveChecklist.map(c => `  ${c}`).join('\n');
  }

  return text;
}

function createDefaultProfile(): ModelProfile {
  return {
    model: 'unknown',
    lastUpdated: new Date().toISOString(),
    totalSessions: 0,
    blindSpots: {},
    adaptiveChecklist: [],
    antiPatternFrequency: {},
  };
}
