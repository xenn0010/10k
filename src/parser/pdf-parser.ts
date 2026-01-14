/**
 * PDF Parser - Extracts template elements from PDF files
 * Converts static PDF layouts into dynamic template structures
 */

import { PDFDocument, PDFPage, PDFFont, rgb } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import {
  Template,
  TemplatePage,
  TemplateElement,
  TextElement,
  ImageElement,
  ShapeElement,
  BoundingBox,
  TextStyle,
  ParseOptions,
  ParseResult,
  Constraints,
} from '../types/index.js';
import { generateId } from '../utils/helpers.js';

interface PDFTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName: string;
  fontSize: number;
  color?: { r: number; g: number; b: number };
}

interface PDFImageItem {
  x: number;
  y: number;
  width: number;
  height: number;
  data: Buffer;
  mimeType: string;
}

export class PDFParser {
  private options: ParseOptions;

  constructor(options: ParseOptions = {}) {
    this.options = {
      extractImages: true,
      extractFonts: true,
      detectTables: true,
      groupElements: true,
      ...options,
    };
  }

  /**
   * Parse a PDF file and extract template structure
   */
  async parse(input: string | Buffer): Promise<ParseResult> {
    try {
      const pdfData = typeof input === 'string'
        ? fs.readFileSync(input)
        : input;

      const pdfDoc = await PDFDocument.load(pdfData, {
        ignoreEncryption: true,
      });

      const pages = pdfDoc.getPages();
      const templatePages: TemplatePage[] = [];
      const warnings: string[] = [];
      const extractedAssets: ParseResult['extractedAssets'] = {
        images: [],
        fonts: [],
      };

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const templatePage = await this.parsePage(page, i, extractedAssets, warnings);
        templatePages.push(templatePage);
      }

      // Group related elements if enabled
      if (this.options.groupElements) {
        for (const page of templatePages) {
          page.elements = this.groupRelatedElements(page.elements);
        }
      }

      const template: Template = {
        id: generateId('template'),
        name: 'Imported PDF Template',
        version: '1.0.0',
        pages: templatePages,
        metadata: {
          created: new Date().toISOString(),
          description: 'Auto-generated from PDF',
        },
      };

      return {
        success: true,
        template,
        warnings: warnings.length > 0 ? warnings : undefined,
        extractedAssets: this.options.extractImages || this.options.extractFonts
          ? extractedAssets
          : undefined,
      };
    } catch (error) {
      return {
        success: false,
        template: this.createEmptyTemplate(),
        errors: [(error as Error).message],
      };
    }
  }

  /**
   * Parse a single PDF page
   */
  private async parsePage(
    page: PDFPage,
    pageIndex: number,
    extractedAssets: ParseResult['extractedAssets'],
    warnings: string[]
  ): Promise<TemplatePage> {
    const { width, height } = page.getSize();
    const elements: TemplateElement[] = [];

    // Note: pdf-lib has limited text extraction capabilities
    // For production, we'd integrate pdf.js or a more advanced parser
    // This provides the structure for element extraction

    return {
      id: generateId('page'),
      size: {
        width,
        height,
        unit: 'pt',
      },
      elements,
      margins: { top: 36, right: 36, bottom: 36, left: 36 },
    };
  }

  /**
   * Group related elements (e.g., text near shapes into containers)
   */
  private groupRelatedElements(elements: TemplateElement[]): TemplateElement[] {
    // Find shapes that might be text containers
    const shapes = elements.filter(e => e.type === 'shape');
    const texts = elements.filter(e => e.type === 'text');
    const others = elements.filter(e => e.type !== 'shape' && e.type !== 'text');

    const grouped: TemplateElement[] = [...others];
    const usedTextIds = new Set<string>();

    for (const shape of shapes) {
      const containedTexts = texts.filter(text =>
        !usedTextIds.has(text.id) && this.isContained(text.bounds, shape.bounds)
      );

      if (containedTexts.length > 0) {
        // Create a container with the shape as background and texts as children
        containedTexts.forEach(t => usedTextIds.add(t.id));

        grouped.push({
          id: generateId('container'),
          type: 'container',
          bounds: shape.bounds,
          constraints: this.inferConstraints(shape.bounds, 'container'),
          zIndex: shape.zIndex,
          children: containedTexts,
          layout: 'absolute',
          style: (shape as ShapeElement).style,
        });
      } else {
        grouped.push(shape);
      }
    }

    // Add remaining ungrouped texts
    for (const text of texts) {
      if (!usedTextIds.has(text.id)) {
        grouped.push(text);
      }
    }

    return grouped.sort((a, b) => a.zIndex - b.zIndex);
  }

  /**
   * Check if bounds A is contained within bounds B
   */
  private isContained(a: BoundingBox, b: BoundingBox): boolean {
    return (
      a.x >= b.x &&
      a.y >= b.y &&
      a.x + a.width <= b.x + b.width &&
      a.y + a.height <= b.y + b.height
    );
  }

  /**
   * Infer constraints based on element properties
   */
  private inferConstraints(bounds: BoundingBox, type: string): Constraints {
    const constraints: Constraints = {
      maxWidth: bounds.width,
      maxHeight: bounds.height,
    };

    if (type === 'text') {
      constraints.minFontSize = 8;
      constraints.maxFontSize = Math.min(bounds.height * 0.8, 72);
      constraints.overflow = 'shrink';
      constraints.textAlign = 'left';
      constraints.verticalAlign = 'middle';
    } else if (type === 'container') {
      constraints.overflow = 'clip';
      constraints.padding = 4;
    }

    return constraints;
  }

  /**
   * Create an empty template structure
   */
  private createEmptyTemplate(): Template {
    return {
      id: generateId('template'),
      name: 'Empty Template',
      version: '1.0.0',
      pages: [],
    };
  }
}

export default PDFParser;
