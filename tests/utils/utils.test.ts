import { describe, it, expect } from 'vitest';
import { parseMarkdownSections, extractSection } from '../../src/utils/markdown.js';
import { estimateTokens, truncateToTokenBudget } from '../../src/utils/tokens.js';

describe('Markdown Utils', () => {
  const sample = `# Title

Some intro.

## Section One

Content of section one.
More content.

## Section Two

Content of section two.

### Subsection

Nested content.`;

  it('parses headings and content', () => {
    const sections = parseMarkdownSections(sample);
    expect(sections.length).toBe(4);
    expect(sections[0].heading).toBe('Title');
    expect(sections[0].level).toBe(1);
    expect(sections[1].heading).toBe('Section One');
    expect(sections[1].content).toContain('Content of section one');
  });

  it('extracts section by heading', () => {
    const content = extractSection(sample, 'Section Two');
    expect(content).toContain('Content of section two');
  });

  it('returns null for missing section', () => {
    const content = extractSection(sample, 'Nonexistent');
    expect(content).toBeNull();
  });
});

describe('Token Utils', () => {
  it('estimates tokens from text length', () => {
    const tokens = estimateTokens('Hello world'); // 11 chars
    expect(tokens).toBe(3); // ceil(11/4)
  });

  it('truncates to token budget', () => {
    const text = 'a'.repeat(1000);
    const truncated = truncateToTokenBudget(text, 50); // 50 tokens = 200 chars
    expect(truncated.length).toBeLessThan(300); // 200 chars + truncation message
    expect(truncated).toContain('[...truncated');
  });

  it('does not truncate if within budget', () => {
    const text = 'short text';
    const result = truncateToTokenBudget(text, 1000);
    expect(result).toBe(text);
  });
});
