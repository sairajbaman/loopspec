import { describe, it, expect } from 'vitest';
import { classifyTask } from '../../src/engines/context-router/index.js';

describe('Context Router', () => {
  it('classifies frontend task', () => {
    const result = classifyTask('Build the invoice list component with pagination');
    expect(result.domain).toBe('frontend');
  });

  it('classifies backend task', () => {
    const result = classifyTask('Create API endpoint for user authentication');
    expect(result.domain).toBe('backend');
  });

  it('classifies design task', () => {
    const result = classifyTask('Update the color theme and font tokens');
    expect(result.domain).toBe('design');
  });

  it('classifies devops task', () => {
    const result = classifyTask('Set up Docker deployment with CI pipeline');
    expect(result.domain).toBe('devops');
  });

  it('extracts entities from task', () => {
    const result = classifyTask('Build invoice dashboard page');
    expect(result.keywords).toContain('invoice');
    expect(result.keywords).toContain('dashboard');
  });
});
