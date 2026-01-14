/**
 * Utility functions for the Dynamic Template Engine
 */

let idCounter = 0;

/**
 * Generate a unique ID with optional prefix
 */
export function generateId(prefix: string = 'el'): string {
  return `${prefix}_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Convert points to pixels (1pt = 1.333px at 96dpi)
 */
export function ptToPx(pt: number): number {
  return pt * (96 / 72);
}

/**
 * Convert pixels to points
 */
export function pxToPt(px: number): number {
  return px * (72 / 96);
}

/**
 * Convert mm to pixels (at 96dpi)
 */
export function mmToPx(mm: number): number {
  return mm * (96 / 25.4);
}

/**
 * Convert inches to pixels (at 96dpi)
 */
export function inToPx(inches: number): number {
  return inches * 96;
}

/**
 * Normalize a unit value to pixels
 */
export function toPixels(value: number, unit: 'px' | 'pt' | 'mm' | 'in'): number {
  switch (unit) {
    case 'pt': return ptToPx(value);
    case 'mm': return mmToPx(value);
    case 'in': return inToPx(value);
    default: return value;
  }
}

/**
 * Parse a color string to RGB object
 */
export function parseColor(color: string): { r: number; g: number; b: number; a?: number } | null {
  // Hex color
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
      };
    } else if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    } else if (hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: parseInt(hex.slice(6, 8), 16) / 255,
      };
    }
  }

  // RGB/RGBA
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]),
      g: parseInt(rgbMatch[2]),
      b: parseInt(rgbMatch[3]),
      a: rgbMatch[4] ? parseFloat(rgbMatch[4]) : undefined,
    };
  }

  return null;
}

/**
 * Convert RGB to hex color
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Get nested property from object using dot notation
 */
export function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

/**
 * Set nested property in object using dot notation
 */
export function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((current, key) => {
    if (current[key] === undefined) {
      current[key] = {};
    }
    return current[key];
  }, obj);
  target[lastKey] = value;
}

/**
 * Calculate text metrics (approximate)
 */
export function estimateTextWidth(text: string, fontSize: number, fontFamily: string): number {
  // Average character width ratios for common fonts
  const avgCharWidthRatio: { [key: string]: number } = {
    'Arial': 0.52,
    'Helvetica': 0.52,
    'Times New Roman': 0.48,
    'Georgia': 0.50,
    'Courier New': 0.60,
    'monospace': 0.60,
    'default': 0.50,
  };

  const ratio = avgCharWidthRatio[fontFamily] || avgCharWidthRatio['default'];
  return text.length * fontSize * ratio;
}

/**
 * Calculate optimal font size to fit text in container
 */
export function calculateFitFontSize(
  text: string,
  containerWidth: number,
  containerHeight: number,
  minFontSize: number = 8,
  maxFontSize: number = 72,
  fontFamily: string = 'Arial',
  lineHeight: number = 1.2
): number {
  let fontSize = maxFontSize;

  while (fontSize >= minFontSize) {
    const textWidth = estimateTextWidth(text, fontSize, fontFamily);
    const textHeight = fontSize * lineHeight;

    if (textWidth <= containerWidth && textHeight <= containerHeight) {
      return fontSize;
    }

    // Check if text can wrap
    const linesNeeded = Math.ceil(textWidth / containerWidth);
    const totalHeight = linesNeeded * textHeight;

    if (totalHeight <= containerHeight) {
      return fontSize;
    }

    fontSize -= 0.5;
  }

  return minFontSize;
}

/**
 * Word wrap text to fit within a width
 */
export function wordWrap(text: string, maxWidth: number, fontSize: number, fontFamily: string): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = estimateTextWidth(testLine, fontSize, fontFamily);

    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxWidth: number, fontSize: number, fontFamily: string): string {
  const ellipsis = '...';
  const ellipsisWidth = estimateTextWidth(ellipsis, fontSize, fontFamily);
  const availableWidth = maxWidth - ellipsisWidth;

  if (estimateTextWidth(text, fontSize, fontFamily) <= maxWidth) {
    return text;
  }

  let truncated = text;
  while (truncated.length > 0 && estimateTextWidth(truncated, fontSize, fontFamily) > availableWidth) {
    truncated = truncated.slice(0, -1);
  }

  return truncated + ellipsis;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Format number with commas
 */
export function formatNumber(num: number, decimals: number = 0): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format currency
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format square footage
 */
export function formatSqFt(sqft: number): string {
  return `${formatNumber(sqft)} SF`;
}
