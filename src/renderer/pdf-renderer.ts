/**
 * PDF Renderer
 *
 * Converts dynamic HTML templates to high-fidelity PDFs.
 * Uses Puppeteer for accurate rendering.
 */

import puppeteer, { Browser, Page, PDFOptions } from 'puppeteer-core';
import { RenderOptions, RenderResult, Template } from '../types/index.js';
import { HTMLGenerator } from '../generator/html-generator.js';
import { toPixels } from '../utils/helpers.js';

export interface PDFRenderOptions extends RenderOptions {
  executablePath?: string; // Path to Chrome/Chromium
  printBackground?: boolean;
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
}

export class PDFRenderer {
  private browser: Browser | null = null;
  private options: PDFRenderOptions;

  constructor(options: PDFRenderOptions = { format: 'pdf' }) {
    this.options = {
      format: 'pdf',
      scale: 1,
      printBackground: true,
      ...options,
    };
  }

  /**
   * Initialize the browser instance
   */
  async init(): Promise<void> {
    if (this.browser) return;

    const executablePath = this.options.executablePath || this.findChrome();

    this.browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
  }

  /**
   * Find Chrome/Chromium executable
   */
  private findChrome(): string {
    // Common Chrome locations
    const locations = [
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium',
      process.env.CHROME_PATH,
    ].filter(Boolean) as string[];

    for (const loc of locations) {
      try {
        require('fs').accessSync(loc);
        return loc;
      } catch {
        continue;
      }
    }

    throw new Error(
      'Chrome/Chromium not found. Please install Chrome or set CHROME_PATH environment variable.'
    );
  }

  /**
   * Render a template to PDF
   */
  async render(template: Template): Promise<RenderResult> {
    const startTime = Date.now();

    try {
      await this.init();

      const generator = new HTMLGenerator({ includeRuntime: true });
      const html = generator.generate(template);

      const page = await this.browser!.newPage();

      // Set viewport to match template page size
      const firstPage = template.pages[0];
      if (firstPage) {
        const width = toPixels(firstPage.size.width, firstPage.size.unit);
        const height = toPixels(firstPage.size.height, firstPage.size.unit);
        await page.setViewport({
          width: Math.ceil(width),
          height: Math.ceil(height),
          deviceScaleFactor: this.options.scale || 1,
        });
      }

      // Load HTML
      await page.setContent(html, {
        waitUntil: ['load', 'networkidle0'],
        timeout: 30000,
      });

      // Wait for fonts and text fitting
      await page.evaluate(() => {
        return new Promise<void>((resolve) => {
          if ((window as any).DTE) {
            (window as any).DTE.fitAllText();
          }
          setTimeout(resolve, 100);
        });
      });

      // Generate PDF
      const pdfOptions: PDFOptions = {
        printBackground: this.options.printBackground,
        displayHeaderFooter: this.options.displayHeaderFooter,
        headerTemplate: this.options.headerTemplate,
        footerTemplate: this.options.footerTemplate,
        margin: this.options.margin,
        preferCSSPageSize: true,
      };

      // Set page size from template
      if (firstPage) {
        const width = firstPage.size.width;
        const height = firstPage.size.height;
        const unit = firstPage.size.unit;

        // Convert to inches for PDF
        let widthIn: number, heightIn: number;
        switch (unit) {
          case 'pt':
            widthIn = width / 72;
            heightIn = height / 72;
            break;
          case 'mm':
            widthIn = width / 25.4;
            heightIn = height / 25.4;
            break;
          case 'in':
            widthIn = width;
            heightIn = height;
            break;
          default:
            widthIn = width / 96;
            heightIn = height / 96;
        }

        pdfOptions.width = `${widthIn}in`;
        pdfOptions.height = `${heightIn}in`;
      }

      const pdfBuffer = await page.pdf(pdfOptions);
      await page.close();

      return {
        success: true,
        output: pdfBuffer,
        metadata: {
          pageCount: template.pages.length,
          renderTime: Date.now() - startTime,
          fileSize: pdfBuffer.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        output: Buffer.from(''),
        errors: [(error as Error).message],
        metadata: {
          pageCount: 0,
          renderTime: Date.now() - startTime,
          fileSize: 0,
        },
      };
    }
  }

  /**
   * Render HTML string to PDF
   */
  async renderHTML(html: string, options?: Partial<PDFRenderOptions>): Promise<Buffer> {
    await this.init();

    const page = await this.browser!.newPage();

    await page.setContent(html, {
      waitUntil: ['load', 'networkidle0'],
      timeout: 30000,
    });

    // Wait for any dynamic content
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        if ((window as any).DTE) {
          (window as any).DTE.fitAllText();
        }
        setTimeout(resolve, 100);
      });
    });

    const pdfOptions: PDFOptions = {
      printBackground: options?.printBackground ?? this.options.printBackground,
      preferCSSPageSize: true,
      ...options,
    };

    const pdfBuffer = await page.pdf(pdfOptions);
    await page.close();

    return pdfBuffer;
  }

  /**
   * Render to PNG screenshot
   */
  async renderPNG(template: Template): Promise<Buffer> {
    await this.init();

    const generator = new HTMLGenerator({ includeRuntime: true });
    const html = generator.generate(template);

    const page = await this.browser!.newPage();

    // Set viewport
    const firstPage = template.pages[0];
    if (firstPage) {
      const width = toPixels(firstPage.size.width, firstPage.size.unit);
      const height = toPixels(firstPage.size.height, firstPage.size.unit);
      await page.setViewport({
        width: Math.ceil(width),
        height: Math.ceil(height),
        deviceScaleFactor: this.options.scale || 2,
      });
    }

    await page.setContent(html, {
      waitUntil: ['load', 'networkidle0'],
    });

    // Wait for text fitting
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        if ((window as any).DTE) {
          (window as any).DTE.fitAllText();
        }
        setTimeout(resolve, 100);
      });
    });

    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: true,
    });

    await page.close();

    return screenshot as Buffer;
  }

  /**
   * Close the browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export default PDFRenderer;
