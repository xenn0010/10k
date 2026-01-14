"""
PDF Template Extractor

Extracts design elements from a PDF template and converts them to
our dynamic template format. This allows users to:

1. Upload their existing PDF template
2. We extract all elements (text, shapes, images, positions, styles)
3. Convert to our dynamic format with auto-fit constraints
4. Inject new content
5. Render new PDF with same design but different content
"""

import fitz  # PyMuPDF
import json
import re
from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path

from .engine import (
    DynamicTemplateEngine,
    BoundingBox,
    TextStyle,
    ShapeStyle,
    Constraints,
    TextElement,
    ShapeElement,
    ImageElement,
    TemplatePage,
    Template,
)


@dataclass
class ExtractedText:
    """Text extracted from PDF with all styling info."""
    text: str
    x: float
    y: float
    width: float
    height: float
    font_name: str
    font_size: float
    color: Tuple[float, float, float]  # RGB 0-1
    is_bold: bool
    is_italic: bool


@dataclass
class ExtractedImage:
    """Image extracted from PDF."""
    x: float
    y: float
    width: float
    height: float
    image_data: bytes
    image_type: str  # png, jpeg, etc.


@dataclass
class ExtractedRect:
    """Rectangle/shape extracted from PDF."""
    x: float
    y: float
    width: float
    height: float
    fill_color: Optional[Tuple[float, float, float]]
    stroke_color: Optional[Tuple[float, float, float]]
    stroke_width: float


class PDFTemplateExtractor:
    """
    Extracts design from PDF and creates dynamic template.

    Usage:
        extractor = PDFTemplateExtractor()
        template_id = extractor.extract("template.pdf")

        # Now inject new data
        engine = extractor.engine
        engine.inject_data(template_id, {"property": {"name": "New Name"}})
        html = engine.render_html(template_id)
    """

    def __init__(self):
        self.engine = DynamicTemplateEngine()

    def extract(self, pdf_path: str, make_dynamic: bool = True) -> str:
        """
        Extract template from PDF file.

        Args:
            pdf_path: Path to PDF file
            make_dynamic: If True, adds auto-fit constraints to text elements

        Returns:
            template_id that can be used with the engine
        """
        doc = fitz.open(pdf_path)

        # Create template with same page size as PDF
        page = doc[0]
        rect = page.rect

        template_id = self.engine.create_template(
            name=Path(pdf_path).stem,
            page_width=rect.width,
            page_height=rect.height,
            background="#ffffff",
        )

        # Extract elements from each page
        for page_num, page in enumerate(doc):
            self._extract_page(page, template_id, make_dynamic)

        doc.close()

        return template_id

    def _extract_page(self, page: fitz.Page, template_id: str, make_dynamic: bool):
        """Extract all elements from a page."""

        # Get page height for coordinate conversion (PDF uses bottom-left origin)
        page_height = page.rect.height

        # 1. Extract drawings (rectangles, shapes) first (they're usually backgrounds)
        self._extract_drawings(page, template_id, page_height)

        # 2. Extract images
        self._extract_images(page, template_id, page_height)

        # 3. Extract text blocks
        self._extract_text(page, template_id, page_height, make_dynamic)

    def _extract_drawings(self, page: fitz.Page, template_id: str, page_height: float):
        """Extract rectangles and shapes from the page."""

        drawings = page.get_drawings()

        for drawing in drawings:
            # Get the bounding rectangle
            rect = drawing.get("rect")
            if not rect:
                continue

            # Convert coordinates (PDF y is from bottom, we use from top)
            x = rect.x0
            y = rect.y0  # PyMuPDF already uses top-left origin
            width = rect.width
            height = rect.height

            # Skip very small shapes (likely artifacts)
            if width < 5 or height < 5:
                continue

            # Get colors
            fill = drawing.get("fill")
            stroke = drawing.get("color")
            stroke_width = drawing.get("width", 1)

            fill_color = None
            stroke_color = None

            if fill:
                fill_color = self._color_to_hex(fill)
            if stroke:
                stroke_color = self._color_to_hex(stroke)

            # Only add if there's some visible styling
            if fill_color or stroke_color:
                self.engine.add_shape_element(
                    template_id=template_id,
                    x=x,
                    y=y,
                    width=width,
                    height=height,
                    shape_type="rectangle",
                    fill=fill_color,
                    stroke=stroke_color,
                    stroke_width=stroke_width,
                )

    def _extract_images(self, page: fitz.Page, template_id: str, page_height: float):
        """Extract images from the page."""

        image_list = page.get_images()

        for img_index, img in enumerate(image_list):
            xref = img[0]

            # Get image bbox on page
            img_rects = page.get_image_rects(xref)
            if not img_rects:
                continue

            rect = img_rects[0]

            # Extract image data
            base_image = page.parent.extract_image(xref)
            image_data = base_image["image"]
            image_ext = base_image["ext"]

            # Save image to file (or could base64 encode)
            img_filename = f"extracted_img_{img_index}.{image_ext}"

            self.engine.add_image_element(
                template_id=template_id,
                x=rect.x0,
                y=rect.y0,
                width=rect.width,
                height=rect.height,
                src=img_filename,  # Would need to save this file
                object_fit="cover",
            )

    def _extract_text(self, page: fitz.Page, template_id: str, page_height: float, make_dynamic: bool):
        """Extract text blocks with styling."""

        # Get text with detailed info
        blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]

        for block in blocks:
            if block["type"] != 0:  # 0 = text block
                continue

            for line in block["lines"]:
                for span in line["spans"]:
                    text = span["text"].strip()
                    if not text:
                        continue

                    # Get bounding box
                    bbox = span["bbox"]
                    x = bbox[0]
                    y = bbox[1]
                    width = bbox[2] - bbox[0]
                    height = bbox[3] - bbox[1]

                    # Add some padding to width for dynamic content
                    if make_dynamic:
                        width = max(width * 1.2, width + 50)  # Allow 20% more or +50pt

                    # Get font info
                    font_name = span["font"]
                    font_size = span["size"]

                    # Detect bold/italic from font name
                    is_bold = "bold" in font_name.lower() or "black" in font_name.lower()
                    is_italic = "italic" in font_name.lower() or "oblique" in font_name.lower()

                    # Get color (PyMuPDF returns int)
                    color_int = span.get("color", 0)
                    color_hex = self._int_color_to_hex(color_int)

                    # Create data binding placeholder from text
                    # Convert "Property Name" -> "{{property_name}}"
                    binding = None
                    if make_dynamic:
                        binding = self._text_to_binding(text)

                    # Add text element with auto-fit constraints
                    self.engine.add_text_element(
                        template_id=template_id,
                        x=x,
                        y=y,
                        width=width,
                        height=height * 1.5,  # Add vertical padding
                        content=text,
                        binding=binding,
                        font_size=font_size,
                        min_font_size=max(8, font_size * 0.5),  # Can shrink to 50%
                        max_font_size=font_size,
                        font_family=self._normalize_font(font_name),
                        font_weight=700 if is_bold else 400,
                        color=color_hex,
                        overflow="shrink" if make_dynamic else "clip",
                    )

    def _color_to_hex(self, color: Tuple[float, ...]) -> str:
        """Convert RGB tuple (0-1) to hex color."""
        if len(color) >= 3:
            r, g, b = int(color[0] * 255), int(color[1] * 255), int(color[2] * 255)
            return f"#{r:02x}{g:02x}{b:02x}"
        return "#000000"

    def _int_color_to_hex(self, color_int: int) -> str:
        """Convert integer color to hex."""
        # PyMuPDF stores color as int: 0xRRGGBB
        r = (color_int >> 16) & 0xFF
        g = (color_int >> 8) & 0xFF
        b = color_int & 0xFF
        return f"#{r:02x}{g:02x}{b:02x}"

    def _normalize_font(self, font_name: str) -> str:
        """Normalize font name to web-safe font."""
        font_lower = font_name.lower()

        if "arial" in font_lower or "helvetica" in font_lower:
            return "Arial"
        elif "times" in font_lower:
            return "Times New Roman"
        elif "courier" in font_lower:
            return "Courier New"
        elif "georgia" in font_lower:
            return "Georgia"
        else:
            return "Arial"  # Default fallback

    def _text_to_binding(self, text: str) -> str:
        """
        Convert text content to a data binding placeholder.

        Examples:
            "Sunset Plaza" -> "{{property_name}}"
            "$5,500,000" -> "{{price|currency}}"
            "45,000 SF" -> "{{sqft|sqft}}"
        """
        # Detect price
        if re.match(r'^\$[\d,]+', text):
            return "{{price|currency}}"

        # Detect square footage
        if re.search(r'[\d,]+\s*SF', text, re.IGNORECASE):
            return "{{sqft|sqft}}"

        # Detect percentage
        if re.search(r'[\d.]+%', text):
            return "{{cap_rate|percent}}"

        # Default: convert to snake_case binding
        # "Property Name" -> "{{property_name}}"
        slug = re.sub(r'[^\w\s]', '', text.lower())
        slug = re.sub(r'\s+', '_', slug.strip())

        if len(slug) > 30:
            slug = slug[:30]

        return "{{" + slug + "}}"

    def extract_to_json(self, pdf_path: str) -> Dict[str, Any]:
        """
        Extract template and return as JSON structure.
        Useful for inspection/debugging.
        """
        template_id = self.extract(pdf_path)
        template = self.engine.get_template(template_id)

        # Convert to dict
        result = {
            "id": template.id,
            "name": template.name,
            "pages": []
        }

        for page in template.pages:
            page_dict = {
                "width": page.width,
                "height": page.height,
                "background": page.background,
                "elements": []
            }

            for el in page.elements:
                el_dict = {
                    "type": el.type,
                    "id": el.id,
                    "bounds": asdict(el.bounds),
                }

                if hasattr(el, "content"):
                    el_dict["content"] = el.content
                if hasattr(el, "data_binding"):
                    el_dict["binding"] = el.data_binding
                if hasattr(el, "style"):
                    el_dict["style"] = asdict(el.style) if el.style else None
                if hasattr(el, "constraints"):
                    el_dict["constraints"] = asdict(el.constraints) if el.constraints else None

                page_dict["elements"].append(el_dict)

            result["pages"].append(page_dict)

        return result


def extract_and_recreate(
    pdf_path: str,
    new_data: Dict[str, Any],
    output_path: str = None,
) -> str:
    """
    High-level function to extract a PDF template and recreate with new data.

    Args:
        pdf_path: Path to the original PDF template
        new_data: New data to inject
        output_path: Where to save the HTML (optional)

    Returns:
        Generated HTML string
    """
    extractor = PDFTemplateExtractor()

    # Extract template from PDF
    template_id = extractor.extract(pdf_path)

    # Inject new data
    extractor.engine.inject_data(template_id, new_data)

    # Render to HTML
    html = extractor.engine.render_html(template_id)

    # Save if path provided
    if output_path:
        Path(output_path).write_text(html)

    return html
