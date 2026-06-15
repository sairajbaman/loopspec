export interface MarkdownSection {
  heading: string;
  level: number;
  content: string;
}

export function parseMarkdownSections(md: string): MarkdownSection[] {
  const lines = md.split('\n');
  const sections: MarkdownSection[] = [];
  let current: MarkdownSection | null = null;
  const contentLines: string[] = [];

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      if (current) {
        current.content = contentLines.join('\n').trim();
        sections.push(current);
        contentLines.length = 0;
      }
      current = { heading: match[2], level: match[1].length, content: '' };
    } else if (current) {
      contentLines.push(line);
    }
  }
  if (current) {
    current.content = contentLines.join('\n').trim();
    sections.push(current);
  }
  return sections;
}

export function extractSection(md: string, heading: string): string | null {
  const sections = parseMarkdownSections(md);
  const section = sections.find((s) => s.heading.toLowerCase().includes(heading.toLowerCase()));
  return section ? section.content : null;
}
