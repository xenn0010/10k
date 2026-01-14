"""
Dynamic Template Engine - LangGraph Plugin

Drop-in tools for LangGraph agents to generate pixel-perfect documents
with content-aware text fitting.

Usage:
    from dynamic_template_engine import get_template_tools

    # Add to your LangGraph agent
    tools = get_template_tools()
    agent = create_react_agent(llm, tools)
"""

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

from .engine import DynamicTemplateEngine

__version__ = "1.0.0"
__all__ = [
    "get_template_tools",
    "create_template",
    "add_text_element",
    "add_shape_element",
    "add_image_element",
    "inject_data",
    "render_html",
    "render_pdf",
    "calculate_text_fit",
    "DynamicTemplateEngine",
]
