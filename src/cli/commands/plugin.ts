import { createContext } from '../../context.js';
import { installPlugin, removePlugin, listPlugins } from '../../engines/plugins/index.js';
import { log, severity } from '../output.js';

export async function runPluginCommand(positional: string[], _flags: Record<string, string | boolean>) {
  const ctx = createContext();
  const action = positional[0] || 'list';

  switch (action) {
    case 'install': {
      const name = positional[1];
      if (!name) { log('Usage: loopspec plugin install <name>'); return; }
      const r = await installPlugin(ctx, name);
      log(`${severity(r.success ? 'ok' : 'error')} ${r.message}`);
      break;
    }
    case 'remove': {
      const name = positional[1];
      if (!name) { log('Usage: loopspec plugin remove <name>'); return; }
      const r = await removePlugin(ctx, name);
      log(`${severity(r.success ? 'ok' : 'error')} ${r.message}`);
      break;
    }
    case 'list': {
      const r = await listPlugins(ctx);
      log(`\n  Installed: ${r.installed.length > 0 ? r.installed.join(', ') : '(none)'}`);
      log(`  Available: ${r.available.join(', ')}\n`);
      break;
    }
    default:
      log('Usage: loopspec plugin [install|remove|list] [name]');
  }
}
