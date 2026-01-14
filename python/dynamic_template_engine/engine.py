"""
Dynamic Template Engine - Core Engine

Handles template creation, element management, data injection, and rendering.
"""

import json
import uuid
import re
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Any, Literal, Callable
from pathlib import Path


@dataclass
class BoundingBox:
    x: float
    y: float
    width: float
    height: float


@dataclass
class TextStyle:
    font_family: str = "Arial"
    font_size: float = 14
    font_weight: int = 400
    font_style: str = "normal"
    color: str = "#000000"
    line_height: float = 1.2
    letter_spacing: float = 0


@dataclass
class ShapeStyle:
    fill: Optional[str] = None
    stroke: Optional[str] = None
    stroke_width: float = 1
    border_radius: float = 0
    opacity: float = 1.0


@dataclass
class Constraints:
    min_font_size: float = 8
    max_font_size: float = 72
    overflow: Literal["shrink", "wrap", "ellipsis", "clip"] = "shrink"
    text_align: Literal["left", "center", "right", "justify"] = "left"
    vertical_align: Literal["top", "middle", "bottom"] = "top"


@dataclass
class TextElement:
    id: str
    type: str = "text"
    bounds: BoundingBox = None
    content: str = ""
    data_binding: Optional[str] = None
    style: TextStyle = None
    constraints: Constraints = None
    z_index: int = 0

    def __post_init__(self):
        if self.bounds is None:
            self.bounds = BoundingBox(0, 0, 100, 20)
        if self.style is None:
            self.style = TextStyle()
        if self.constraints is None:
            self.constraints = Constraints()


@dataclass
class ImageElement:
    id: str
    type: str = "image"
    bounds: BoundingBox = None
    src: str = ""
    data_binding: Optional[str] = None
    object_fit: Literal["cover", "contain", "fill", "none"] = "cover"
    z_index: int = 0

    def __post_init__(self):
        if self.bounds is None:
            self.bounds = BoundingBox(0, 0, 100, 100)


@dataclass
class ShapeElement:
    id: str
    type: str = "shape"
    bounds: BoundingBox = None
    shape_type: Literal["rectangle", "circle", "ellipse"] = "rectangle"
    style: ShapeStyle = None
    z_index: int = 0

    def __post_init__(self):
        if self.bounds is None:
            self.bounds = BoundingBox(0, 0, 100, 100)
        if self.style is None:
            self.style = ShapeStyle()


@dataclass
class TemplatePage:
    id: str
    width: float = 612  # US Letter in points
    height: float = 792
    unit: str = "pt"
    background: str = "#ffffff"
    elements: List[Any] = field(default_factory=list)


@dataclass
class Template:
    id: str
    name: str
    version: str = "1.0.0"
    pages: List[TemplatePage] = field(default_factory=list)


class DynamicTemplateEngine:
    """
    Core engine for dynamic template generation.

    Key feature: Text elements automatically scale to fit within their
    containers, preventing overflow issues.
    """

    def __init__(self):
        self.templates: Dict[str, Template] = {}
        self.formatters: Dict[str, Callable] = {
            "currency": lambda v: f"${v:,.2f}" if isinstance(v, (int, float)) else str(v),
            "number": lambda v: f"{v:,}" if isinstance(v, (int, float)) else str(v),
            "percent": lambda v: f"{v * 100:.1f}%" if isinstance(v, (int, float)) else str(v),
            "sqft": lambda v: f"{v:,} SF" if isinstance(v, (int, float)) else str(v),
            "uppercase": lambda v: str(v).upper(),
            "lowercase": lambda v: str(v).lower(),
        }

    def generate_id(self, prefix: str = "el") -> str:
        """Generate a unique ID."""
        return f"{prefix}_{uuid.uuid4().hex[:8]}"

    # =========================================
    # Template Operations
    # =========================================

    def create_template(
        self,
        name: str,
        page_width: float = 612,
        page_height: float = 792,
        background: str = "#ffffff",
    ) -> str:
        """Create a new template and return its ID."""
        template_id = self.generate_id("template")
        page_id = self.generate_id("page")

        template = Template(
            id=template_id,
            name=name,
            pages=[
                TemplatePage(
                    id=page_id,
                    width=page_width,
                    height=page_height,
                    background=background,
                )
            ],
        )

        self.templates[template_id] = template
        return template_id

    def get_template(self, template_id: str) -> Optional[Template]:
        """Get a template by ID."""
        return self.templates.get(template_id)

    # =========================================
    # Element Creation
    # =========================================

    def add_text_element(
        self,
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
    ) -> str:
        """
        Add a dynamic text element to a template.

        The key innovation: overflow="shrink" makes text automatically
        scale down to fit within the container bounds.
        """
        template = self.templates.get(template_id)
        if not template:
            raise ValueError(f"Template not found: {template_id}")

        element_id = self.generate_id("text")
        element = TextElement(
            id=element_id,
            bounds=BoundingBox(x, y, width, height),
            content=content,
            data_binding=binding,
            style=TextStyle(
                font_family=font_family,
                font_size=font_size,
                font_weight=font_weight,
                color=color,
            ),
            constraints=Constraints(
                min_font_size=min_font_size,
                max_font_size=max_font_size or font_size,
                overflow=overflow,
                text_align=text_align,
                vertical_align=vertical_align,
            ),
        )

        template.pages[0].elements.append(element)
        return element_id

    def add_shape_element(
        self,
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
    ) -> str:
        """Add a shape element (rectangle, circle, etc.)."""
        template = self.templates.get(template_id)
        if not template:
            raise ValueError(f"Template not found: {template_id}")

        element_id = self.generate_id("shape")
        element = ShapeElement(
            id=element_id,
            bounds=BoundingBox(x, y, width, height),
            shape_type=shape_type,
            style=ShapeStyle(
                fill=fill,
                stroke=stroke,
                stroke_width=stroke_width,
                border_radius=border_radius,
            ),
        )

        template.pages[0].elements.append(element)
        return element_id

    def add_image_element(
        self,
        template_id: str,
        x: float,
        y: float,
        width: float,
        height: float,
        src: str,
        binding: Optional[str] = None,
        object_fit: str = "cover",
    ) -> str:
        """Add an image element."""
        template = self.templates.get(template_id)
        if not template:
            raise ValueError(f"Template not found: {template_id}")

        element_id = self.generate_id("image")
        element = ImageElement(
            id=element_id,
            bounds=BoundingBox(x, y, width, height),
            src=src,
            data_binding=binding,
            object_fit=object_fit,
        )

        template.pages[0].elements.append(element)
        return element_id

    # =========================================
    # Data Injection
    # =========================================

    def inject_data(self, template_id: str, data: Dict[str, Any]) -> None:
        """
        Inject data into template bindings.

        Bindings use format: {{path.to.value}} or {{path|formatter}}
        """
        template = self.templates.get(template_id)
        if not template:
            raise ValueError(f"Template not found: {template_id}")

        for page in template.pages:
            for element in page.elements:
                if hasattr(element, "data_binding") and element.data_binding:
                    resolved = self._resolve_binding(element.data_binding, data)
                    element.content = resolved

    def _resolve_binding(self, binding: str, data: Dict[str, Any]) -> str:
        """Resolve a binding expression like {{property.name|currency}}."""
        match = re.match(r"\{\{(.+?)\}\}", binding)
        if not match:
            return binding

        expression = match.group(1).strip()
        parts = expression.split("|")
        path = parts[0].strip()
        formatter_name = parts[1].strip() if len(parts) > 1 else None

        # Get nested value
        value = self._get_nested_value(data, path)

        # Apply formatter if specified
        if formatter_name and formatter_name in self.formatters:
            try:
                value = self.formatters[formatter_name](value)
            except Exception:
                pass

        return str(value) if value is not None else ""

    def _get_nested_value(self, data: Dict[str, Any], path: str) -> Any:
        """Get a nested value from a dict using dot notation."""
        keys = path.split(".")
        value = data
        for key in keys:
            if isinstance(value, dict):
                value = value.get(key)
            else:
                return None
        return value

    # =========================================
    # Text Fitting
    # =========================================

    def calculate_text_fit(
        self,
        text: str,
        container_width: float,
        container_height: float,
        min_font_size: float = 8,
        max_font_size: float = 72,
        font_family: str = "Arial",
    ) -> float:
        """
        Calculate optimal font size for text to fit in container.
        Uses binary search to find the largest font that fits.
        """
        # Approximate character width ratios
        avg_char_width_ratio = {
            "Arial": 0.52,
            "Helvetica": 0.52,
            "Times New Roman": 0.48,
        }.get(font_family, 0.50)

        line_height = 1.2
        low, high = min_font_size, max_font_size

        while high - low > 0.5:
            mid = (low + high) / 2
            text_width = len(text) * mid * avg_char_width_ratio
            text_height = mid * line_height

            # Check if text fits (single line)
            if text_width <= container_width and text_height <= container_height:
                low = mid
            else:
                # Check with wrapping
                lines_needed = max(1, text_width / container_width)
                total_height = lines_needed * text_height
                if total_height <= container_height:
                    low = mid
                else:
                    high = mid

        return low

    # =========================================
    # Rendering
    # =========================================

    def render_html(self, template_id: str) -> str:
        """Generate HTML with embedded text-fitting runtime."""
        template = self.templates.get(template_id)
        if not template:
            raise ValueError(f"Template not found: {template_id}")

        page = template.pages[0]
        elements_html = self._render_elements(page.elements)

        return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{template.name}</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        .dte-page {{
            position: relative;
            width: {page.width}pt;
            height: {page.height}pt;
            background: {page.background};
            overflow: hidden;
            margin: 0 auto;
        }}
        .dte-element {{ position: absolute; }}
        .dte-text {{
            display: flex;
            overflow: hidden;
        }}
        .dte-text-content {{ width: 100%; }}
        .dte-overflow-shrink {{ overflow: hidden; }}
        .dte-align-h-left {{ justify-content: flex-start; text-align: left; }}
        .dte-align-h-center {{ justify-content: center; text-align: center; }}
        .dte-align-h-right {{ justify-content: flex-end; text-align: right; }}
        .dte-align-v-top {{ align-items: flex-start; }}
        .dte-align-v-middle {{ align-items: center; }}
        .dte-align-v-bottom {{ align-items: flex-end; }}
        .dte-image img {{ width: 100%; height: 100%; }}
    </style>
</head>
<body>
    <div class="dte-page">
{elements_html}
    </div>
    {self._get_runtime_script()}
</body>
</html>"""

    def _render_elements(self, elements: List[Any]) -> str:
        """Render all elements to HTML."""
        html_parts = []

        # Sort by z-index
        sorted_elements = sorted(elements, key=lambda e: e.z_index)

        for element in sorted_elements:
            if element.type == "text":
                html_parts.append(self._render_text_element(element))
            elif element.type == "shape":
                html_parts.append(self._render_shape_element(element))
            elif element.type == "image":
                html_parts.append(self._render_image_element(element))

        return "\n".join(html_parts)

    def _render_text_element(self, element: TextElement) -> str:
        """Render a text element with constraints for auto-fitting."""
        b = element.bounds
        s = element.style
        c = element.constraints

        constraints_json = json.dumps({
            "minFontSize": c.min_font_size,
            "maxFontSize": c.max_font_size,
            "overflow": c.overflow,
        })

        return f"""        <div class="dte-element dte-text dte-overflow-{c.overflow} dte-align-h-{c.text_align} dte-align-v-{c.vertical_align}"
             id="{element.id}"
             data-constraints='{constraints_json}'
             style="left: {b.x}pt; top: {b.y}pt; width: {b.width}pt; height: {b.height}pt;
                    font-family: {s.font_family}; font-size: {s.font_size}pt;
                    font-weight: {s.font_weight}; color: {s.color};">
            <span class="dte-text-content">{element.content}</span>
        </div>"""

    def _render_shape_element(self, element: ShapeElement) -> str:
        """Render a shape element."""
        b = element.bounds
        s = element.style

        style_parts = [
            f"left: {b.x}pt",
            f"top: {b.y}pt",
            f"width: {b.width}pt",
            f"height: {b.height}pt",
        ]

        if s.fill:
            style_parts.append(f"background: {s.fill}")
        if s.stroke:
            style_parts.append(f"border: {s.stroke_width}pt solid {s.stroke}")
        if s.border_radius:
            style_parts.append(f"border-radius: {s.border_radius}pt")
        if element.shape_type in ("circle", "ellipse"):
            style_parts.append("border-radius: 50%")

        return f"""        <div class="dte-element dte-shape"
             id="{element.id}"
             style="{'; '.join(style_parts)};">
        </div>"""

    def _render_image_element(self, element: ImageElement) -> str:
        """Render an image element."""
        b = element.bounds

        return f"""        <div class="dte-element dte-image"
             id="{element.id}"
             style="left: {b.x}pt; top: {b.y}pt; width: {b.width}pt; height: {b.height}pt;">
            <img src="{element.src}" style="object-fit: {element.object_fit};" />
        </div>"""

    def _get_runtime_script(self) -> str:
        """Get the JavaScript runtime for text fitting."""
        return """
    <script>
    (function() {
        const DTE = {
            init() {
                this.fitAllText();
                window.DTE = this;
            },
            fitAllText() {
                document.querySelectorAll('.dte-overflow-shrink').forEach(el => this.fitText(el));
            },
            fitText(element) {
                const content = element.querySelector('.dte-text-content');
                if (!content) return;

                const constraints = JSON.parse(element.dataset.constraints || '{}');
                const minFont = constraints.minFontSize || 6;
                const maxFont = constraints.maxFontSize || 72;

                let low = minFont, high = Math.min(maxFont, parseFloat(getComputedStyle(element).fontSize));

                while (high - low > 0.5) {
                    const mid = (low + high) / 2;
                    element.style.fontSize = mid + 'pt';

                    if (content.scrollWidth > element.clientWidth || content.scrollHeight > element.clientHeight) {
                        high = mid;
                    } else {
                        low = mid;
                    }
                }
                element.style.fontSize = low + 'pt';
            }
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => DTE.init());
        } else {
            DTE.init();
        }
    })();
    </script>"""

    def render_to_file(self, template_id: str, output_path: str) -> str:
        """Render template to HTML file."""
        html = self.render_html(template_id)
        Path(output_path).write_text(html)
        return output_path
