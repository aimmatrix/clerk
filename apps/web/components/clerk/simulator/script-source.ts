import type { SimScriptStep } from '@clerk/core';
import { loadScript } from '@/lib/sim-script';
import { FIXTURE_SCRIPT } from './fixture-script';

/**
 * Loads demo/seed/london-meetup.json through C8's validating `loadScript()`.
 * If the seed is ever malformed we warn loudly and play the bundled fixture instead, so a bad
 * edit to the JSON can't leave the stage demo with an empty simulator.
 */
export async function loadSimScript(): Promise<SimScriptStep[]> {
  try {
    return loadScript();
  } catch (error) {
    console.warn('[simulator] seed script invalid, using bundled fixture:', error);
    return FIXTURE_SCRIPT;
  }
}
