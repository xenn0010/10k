/**
 * Dynamic HTML Generator
 *
 * The core innovation: Generates constraint-based HTML that adapts to content
 * instead of breaking when text is longer/shorter than original.
 *
 * Key features:
 * - CSS-based text fitting (clamp, container queries)
 * - Automatic overflow handling
 * - SVG text element preservation
 * - Data binding support
 */

import {
  Template,
  TemplatePage,
  TemplateElement,
  TextElement,
  ImageElement,
  ShapeElement,
  SVGElement,
  ContainerElement,
  TableElement,
  BoundingBox,
  Constraints,
  TextStyle,
  ShapeStyle,
  RenderOptions,
} from '../types/index.js';
import { escapeHtml, toPixels } from '../utils/helpers.js';

export interface GeneratorOptions {
  embedStyles?: boolean;
  includeRuntime?: boolean; // Include JS runtime for text fitting
  cssPrefix?: string;
  useContainerQueries?: boolean;
}

export class HTMLGenerator {
  private options: GeneratorOptions;
  private styleMap: Map<string, string> = new Map();
  private elementCount: number = 0;

  constructor(options: GeneratorOptions = {}) {
    this.options = {
      embedStyles: true,
      includeRuntime: true,
      cssPrefix: 'dte',
      useContainerQueries: true,
      ...options,
    };
  }

  /**
   * Generate complete HTML document from template
   */
  generate(template: Template): string {
    this.styleMap.clear();
    this.elementCount = 0;

    const pages = template.pages.map((page, index) =>
      this.generatePage(page, index)
    ).join('\n');

    const styles = this.generateStyles(template);
    const runtime = this.options.includeRuntime ? this.generateRuntime() : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(template.name)}</title>
  ${this.generateFontImports(template)}
  <style>
${styles}
  </style>
</head>
<body>
  <div class="${this.prefix('document')}" data-template-id="${template.id}">
${pages}
  </div>
  ${runtime}
</body>
</html>`;
  }

  /**
   * Generate HTML for a single page
   */
  generatePage(page: TemplatePage, pageIndex: number): string {
    const width = toPixels(page.size.width, page.size.unit);
    const height = toPixels(page.size.height, page.size.unit);

    const bgStyle = this.generateBackgroundStyle(page.background);

    const elements = page.elements
      .sort((a, b) => a.zIndex - b.zIndex)
      .map(el => this.generateElement(el))
      .join('\n');

    return `    <div class="${this.prefix('page')}"
         data-page-id="${page.id}"
         data-page-index="${pageIndex}"
         style="width: ${width}px; height: ${height}px; ${bgStyle}">
${elements}
    </div>`;
  }

  /**
   * Generate HTML for any element type
   */
  generateElement(element: TemplateElement): string {
    switch (element.type) {
      case 'text':
        return this.generateTextElement(element);
      case 'image':
        return this.generateImageElement(element);
      case 'shape':
        return this.generateShapeElement(element);
      case 'svg':
        return this.generateSVGElement(element);
      case 'container':
        return this.generateContainerElement(element);
      case 'table':
        return this.generateTableElement(element);
      default:
        return `<!-- Unknown element type -->`;
    }
  }

  /**
   * Generate dynamic text element with auto-fitting
   */
  generateTextElement(element: TextElement): string {
    const { bounds, constraints, style, content, dataBinding } = element;
    const posStyle = this.generatePositionStyle(bounds);
    const textStyle = this.generateTextStyle(style);
    const constraintAttrs = this.generateConstraintAttributes(constraints);

    // The magic: CSS clamp() for responsive font sizing
    const minFont = constraints.minFontSize || 8;
    const maxFont = constraints.maxFontSize || style.fontSize;
    const idealFont = style.fontSize;

    // Calculate responsive font size using container width
    const fontSizeStyle = `font-size: clamp(${minFont}px, ${idealFont}px, ${maxFont}px);`;

    const overflowClass = this.getOverflowClass(constraints.overflow);
    const alignClass = this.getAlignmentClass(constraints.textAlign, constraints.verticalAlign);

    const displayContent = dataBinding
      ? `<span class="${this.prefix('binding')}" data-bind="${dataBinding}">${escapeHtml(content)}</span>`
      : escapeHtml(content);

    return `      <div class="${this.prefix('element')} ${this.prefix('text')} ${overflowClass} ${alignClass}"
           id="${element.id}"
           data-type="text"
           ${constraintAttrs}
           style="${posStyle} ${textStyle} ${fontSizeStyle}">
        <span class="${this.prefix('text-content')}">${displayContent}</span>
      </div>`;
  }

  /**
   * Generate image element with object-fit
   */
  generateImageElement(element: ImageElement): string {
    const { bounds, src, alt, objectFit, dataBinding } = element;
    const posStyle = this.generatePositionStyle(bounds);

    const imgSrc = dataBinding
      ? `data-bind-src="${dataBinding}" src="${escapeHtml(src)}"`
      : `src="${escapeHtml(src)}"`;

    return `      <div class="${this.prefix('element')} ${this.prefix('image')}"
           id="${element.id}"
           data-type="image"
           style="${posStyle}">
        <img ${imgSrc}
             alt="${escapeHtml(alt || '')}"
             style="width: 100%; height: 100%; object-fit: ${objectFit};"
             loading="lazy" />
      </div>`;
  }

  /**
   * Generate shape element (rectangle, circle, etc.)
   */
  generateShapeElement(element: ShapeElement): string {
    const { bounds, shapeType, style } = element;
    const posStyle = this.generatePositionStyle(bounds);
    const shapeStyle = this.generateShapeStyle(style, shapeType, bounds);

    if (shapeType === 'circle' || shapeType === 'ellipse') {
      return `      <div class="${this.prefix('element')} ${this.prefix('shape')} ${this.prefix(`shape-${shapeType}`)}"
           id="${element.id}"
           data-type="shape"
           style="${posStyle} ${shapeStyle} border-radius: 50%;">
      </div>`;
    }

    return `      <div class="${this.prefix('element')} ${this.prefix('shape')} ${this.prefix(`shape-${shapeType}`)}"
           id="${element.id}"
           data-type="shape"
           style="${posStyle} ${shapeStyle}">
      </div>`;
  }

  /**
   * Generate SVG element with preserved text bindings
   */
  generateSVGElement(element: SVGElement): string {
    const { bounds, content, textBindings, viewBox } = element;
    const posStyle = this.generatePositionStyle(bounds);

    // Process SVG content to add data bindings to text elements
    let processedSvg = content;

    if (textBindings) {
      for (const [selector, binding] of Object.entries(textBindings)) {
        // Add data-bind attributes to matching text elements
        processedSvg = this.addSVGTextBindings(processedSvg, selector, binding);
      }
    }

    // Ensure SVG scales properly
    processedSvg = this.ensureSVGScaling(processedSvg, bounds);

    return `      <div class="${this.prefix('element')} ${this.prefix('svg')}"
           id="${element.id}"
           data-type="svg"
           style="${posStyle}">
        ${processedSvg}
      </div>`;
  }

  /**
   * Generate container element with children
   */
  generateContainerElement(element: ContainerElement): string {
    const { bounds, children, layout, flexDirection, gap, style } = element;
    const posStyle = this.generatePositionStyle(bounds);
    const bgStyle = style ? this.generateShapeStyle(style, 'rectangle', bounds) : '';

    let layoutStyle = '';
    if (layout === 'flex') {
      layoutStyle = `display: flex; flex-direction: ${flexDirection || 'column'}; gap: ${gap || 0}px;`;
    } else if (layout === 'grid') {
      layoutStyle = `display: grid; gap: ${gap || 0}px;`;
    }

    const childrenHtml = children
      .sort((a, b) => a.zIndex - b.zIndex)
      .map(child => this.generateElement(child))
      .join('\n');

    return `      <div class="${this.prefix('element')} ${this.prefix('container')}"
           id="${element.id}"
           data-type="container"
           style="${posStyle} ${bgStyle} ${layoutStyle} overflow: hidden;">
${childrenHtml}
      </div>`;
  }

  /**
   * Generate table element
   */
  generateTableElement(element: TableElement): string {
    const { bounds, columns, rowHeight, headerStyle, cellStyle, alternateRowColor, data } = element;
    const posStyle = this.generatePositionStyle(bounds);

    const headerCells = columns
      .map(col => `<th style="width: ${col.width === 'auto' ? 'auto' : col.width + 'px'};">${escapeHtml(col.header || '')}</th>`)
      .join('');

    const bodyRows = (data || []).map((row, index) => {
      const rowBg = alternateRowColor && index % 2 === 1 ? `background: ${alternateRowColor};` : '';
      const cells = columns.map(col => {
        const value = col.binding ? row[col.binding] : '';
        return `<td>${escapeHtml(String(value))}</td>`;
      }).join('');
      return `<tr style="${rowBg}">${cells}</tr>`;
    }).join('\n');

    return `      <div class="${this.prefix('element')} ${this.prefix('table')}"
           id="${element.id}"
           data-type="table"
           style="${posStyle} overflow: auto;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>`;
  }

  // ============================================
  // STYLE GENERATORS
  // ============================================

  private generatePositionStyle(bounds: BoundingBox): string {
    return `position: absolute; left: ${bounds.x}px; top: ${bounds.y}px; width: ${bounds.width}px; height: ${bounds.height}px;`;
  }

  private generateTextStyle(style: TextStyle): string {
    const parts: string[] = [
      `font-family: "${style.fontFamily}", sans-serif`,
      `font-weight: ${style.fontWeight}`,
      `font-style: ${style.fontStyle}`,
      `color: ${style.color}`,
    ];

    if (style.lineHeight) parts.push(`line-height: ${style.lineHeight}`);
    if (style.letterSpacing) parts.push(`letter-spacing: ${style.letterSpacing}px`);
    if (style.textDecoration) parts.push(`text-decoration: ${style.textDecoration}`);
    if (style.textTransform) parts.push(`text-transform: ${style.textTransform}`);

    return parts.join('; ') + ';';
  }

  private generateShapeStyle(style: ShapeStyle, shapeType: string, bounds: BoundingBox): string {
    const parts: string[] = [];

    if (style.fill) parts.push(`background: ${style.fill}`);
    if (style.stroke) parts.push(`border: ${style.strokeWidth || 1}px solid ${style.stroke}`);
    if (style.borderRadius) parts.push(`border-radius: ${style.borderRadius}px`);
    if (style.opacity !== undefined) parts.push(`opacity: ${style.opacity}`);
    if (style.shadow) {
      parts.push(`box-shadow: ${style.shadow.offsetX}px ${style.shadow.offsetY}px ${style.shadow.blur}px ${style.shadow.color}`);
    }

    return parts.join('; ') + (parts.length ? ';' : '');
  }

  private generateBackgroundStyle(background?: string | { type: string; value: string }): string {
    if (!background) return 'background: white;';

    if (typeof background === 'string') {
      return `background: ${background};`;
    }

    switch (background.type) {
      case 'color':
        return `background-color: ${background.value};`;
      case 'image':
        return `background-image: url('${background.value}'); background-size: cover;`;
      case 'gradient':
        return `background: ${background.value};`;
      default:
        return 'background: white;';
    }
  }

  private generateConstraintAttributes(constraints: Constraints): string {
    return `data-constraints='${JSON.stringify(constraints)}'`;
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private prefix(name: string): string {
    return `${this.options.cssPrefix}-${name}`;
  }

  private getOverflowClass(overflow?: Constraints['overflow']): string {
    switch (overflow) {
      case 'clip': return this.prefix('overflow-clip');
      case 'ellipsis': return this.prefix('overflow-ellipsis');
      case 'shrink': return this.prefix('overflow-shrink');
      case 'wrap': return this.prefix('overflow-wrap');
      default: return this.prefix('overflow-shrink');
    }
  }

  private getAlignmentClass(textAlign?: string, verticalAlign?: string): string {
    const h = textAlign || 'left';
    const v = verticalAlign || 'top';
    return `${this.prefix(`align-h-${h}`)} ${this.prefix(`align-v-${v}`)}`;
  }

  private addSVGTextBindings(svg: string, selector: string, binding: string): string {
    // Simple implementation - add data-bind to text elements
    // In production, use a proper SVG parser
    return svg.replace(/<text([^>]*)>/g, (match, attrs) => {
      if (attrs.includes(selector) || selector === 'text') {
        return `<text${attrs} data-bind="${binding}">`;
      }
      return match;
    });
  }

  private ensureSVGScaling(svg: string, bounds: BoundingBox): string {
    // Ensure SVG has proper width/height and viewBox for scaling
    if (!svg.includes('width=') && !svg.includes('height=')) {
      svg = svg.replace('<svg', `<svg width="100%" height="100%"`);
    }
    return svg;
  }

  private generateFontImports(template: Template): string {
    if (!template.fonts || template.fonts.length === 0) return '';

    const fontFaces = template.fonts.map(font => `
    @font-face {
      font-family: '${font.family}';
      src: url('${font.src}');
      font-weight: ${font.weight || 400};
      font-style: ${font.style || 'normal'};
    }`).join('\n');

    return `<style>${fontFaces}</style>`;
  }

  // ============================================
  // GLOBAL STYLES
  // ============================================

  private generateStyles(template: Template): string {
    const p = this.options.cssPrefix;

    return `
    /* Reset & Base */
    * { box-sizing: border-box; margin: 0; padding: 0; }

    .${p}-document {
      font-family: system-ui, -apple-system, sans-serif;
    }

    .${p}-page {
      position: relative;
      overflow: hidden;
      margin: 0 auto 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      background: white;
    }

    .${p}-element {
      position: absolute;
    }

    /* Text Element Styles */
    .${p}-text {
      display: flex;
      align-items: flex-start;
      justify-content: flex-start;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    .${p}-text-content {
      width: 100%;
    }

    /* Overflow Handling */
    .${p}-overflow-clip {
      overflow: hidden;
    }

    .${p}-overflow-ellipsis .${p}-text-content {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .${p}-overflow-shrink {
      overflow: hidden;
    }

    .${p}-overflow-wrap {
      overflow: hidden;
      word-wrap: break-word;
    }

    /* Horizontal Alignment */
    .${p}-align-h-left { justify-content: flex-start; text-align: left; }
    .${p}-align-h-center { justify-content: center; text-align: center; }
    .${p}-align-h-right { justify-content: flex-end; text-align: right; }
    .${p}-align-h-justify { text-align: justify; }

    /* Vertical Alignment */
    .${p}-align-v-top { align-items: flex-start; }
    .${p}-align-v-middle { align-items: center; }
    .${p}-align-v-bottom { align-items: flex-end; }

    /* Image Elements */
    .${p}-image {
      overflow: hidden;
    }

    .${p}-image img {
      display: block;
    }

    /* Shape Elements */
    .${p}-shape {
      overflow: hidden;
    }

    /* SVG Elements */
    .${p}-svg {
      overflow: hidden;
    }

    .${p}-svg svg {
      width: 100%;
      height: 100%;
    }

    /* Container Elements */
    .${p}-container {
      overflow: hidden;
    }

    /* Table Elements */
    .${p}-table table {
      width: 100%;
      border-collapse: collapse;
    }

    .${p}-table th,
    .${p}-table td {
      padding: 4px 8px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }

    /* Print Styles */
    @media print {
      .${p}-page {
        box-shadow: none;
        margin: 0;
        page-break-after: always;
      }
    }
    `;
  }

  // ============================================
  // JAVASCRIPT RUNTIME FOR TEXT FITTING
  // ============================================

  private generateRuntime(): string {
    return `
  <script>
  (function() {
    'use strict';

    /**
     * Dynamic Template Engine Runtime
     * Handles text fitting, overflow, and dynamic content injection
     */
    const DTE = {
      /**
       * Initialize all dynamic elements
       */
      init: function() {
        this.fitAllText();
        this.observeResize();
        window.DTE = this;
      },

      /**
       * Fit text in all text elements
       */
      fitAllText: function() {
        document.querySelectorAll('.dte-overflow-shrink').forEach(el => {
          this.fitText(el);
        });
      },

      /**
       * Fit text within a single element
       */
      fitText: function(element) {
        const content = element.querySelector('.dte-text-content');
        if (!content) return;

        const constraints = JSON.parse(element.dataset.constraints || '{}');
        const minFont = constraints.minFontSize || 6;
        const maxFont = constraints.maxFontSize || 72;

        // Get computed styles
        const style = window.getComputedStyle(element);
        let fontSize = parseFloat(style.fontSize);

        // Binary search for optimal font size
        let low = minFont;
        let high = Math.min(maxFont, fontSize);

        while (high - low > 0.5) {
          const mid = (low + high) / 2;
          element.style.fontSize = mid + 'px';

          if (this.isOverflowing(element, content)) {
            high = mid;
          } else {
            low = mid;
          }
        }

        element.style.fontSize = low + 'px';
      },

      /**
       * Check if content overflows its container
       */
      isOverflowing: function(container, content) {
        return content.scrollWidth > container.clientWidth ||
               content.scrollHeight > container.clientHeight;
      },

      /**
       * Observe elements for resize
       */
      observeResize: function() {
        if ('ResizeObserver' in window) {
          const observer = new ResizeObserver(entries => {
            entries.forEach(entry => {
              if (entry.target.classList.contains('dte-overflow-shrink')) {
                this.fitText(entry.target);
              }
            });
          });

          document.querySelectorAll('.dte-overflow-shrink').forEach(el => {
            observer.observe(el);
          });
        }
      },

      /**
       * Inject data into template
       */
      inject: function(data) {
        // Handle text bindings
        document.querySelectorAll('[data-bind]').forEach(el => {
          const binding = el.dataset.bind;
          const value = this.getNestedValue(data, binding);
          if (value !== undefined) {
            if (el.tagName === 'IMG') {
              el.src = value;
            } else {
              el.textContent = value;
            }
          }
        });

        // Handle src bindings
        document.querySelectorAll('[data-bind-src]').forEach(el => {
          const binding = el.dataset.bindSrc;
          const value = this.getNestedValue(data, binding);
          if (value !== undefined) {
            el.src = value;
          }
        });

        // Re-fit text after injection
        this.fitAllText();
      },

      /**
       * Get nested value from object
       */
      getNestedValue: function(obj, path) {
        return path.replace(/{{|}}/g, '').split('.').reduce((curr, key) => {
          return curr && curr[key] !== undefined ? curr[key] : undefined;
        }, obj);
      },

      /**
       * Format helpers
       */
      format: {
        currency: function(val) {
          return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
        },
        number: function(val) {
          return new Intl.NumberFormat('en-US').format(val);
        },
        percent: function(val) {
          return (val * 100).toFixed(1) + '%';
        },
        sqft: function(val) {
          return new Intl.NumberFormat('en-US').format(val) + ' SF';
        }
      }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => DTE.init());
    } else {
      DTE.init();
    }
  })();
  </script>`;
  }
}

export default HTMLGenerator;
