import { createInterface } from 'node:readline';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { detectTools, type DetectedTool } from './detect-tools.js';
import { removeLoopspecEntry } from './config-writer.js';

interface ManifestEntry {
  configPath: string;
}

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function readManifest(): Record<string, ManifestEntry> | null {
  const manifestPath = path.join(process.cwd(), '.loopspec', 'registered-tools.json');
  try {
    const content = readFileSync(manifestPath, 'utf-8');
    const parsed = JSON.parse(content);
    return parsed.tools || null;
  } catch {
    return null;
  }
}

function findConfigKey(filePath: string): 'mcpServers' | 'servers' | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    if (parsed.servers?.loopspec) return 'servers';
    if (parsed.mcpServers?.loopspec) return 'mcpServers';
    return null;
  } catch {
    return null;
  }
}

interface RemovalTarget {
  name: string;
  configPath: string;
  configKey: 'mcpServers' | 'servers';
}

function getRemovalTargets(): RemovalTarget[] {
  const targets: RemovalTarget[] = [];

  // Fast path: use manifest
  const manifest = readManifest();
  if (manifest) {
    for (const [name, entry] of Object.entries(manifest)) {
      if (existsSync(entry.configPath)) {
        const key = findConfigKey(entry.configPath);
        if (key) {
          targets.push({ name, configPath: entry.configPath, configKey: key });
        }
      }
    }
    if (targets.length > 0) return targets;
  }

  // Fallback: re-detect and check each config
  const detected = detectTools();
  for (const tool of detected) {
    if (tool.action === 'manual' || !tool.configPath) continue;
    if (existsSync(tool.configPath)) {
      const key = findConfigKey(tool.configPath);
      if (key) {
        targets.push({ name: tool.name, configPath: tool.configPath, configKey: key });
      }
    }
  }

  return targets;
}

export async function runStop() {
  console.log('\n⚡ LoopSpec Uninstaller\n');

  const targets = getRemovalTargets();

  if (targets.length === 0) {
    console.log('No LoopSpec configurations found to remove.\n');
    return;
  }

  console.log('Will remove LoopSpec from:');
  for (const t of targets) {
    console.log(`  • ${t.name} → ${path.relative(process.cwd(), t.configPath)}`);
  }
  console.log('');

  const answer = await prompt(`Remove from ${targets.length} tool${targets.length > 1 ? 's' : ''}? [Y/n] `);
  if (answer.toLowerCase() === 'n') {
    console.log('Aborted.');
    return;
  }

  for (const target of targets) {
    try {
      const content = readFileSync(target.configPath, 'utf-8');
      const updated = removeLoopspecEntry(content, target.configKey);

      if (updated.trim() === '{}') {
        unlinkSync(target.configPath);
        console.log(`  ✅ ${target.name} — deleted empty config`);
      } else {
        writeFileSync(target.configPath, updated);
        console.log(`  ✅ ${target.name} — removed loopspec entry`);
      }
    } catch (e) {
      console.log(`  ❌ ${target.name} — ${(e as Error).message}`);
    }
  }

  // Clean up manifest
  const manifestPath = path.join(process.cwd(), '.loopspec', 'registered-tools.json');
  if (existsSync(manifestPath)) {
    unlinkSync(manifestPath);
  }

  console.log('\n✨ LoopSpec removed from all tools.\n');
}
