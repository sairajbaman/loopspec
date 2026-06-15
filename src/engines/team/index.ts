import path from 'node:path';
import type { AppContext } from '../../context.js';
import { readFile, writeFile } from '../../utils/files.js';
import { dumpYaml, parseYaml } from '../../utils/yaml.js';

export interface TeamConfig {
  members: number;
  shared_memory: boolean;
  pr_policy: 'human-required' | 'agent-ok' | 'mixed';
}

export async function createTeamConfig(ctx: AppContext, config: TeamConfig): Promise<void> {
  const filePath = path.join(ctx.loopspecDir, 'team.yaml');
  await writeFile(filePath, dumpYaml(config));
}

export async function getTeamConfig(ctx: AppContext): Promise<TeamConfig | null> {
  const filePath = path.join(ctx.loopspecDir, 'team.yaml');
  const content = await readFile(filePath);
  if (!content) return null;
  return parseYaml<TeamConfig>(content);
}

export function isTeamMode(config: TeamConfig | null): boolean {
  return config !== null;
}
