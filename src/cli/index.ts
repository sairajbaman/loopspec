#!/usr/bin/env node
import { runStart } from './start.js';
import { runStop } from './stop.js';

export interface ParsedArgs {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const command = args[0] || 'help';
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('-')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      const key = arg.slice(1);
      const next = args[i + 1];
      if (next && !next.startsWith('-')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { command, positional, flags };
}

const HELP = `
loopspec v2.1.0 — The Compound Intelligence Engine for AI Development

Usage:
  loopspec <command> [options]

Commands:
  status                 Show current session state (alias for session status)
  session start <name>   Start a tracked session
  session status         Show current session state
  session end            End session with report
  session history        List past sessions

  check <file>           One-shot analysis (drift + guardrails + score)
  watch [--continuous]   Watch files for drift (--tui for dashboard)
  review [--pr <base>]   Review changed files against spec
  suggest "<task>"       Get implementation guidance
  preflight "<task>"     Get guardrails and constraints before coding
  predict "<task>"       Predict expected patterns before writing code
  predict compare        Compare written code against predictions

  graph build            Build dependency graph from source (--all for tests)
  graph impact <file>    Show what depends on a file
  graph query "<name>"   Search graph for nodes

  compound "<task>"      Extract learnings from completed work
  profile                Show model blind-spot profile
  plugin install <name>  Install a plugin (drift-react, drift-next, etc.)
  plugin list            List installed/available plugins
  worktree list|create|remove  Manage git worktrees

  connect [--status]     Configure AI tools (or show status)
  start [--yes]          Configure all detected tools (--yes for CI)
  stop [--yes]           Remove LoopSpec from all tools (--yes for CI)

  help                   Show this help

Options:
  --json                 Output as JSON (for check command, CI integration)
  --tui                  Use TUI dashboard (for watch)
  --all                  Include tests/scripts in graph
  --global               Use global session store
  --continuous           Keep watching (don't exit)
  --yes, -y              Skip interactive prompts (CI mode)
  -h, --help             Show help for a command
  --version              Show version

Note (Windows PowerShell 5.1):
  Use semicolons (;) to chain commands, not &&.
  Example: cd "my-project" ; npx loopspec-mcp status
`;

async function runCheck(args: ParsedArgs) {
  const file = args.positional[0];
  if (!file) {
    console.log('Usage: loopspec check <file>');
    return;
  }
  const { runCheckCommand } = await import('./commands/check.js');
  await runCheckCommand(file, args.flags);
}

async function runWatch(args: ParsedArgs) {
  const { runWatchCommand } = await import('./commands/watch.js');
  await runWatchCommand(args.flags);
}

async function runSession(args: ParsedArgs) {
  const { runSessionCommand } = await import('./commands/session.js');
  await runSessionCommand(args.positional, args.flags);
}

async function runReview(args: ParsedArgs) {
  const { runReviewCommand } = await import('./commands/review.js');
  await runReviewCommand(args.flags);
}

async function runSuggest(args: ParsedArgs) {
  const task = args.positional[0];
  if (!task) {
    console.log('Usage: loopspec suggest "<task description>"');
    return;
  }
  const { runSuggestCommand } = await import('./commands/suggest.js');
  await runSuggestCommand(task, args.flags);
}

async function runConnect(args: ParsedArgs) {
  const { runConnectCommand } = await import('./commands/connect.js');
  await runConnectCommand(args.positional, args.flags);
}

async function runGraph(args: ParsedArgs) {
  const { runGraphCommand } = await import('./commands/graph.js');
  await runGraphCommand(args.positional, args.flags);
}

async function runProfile(args: ParsedArgs) {
  const { runProfileCommand } = await import('./commands/profile.js');
  await runProfileCommand(args.flags);
}

async function runPlugin(args: ParsedArgs) {
  const { runPluginCommand } = await import('./commands/plugin.js');
  await runPluginCommand(args.positional, args.flags);
}

export async function main() {
  const parsed = parseArgs(process.argv);

  if (parsed.flags.help || parsed.flags.h) {
    console.log(HELP);
    return;
  }

  if (parsed.flags.version) {
    console.log('loopspec v2.1.0');
    return;
  }

  switch (parsed.command) {
    case 'help':
    case '--help':
    case '-h':
      console.log(HELP);
      break;
    case '--version':
    case '-V':
      console.log('loopspec v2.1.0');
      break;
    case 'session':
      await runSession(parsed);
      break;
    case 'check':
      await runCheck(parsed);
      break;
    case 'watch':
      await runWatch(parsed);
      break;
    case 'review':
      await runReview(parsed);
      break;
    case 'suggest':
      await runSuggest(parsed);
      break;
    case 'connect':
      await runConnect(parsed);
      break;
    case 'graph':
      await runGraph(parsed);
      break;
    case 'profile':
      await runProfile(parsed);
      break;
    case 'plugin':
      await runPlugin(parsed);
      break;
    case 'compound': {
      const { runCompoundCommand } = await import('./commands/compound.js');
      await runCompoundCommand(parsed.positional, parsed.flags);
      break;
    }
    case 'preflight': {
      const task = parsed.positional.join(' ');
      if (!task) { console.log('Usage: loopspec preflight "<task description>"'); break; }
      const { runPreflightCommand } = await import('./commands/preflight.js');
      await runPreflightCommand(task, parsed.flags);
      break;
    }
    case 'predict': {
      const { runPredictCommand } = await import('./commands/predict.js');
      await runPredictCommand(parsed.positional, parsed.flags);
      break;
    }
    case 'worktree': {
      const { runWorktreeCommand } = await import('./commands/worktree.js');
      await runWorktreeCommand(parsed.positional, parsed.flags);
      break;
    }
    case 'start':
    case 'setup':
      await runStart(parsed.flags);
      break;
    case 'stop':
      await runStop(parsed.flags);
      break;
    case 'status': {
      // Shorthand for 'session status'
      const { runSessionCommand } = await import('./commands/session.js');
      await runSessionCommand(['status'], parsed.flags);
      break;
    }
    default:
      console.log(`Unknown command: ${parsed.command}\n`);
      console.log(HELP);
      process.exit(1);
  }
}

main().catch((e) => {
  console.error('Fatal:', e.message || e);
  process.exit(1);
});
