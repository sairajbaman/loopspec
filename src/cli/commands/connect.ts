import { detectTools } from '../detect-tools.js';
import { runStart } from '../start.js';
import { log, severity } from '../output.js';

export async function runConnectCommand(positional: string[], flags: Record<string, string | boolean>) {
  if (flags.status) {
    const tools = detectTools();
    if (tools.length === 0) {
      log(`${severity('info')} No AI tools detected.`);
      return;
    }
    log(`\n  Connected AI Tools:\n`);
    for (const t of tools) {
      const icon = t.action === 'update' ? '✓' : '○';
      log(`  ${icon} ${t.name} — ${t.action === 'update' ? 'configured' : 'available'}`);
    }
    log('');
    return;
  }

  // If specific tool name provided, filter
  const target = positional[0];
  if (target) {
    const tools = detectTools();
    const match = tools.find(t => t.name.toLowerCase() === target.toLowerCase());
    if (!match) {
      log(`${severity('error')} Tool "${target}" not detected. Available: ${tools.map(t => t.name).join(', ')}`);
      return;
    }
    log(`${severity('info')} Configuring ${match.name}...`);
    // Delegate to start which handles the actual config writing
    await runStart();
    return;
  }

  // Default: run full start (connect all)
  await runStart();
}
