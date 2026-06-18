import path from 'node:path';

const isWindows = process.platform === 'win32';

export function buildLoopspecEntry(typeField?: string): Record<string, unknown> {
  const entry: Record<string, unknown> = isWindows
    ? {
        command: 'cmd',
        args: ['/c', 'npx', '-y', 'loopspec-mcp'],
        env: { LOOPSPEC_PROJECT_DIR: path.resolve(process.cwd()) },
      }
    : {
        command: 'npx',
        args: ['-y', 'loopspec-mcp'],
        env: { LOOPSPEC_PROJECT_DIR: path.resolve(process.cwd()) },
      };
  if (typeField) entry.type = typeField;
  return entry;
}

export function mergeLoopspecEntry(
  existingJson: string | null,
  configKey: 'mcpServers' | 'servers',
  typeField?: string
): string {
  let parsed: Record<string, unknown>;
  try {
    parsed = existingJson ? JSON.parse(existingJson) : {};
  } catch (e) {
    throw new Error('Invalid JSON: ' + (e as Error).message);
  }
  if (!parsed[configKey] || typeof parsed[configKey] !== 'object') {
    parsed[configKey] = {};
  }
  (parsed[configKey] as Record<string, unknown>).loopspec = buildLoopspecEntry(typeField);
  return JSON.stringify(parsed, null, 2) + '\n';
}

export function removeLoopspecEntry(
  existingJson: string,
  configKey: 'mcpServers' | 'servers'
): string {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(existingJson);
  } catch (e) {
    throw new Error('Invalid JSON: ' + (e as Error).message);
  }
  const servers = parsed[configKey] as Record<string, unknown> | undefined;
  if (servers && 'loopspec' in servers) {
    delete servers.loopspec;
  }
  if (servers && Object.keys(servers).length === 0) {
    delete parsed[configKey];
  }
  if (Object.keys(parsed).length === 0) {
    return '{}\n';
  }
  return JSON.stringify(parsed, null, 2) + '\n';
}
