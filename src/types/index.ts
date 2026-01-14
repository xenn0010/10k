/**
 * Core types for the Dynamic Template Engine
 */

// ============================================
// ELEMENT TYPES
// ============================================

export type ElementType = 'text' | 'image' | 'shape' | 'svg' | 'container' | 'table';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Constraints {
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  minFontSize?: number;
  maxFontSize?: number;
  overflow?: 'clip' | 'ellipsis' | 'shrink' | 'wrap';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  padding?: number | { top: number; right: number; bottom: number; left: number };
  preserveAspectRatio?: boolean;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number | string;
  fontStyle: 'normal' | 'italic' | 'oblique';
  color: string;
  lineHeight?: number;
  letterSpacing?: number;
  textDecoration?: 'none' | 'underline' | 'line-through';
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
}

export interface ShapeStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
  opacity?: number;
  shadow?: {
    color: string;
    blur: number;
    offsetX: number;
    offsetY: number;
  };
}

// ============================================
// TEMPLATE ELEMENTS
// ============================================

export interface BaseElement {
  id: string;
  type: ElementType;
  bounds: BoundingBox;
  constraints: Constraints;
  zIndex: number;
  rotation?: number;
  opacity?: number;
  locked?: boolean;
  dataBinding?: string; // e.g., "{{property.address}}"
}

export interface TextElement extends BaseElement {
  type: 'text';
  content: string;
  style: TextStyle;
  placeholder?: string;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  alt?: string;
  objectFit: 'cover' | 'contain' | 'fill' | 'none';
}

export interface ShapeElement extends BaseElement {
  type: 'shape';
  shapeType: 'rectangle' | 'circle' | 'ellipse' | 'polygon' | 'line';
  style: ShapeStyle;
  points?: { x: number; y: number }[]; // For polygon/line
}

export interface SVGElement extends BaseElement {
  type: 'svg';
  content: string; // Raw SVG markup
  viewBox?: string;
  preserveTextElements?: boolean; // Keep text editable
  textBindings?: { [selector: string]: string }; // CSS selector -> data binding
}

export interface ContainerElement extends BaseElement {
  type: 'container';
  children: TemplateElement[];
  layout?: 'absolute' | 'flex' | 'grid';
  flexDirection?: 'row' | 'column';
  gap?: number;
  style?: ShapeStyle;
}

export interface TableElement extends BaseElement {
  type: 'table';
  columns: { width: number | 'auto'; header?: string; binding?: string }[];
  rowHeight: number;
  headerStyle?: TextStyle;
  cellStyle?: TextStyle;
  alternateRowColor?: string;
  data?: any[];
}

export type TemplateElement =
  | TextElement
  | ImageElement
  | ShapeElement
  | SVGElement
  | ContainerElement
  | TableElement;

// ============================================
// TEMPLATE STRUCTURE
// ============================================

export interface PageSize {
  width: number;
  height: number;
  unit: 'px' | 'pt' | 'mm' | 'in';
}

export interface TemplatePage {
  id: string;
  size: PageSize;
  background?: string | { type: 'color' | 'image' | 'gradient'; value: string };
  elements: TemplateElement[];
  margins?: { top: number; right: number; bottom: number; left: number };
}

export interface Template {
  id: string;
  name: string;
  version: string;
  pages: TemplatePage[];
  fonts?: { family: string; src: string; weight?: number; style?: string }[];
  variables?: { [key: string]: any }; // Default values
  metadata?: {
    author?: string;
    created?: string;
    modified?: string;
    description?: string;
  };
}

// ============================================
// DATA INJECTION
// ============================================

export interface InjectionData {
  [key: string]: any;
}

export interface InjectionOptions {
  strictMode?: boolean; // Fail on missing bindings
  defaultValues?: { [key: string]: any };
  formatters?: { [name: string]: (value: any) => string };
  imageResolver?: (src: string) => Promise<string>; // Resolve image URLs
}

// ============================================
// RENDERING
// ============================================

export interface RenderOptions {
  format: 'html' | 'pdf' | 'png' | 'svg';
  scale?: number;
  quality?: number; // For image outputs
  embedFonts?: boolean;
  embedImages?: boolean; // Base64 encode images
  minify?: boolean;
}

export interface RenderResult {
  success: boolean;
  output: string | Buffer;
  warnings?: string[];
  errors?: string[];
  metadata?: {
    pageCount: number;
    renderTime: number;
    fileSize: number;
  };
}

// ============================================
// PARSER
// ============================================

export interface ParseOptions {
  extractImages?: boolean;
  extractFonts?: boolean;
  detectTables?: boolean;
  groupElements?: boolean; // Try to group related elements
  ocrFallback?: boolean; // Use OCR for images with text
}

export interface ParseResult {
  success: boolean;
  template: Template;
  warnings?: string[];
  errors?: string[];
  extractedAssets?: {
    images: { id: string; data: Buffer; mimeType: string }[];
    fonts: { family: string; data: Buffer; format: string }[];
  };
}
