import { createContext } from '../../context.js';
import { loadProfile, formatProfile } from '../../engines/profiler/index.js';
import { log } from '../output.js';

export async function runProfileCommand(_flags: Record<string, string | boolean>) {
  const ctx = createContext();
  const profile = await loadProfile(ctx);
  log(`\n${formatProfile(profile)}\n`);
}
