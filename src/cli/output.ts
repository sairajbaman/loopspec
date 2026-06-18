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
  const w = Math.min(process.stdout.columns || 64, 64);
  const hr = '─'.repeat(w - 2);
  const lines: string[] = [];

  // Clear screen + cursor home
  process.stdout.write('\x1b[2J\x1b[H');

  // Header
  lines.push(`┌${hr}┐`);
  lines.push(row(`│ ${c.bold}${c.cyan}LOOPSPEC WATCH${c.reset}  ${c.dim}${time()}${c.reset}`, w));
  lines.push(`├${hr}┤`);

  // Session
  if (state.sessionName) {
    lines.push(row(`│ ${c.bold}Session:${c.reset} ${state.sessionName}`, w));
    lines.push(row(`│`, w));
  }

  // Score with color
  const scoreDelta = state.lastScore != null ? state.score - state.lastScore : 0;
  const deltaStr = scoreDelta !== 0 ? ` ${scoreDelta >= 0 ? `${c.green}↑${scoreDelta}` : `${c.red}↓${Math.abs(scoreDelta)}`}${c.reset}` : '';
  const scoreColor = state.score >= 80 ? c.green : state.score >= 60 ? c.yellow : c.red;
  lines.push(row(`│ ${c.bold}Score:${c.reset} ${scoreColor}${state.score}/100${c.reset}${deltaStr}`, w));
  lines.push(row(`│ ${progressBar(state.score, 100, w - 8)}`, w));
  lines.push(row(`│`, w));

  // Goals
  if (state.goals.length > 0) {
    const done = state.goals.filter(g => g.done).length;
    const total = state.goals.length;
    lines.push(row(`│ ${c.bold}Goals:${c.reset} ${done}/${total} ${progressBar(done, total, 20)}`, w));
    for (const g of state.goals.slice(0, 7)) {
      const icon = g.done ? `${c.green}[✓]${c.reset}` : `${c.dim}[ ]${c.reset}`;
      lines.push(row(`│   ${icon} ${g.description}`, w));
    }
    if (state.goals.length > 7) {
      lines.push(row(`│   ${c.dim}... +${state.goals.length - 7} more${c.reset}`, w));
    }
    lines.push(row(`│`, w));
  }

  // Issues (last 5)
  if (state.issues.length > 0) {
    lines.push(`├${hr}┤`);
    lines.push(row(`│ ${c.bold}Issues (${state.issues.length}):${c.reset}`, w));
    for (const issue of state.issues.slice(-5)) {
      const icon = severity(issue.level);
      const file = issue.file.length > 20 ? '...' + issue.file.slice(-17) : issue.file;
      lines.push(row(`│  ${icon} ${c.dim}${file}${c.reset} ${issue.message}`, w));
    }
  }

  // Watched files count
  lines.push(`├${hr}┤`);
  lines.push(row(`│ ${c.dim}Watching: ${state.watchedFiles.length} files${c.reset}`, w));
  lines.push(`└${hr}┘`);

  process.stdout.write(lines.join('\n') + '\n');
}

function progressBar(value: number, max: number, width: number): string {
  const pct = max > 0 ? value / max : 0;
  const filled = Math.round(pct * width);
  const empty = width - filled;
  const color = pct >= 0.8 ? c.green : pct >= 0.6 ? c.yellow : c.red;
  return `${color}${'█'.repeat(filled)}${c.dim}${'░'.repeat(empty)}${c.reset}`;
}

function row(content: string, width: number): string {
  // Strip ANSI for visible length calculation
  const visible = content.replace(/\x1b\[[0-9;]*m/g, '');
  const padding = width - visible.length;
  if (padding <= 0) return content.slice(0, width - 1) + '│';
  return content + ' '.repeat(padding - 1) + '│';
}

function time(): string {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}
