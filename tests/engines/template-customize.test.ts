import { describe, it, expect } from 'vitest';
import {
  getActiveDocuments,
  applyCustomSections,
  formatTemplateConfigSummary,
  type TemplateConfig,
} from '../../src/engines/spec-engine/templates/customize.js';

describe('Template Customization', () => {
  describe('getActiveDocuments', () => {
    it('returns all defaults when no config', () => {
      const docs = getActiveDocuments({});
      expect(docs).toContain('PRD.md');
      expect(docs).toContain('TRD.md');
      expect(docs).toContain('Schema.md');
      expect(docs.length).toBe(8);
    });

    it('respects skip list', () => {
      const docs = getActiveDocuments({ skip: ['UIBrief.md', 'DesignSystem.md'] });
      expect(docs).not.toContain('UIBrief.md');
      expect(docs).not.toContain('DesignSystem.md');
      expect(docs.length).toBe(6);
    });

    it('respects custom documents list', () => {
      const docs = getActiveDocuments({ documents: ['PRD.md', 'Schema.md'] });
      expect(docs).toEqual(['PRD.md', 'Schema.md']);
    });

    it('applies skip to custom documents list', () => {
      const docs = getActiveDocuments({ documents: ['PRD.md', 'Schema.md', 'TRD.md'], skip: ['TRD.md'] });
      expect(docs).toEqual(['PRD.md', 'Schema.md']);
    });
  });

  describe('applyCustomSections', () => {
    const baseContent = '# Doc\n\n## Overview\nSome content\n\n## Details\nMore content';

    it('appends section at end when no anchor', () => {
      const config: TemplateConfig = {
        customSections: {
          'test.md': [{ title: 'Custom', prompt: 'Custom content here' }],
        },
      };
      const result = applyCustomSections(baseContent, 'test.md', config);
      expect(result).toContain('## Custom');
      expect(result).toContain('Custom content here');
    });

    it('places section after anchor', () => {
      const config: TemplateConfig = {
        customSections: {
          'test.md': [{ title: 'After Overview', prompt: 'After content', position: 'after', anchor: 'Overview' }],
        },
      };
      const result = applyCustomSections(baseContent, 'test.md', config);
      const overviewIdx = result.indexOf('## Overview');
      const customIdx = result.indexOf('## After Overview');
      const detailsIdx = result.indexOf('## Details');
      expect(customIdx).toBeGreaterThan(overviewIdx);
      expect(customIdx).toBeLessThan(detailsIdx);
    });

    it('places section before anchor', () => {
      const config: TemplateConfig = {
        customSections: {
          'test.md': [{ title: 'Before Details', prompt: 'Before content', position: 'before', anchor: 'Details' }],
        },
      };
      const result = applyCustomSections(baseContent, 'test.md', config);
      const customIdx = result.indexOf('## Before Details');
      const detailsIdx = result.indexOf('## Details');
      expect(customIdx).toBeLessThan(detailsIdx);
    });

    it('returns unchanged content when no custom sections for doc', () => {
      const config: TemplateConfig = {
        customSections: { 'other.md': [{ title: 'X', prompt: 'Y' }] },
      };
      const result = applyCustomSections(baseContent, 'test.md', config);
      expect(result).toBe(baseContent);
    });
  });

  describe('formatTemplateConfigSummary', () => {
    it('shows default state', () => {
      const summary = formatTemplateConfigSummary({});
      expect(summary).toContain('Active documents');
      expect(summary).toContain('PRD.md');
    });

    it('shows skipped documents', () => {
      const summary = formatTemplateConfigSummary({ skip: ['UIBrief.md'] });
      expect(summary).toContain('Skipped');
      expect(summary).toContain('UIBrief.md');
    });

    it('shows custom sections', () => {
      const summary = formatTemplateConfigSummary({
        customSections: { 'PRD.md': [{ title: 'Risk Matrix', prompt: 'Generate risk matrix' }] },
      });
      expect(summary).toContain('Custom sections');
      expect(summary).toContain('PRD.md');
    });
  });
});
