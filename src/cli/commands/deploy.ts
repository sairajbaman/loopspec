import { createContext } from '../../context.js';
import { initDeployLoop, startDeploy, getDeployStatus } from '../../engines/deploy-loop/index.js';

export async function runDeployCommand(positional: string[], flags: Record<string, string | boolean>) {
  const ctx = createContext();
  const sub = positional[0];

  switch (sub) {
    case 'init': {
      const env = (flags.env as string) || 'preview';
      const config = await initDeployLoop(ctx, { environment: env as any });
      console.log(`✓ Deploy pipeline configured.`);
      console.log(`  Environment: ${config.environment}`);
      console.log(`  Stages: ${config.stages.join(' → ')}`);
      console.log(`  Auto-rollback: ${config.autoRollback}`);
      break;
    }
    case 'start': {
      const env = (flags.env as string) || undefined;
      const run = await startDeploy(ctx, 'manual', env ? { environment: env as any } : undefined);
      console.log(`✓ Deploy started: ${run.id}`);
      console.log(`  Environment: ${run.config.environment}`);
      console.log(`  Stages: ${run.stages.map(s => s.stage).join(' → ')}`);
      break;
    }
    case 'status': {
      const data = await getDeployStatus(ctx, positional[1]);
      if (!data) { console.log('No deployments found.'); return; }
      if (Array.isArray(data)) {
        for (const r of data) console.log(`  ${r.id} [${r.status}] ${r.config.environment} (${new Date(r.startedAt).toLocaleDateString()})`);
      } else {
        console.log(`Deploy: ${data.id} [${data.status}]`);
        console.log(`Environment: ${data.config.environment} | Triggered: ${data.triggeredBy}`);
        for (const s of data.stages) {
          const icon = s.status === 'passed' ? '✓' : s.status === 'failed' ? '✗' : s.status === 'running' ? '…' : '○';
          console.log(`  ${icon} ${s.stage} [${s.status}]`);
        }
      }
      break;
    }
    default:
      console.log('Usage: loopspec deploy <init|start|status> [--env preview|staging|production]');
  }
}
