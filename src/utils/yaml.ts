import yaml from 'js-yaml';
import { readFile } from './files.js';

export function parseYaml<T = unknown>(content: string): T {
  return yaml.load(content) as T;
}

export function dumpYaml(data: unknown): string {
  return yaml.dump(data, { lineWidth: 120 });
}

export async function loadYamlFile<T = unknown>(filePath: string): Promise<T | null> {
  const content = await readFile(filePath);
  if (!content) return null;
  return parseYaml<T>(content);
}
