import { describe, it, expect } from 'vitest';
import { generateChecklist, type ModelProfile } from '../../src/engines/profiler/index.js';
import { impactAnalysis, queryGraph, type ProjectGraph } from '../../src/engines/graph/index.js';

describe('Model Profiler', () => {
  describe('generateChecklist', () => {
    it('generates warnings for low-score blind spots', () => {
      const profile: ModelProfile = {
        model: 'test', lastUpdated: '', totalSessions: 5,
        blindSpots: {
          loadingStates: { category: 'loadingStates', missed: 8, hit: 2, score: 20 },
          errorStates: { category: 'errorStates', missed: 2, hit: 8, score: 80 },
        },
        adaptiveChecklist: [],
        antiPatternFrequency: { any_types: 10 },
      };
      const checklist = generateChecklist(profile);
      expect(checklist.some(c => c.includes('Loading states'))).toBe(true);
      expect(checklist.some(c => c.includes('any types'))).toBe(true);
      // errorStates is 80% — should NOT appear as warning
      expect(checklist.some(c => c.includes('Error handling'))).toBe(false);
    });

    it('returns empty for perfect profile', () => {
      const profile: ModelProfile = {
        model: 'test', lastUpdated: '', totalSessions: 5,
        blindSpots: {
          loadingStates: { category: 'loadingStates', missed: 1, hit: 9, score: 90 },
        },
        adaptiveChecklist: [],
        antiPatternFrequency: {},
      };
      const checklist = generateChecklist(profile);
      expect(checklist.length).toBe(0);
    });
  });
});

describe('Graph-of-Thought', () => {
  const mockGraph: ProjectGraph = {
    nodes: [
      { id: 'file:src/utils.ts', type: 'file', name: 'utils.ts', file: 'src/utils.ts' },
      { id: 'file:src/app.ts', type: 'file', name: 'app.ts', file: 'src/app.ts' },
      { id: 'function:src/utils.ts:formatDate', type: 'function', name: 'formatDate', file: 'src/utils.ts', line: 5 },
      { id: 'type:src/utils.ts:DateFormat', type: 'type', name: 'DateFormat', file: 'src/utils.ts' },
      { id: 'component:src/app.ts:App', type: 'component', name: 'App', file: 'src/app.ts' },
    ],
    edges: [
      { source: 'file:src/app.ts', target: 'file:src/utils.ts', type: 'imports' },
      { source: 'file:src/app.ts', target: 'function:src/utils.ts:formatDate', type: 'references' },
      { source: 'file:src/app.ts', target: 'type:src/utils.ts:DateFormat', type: 'references' },
    ],
  };

  describe('impactAnalysis', () => {
    it('finds files that depend on changed file', () => {
      const result = impactAnalysis(mockGraph, 'src/utils.ts');
      expect(result.affected.length).toBeGreaterThan(0);
      expect(result.affected[0].node.file).toBe('src/app.ts');
    });

    it('returns empty for file with no dependents', () => {
      const result = impactAnalysis(mockGraph, 'src/app.ts');
      expect(result.affected.length).toBe(0);
    });

    it('includes summary text', () => {
      const result = impactAnalysis(mockGraph, 'src/utils.ts');
      expect(result.summary).toContain('src/utils.ts');
      expect(result.summary).toContain('src/app.ts');
    });
  });

  describe('queryGraph', () => {
    it('finds nodes by name', () => {
      const results = queryGraph(mockGraph, 'formatDate');
      expect(results.length).toBe(1);
      expect(results[0].type).toBe('function');
    });

    it('finds nodes by file path', () => {
      const results = queryGraph(mockGraph, 'utils');
      expect(results.length).toBeGreaterThanOrEqual(3); // file + function + type
    });

    it('is case-insensitive', () => {
      const results = queryGraph(mockGraph, 'APP');
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns empty for no match', () => {
      const results = queryGraph(mockGraph, 'nonexistent_xyz');
      expect(results.length).toBe(0);
    });
  });
});
