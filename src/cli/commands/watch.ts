import { createContext } from '../../context.js';
import { createWatcher } from '../../engines/watcher/index.js';
import { log, severity, renderTui } from '../output.js';

export async function runWatchCommand(flags: Record<string, string | boolean>) {
  const ctx = createContext();
  const useTui = !!flags.tui;
  const continuous = flags.continuous !== false; // default true for watch

  log(`${severity('info')} LoopSpec Watch — monitoring for drift and violations\n`);

  const watcher = await createWatcher(ctx, {
    onEvent(event) {
      if (useTui) {
        renderTui(watcher.getState());
      } else {
        const icon = severity(event.level);
        log(`${icon} [${event.file}] ${event.message}`);
        if (event.suggestion) log(`  → ${event.suggestion}`);
      }
    },
  });

  watcher.start();
  log(`${severity('ok')} Watching: ${ctx.projectDir}`);
  log(`  Press Ctrl+C to stop\n`);

  // Keep process alive
  process.on('SIGINT', () => {
    watcher.stop();
    log(`\n${severity('info')} Watch stopped.`);
    process.exit(0);
  });

  if (!continuous) {
    // Single pass mode — run once and exit
    await watcher.runOnce();
    watcher.stop();
  }
}
