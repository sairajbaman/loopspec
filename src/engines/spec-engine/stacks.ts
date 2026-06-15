import { STACK_PRESETS, type StackPreset } from './stacks-data.js';

export type { StackPreset };

export function loadStackPreset(stackName: string): StackPreset | null {
  return STACK_PRESETS[stackName] || null;
}

export function stackPresetToContext(preset: StackPreset): string {
  const lines = [
    `Framework: ${preset.framework}`,
    `ORM: ${preset.orm}`,
    `Auth: ${preset.auth}`,
    `UI: ${preset.ui_library}`,
    '',
    'Conventions:',
    ...preset.conventions.map((c) => `- ${c}`),
    '',
    'Anti-Patterns:',
    ...preset.anti_patterns.map((a) => `- ${a}`),
  ];
  return lines.join('\n');
}

export function listAvailableStacks(): string[] {
  return Object.keys(STACK_PRESETS);
}
