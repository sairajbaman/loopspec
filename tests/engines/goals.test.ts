import { describe, it, expect } from 'vitest';
import { decomposeGoals, verifyGoals, type Goal } from '../../src/engines/goals/index.js';

describe('Goal Graph Engine', () => {
  describe('decomposeGoals', () => {
    it('decomposes form features into form goals', () => {
      const goals = decomposeGoals('build invoice form');
      const descriptions = goals.map(g => g.description);
      expect(descriptions).toContain('Schema validation (Zod/Yup)');
      expect(descriptions).toContain('UI form with all fields');
      expect(descriptions).toContain('Loading state');
      expect(descriptions).toContain('Error state');
      expect(descriptions).toContain('Test file with edge cases');
    });

    it('decomposes API features into api goals', () => {
      const goals = decomposeGoals('create payments api');
      const descriptions = goals.map(g => g.description);
      expect(descriptions).toContain('Input validation');
      expect(descriptions).toContain('Authentication check');
      expect(descriptions).toContain('Proper HTTP status codes');
    });

    it('decomposes webhook features', () => {
      const goals = decomposeGoals('stripe webhook handler');
      const descriptions = goals.map(g => g.description);
      expect(descriptions).toContain('Signature verification');
      expect(descriptions).toContain('Idempotency check');
    });

    it('decomposes auth features', () => {
      const goals = decomposeGoals('user authentication flow');
      const descriptions = goals.map(g => g.description);
      expect(descriptions).toContain('Session management');
      expect(descriptions).toContain('Password hashing');
      expect(descriptions).toContain('Rate limiting');
    });

    it('always includes test goal', () => {
      const goals = decomposeGoals('random xyz thing');
      const descriptions = goals.map(g => g.description);
      expect(descriptions).toContain('Test file with edge cases');
    });

    it('combines multiple keyword matches', () => {
      const goals = decomposeGoals('build form with api endpoint');
      expect(goals.length).toBeGreaterThan(10); // form (7) + api (5) + test (1)
    });
  });

  describe('verifyGoals', () => {
    it('marks goal as done when verify pattern matches', () => {
      const goals: Goal[] = [{
        id: '1', description: 'Has validation', status: 'pending',
        verifyPatterns: ['z\\.object|safeParse'], antiPatterns: [], fileGlobs: [],
      }];
      const files = new Map([['test.ts', 'const schema = z.object({ name: z.string() });']]);
      const results = verifyGoals(goals, files);
      expect(results[0].status).toBe('done');
    });

    it('marks goal as pending when pattern not found', () => {
      const goals: Goal[] = [{
        id: '1', description: 'Has validation', status: 'pending',
        verifyPatterns: ['z\\.object|safeParse'], antiPatterns: [], fileGlobs: [],
      }];
      const files = new Map([['test.ts', 'const x = 5;']]);
      const results = verifyGoals(goals, files);
      expect(results[0].status).toBe('pending');
    });

    it('detects anti-patterns', () => {
      const goals: Goal[] = [{
        id: '1', description: 'No any types', status: 'pending',
        verifyPatterns: ['interface|type\\s+\\w+'], antiPatterns: [': any'], fileGlobs: [],
      }];
      const files = new Map([['test.ts', 'interface User { name: string }\nconst x: any = 5;']]);
      const results = verifyGoals(goals, files);
      expect(results[0].antiPatternHits.length).toBeGreaterThan(0);
    });

    it('respects blocked status', () => {
      const goals: Goal[] = [{
        id: '1', description: 'Blocked goal', status: 'blocked',
        verifyPatterns: ['anything'], antiPatterns: [], fileGlobs: [],
      }];
      const results = verifyGoals(goals, new Map());
      expect(results[0].status).toBe('blocked');
    });
  });
});
