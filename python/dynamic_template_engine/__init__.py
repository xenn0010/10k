"""
Dynamic Template Engine - LangGraph Plugin

Drop-in tools for LangGraph agents to generate pixel-perfect documents
with content-aware text fitting.

Usage:
    from dynamic_template_engine import get_template_tools

    # Add to your LangGraph agent
    tools = get_template_tools()
    agent = create_react_agent(llm, tools)

PDF Template Extraction:
    from dynamic_template_engine import extract_and_recreate

    # Extract design from existing PDF, inject new data
    html = extract_and_recreate(
        "template.pdf",
        {"property_name": "New Property", "price": 5500000}
    )
"""

from .engine import DynamicTemplateEngine
from .pdf_extractor import PDFTemplateExtractor, extract_and_recreate

# Only import LangGraph tools if langchain is available
try:
    from .tools import (
        get_template_tools,
        create_template,
        add_text_element,
        add_shape_element,
        add_image_element,
        inject_data,
        render_html,
        render_pdf,
        calculate_text_fit,
    )
    _HAS_LANGCHAIN = True
except ImportError:
    _HAS_LANGCHAIN = False
    get_template_tools = None

__version__ = "1.0.0"
__all__ = [
    "DynamicTemplateEngine",
    "PDFTemplateExtractor",
    "extract_and_recreate",
    "get_template_tools",
    "create_template",
    "add_text_element",
    "add_shape_element",
    "add_image_element",
    "inject_data",
    "render_html",
    "render_pdf",
    "calculate_text_fit",
]
