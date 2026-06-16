import { describe, it, expect } from 'vitest';
import { PALETTES, FONT_PAIRINGS, UI_STYLES } from '../../src/engines/design-engine/data.js';
import { getAvailablePacks, getGuardrailPack } from '../../src/engines/guardrails/index.js';

describe('Design Engine Data', () => {
  it('has 42 palettes', () => {
    expect(PALETTES.length).toBe(42);
  });

  it('has 28 font pairings', () => {
    expect(FONT_PAIRINGS.length).toBe(28);
  });

  it('has 22 UI styles', () => {
    expect(UI_STYLES.length).toBe(22);
  });

  it('all palettes have required fields', () => {
    for (const p of PALETTES) {
      expect(p.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(p.text).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(p.industry.length).toBeGreaterThan(0);
      expect(p.keywords.length).toBeGreaterThan(0);
    }
  });

  it('all font pairings have heading and body', () => {
    for (const f of FONT_PAIRINGS) {
      expect(f.heading.length).toBeGreaterThan(0);
      expect(f.body.length).toBeGreaterThan(0);
    }
  });

  it('all UI styles have cssProperties and antiPatterns', () => {
    for (const s of UI_STYLES) {
      expect(Object.keys(s.cssProperties).length).toBeGreaterThan(0);
      expect(s.antiPatterns.length).toBeGreaterThan(0);
    }
  });
});

describe('Guardrail Packs', () => {
  it('lists 6 available packs', () => {
    expect(getAvailablePacks().length).toBe(6);
  });

  it('loads security-owasp pack', () => {
    const pack = getGuardrailPack('security-owasp');
    expect(pack).not.toBeNull();
    expect(pack!.rules.length).toBe(10);
    expect(pack!.rules.every((r) => r.category === 'security')).toBe(true);
  });

  it('returns null for unknown pack', () => {
    expect(getGuardrailPack('nonexistent')).toBeNull();
  });
});
