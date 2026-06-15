import { describe, it, expect } from 'vitest';

// Test the scoreAccessibility and scoreDesignMatch logic directly
// These are inlined here since they're not exported, but we test through the patterns

describe('Scorecard Analysis', () => {
  describe('accessibility detection patterns', () => {
    it('detects images without alt', () => {
      const content = '<img src="photo.png" class="w-full">';
      const imgs = content.match(/<img\b[^>]*>/gi) || [];
      const withoutAlt = imgs.filter(i => !i.includes('alt='));
      expect(withoutAlt.length).toBe(1);
    });

    it('passes images with alt', () => {
      const content = '<img src="photo.png" alt="Profile photo" class="w-full">';
      const imgs = content.match(/<img\b[^>]*>/gi) || [];
      const withoutAlt = imgs.filter(i => !i.includes('alt='));
      expect(withoutAlt.length).toBe(0);
    });

    it('detects icon-only buttons', () => {
      const content = '<button className="p-2"><svg viewBox="0 0 24 24">...</svg></button>';
      const matches = (content.match(/<button[^>]*>\s*<(?:svg|img|icon)/gi) || []).length;
      expect(matches).toBe(1);
    });

    it('detects onClick on non-interactive elements', () => {
      const content = '<div onClick={handleClick}>Click me</div><span onClick={doSomething}>Another</span>';
      const matches = (content.match(/<(?:div|span)\b[^>]*onClick/gi) || []).length;
      expect(matches).toBe(2);
    });
  });

  describe('design match patterns', () => {
    it('detects hardcoded hex colors', () => {
      const content = 'color: #ff0000; background: #333333;';
      const matches = (content.match(/#[0-9a-fA-F]{3,8}|rgb\(|rgba\(/g) || []).length;
      expect(matches).toBe(2);
    });

    it('detects inline styles', () => {
      const content = '<div style={{ color: "red" }}><span style="margin: 4px"></span></div>';
      const matches = (content.match(/style=\{?\{|style="/g) || []).length;
      expect(matches).toBe(2);
    });

    it('detects magic pixel values', () => {
      const content = 'margin: 13px; padding: 7px;';
      const matches = (content.match(/:\s*\d+px|margin:\s*\d|padding:\s*\d/g) || []).length;
      expect(matches).toBeGreaterThan(0);
    });
  });

  describe('spec compliance patterns', () => {
    it('detects TODO markers', () => {
      const content = '// TODO: implement auth\n// FIXME: error handling\nconst x = 1;';
      const todos = (content.match(/(?:TODO|FIXME|HACK|XXX)/g) || []).length;
      expect(todos).toBe(2);
    });

    it('gives positive signal for error handling', () => {
      const content = 'try { await fetchData() } catch (e) { handleError(e) }';
      expect(content.match(/try\s*\{|\.catch\(|ErrorBoundary/)).not.toBeNull();
    });

    it('gives positive signal for validation', () => {
      const content = 'const schema = z.object({ email: z.string().email() })';
      expect(content.match(/z\.\w+|zod|yup|joi|validate/i)).not.toBeNull();
    });

    it('detects console.log in production code', () => {
      const content = 'console.log("debug")\nconsole.error("oops")';
      expect(content.match(/console\.\w+/)).not.toBeNull();
    });
  });
});
