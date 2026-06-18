import { execSync } from 'node:child_process';
import { log, severity } from '../output.js';

export async function runWorktreeCommand(positional: string[], _flags: Record<string, string | boolean>) {
  const action = positional[0] || 'list';

  switch (action) {
    case 'list': {
      try {
        const out = execSync('git worktree list', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        log(`${severity('info')} Git Worktrees:\n${out}`);
      } catch {
        log(`${severity('error')} Not a git repository or git worktree not available.`);
      }
      break;
    }
    case 'create': {
      const name = positional[1];
      if (!name) { log('Usage: loopspec worktree create <branch-name>'); return; }
      try {
        execSync(`git worktree add ../${name} -b ${name}`, { encoding: 'utf-8', stdio: 'pipe' });
        log(`${severity('ok')} Created worktree: ../${name} (branch: ${name})`);
      } catch (e) {
        log(`${severity('error')} ${(e as Error).message}`);
      }
      break;
    }
    case 'remove': {
      const name = positional[1];
      if (!name) { log('Usage: loopspec worktree remove <path>'); return; }
      try {
        execSync(`git worktree remove ${name}`, { encoding: 'utf-8', stdio: 'pipe' });
        log(`${severity('ok')} Removed worktree: ${name}`);
      } catch (e) {
        log(`${severity('error')} ${(e as Error).message}`);
      }
      break;
    }
    default:
      log('Usage: loopspec worktree [list|create|remove] [name]');
  }
}
