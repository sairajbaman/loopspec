import { createInterface } from 'node:readline';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { detectTools, type DetectedTool } from './detect-tools.js';
import { mergeLoopspecEntry } from './config-writer.js';

const UNIVERSAL_CONFIG = `{
  "mcpServers": {
    "loopspec": {
      "command": "npx",
      "args": ["-y", "loopspec-mcp"],
      "env": { "LOOPSPEC_PROJECT_DIR": "." }
    }
  }
}`;

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function printTable(tools: DetectedTool[]) {
  const nameW = Math.max(6, ...tools.map((t) => t.name.length));
  const pathW = Math.max(11, ...tools.map((t) => (t.configPath ? path.relative(process.cwd(), t.configPath) : '(manual)').length));
  const actW = 6;

  const pad = (s: string, w: number) => s + ' '.repeat(Math.max(0, w - s.length));
  const line = (n: string, p: string, a: string) =>
    `│ ${pad(n, nameW)} │ ${pad(p, pathW)} │ ${pad(a, actW)} │`;
  const sep = (l: string, m: string, r: string, f: string) =>
    `${l}${'─'.repeat(nameW + 2)}${m}${'─'.repeat(pathW + 2)}${m}${'─'.repeat(actW + 2)}${r}`;

  console.log('\n🔍 Detected AI Tools:');
  console.log(sep('┌', '┬', '┐', '─'));
  console.log(line('Tool', 'Config Path', 'Action'));
  console.log(sep('├', '┼', '┤', '─'));
  for (const t of tools) {
    const rel = t.configPath ? path.relative(process.cwd(), t.configPath) : '(no config file)';
    console.log(line(t.name, rel, t.action));
  }
  console.log(sep('└', '┴', '┘', '─'));
  console.log('');
}

function writeManifest(tools: DetectedTool[]) {
  const manifest = {
    version: '0.3.0',
    installed_at: new Date().toISOString(),
    tools: Object.fromEntries(
      tools
        .filter((t) => t.action !== 'manual')
        .map((t) => [t.name, { configPath: t.configPath }])
    ),
  };
  const dir = path.join(process.cwd(), '.loopspec');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'registered-tools.json'), JSON.stringify(manifest, null, 2) + '\n');
}

export async function runStart(flags: Record<string, string | boolean> = {}) {
  console.log('\n⚡ LoopSpec Universal Installer\n');

  const tools = detectTools();

  if (tools.length === 0) {
    console.log('No AI tools detected on this system.\n');
    console.log('Add this to your AI tool\'s MCP config manually:\n');
    console.log(UNIVERSAL_CONFIG);
    return;
  }

  printTable(tools);

  const configurable = tools.filter((t) => t.action !== 'manual');
  const manual = tools.filter((t) => t.action === 'manual');

  if (configurable.length === 0) {
    // Only manual tools detected
    if (manual.length > 0) {
      console.log('📋 Manual setup required:');
      for (const t of manual) {
        console.log(`   ${t.name}: ${t.instructions}`);
      }
    }
    return;
  }

  // --yes / -y flag for CI/scripting (skip interactive prompt)
  if (!flags.yes && !flags.y) {
    const answer = await prompt(`Configure ${configurable.length} tool${configurable.length > 1 ? 's' : ''}? [Y/n] `);
    if (answer.toLowerCase() === 'n') {
      console.log('Aborted.');
      return;
    }
  }

  let successCount = 0;
  for (const tool of configurable) {
    try {
      // Ensure directory exists
      mkdirSync(path.dirname(tool.configPath), { recursive: true });

      // Read existing config
      const existing = existsSync(tool.configPath) ? readFileSync(tool.configPath, 'utf-8') : null;

      // Merge and write
      const merged = mergeLoopspecEntry(existing, tool.configKey, tool.typeField);
      writeFileSync(tool.configPath, merged);

      console.log(`  ✅ ${tool.name} → ${path.relative(process.cwd(), tool.configPath)}`);
      if (tool.needsRestart && tool.instructions) {
        console.log(`     ↳ ${tool.instructions}`);
      }
      successCount++;
    } catch (e) {
      console.log(`  ❌ ${tool.name} — ${(e as Error).message}`);
    }
  }

  // Write manifest
  if (successCount > 0) {
    writeManifest(configurable.filter((_, i) => i < successCount));
    console.log(`\n✨ LoopSpec configured for ${successCount} tool${successCount > 1 ? 's' : ''}!`);
    console.log('   Run "npx loopspec-mcp stop" to remove.\n');
  }

  // Print manual instructions
  if (manual.length > 0) {
    console.log('📋 Manual setup (no config file):');
    for (const t of manual) {
      console.log(`   ${t.name}: ${t.instructions}`);
    }
    console.log('');
  }
}
