import path from 'node:path';
import fs from 'node:fs';
import type { AppContext } from '../../context.js';
import { readFile, writeFile, ensureDir } from '../../utils/files.js';

export interface PluginRule {
  id: string;
  pattern: RegExp;
  message: string;
  severity: 'error' | 'warn' | 'info';
  category: string;
  fix?: string;
}

export interface PluginGoal {
  description: string;
  verifyPatterns: string[];
  antiPatterns: string[];
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  rules?: { id: string; pattern: string; flags?: string; message: string; severity: string; category: string; fix?: string }[];
  goals?: PluginGoal[];
  scoreModifiers?: { category: string; weight: number }[];
}

export interface LoadedPlugin {
  manifest: PluginManifest;
  rules: PluginRule[];
  goals: PluginGoal[];
}

export async function loadPlugins(ctx: AppContext): Promise<LoadedPlugin[]> {
  const pluginsDir = path.join(ctx.loopspecDir, 'plugins');
  const plugins: LoadedPlugin[] = [];

  try {
    const entries = fs.readdirSync(pluginsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(pluginsDir, entry.name, 'plugin.json');
      try {
        const content = fs.readFileSync(manifestPath, 'utf-8');
        const manifest: PluginManifest = JSON.parse(content);
        const rules: PluginRule[] = (manifest.rules || []).map(r => ({
          id: r.id,
          pattern: new RegExp(r.pattern, r.flags || 'g'),
          message: r.message,
          severity: r.severity as any,
          category: r.category,
          fix: r.fix,
        }));
        plugins.push({ manifest, rules, goals: manifest.goals || [] });
      } catch {}
    }
  } catch {}

  return plugins;
}

export async function installPlugin(ctx: AppContext, name: string): Promise<{ success: boolean; message: string }> {
  const pluginsDir = path.join(ctx.loopspecDir, 'plugins');
  await ensureDir(pluginsDir);

  // Check built-in plugins
  const builtin = BUILTIN_PLUGINS[name];
  if (!builtin) {
    return { success: false, message: `Plugin "${name}" not found. Available: ${Object.keys(BUILTIN_PLUGINS).join(', ')}` };
  }

  const pluginDir = path.join(pluginsDir, name);
  await ensureDir(pluginDir);
  await writeFile(path.join(pluginDir, 'plugin.json'), JSON.stringify(builtin, null, 2));

  return { success: true, message: `Installed plugin: ${name} (${builtin.rules?.length || 0} rules, ${builtin.goals?.length || 0} goals)` };
}

export async function removePlugin(ctx: AppContext, name: string): Promise<{ success: boolean; message: string }> {
  const pluginDir = path.join(ctx.loopspecDir, 'plugins', name);
  try {
    fs.rmSync(pluginDir, { recursive: true });
    return { success: true, message: `Removed plugin: ${name}` };
  } catch {
    return { success: false, message: `Plugin "${name}" not installed.` };
  }
}

export async function listPlugins(ctx: AppContext): Promise<{ installed: string[]; available: string[] }> {
  const pluginsDir = path.join(ctx.loopspecDir, 'plugins');
  let installed: string[] = [];
  try {
    installed = fs.readdirSync(pluginsDir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);
  } catch {}
  const available = Object.keys(BUILTIN_PLUGINS).filter(n => !installed.includes(n));
  return { installed, available };
}

// Built-in plugin registry
const BUILTIN_PLUGINS: Record<string, PluginManifest> = {
  'drift-react': {
    name: 'drift-react', version: '1.0.0', description: 'React-specific drift checks',
    rules: [
      { id: 'react-no-index-key', pattern: 'key=\\{(?:index|i|idx)\\}', message: 'Avoid using array index as key', severity: 'warn', category: 'react' },
      { id: 'react-useeffect-deps', pattern: 'useEffect\\([^)]+,\\s*\\[\\]\\)', message: 'Empty dependency array — intentional?', severity: 'info', category: 'react' },
      { id: 'react-no-nested-components', pattern: 'function\\s+[A-Z]\\w+.*\\{[\\s\\S]*function\\s+[A-Z]', message: 'Nested component definition — extract to separate file', severity: 'warn', category: 'react' },
    ],
  },
  'drift-next': {
    name: 'drift-next', version: '1.0.0', description: 'Next.js-specific drift checks',
    rules: [
      { id: 'next-use-image', pattern: '<img\\s', message: 'Use next/image instead of <img>', severity: 'warn', category: 'next' },
      { id: 'next-use-link', pattern: '<a\\s+href=', message: 'Use next/link instead of <a href>', severity: 'warn', category: 'next' },
      { id: 'next-metadata', pattern: 'export\\s+default\\s+function\\s+\\w+Page', flags: 'm', message: 'Page missing generateMetadata export', severity: 'info', category: 'next' },
    ],
  },
  'drift-vue': {
    name: 'drift-vue', version: '1.0.0', description: 'Vue-specific drift checks',
    rules: [
      { id: 'vue-no-v-html', pattern: 'v-html', message: 'v-html is an XSS risk — sanitize input', severity: 'error', category: 'vue' },
      { id: 'vue-key-in-v-for', pattern: 'v-for=(?!.*:key)', message: 'v-for without :key binding', severity: 'warn', category: 'vue' },
    ],
  },
  'security-advanced': {
    name: 'security-advanced', version: '1.0.0', description: 'Advanced security rules',
    rules: [
      { id: 'sec-eval', pattern: 'eval\\(', message: 'eval() is a security risk', severity: 'error', category: 'security' },
      { id: 'sec-innerhtml', pattern: 'innerHTML\\s*=', message: 'innerHTML assignment — XSS risk', severity: 'error', category: 'security' },
      { id: 'sec-hardcoded-secret', pattern: '(?:password|secret|api_key|token)\\s*=\\s*["\'][^"\']{8,}', message: 'Possible hardcoded secret', severity: 'error', category: 'security' },
      { id: 'sec-no-cors-star', pattern: "cors\\(\\{[^}]*origin:\\s*['\"]\\*", message: 'CORS origin * allows any domain', severity: 'warn', category: 'security' },
    ],
  },
  'testing-enforce': {
    name: 'testing-enforce', version: '1.0.0', description: 'Testing enforcement rules',
    rules: [
      { id: 'test-no-skip', pattern: '(?:it|test|describe)\\.skip', message: 'Skipped test — remove skip or delete test', severity: 'warn', category: 'testing' },
      { id: 'test-no-only', pattern: '(?:it|test|describe)\\.only', message: '.only left in test file — will skip other tests in CI', severity: 'error', category: 'testing' },
    ],
    goals: [
      { description: 'All exported functions have tests', verifyPatterns: ['describe\\(|test\\('], antiPatterns: [] },
      { description: 'No skipped tests', verifyPatterns: [], antiPatterns: ['\\.skip'] },
    ],
  },
};
