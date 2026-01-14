/**
 * Content Injection Engine
 *
 * Handles intelligent data binding and content injection into templates.
 * Features:
 * - Data binding resolution ({{property.name}})
 * - Smart text fitting with multiple strategies
 * - Format transformations (currency, dates, etc.)
 * - SVG text injection
 */

import {
  Template,
  TemplatePage,
  TemplateElement,
  TextElement,
  ImageElement,
  SVGElement,
  TableElement,
  InjectionData,
  InjectionOptions,
  Constraints,
} from '../types/index.js';
import {
  deepClone,
  getNestedValue,
  calculateFitFontSize,
  wordWrap,
  truncateText,
  formatCurrency,
  formatNumber,
  formatPercentage,
  formatSqFt,
} from '../utils/helpers.js';

export interface TextFitResult {
  text: string;
  fontSize: number;
  lines: string[];
  truncated: boolean;
  strategy: 'fit' | 'shrink' | 'wrap' | 'truncate';
}

export class ContentInjector {
  private options: InjectionOptions;
  private formatters: Map<string, (value: any, ...args: any[]) => string>;

  constructor(options: InjectionOptions = {}) {
    this.options = {
      strictMode: false,
      defaultValues: {},
      ...options,
    };

    // Initialize built-in formatters
    this.formatters = new Map<string, (value: any, ...args: any[]) => string>();
    this.formatters.set('currency', (v) => formatCurrency(v));
    this.formatters.set('number', (v) => formatNumber(v));
    this.formatters.set('percent', (v) => formatPercentage(v));
    this.formatters.set('sqft', (v) => formatSqFt(v));
    this.formatters.set('uppercase', (v) => String(v).toUpperCase());
    this.formatters.set('lowercase', (v) => String(v).toLowerCase());
    this.formatters.set('capitalize', (v) => String(v).charAt(0).toUpperCase() + String(v).slice(1));
    this.formatters.set('date', (v) => new Date(v).toLocaleDateString());
    this.formatters.set('shortDate', (v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));

    // Add custom formatters
    if (options.formatters) {
      for (const [name, fn] of Object.entries(options.formatters)) {
        this.formatters.set(name, fn);
      }
    }
  }

  /**
   * Inject data into a template
   */
  async inject(template: Template, data: InjectionData): Promise<Template> {
    const result = deepClone(template);

    for (const page of result.pages) {
      await this.injectIntoPage(page, data);
    }

    return result;
  }

  /**
   * Inject data into a single page
   */
  private async injectIntoPage(page: TemplatePage, data: InjectionData): Promise<void> {
    for (const element of page.elements) {
      await this.injectIntoElement(element, data);
    }
  }

  /**
   * Inject data into an element
   */
  private async injectIntoElement(element: TemplateElement, data: InjectionData): Promise<void> {
    switch (element.type) {
      case 'text':
        this.injectIntoText(element, data);
        break;
      case 'image':
        await this.injectIntoImage(element, data);
        break;
      case 'svg':
        this.injectIntoSVG(element, data);
        break;
      case 'table':
        this.injectIntoTable(element, data);
        break;
      case 'container':
        for (const child of element.children) {
          await this.injectIntoElement(child, data);
        }
        break;
    }
  }

  /**
   * Inject data into text element with smart fitting
   */
  private injectIntoText(element: TextElement, data: InjectionData): void {
    if (!element.dataBinding) return;

    const { value, formatted } = this.resolveBinding(element.dataBinding, data);

    if (value === undefined) {
      if (this.options.strictMode) {
        throw new Error(`Missing binding: ${element.dataBinding}`);
      }
      return;
    }

    // Apply the new content
    element.content = formatted;

    // Calculate optimal text fitting
    const fitResult = this.fitTextToElement(element);

    // Update element based on fit result
    if (fitResult.truncated) {
      element.content = fitResult.text;
    }

    // Optionally adjust font size in style
    if (fitResult.strategy === 'shrink' && fitResult.fontSize < element.style.fontSize) {
      element.style.fontSize = fitResult.fontSize;
    }
  }

  /**
   * Inject data into image element
   */
  private async injectIntoImage(element: ImageElement, data: InjectionData): Promise<void> {
    if (!element.dataBinding) return;

    const { value } = this.resolveBinding(element.dataBinding, data);

    if (value === undefined) {
      if (this.options.strictMode) {
        throw new Error(`Missing binding: ${element.dataBinding}`);
      }
      return;
    }

    // Resolve image URL if resolver provided
    if (this.options.imageResolver) {
      element.src = await this.options.imageResolver(String(value));
    } else {
      element.src = String(value);
    }
  }

  /**
   * Inject data into SVG element
   */
  private injectIntoSVG(element: SVGElement, data: InjectionData): void {
    if (!element.textBindings) return;

    for (const [selector, binding] of Object.entries(element.textBindings)) {
      const { formatted } = this.resolveBinding(binding, data);

      if (formatted !== undefined) {
        // Replace text content in SVG
        element.content = this.replaceSVGText(element.content, selector, formatted);
      }
    }
  }

  /**
   * Inject data into table element
   */
  private injectIntoTable(element: TableElement, data: InjectionData): void {
    // Check if there's a data binding for table data
    const tableDataBinding = element.columns.find(c => c.binding?.startsWith('{{'))?.binding;

    if (tableDataBinding) {
      const { value } = this.resolveBinding(tableDataBinding, data);
      if (Array.isArray(value)) {
        element.data = value;
      }
    }

    // Also resolve individual column bindings for each row
    if (element.data) {
      for (const row of element.data) {
        for (const col of element.columns) {
          if (col.binding && !col.binding.startsWith('{{')) {
            // Direct property reference
            continue;
          }
          if (col.binding) {
            const { value } = this.resolveBinding(col.binding, row);
            if (value !== undefined) {
              row[col.binding] = value;
            }
          }
        }
      }
    }
  }

  /**
   * Resolve a data binding expression
   */
  private resolveBinding(binding: string, data: InjectionData): { value: any; formatted: string } {
    // Extract binding path and formatter
    // Format: {{path}} or {{path|formatter}} or {{path|formatter:arg}}
    const match = binding.match(/\{\{(.+?)\}\}/);
    if (!match) {
      return { value: binding, formatted: binding };
    }

    const expression = match[1].trim();
    const [path, ...formatterParts] = expression.split('|');

    // Get the raw value
    let value = getNestedValue(data, path.trim());

    // Apply default value if undefined
    if (value === undefined) {
      value = getNestedValue(this.options.defaultValues || {}, path.trim());
    }

    // Apply formatters
    let formatted = String(value ?? '');

    for (const formatterExpr of formatterParts) {
      const parts = formatterExpr.trim().split(':');
      const formatterName = parts[0];
      const formatterArgs = parts.slice(1);
      const formatter = this.formatters.get(formatterName || '');

      if (formatter) {
        try {
          formatted = formatter(value, ...formatterArgs);
        } catch (e) {
          console.warn(`Formatter error: ${formatterName}`, e);
        }
      }
    }

    return { value, formatted };
  }

  /**
   * Calculate optimal text fitting for an element
   */
  fitTextToElement(element: TextElement): TextFitResult {
    const { content, bounds, constraints, style } = element;

    const minFont = constraints.minFontSize || 6;
    const maxFont = constraints.maxFontSize || style.fontSize;
    const overflow = constraints.overflow || 'shrink';

    // Strategy 1: Check if text fits at current size
    const currentWidth = this.estimateTextWidth(content, style.fontSize, style.fontFamily);
    const lineHeight = style.lineHeight || 1.2;
    const currentHeight = style.fontSize * lineHeight;

    if (currentWidth <= bounds.width && currentHeight <= bounds.height) {
      return {
        text: content,
        fontSize: style.fontSize,
        lines: [content],
        truncated: false,
        strategy: 'fit',
      };
    }

    // Strategy 2: Try wrapping
    if (overflow === 'wrap') {
      const lines = wordWrap(content, bounds.width, style.fontSize, style.fontFamily);
      const totalHeight = lines.length * style.fontSize * lineHeight;

      if (totalHeight <= bounds.height) {
        return {
          text: content,
          fontSize: style.fontSize,
          lines,
          truncated: false,
          strategy: 'wrap',
        };
      }
    }

    // Strategy 3: Shrink font size
    if (overflow === 'shrink') {
      const optimalSize = calculateFitFontSize(
        content,
        bounds.width,
        bounds.height,
        minFont,
        maxFont,
        style.fontFamily,
        lineHeight
      );

      const lines = wordWrap(content, bounds.width, optimalSize, style.fontFamily);

      return {
        text: content,
        fontSize: optimalSize,
        lines,
        truncated: false,
        strategy: 'shrink',
      };
    }

    // Strategy 4: Truncate with ellipsis
    if (overflow === 'ellipsis' || overflow === 'clip') {
      const truncated = truncateText(content, bounds.width, style.fontSize, style.fontFamily);

      return {
        text: truncated,
        fontSize: style.fontSize,
        lines: [truncated],
        truncated: truncated !== content,
        strategy: 'truncate',
      };
    }

    // Default: shrink
    const optimalSize = calculateFitFontSize(
      content,
      bounds.width,
      bounds.height,
      minFont,
      maxFont,
      style.fontFamily,
      lineHeight
    );

    return {
      text: content,
      fontSize: optimalSize,
      lines: wordWrap(content, bounds.width, optimalSize, style.fontFamily),
      truncated: false,
      strategy: 'shrink',
    };
  }

  /**
   * Estimate text width (approximate)
   */
  private estimateTextWidth(text: string, fontSize: number, fontFamily: string): number {
    const avgCharWidthRatio: { [key: string]: number } = {
      'Arial': 0.52,
      'Helvetica': 0.52,
      'Times New Roman': 0.48,
      'default': 0.50,
    };

    const ratio = avgCharWidthRatio[fontFamily] || avgCharWidthRatio['default'];
    return text.length * fontSize * ratio;
  }

  /**
   * Replace text content in SVG
   */
  private replaceSVGText(svg: string, selector: string, newText: string): string {
    // Simple text replacement - for production, use a proper SVG parser
    const textRegex = new RegExp(`(<text[^>]*${selector}[^>]*>)([^<]*)(<\\/text>)`, 'gi');
    return svg.replace(textRegex, `$1${this.escapeXml(newText)}$3`);
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Add a custom formatter
   */
  addFormatter(name: string, fn: (value: any, ...args: any[]) => string): void {
    this.formatters.set(name, fn);
  }

  /**
   * Get all available formatters
   */
  getFormatters(): string[] {
    return Array.from(this.formatters.keys());
  }
}

export default ContentInjector;
