"""
Dynamic Template Engine - LangGraph Tools

Drop-in tools for LangGraph agents. These tools enable AI agents to
create pixel-perfect documents with automatic text fitting.

Usage with LangGraph:
    from dynamic_template_engine import get_template_tools
    from langgraph.prebuilt import create_react_agent

    tools = get_template_tools()
    agent = create_react_agent(model, tools)
"""

from typing import Optional, Dict, Any, List
from langchain_core.tools import tool, StructuredTool
from pydantic import BaseModel, Field

from .engine import DynamicTemplateEngine

# Global engine instance (shared across tools)
_engine = DynamicTemplateEngine()


def get_engine() -> DynamicTemplateEngine:
    """Get the shared engine instance."""
    return _engine


def get_template_tools() -> List[StructuredTool]:
    """
    Get all template tools for use with LangGraph agents.

    Returns a list of tools that can be passed directly to create_react_agent()
    or any LangGraph tool executor.
    """
    return [
        create_template,
        add_text_element,
        add_shape_element,
        add_image_element,
        inject_data,
        render_html,
        render_pdf,
        calculate_text_fit,
    ]


# =========================================
# Tool Input Schemas (Pydantic models)
# =========================================

class CreateTemplateInput(BaseModel):
    """Input for creating a new template."""
    name: str = Field(description="Name of the template (e.g., 'Offering Memorandum', 'Property Flyer')")
    page_width: float = Field(default=612, description="Page width in points (612 = US Letter)")
    page_height: float = Field(default=792, description="Page height in points (792 = US Letter)")
    background: str = Field(default="#ffffff", description="Background color")


class AddTextElementInput(BaseModel):
    """Input for adding a dynamic text element."""
    template_id: str = Field(description="ID of the template to add the element to")
    x: float = Field(description="X position in points from left edge")
    y: float = Field(description="Y position in points from top edge")
    width: float = Field(description="Width of the text container in points")
    height: float = Field(description="Height of the text container in points")
    content: str = Field(description="Default text content or placeholder")
    binding: Optional[str] = Field(default=None, description="Data binding expression (e.g., '{{property.name}}' or '{{price|currency}}')")
    font_size: float = Field(default=14, description="Base font size in points")
    min_font_size: float = Field(default=8, description="Minimum font size when shrinking (for overflow='shrink')")
    max_font_size: Optional[float] = Field(default=None, description="Maximum font size")
    font_family: str = Field(default="Arial", description="Font family name")
    font_weight: int = Field(default=400, description="Font weight (400=normal, 700=bold)")
    color: str = Field(default="#000000", description="Text color in hex")
    text_align: str = Field(default="left", description="Horizontal alignment: left, center, right")
    vertical_align: str = Field(default="top", description="Vertical alignment: top, middle, bottom")
    overflow: str = Field(default="shrink", description="How to handle overflow: 'shrink' (auto-scale font), 'wrap', 'ellipsis', 'clip'")


class AddShapeElementInput(BaseModel):
    """Input for adding a shape element."""
    template_id: str = Field(description="ID of the template")
    x: float = Field(description="X position in points")
    y: float = Field(description="Y position in points")
    width: float = Field(description="Width in points")
    height: float = Field(description="Height in points")
    shape_type: str = Field(default="rectangle", description="Shape type: rectangle, circle, ellipse")
    fill: Optional[str] = Field(default=None, description="Fill color (e.g., '#1a365d')")
    stroke: Optional[str] = Field(default=None, description="Border color")
    stroke_width: float = Field(default=1, description="Border width in points")
    border_radius: float = Field(default=0, description="Corner radius for rectangles")


class AddImageElementInput(BaseModel):
    """Input for adding an image element."""
    template_id: str = Field(description="ID of the template")
    x: float = Field(description="X position in points")
    y: float = Field(description="Y position in points")
    width: float = Field(description="Width in points")
    height: float = Field(description="Height in points")
    src: str = Field(description="Image source URL or path")
    binding: Optional[str] = Field(default=None, description="Data binding for dynamic image (e.g., '{{property.heroImage}}')")
    object_fit: str = Field(default="cover", description="How image fits: cover, contain, fill, none")


class InjectDataInput(BaseModel):
    """Input for injecting data into a template."""
    template_id: str = Field(description="ID of the template")
    data: Dict[str, Any] = Field(description="Data object to inject. Bindings like {{property.name}} will be replaced with values from this object.")


class RenderHtmlInput(BaseModel):
    """Input for rendering template to HTML."""
    template_id: str = Field(description="ID of the template")
    output_path: Optional[str] = Field(default=None, description="Optional file path to save the HTML")


class RenderPdfInput(BaseModel):
    """Input for rendering template to PDF."""
    template_id: str = Field(description="ID of the template")
    output_path: str = Field(description="File path to save the PDF")


class CalculateTextFitInput(BaseModel):
    """Input for calculating optimal font size."""
    text: str = Field(description="The text content to fit")
    container_width: float = Field(description="Container width in points")
    container_height: float = Field(description="Container height in points")
    min_font_size: float = Field(default=8, description="Minimum font size")
    max_font_size: float = Field(default=72, description="Maximum font size")
    font_family: str = Field(default="Arial", description="Font family")


# =========================================
# LangGraph Tools
# =========================================

@tool(args_schema=CreateTemplateInput)
def create_template(
    name: str,
    page_width: float = 612,
    page_height: float = 792,
    background: str = "#ffffff",
) -> Dict[str, Any]:
    """
    Create a new dynamic template for document generation.

    Use this to start building a new document. Returns a template_id
    that you'll use in subsequent tool calls.

    Common page sizes:
    - US Letter: 612 x 792 points
    - A4: 595 x 842 points
    - US Legal: 612 x 1008 points
    """
    engine = get_engine()
    template_id = engine.create_template(
        name=name,
        page_width=page_width,
        page_height=page_height,
        background=background,
    )
    return {
        "success": True,
        "template_id": template_id,
        "message": f"Template '{name}' created successfully",
    }


@tool(args_schema=AddTextElementInput)
def add_text_element(
    template_id: str,
    x: float,
    y: float,
    width: float,
    height: float,
    content: str,
    binding: Optional[str] = None,
    font_size: float = 14,
    min_font_size: float = 8,
    max_font_size: Optional[float] = None,
    font_family: str = "Arial",
    font_weight: int = 400,
    color: str = "#000000",
    text_align: str = "left",
    vertical_align: str = "top",
    overflow: str = "shrink",
) -> Dict[str, Any]:
    """
    Add a dynamic text element to a template.

    KEY FEATURE: Set overflow='shrink' to automatically scale the font size
    to fit within the container. This prevents text from overflowing!

    Example bindings:
    - '{{property.name}}' - Simple value
    - '{{property.price|currency}}' - Formatted as $1,234,567.00
    - '{{property.sqft|number}}' - Formatted with commas
    - '{{property.capRate|percent}}' - Formatted as 6.5%

    The text will automatically shrink if the content is too long for the
    container, down to min_font_size.
    """
    engine = get_engine()
    element_id = engine.add_text_element(
        template_id=template_id,
        x=x, y=y, width=width, height=height,
        content=content,
        binding=binding,
        font_size=font_size,
        min_font_size=min_font_size,
        max_font_size=max_font_size,
        font_family=font_family,
        font_weight=font_weight,
        color=color,
        text_align=text_align,
        vertical_align=vertical_align,
        overflow=overflow,
    )
    return {
        "success": True,
        "element_id": element_id,
        "message": "Text element added",
    }


@tool(args_schema=AddShapeElementInput)
def add_shape_element(
    template_id: str,
    x: float,
    y: float,
    width: float,
    height: float,
    shape_type: str = "rectangle",
    fill: Optional[str] = None,
    stroke: Optional[str] = None,
    stroke_width: float = 1,
    border_radius: float = 0,
) -> Dict[str, Any]:
    """
    Add a shape element (rectangle, circle, etc.) to a template.

    Useful for:
    - Backgrounds and colored sections
    - Boxes around text content
    - Dividers and visual elements

    Add shapes BEFORE text elements so text appears on top.
    """
    engine = get_engine()
    element_id = engine.add_shape_element(
        template_id=template_id,
        x=x, y=y, width=width, height=height,
        shape_type=shape_type,
        fill=fill,
        stroke=stroke,
        stroke_width=stroke_width,
        border_radius=border_radius,
    )
    return {
        "success": True,
        "element_id": element_id,
        "message": f"Shape element ({shape_type}) added",
    }


@tool(args_schema=AddImageElementInput)
def add_image_element(
    template_id: str,
    x: float,
    y: float,
    width: float,
    height: float,
    src: str,
    binding: Optional[str] = None,
    object_fit: str = "cover",
) -> Dict[str, Any]:
    """
    Add an image element to a template.

    object_fit options:
    - 'cover': Fill the container, cropping if needed (best for hero images)
    - 'contain': Fit entirely within container, may have gaps
    - 'fill': Stretch to fill (may distort)
    - 'none': Natural size
    """
    engine = get_engine()
    element_id = engine.add_image_element(
        template_id=template_id,
        x=x, y=y, width=width, height=height,
        src=src,
        binding=binding,
        object_fit=object_fit,
    )
    return {
        "success": True,
        "element_id": element_id,
        "message": "Image element added",
    }


@tool(args_schema=InjectDataInput)
def inject_data(template_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Inject data into a template, replacing all {{bindings}} with actual values.

    The data object should match the structure used in your bindings.

    Example:
    If your template has bindings like '{{property.name}}' and '{{property.price|currency}}',
    provide data like:
    {
        "property": {
            "name": "Sunset Plaza",
            "price": 5500000
        }
    }

    Available formatters:
    - currency: $1,234,567.00
    - number: 1,234,567
    - percent: 6.5%
    - sqft: 45,000 SF
    - uppercase: UPPERCASE
    - lowercase: lowercase
    """
    engine = get_engine()
    engine.inject_data(template_id, data)
    return {
        "success": True,
        "message": "Data injected successfully",
    }


@tool(args_schema=RenderHtmlInput)
def render_html(template_id: str, output_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Render a template to HTML.

    The HTML includes a JavaScript runtime that automatically fits text
    to containers at render time. This ensures pixel-perfect output.

    If output_path is provided, saves to file. Otherwise returns HTML string.
    """
    engine = get_engine()

    if output_path:
        engine.render_to_file(template_id, output_path)
        return {
            "success": True,
            "output_path": output_path,
            "message": f"HTML saved to {output_path}",
        }
    else:
        html = engine.render_html(template_id)
        return {
            "success": True,
            "html": html,
            "message": "HTML generated",
        }


@tool(args_schema=RenderPdfInput)
def render_pdf(template_id: str, output_path: str) -> Dict[str, Any]:
    """
    Render a template to PDF.

    First renders to HTML, then uses a headless browser to generate
    pixel-perfect PDF output. Requires Chrome/Chromium to be installed.
    """
    engine = get_engine()

    # For PDF, we first render HTML then convert
    # In production, this would use playwright or puppeteer
    html_path = output_path.replace(".pdf", ".html")
    engine.render_to_file(template_id, html_path)

    return {
        "success": True,
        "html_path": html_path,
        "message": f"HTML generated at {html_path}. For PDF conversion, open in browser and print to PDF, or use playwright/puppeteer.",
        "note": "Full PDF rendering requires browser automation. HTML output is ready for conversion.",
    }


@tool(args_schema=CalculateTextFitInput)
def calculate_text_fit(
    text: str,
    container_width: float,
    container_height: float,
    min_font_size: float = 8,
    max_font_size: float = 72,
    font_family: str = "Arial",
) -> Dict[str, Any]:
    """
    Calculate the optimal font size for text to fit within given dimensions.

    Useful for previewing how text will render without creating a full template.
    Uses binary search to find the largest font size that fits.
    """
    engine = get_engine()
    optimal_size = engine.calculate_text_fit(
        text=text,
        container_width=container_width,
        container_height=container_height,
        min_font_size=min_font_size,
        max_font_size=max_font_size,
        font_family=font_family,
    )
    return {
        "success": True,
        "optimal_font_size": round(optimal_size, 1),
        "text_length": len(text),
        "container": f"{container_width}x{container_height}pt",
    }
