/**
 * Dynamic Template Engine
 *
 * A complete solution for creating dynamic, content-aware templates
 * that maintain visual fidelity regardless of content length.
 *
 * @example
 * ```typescript
 * import { DynamicTemplateEngine } from 'dynamic-template-engine';
 *
 * const engine = new DynamicTemplateEngine();
 *
 * // Load or create a template
 * const template = await engine.createTemplate({
 *   name: 'Property Flyer',
 *   pages: [...]
 * });
 *
 * // Inject data
 * const populated = await engine.inject(template, {
 *   property: {
 *     name: 'Sunset Plaza',
 *     address: '123 Main St, Austin, TX',
 *     price: 5500000,
 *     sqft: 45000
 *   }
 * });
 *
 * // Render to PDF
 * const pdf = await engine.renderPDF(populated);
 * ```
 */

// Export types
export * from './types/index.js';

// Export utilities
export * from './utils/helpers.js';

// Export components
export { PDFParser } from './parser/pdf-parser.js';
export { HTMLGenerator } from './generator/html-generator.js';
export { ContentInjector } from './injector/content-injector.js';
export { PDFRenderer } from './renderer/pdf-renderer.js';

// Main engine class
import { PDFParser } from './parser/pdf-parser.js';
import { HTMLGenerator, GeneratorOptions } from './generator/html-generator.js';
import { ContentInjector } from './injector/content-injector.js';
import { PDFRenderer, PDFRenderOptions } from './renderer/pdf-renderer.js';
import {
  Template,
  TemplatePage,
  TemplateElement,
  TextElement,
  ImageElement,
  ShapeElement,
  SVGElement,
  ContainerElement,
  InjectionData,
  InjectionOptions,
  ParseOptions,
  RenderResult,
} from './types/index.js';
import { generateId, deepClone } from './utils/helpers.js';

export interface EngineOptions {
  parser?: ParseOptions;
  generator?: GeneratorOptions;
  injector?: InjectionOptions;
  renderer?: PDFRenderOptions;
}

export class DynamicTemplateEngine {
  private parser: PDFParser;
  private generator: HTMLGenerator;
  private injector: ContentInjector;
  private renderer: PDFRenderer;

  constructor(options: EngineOptions = {}) {
    this.parser = new PDFParser(options.parser);
    this.generator = new HTMLGenerator(options.generator);
    this.injector = new ContentInjector(options.injector);
    this.renderer = new PDFRenderer(options.renderer);
  }

  // ============================================
  // TEMPLATE OPERATIONS
  // ============================================

  /**
   * Parse a PDF file into a template structure
   */
  async parseTemplate(input: string | Buffer): Promise<Template> {
    const result = await this.parser.parse(input);
    if (!result.success) {
      throw new Error(`Failed to parse template: ${result.errors?.join(', ')}`);
    }
    return result.template;
  }

  /**
   * Create a template from scratch
   */
  createTemplate(config: Partial<Template>): Template {
    return {
      id: generateId('template'),
      name: config.name || 'Untitled Template',
      version: config.version || '1.0.0',
      pages: config.pages || [],
      fonts: config.fonts,
      variables: config.variables,
      metadata: {
        created: new Date().toISOString(),
        ...config.metadata,
      },
    };
  }

  /**
   * Create a template page
   */
  createPage(config: Partial<TemplatePage>): TemplatePage {
    return {
      id: generateId('page'),
      size: config.size || { width: 612, height: 792, unit: 'pt' }, // US Letter
      elements: config.elements || [],
      background: config.background,
      margins: config.margins || { top: 36, right: 36, bottom: 36, left: 36 },
    };
  }

  // ============================================
  // ELEMENT FACTORY METHODS
  // ============================================

  /**
   * Create a dynamic text element
   */
  createTextElement(config: {
    x: number;
    y: number;
    width: number;
    height: number;
    content: string;
    binding?: string;
    style?: Partial<TextElement['style']>;
    constraints?: Partial<TextElement['constraints']>;
  }): TextElement {
    return {
      id: generateId('text'),
      type: 'text',
      bounds: {
        x: config.x,
        y: config.y,
        width: config.width,
        height: config.height,
      },
      content: config.content,
      dataBinding: config.binding,
      style: {
        fontFamily: 'Arial',
        fontSize: 14,
        fontWeight: 400,
        fontStyle: 'normal',
        color: '#000000',
        lineHeight: 1.2,
        ...config.style,
      },
      constraints: {
        maxWidth: config.width,
        maxHeight: config.height,
        minFontSize: 8,
        maxFontSize: config.style?.fontSize || 14,
        overflow: 'shrink',
        textAlign: 'left',
        verticalAlign: 'top',
        ...config.constraints,
      },
      zIndex: 0,
    };
  }

  /**
   * Create an image element
   */
  createImageElement(config: {
    x: number;
    y: number;
    width: number;
    height: number;
    src: string;
    binding?: string;
    objectFit?: ImageElement['objectFit'];
  }): ImageElement {
    return {
      id: generateId('image'),
      type: 'image',
      bounds: {
        x: config.x,
        y: config.y,
        width: config.width,
        height: config.height,
      },
      src: config.src,
      dataBinding: config.binding,
      objectFit: config.objectFit || 'cover',
      constraints: {
        preserveAspectRatio: true,
      },
      zIndex: 0,
    };
  }

  /**
   * Create a shape element (rectangle, circle, etc.)
   */
  createShapeElement(config: {
    x: number;
    y: number;
    width: number;
    height: number;
    shapeType: ShapeElement['shapeType'];
    style?: Partial<ShapeElement['style']>;
  }): ShapeElement {
    return {
      id: generateId('shape'),
      type: 'shape',
      bounds: {
        x: config.x,
        y: config.y,
        width: config.width,
        height: config.height,
      },
      shapeType: config.shapeType,
      style: {
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 1,
        ...config.style,
      },
      constraints: {},
      zIndex: 0,
    };
  }

  /**
   * Create a container element with children
   */
  createContainerElement(config: {
    x: number;
    y: number;
    width: number;
    height: number;
    children: TemplateElement[];
    layout?: ContainerElement['layout'];
    style?: Partial<ContainerElement['style']>;
  }): ContainerElement {
    return {
      id: generateId('container'),
      type: 'container',
      bounds: {
        x: config.x,
        y: config.y,
        width: config.width,
        height: config.height,
      },
      children: config.children,
      layout: config.layout || 'absolute',
      style: config.style,
      constraints: {
        overflow: 'clip',
      },
      zIndex: 0,
    };
  }

  // ============================================
  // DATA INJECTION
  // ============================================

  /**
   * Inject data into a template
   */
  async inject(template: Template, data: InjectionData): Promise<Template> {
    return this.injector.inject(template, data);
  }

  // ============================================
  // RENDERING
  // ============================================

  /**
   * Generate HTML from a template
   */
  generateHTML(template: Template): string {
    return this.generator.generate(template);
  }

  /**
   * Render template to PDF
   */
  async renderPDF(template: Template): Promise<RenderResult> {
    return this.renderer.render(template);
  }

  /**
   * Render HTML string to PDF
   */
  async renderHTMLToPDF(html: string): Promise<Buffer> {
    return this.renderer.renderHTML(html);
  }

  /**
   * Render template to PNG
   */
  async renderPNG(template: Template): Promise<Buffer> {
    return this.renderer.renderPNG(template);
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    await this.renderer.close();
  }
}

// Default export
export default DynamicTemplateEngine;
