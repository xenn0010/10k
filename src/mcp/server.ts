/**
 * MCP Server for Dynamic Template Engine
 *
 * This exposes the template engine as an MCP server that can be
 * used by any AI agent (Claude, etc.) to generate dynamic documents.
 *
 * Tools exposed:
 * - create_template: Create a new template structure
 * - add_text_element: Add a dynamic text element to a template
 * - add_image_element: Add an image element
 * - add_shape_element: Add a shape (rectangle, circle, etc.)
 * - inject_data: Inject data into a template
 * - render_html: Render template to HTML
 * - render_pdf: Render template to PDF
 * - fit_text: Calculate optimal font size for text in container
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { DynamicTemplateEngine, Template } from '../index.js';
import * as fs from 'fs';

// In-memory template storage
const templates = new Map<string, Template>();
const engine = new DynamicTemplateEngine();

// Tool definitions
const tools: Tool[] = [
  {
    name: 'create_template',
    description: 'Create a new dynamic template for document generation. Returns a template ID.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the template (e.g., "Property Flyer", "Offering Memorandum")',
        },
        pageWidth: {
          type: 'number',
          description: 'Page width in points (default: 612 for US Letter)',
          default: 612,
        },
        pageHeight: {
          type: 'number',
          description: 'Page height in points (default: 792 for US Letter)',
          default: 792,
        },
        background: {
          type: 'string',
          description: 'Background color (default: #ffffff)',
          default: '#ffffff',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'add_text_element',
    description: `Add a dynamic text element to a template. The text will automatically scale to fit within its container - this is the key feature that prevents overflow!

Use this for:
- Property names (may be short or very long)
- Addresses
- Descriptions
- Any text that varies in length`,
    inputSchema: {
      type: 'object',
      properties: {
        templateId: {
          type: 'string',
          description: 'ID of the template to add the element to',
        },
        x: { type: 'number', description: 'X position in points' },
        y: { type: 'number', description: 'Y position in points' },
        width: { type: 'number', description: 'Container width in points' },
        height: { type: 'number', description: 'Container height in points' },
        content: {
          type: 'string',
          description: 'Default text content or placeholder',
        },
        binding: {
          type: 'string',
          description: 'Data binding expression (e.g., "{{property.name}}" or "{{price|currency}}")',
        },
        fontSize: { type: 'number', description: 'Base font size (default: 14)', default: 14 },
        minFontSize: {
          type: 'number',
          description: 'Minimum font size when shrinking (default: 8)',
          default: 8,
        },
        maxFontSize: {
          type: 'number',
          description: 'Maximum font size (default: same as fontSize)',
        },
        fontFamily: { type: 'string', description: 'Font family (default: Arial)', default: 'Arial' },
        fontWeight: { type: 'number', description: 'Font weight (default: 400)', default: 400 },
        color: { type: 'string', description: 'Text color (default: #000000)', default: '#000000' },
        textAlign: {
          type: 'string',
          enum: ['left', 'center', 'right', 'justify'],
          description: 'Horizontal text alignment',
          default: 'left',
        },
        verticalAlign: {
          type: 'string',
          enum: ['top', 'middle', 'bottom'],
          description: 'Vertical text alignment',
          default: 'top',
        },
        overflow: {
          type: 'string',
          enum: ['shrink', 'wrap', 'ellipsis', 'clip'],
          description: 'How to handle text that exceeds container bounds. "shrink" auto-scales font size.',
          default: 'shrink',
        },
      },
      required: ['templateId', 'x', 'y', 'width', 'height', 'content'],
    },
  },
  {
    name: 'add_image_element',
    description: 'Add an image element to a template',
    inputSchema: {
      type: 'object',
      properties: {
        templateId: { type: 'string', description: 'ID of the template' },
        x: { type: 'number', description: 'X position in points' },
        y: { type: 'number', description: 'Y position in points' },
        width: { type: 'number', description: 'Width in points' },
        height: { type: 'number', description: 'Height in points' },
        src: { type: 'string', description: 'Image source URL or path' },
        binding: { type: 'string', description: 'Data binding for dynamic image (e.g., "{{property.heroImage}}")' },
        objectFit: {
          type: 'string',
          enum: ['cover', 'contain', 'fill', 'none'],
          description: 'How the image should fit in its container',
          default: 'cover',
        },
      },
      required: ['templateId', 'x', 'y', 'width', 'height', 'src'],
    },
  },
  {
    name: 'add_shape_element',
    description: 'Add a shape element (rectangle, circle, etc.) to a template. Useful for backgrounds, boxes, dividers.',
    inputSchema: {
      type: 'object',
      properties: {
        templateId: { type: 'string', description: 'ID of the template' },
        x: { type: 'number', description: 'X position in points' },
        y: { type: 'number', description: 'Y position in points' },
        width: { type: 'number', description: 'Width in points' },
        height: { type: 'number', description: 'Height in points' },
        shapeType: {
          type: 'string',
          enum: ['rectangle', 'circle', 'ellipse'],
          description: 'Type of shape',
          default: 'rectangle',
        },
        fill: { type: 'string', description: 'Fill color (e.g., "#1a365d")', default: '#ffffff' },
        stroke: { type: 'string', description: 'Border color' },
        strokeWidth: { type: 'number', description: 'Border width in points' },
        borderRadius: { type: 'number', description: 'Corner radius for rectangles' },
      },
      required: ['templateId', 'x', 'y', 'width', 'height'],
    },
  },
  {
    name: 'inject_data',
    description: `Inject data into a template, replacing all {{bindings}} with actual values.

Supported formatters:
- {{value|currency}} → $1,234,567.00
- {{value|number}} → 1,234,567
- {{value|percent}} → 6.5%
- {{value|sqft}} → 45,000 SF
- {{value|uppercase}} → UPPERCASE
- {{value|date}} → 1/15/2024`,
    inputSchema: {
      type: 'object',
      properties: {
        templateId: { type: 'string', description: 'ID of the template' },
        data: {
          type: 'object',
          description: 'Data object to inject (e.g., { property: { name: "Sunset Plaza", price: 5500000 } })',
        },
      },
      required: ['templateId', 'data'],
    },
  },
  {
    name: 'render_html',
    description: 'Render a template to HTML. The HTML includes a JavaScript runtime that automatically fits text to containers.',
    inputSchema: {
      type: 'object',
      properties: {
        templateId: { type: 'string', description: 'ID of the template' },
        outputPath: { type: 'string', description: 'Optional file path to save the HTML' },
      },
      required: ['templateId'],
    },
  },
  {
    name: 'render_pdf',
    description: 'Render a template to PDF with pixel-perfect fidelity',
    inputSchema: {
      type: 'object',
      properties: {
        templateId: { type: 'string', description: 'ID of the template' },
        outputPath: { type: 'string', description: 'File path to save the PDF' },
      },
      required: ['templateId', 'outputPath'],
    },
  },
  {
    name: 'calculate_text_fit',
    description: 'Calculate the optimal font size for text to fit within given dimensions. Useful for previewing how text will render.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The text content' },
        containerWidth: { type: 'number', description: 'Container width in points' },
        containerHeight: { type: 'number', description: 'Container height in points' },
        minFontSize: { type: 'number', description: 'Minimum font size', default: 8 },
        maxFontSize: { type: 'number', description: 'Maximum font size', default: 72 },
        fontFamily: { type: 'string', description: 'Font family', default: 'Arial' },
      },
      required: ['text', 'containerWidth', 'containerHeight'],
    },
  },
  {
    name: 'list_templates',
    description: 'List all templates currently in memory',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_template',
    description: 'Get the full template structure as JSON',
    inputSchema: {
      type: 'object',
      properties: {
        templateId: { type: 'string', description: 'ID of the template' },
      },
      required: ['templateId'],
    },
  },
];

// Create the MCP server
const server = new Server(
  {
    name: 'dynamic-template-engine',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      case 'create_template': {
        const template = engine.createTemplate({
          name: args.name as string,
          pages: [
            engine.createPage({
              size: {
                width: (args.pageWidth as number) || 612,
                height: (args.pageHeight as number) || 792,
                unit: 'pt',
              },
              background: (args.background as string) || '#ffffff',
            }),
          ],
        });
        templates.set(template.id, template);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                templateId: template.id,
                message: `Template "${args.name}" created successfully`,
              }),
            },
          ],
        };
      }

      case 'add_text_element': {
        const template = templates.get(args.templateId as string);
        if (!template) {
          throw new Error(`Template not found: ${args.templateId}`);
        }

        const element = engine.createTextElement({
          x: args.x as number,
          y: args.y as number,
          width: args.width as number,
          height: args.height as number,
          content: args.content as string,
          binding: args.binding as string | undefined,
          style: {
            fontFamily: (args.fontFamily as string) || 'Arial',
            fontSize: (args.fontSize as number) || 14,
            fontWeight: (args.fontWeight as number) || 400,
            color: (args.color as string) || '#000000',
          },
          constraints: {
            minFontSize: (args.minFontSize as number) || 8,
            maxFontSize: (args.maxFontSize as number) || (args.fontSize as number) || 14,
            overflow: (args.overflow as any) || 'shrink',
            textAlign: (args.textAlign as any) || 'left',
            verticalAlign: (args.verticalAlign as any) || 'top',
          },
        });

        template.pages[0]!.elements.push(element);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                elementId: element.id,
                message: 'Text element added',
              }),
            },
          ],
        };
      }

      case 'add_image_element': {
        const template = templates.get(args.templateId as string);
        if (!template) {
          throw new Error(`Template not found: ${args.templateId}`);
        }

        const element = engine.createImageElement({
          x: args.x as number,
          y: args.y as number,
          width: args.width as number,
          height: args.height as number,
          src: args.src as string,
          binding: args.binding as string | undefined,
          objectFit: (args.objectFit as any) || 'cover',
        });

        template.pages[0]!.elements.push(element);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                elementId: element.id,
                message: 'Image element added',
              }),
            },
          ],
        };
      }

      case 'add_shape_element': {
        const template = templates.get(args.templateId as string);
        if (!template) {
          throw new Error(`Template not found: ${args.templateId}`);
        }

        const element = engine.createShapeElement({
          x: args.x as number,
          y: args.y as number,
          width: args.width as number,
          height: args.height as number,
          shapeType: (args.shapeType as any) || 'rectangle',
          style: {
            fill: args.fill as string,
            stroke: args.stroke as string,
            strokeWidth: args.strokeWidth as number,
            borderRadius: args.borderRadius as number,
          },
        });

        template.pages[0]!.elements.push(element);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                elementId: element.id,
                message: 'Shape element added',
              }),
            },
          ],
        };
      }

      case 'inject_data': {
        const template = templates.get(args.templateId as string);
        if (!template) {
          throw new Error(`Template not found: ${args.templateId}`);
        }

        const injected = await engine.inject(template, args.data as Record<string, any>);
        templates.set(args.templateId as string, injected);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'Data injected successfully',
              }),
            },
          ],
        };
      }

      case 'render_html': {
        const template = templates.get(args.templateId as string);
        if (!template) {
          throw new Error(`Template not found: ${args.templateId}`);
        }

        const html = engine.generateHTML(template);

        if (args.outputPath) {
          fs.writeFileSync(args.outputPath as string, html);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                html: args.outputPath ? undefined : html,
                outputPath: args.outputPath || undefined,
                message: args.outputPath
                  ? `HTML saved to ${args.outputPath}`
                  : 'HTML generated (included in response)',
              }),
            },
          ],
        };
      }

      case 'render_pdf': {
        const template = templates.get(args.templateId as string);
        if (!template) {
          throw new Error(`Template not found: ${args.templateId}`);
        }

        const result = await engine.renderPDF(template);

        if (result.success && args.outputPath) {
          fs.writeFileSync(args.outputPath as string, result.output);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: result.success,
                outputPath: args.outputPath,
                metadata: result.metadata,
                errors: result.errors,
                message: result.success
                  ? `PDF saved to ${args.outputPath}`
                  : `PDF generation failed: ${result.errors?.join(', ')}`,
              }),
            },
          ],
        };
      }

      case 'calculate_text_fit': {
        const { calculateFitFontSize } = await import('../utils/helpers.js');
        const optimalSize = calculateFitFontSize(
          args.text as string,
          args.containerWidth as number,
          args.containerHeight as number,
          (args.minFontSize as number) || 8,
          (args.maxFontSize as number) || 72,
          (args.fontFamily as string) || 'Arial'
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                optimalFontSize: optimalSize,
                text: args.text,
                containerWidth: args.containerWidth,
                containerHeight: args.containerHeight,
              }),
            },
          ],
        };
      }

      case 'list_templates': {
        const templateList = Array.from(templates.entries()).map(([id, t]) => ({
          id,
          name: t.name,
          pageCount: t.pages.length,
          elementCount: t.pages.reduce((sum, p) => sum + p.elements.length, 0),
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                templates: templateList,
              }),
            },
          ],
        };
      }

      case 'get_template': {
        const template = templates.get(args.templateId as string);
        if (!template) {
          throw new Error(`Template not found: ${args.templateId}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                template,
              }),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: (error as Error).message,
          }),
        },
      ],
      isError: true,
    };
  }
});

// Main entry point
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Dynamic Template Engine MCP Server running on stdio');
}

main().catch(console.error);
