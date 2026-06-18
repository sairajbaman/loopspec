import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

export interface DetectedTool {
  name: string;
  configPath: string;
  configKey: 'mcpServers' | 'servers';
  typeField?: string;
  action: 'add' | 'update' | 'manual';
  detectedVia: string;
  needsRestart: boolean;
  instructions?: string;
}

interface ToolDefinition {
  name: string;
  binaries: string[];
  projectPaths: string[];
  globalPaths: string[];
  configKey: 'mcpServers' | 'servers';
  typeField?: string;
  needsRestart: boolean;
  instructions?: string;
}

const isWindows = process.platform === 'win32';
const home = homedir();
const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');

function getToolDefinitions(cwd: string): ToolDefinition[] {
  return [
    {
      name: 'Cursor',
      binaries: ['cursor'],
      projectPaths: [path.join(cwd, '.cursor', 'mcp.json')],
      globalPaths: [path.join(home, '.cursor', 'mcp.json')],
      configKey: 'mcpServers',
      needsRestart: true,
      instructions: 'Restart Cursor to activate',
    },
    {
      name: 'VS Code',
      binaries: ['code'],
      projectPaths: [path.join(cwd, '.vscode', 'mcp.json')],
      globalPaths: [],
      configKey: 'servers',
      typeField: 'stdio',
      needsRestart: true,
      instructions: 'Reload VS Code window (Ctrl+Shift+P → Reload Window)',
    },
    {
      name: 'Windsurf',
      binaries: ['windsurf'],
      projectPaths: [],
      globalPaths: [path.join(home, '.codeium', 'windsurf', 'mcp_config.json')],
      configKey: 'mcpServers',
      needsRestart: false,
    },
    {
      name: 'Cline',
      binaries: [],
      projectPaths: [],
      globalPaths: [
        isWindows
          ? path.join(appData, 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json')
          : path.join(home, '.config', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
      ],
      configKey: 'mcpServers',
      needsRestart: true,
      instructions: 'Restart the Cline extension',
    },
    {
      name: 'Claude Code',
      binaries: ['claude'],
      projectPaths: [path.join(cwd, '.mcp.json')],
      globalPaths: [],
      configKey: 'mcpServers',
      needsRestart: false,
      instructions: 'Picked up on next prompt',
    },
    {
      name: 'Kiro',
      binaries: ['kiro'],
      projectPaths: [path.join(cwd, '.kiro', 'settings', 'mcp.json')],
      globalPaths: [path.join(home, '.kiro', 'settings', 'mcp.json')],
      configKey: 'mcpServers',
      needsRestart: false,
    },
    {
      name: 'Amazon Q',
      binaries: ['q', 'qchat'],
      projectPaths: [],
      globalPaths: [path.join(home, '.aws', 'amazonq', 'mcp.json')],
      configKey: 'mcpServers',
      needsRestart: false,
    },
    {
      name: 'Continue',
      binaries: [],
      projectPaths: [path.join(cwd, '.continue', 'config.json')],
      globalPaths: [
        isWindows
          ? path.join(appData, 'continue', 'config.json')
          : path.join(home, '.continue', 'config.json'),
      ],
      configKey: 'mcpServers',
      needsRestart: true,
      instructions: 'Restart Continue extension to activate',
    },
    {
      name: 'Codebuff',
      binaries: ['codebuff'],
      projectPaths: [path.join(cwd, 'codebuff_config.json')],
      globalPaths: [],
      configKey: 'mcpServers',
      needsRestart: false,
    },
  ];
}

function binaryExists(name: string): boolean {
  try {
    const cmd = isWindows ? `where ${name}` : `which ${name}`;
    execSync(cmd, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function configHasLoopspec(filePath: string, key: 'mcpServers' | 'servers'): boolean {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    return !!parsed?.[key]?.loopspec;
  } catch {
    return false;
  }
}

export function detectTools(cwd: string = process.cwd()): DetectedTool[] {
  const definitions = getToolDefinitions(cwd);
  const detected: DetectedTool[] = [];

  for (const tool of definitions) {
    let configPath: string | null = null;
    let detectedVia = '';

    // First: check if any binary is on PATH (strongest signal)
    let hasBinary = false;
    for (const bin of tool.binaries) {
      if (binaryExists(bin)) {
        hasBinary = true;
        detectedVia = `PATH (${bin})`;
        break;
      }
    }

    // Check project-level config files (file must actually exist, not just parent dir)
    for (const p of tool.projectPaths) {
      if (existsSync(p)) {
        configPath = p;
        if (!detectedVia) detectedVia = 'project config';
        break;
      }
    }

    // Check global config files (file must actually exist)
    if (!configPath) {
      for (const p of tool.globalPaths) {
        if (existsSync(p)) {
          configPath = p;
          if (!detectedVia) detectedVia = 'global config';
          break;
        }
      }
    }

    // If binary found but no existing config, determine where to write
    if (!configPath && hasBinary) {
      configPath = tool.projectPaths[0] || tool.globalPaths[0] || null;
    }

    // Only detect if we have proof: binary on PATH or config file exists
    if (configPath && (hasBinary || existsSync(configPath))) {
      const hasExisting = existsSync(configPath) && configHasLoopspec(configPath, tool.configKey);
      detected.push({
        name: tool.name,
        configPath: path.resolve(configPath),
        configKey: tool.configKey,
        typeField: tool.typeField,
        action: hasExisting ? 'update' : 'add',
        detectedVia,
        needsRestart: tool.needsRestart,
        instructions: tool.instructions,
      });
    }
  }

  // Always add Gemini as manual if detected on PATH
  if (binaryExists('gemini')) {
    detected.push({
      name: 'Gemini',
      configPath: '',
      configKey: 'mcpServers',
      action: 'manual',
      detectedVia: 'PATH (gemini)',
      needsRestart: true,
      instructions: 'Run: gemini --mcp-server-path "npx -y loopspec-mcp"',
    });
  }

  return detected;
}
