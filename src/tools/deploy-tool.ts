import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { initDeployLoop, startDeploy, advanceStage, completeStage, getDeployStatus, stageInstructions } from '../engines/deploy-loop/index.js';

export function registerDeployLoopTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_deploy', {
    title: 'Auto-Deploy Loop',
    description: 'Full deployment pipeline: build → test → lint → security → deploy → verify → monitor. Auto-rollback on failure.',
    inputSchema: z.object({
      action: z.enum(['init', 'start', 'advance', 'complete', 'status']),
      deployId: z.string().optional(),
      environment: z.enum(['preview', 'staging', 'production']).optional(),
      stage: z.enum(['build', 'test', 'lint', 'security', 'deploy', 'verify', 'monitor', 'rollback']).optional(),
      passed: z.boolean().optional(),
      output: z.string().optional(),
      autoRollback: z.boolean().optional(),
    }),
  }, async (args) => {
    switch (args.action) {
      case 'init': {
        const config = await initDeployLoop(ctx, { environment: args.environment, autoRollback: args.autoRollback });
        return { content: [{ type: 'text', text: `✓ Deploy pipeline configured.\nEnvironment: ${config.environment}\nStages: ${config.stages.join(' → ')}\nAuto-rollback: ${config.autoRollback}\nApproval required: ${config.requireApproval}` }] };
      }
      case 'start': {
        const run = await startDeploy(ctx, 'manual', { environment: args.environment });
        return { content: [{ type: 'text', text: `✓ Deploy started: ${run.id}\nEnvironment: ${run.config.environment}\nStages: ${run.stages.map(s => s.stage).join(' → ')}\n\nCall action=advance to begin first stage.` }] };
      }
      case 'advance': {
        if (!args.deployId) return { content: [{ type: 'text', text: '❌ `deployId` required' }] };
        const { current, run, needsApproval } = await advanceStage(ctx, args.deployId);
        if (!current) return { content: [{ type: 'text', text: `✓ Deploy ${run.id} complete. Final status: ${run.status}` }] };
        const instructions = stageInstructions(current.stage, run.config);
        let text = `## Stage: ${current.stage.toUpperCase()}\n\n${instructions}\n\nWhen done, call action=complete with stage="${current.stage}" and passed=true/false.`;
        if (needsApproval) text += '\n\n⚠️ HUMAN APPROVAL REQUIRED before deploying to production.';
        return { content: [{ type: 'text', text }] };
      }
      case 'complete': {
        if (!args.deployId || !args.stage || args.passed === undefined) return { content: [{ type: 'text', text: '❌ `deployId`, `stage`, `passed` required' }] };
        const run = await completeStage(ctx, args.deployId, args.stage, args.passed, args.output);
        const done = run.stages.filter(s => s.status === 'passed').length;
        const total = run.stages.length;
        let text = `✓ Stage "${args.stage}" ${args.passed ? 'PASSED' : 'FAILED'}. Progress: ${done}/${total}`;
        if (run.status === 'rolled-back') text += '\n\n🔄 Auto-rollback triggered due to verify failure.';
        if (run.status === 'passed') text += '\n\n🎉 All stages passed! Deployment successful.';
        if (run.status === 'failed') text += `\n\n❌ Pipeline failed at ${args.stage}.`;
        return { content: [{ type: 'text', text }] };
      }
      case 'status': {
        const data = await getDeployStatus(ctx, args.deployId);
        if (!data) return { content: [{ type: 'text', text: 'No deployments found.' }] };
        if (Array.isArray(data)) {
          const lines = data.map(r => `• ${r.id} [${r.status}] ${r.config.environment} (${new Date(r.startedAt).toLocaleDateString()})`);
          return { content: [{ type: 'text', text: `## Deployments\n${lines.join('\n')}` }] };
        }
        const stageLines = data.stages.map(s => {
          const icon = s.status === 'passed' ? '✓' : s.status === 'failed' ? '✗' : s.status === 'running' ? '…' : '○';
          return `  ${icon} ${s.stage} [${s.status}]`;
        });
        return { content: [{ type: 'text', text: `## Deploy: ${data.id}\nStatus: ${data.status} | Env: ${data.config.environment}\nTriggered: ${data.triggeredBy}\n\n${stageLines.join('\n')}` }] };
      }
      default:
        return { content: [{ type: 'text', text: '❌ Unknown action' }] };
    }
  });
}
