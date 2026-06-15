import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import {
  loadTemplateConfig,
  saveTemplateConfig,
  formatTemplateConfigSummary,
  type TemplateConfig,
} from '../engines/spec-engine/templates/customize.js';

export function registerTemplateCustomizeTool(server: McpServer, ctx: AppContext) {
  server.registerTool(
    'loopspec_template',
    {
      title: 'Customize Templates',
      description: 'Configure which spec documents to generate, add custom sections, skip documents, or provide entirely custom templates. Persisted in .loopspec/template-config.json.',
      inputSchema: z.object({
        action: z.enum(['show', 'skip', 'unskip', 'add_section', 'remove_section', 'set_template', 'reset']).describe('Action to perform'),
        document: z.string().optional().describe('Target document (e.g. PRD.md, TRD.md)'),
        section_title: z.string().optional().describe('Custom section title (for add_section)'),
        section_prompt: z.string().optional().describe('Custom section prompt/content (for add_section)'),
        section_position: z.enum(['before', 'after']).optional().describe('Position relative to anchor'),
        section_anchor: z.string().optional().describe('Existing section title to position relative to'),
        template_content: z.string().optional().describe('Full custom template content (for set_template)'),
      }),
    },
    async (args) => {
      const { action, document, section_title, section_prompt, section_position, section_anchor, template_content } = args as {
        action: string; document?: string; section_title?: string; section_prompt?: string;
        section_position?: 'before' | 'after'; section_anchor?: string; template_content?: string;
      };

      const config = await loadTemplateConfig(ctx);

      switch (action) {
        case 'show': {
          return { content: [{ type: 'text' as const, text: formatTemplateConfigSummary(config) }] };
        }

        case 'skip': {
          if (!document) return { content: [{ type: 'text' as const, text: '❌ Provide `document` to skip (e.g. "UIBrief.md")' }] };
          config.skip = config.skip || [];
          if (!config.skip.includes(document)) config.skip.push(document);
          await saveTemplateConfig(ctx, config);
          return { content: [{ type: 'text' as const, text: `✓ Skipped \`${document}\`. It won't be generated on next init.` }] };
        }

        case 'unskip': {
          if (!document) return { content: [{ type: 'text' as const, text: '❌ Provide `document` to unskip' }] };
          config.skip = (config.skip || []).filter(d => d !== document);
          await saveTemplateConfig(ctx, config);
          return { content: [{ type: 'text' as const, text: `✓ Restored \`${document}\` to active documents.` }] };
        }

        case 'add_section': {
          if (!document || !section_title || !section_prompt) {
            return { content: [{ type: 'text' as const, text: '❌ Provide `document`, `section_title`, and `section_prompt`' }] };
          }
          config.customSections = config.customSections || {};
          config.customSections[document] = config.customSections[document] || [];
          config.customSections[document].push({
            title: section_title,
            prompt: section_prompt,
            position: section_position,
            anchor: section_anchor,
          });
          await saveTemplateConfig(ctx, config);
          return { content: [{ type: 'text' as const, text: `✓ Added "${section_title}" section to ${document}.` }] };
        }

        case 'remove_section': {
          if (!document || !section_title) {
            return { content: [{ type: 'text' as const, text: '❌ Provide `document` and `section_title`' }] };
          }
          if (config.customSections?.[document]) {
            config.customSections[document] = config.customSections[document].filter(s => s.title !== section_title);
            await saveTemplateConfig(ctx, config);
          }
          return { content: [{ type: 'text' as const, text: `✓ Removed "${section_title}" from ${document}.` }] };
        }

        case 'set_template': {
          if (!document || !template_content) {
            return { content: [{ type: 'text' as const, text: '❌ Provide `document` and `template_content`' }] };
          }
          config.customTemplates = config.customTemplates || {};
          config.customTemplates[document] = template_content;
          await saveTemplateConfig(ctx, config);
          return { content: [{ type: 'text' as const, text: `✓ Set custom template for ${document}. This replaces the default entirely.` }] };
        }

        case 'reset': {
          await saveTemplateConfig(ctx, {});
          return { content: [{ type: 'text' as const, text: '✓ Template configuration reset to defaults.' }] };
        }

        default:
          return { content: [{ type: 'text' as const, text: `Unknown action: ${action}` }] };
      }
    }
  );
}
