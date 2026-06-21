import { createContext } from '../../context.js';
import { initDaemon, enableDaemon, disableDaemon, tick, getDaemonStatus } from '../../engines/daemon/index.js';

export async function runDaemonCommand(positional: string[], flags: Record<string, string | boolean>) {
  const ctx = createContext();
  const sub = positional[0];

  switch (sub) {
    case 'init': {
      const state = await initDaemon(ctx);
      console.log(`✓ Daemon initialized. ${state.tasks.length} tasks.`);
      break;
    }
    case 'enable': {
      const state = await enableDaemon(ctx);
      console.log(`✓ Daemon enabled. ${state.tasks.filter(t => t.enabled).length} active tasks.`);
      break;
    }
    case 'disable': {
      await disableDaemon(ctx);
      console.log('✓ Daemon disabled.');
      break;
    }
    case 'tick': {
      const { triggered } = await tick(ctx);
      if (triggered.length === 0) { console.log('✓ No tasks due.'); return; }
      console.log(`Triggered ${triggered.length} tasks:`);
      for (const t of triggered) console.log(`  • ${t.name} (${t.action})`);
      break;
    }
    case 'status': {
      const state = await getDaemonStatus(ctx);
      console.log(`Daemon: ${state.enabled ? 'ENABLED' : 'DISABLED'}`);
      console.log(`Last tick: ${new Date(state.lastTick).toISOString()}`);
      console.log(`\nTasks (${state.tasks.length}):`);
      for (const t of state.tasks) console.log(`  ${t.enabled ? '●' : '○'} ${t.name} [${t.action}] — ${t.schedule.pattern || t.schedule.type}`);
      const recent = state.history.slice(-5).reverse();
      if (recent.length) {
        console.log('\nRecent:');
        for (const h of recent) console.log(`  ${h.status === 'success' ? '✓' : '✗'} ${h.taskId} (${new Date(h.startedAt).toLocaleString()})`);
      }
      break;
    }
    default:
      console.log('Usage: loopspec daemon <init|enable|disable|tick|status>');
  }
}
