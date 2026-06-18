// ANSI color codes — no dependencies
const c = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

export function log(msg: string) {
  console.log(msg);
}

export function severity(level: string): string {
  switch (level) {
    case 'error': case 'critical': return `${c.red}⛔${c.reset}`;
    case 'warn': case 'warning': return `${c.yellow}⚠${c.reset}`;
    case 'ok': case 'success': return `${c.green}✓${c.reset}`;
    case 'info': return `${c.blue}ℹ${c.reset}`;
    default: return '•';
  }
}

export interface TuiState {
  sessionName?: string;
  watchedFiles: string[];
  goals: { description: string; done: boolean }[];
  issues: { file: string; message: string; level: string }[];
  score: number;
  lastScore?: number;
}

export function renderTui(state: TuiState) {
  // Clear screen and move cursor to top
  process.stdout.write('\x1b[2J\x1b[H');

  const width = Math.min(process.stdout.columns || 60, 60);
  const hr = '─'.repeat(width - 2);

  const lines: string[] = [];
  lines.push(`┌${hr}┐`);
  lines.push(`│${c.bold} LOOPSPEC WATCH${c.reset}${' '.repeat(width - 16)}│`);
  lines.push(`├${hr}┤`);

  if (state.sessionName) {
    lines.push(pad(`│  Session: ${state.sessionName}`, width));
    lines.push(`│${' '.repeat(width - 2)}│`);
  }

  // Score
  const delta = state.lastScore != null ? state.score - state.lastScore : 0;
  const deltaStr = delta !== 0 ? ` ${delta >= 0 ? '↑' : '↓'}${Math.abs(delta)}` : '';
  lines.push(pad(`│  Score: ${state.score}/100${deltaStr}`, width));
  lines.push(`│${' '.repeat(width - 2)}│`);

  // Goals
  if (state.goals.length > 0) {
    lines.push(pad(`│  Goals:`, width));
    for (const g of state.goals.slice(0, 8)) {
      const icon = g.done ? `${c.green}[x]${c.reset}` : '[ ]';
      lines.push(pad(`│    ${icon} ${g.description.slice(0, width - 12)}`, width));
    }
    lines.push(`│${' '.repeat(width - 2)}│`);
  }

  // Recent issues
  if (state.issues.length > 0) {
    lines.push(pad(`│  Issues (${state.issues.length}):`, width));
    for (const issue of state.issues.slice(-5)) {
      const icon = severity(issue.level);
      lines.push(pad(`│    ${icon} ${issue.file}: ${issue.message.slice(0, width - 20)}`, width));
    }
  }

  lines.push(`└${hr}┘`);
  process.stdout.write(lines.join('\n') + '\n');
}

function pad(line: string, width: number): string {
  // Strip ANSI for length calculation
  const visible = line.replace(/\x1b\[[0-9;]*m/g, '');
  const needed = width - visible.length;
  if (needed <= 0) return line.slice(0, width - 1) + '│';
  return line + ' '.repeat(needed - 1) + '│';
}
