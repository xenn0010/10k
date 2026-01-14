"""
LangGraph Integration Example

This shows how to integrate the Dynamic Template Engine into
an existing LangGraph agent for CRE document generation.

The agent can now:
1. Create templates
2. Add dynamic text elements that auto-shrink to fit
3. Inject data from property listings
4. Render to HTML/PDF
"""

from typing import Annotated, TypedDict
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

# Import the template tools
from dynamic_template_engine import get_template_tools


# =========================================
# State Definition
# =========================================

class AgentState(TypedDict):
    """State for the document generation agent."""
    messages: Annotated[list, add_messages]
    property_data: dict  # Data from Crexi or other sources
    template_id: str  # Current template being built


# =========================================
# Agent Setup
# =========================================

def create_document_agent(model_name: str = "gpt-4"):
    """
    Create a LangGraph agent with template generation capabilities.

    This agent can:
    - Create templates for OMs, flyers, etc.
    - Add dynamic text that auto-scales to fit
    - Inject property data
    - Render final documents
    """

    # Get our template tools
    template_tools = get_template_tools()

    # Initialize the LLM with tools
    llm = ChatOpenAI(model=model_name, temperature=0)
    llm_with_tools = llm.bind_tools(template_tools)

    # Define the agent node
    def agent_node(state: AgentState):
        """Main agent reasoning node."""
        messages = state["messages"]

        # Add context about the property if available
        if state.get("property_data"):
            property_context = f"\n\nProperty Data Available: {state['property_data']}"
            # Append to system message or inject into conversation
            pass

        response = llm_with_tools.invoke(messages)
        return {"messages": [response]}

    # Build the graph
    graph = StateGraph(AgentState)

    # Add nodes
    graph.add_node("agent", agent_node)
    graph.add_node("tools", ToolNode(template_tools))

    # Add edges
    graph.add_edge(START, "agent")

    # Conditional edge: if tool calls, go to tools, else end
    def should_continue(state: AgentState):
        last_message = state["messages"][-1]
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            return "tools"
        return END

    graph.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
    graph.add_edge("tools", "agent")

    return graph.compile()


# =========================================
# Example Usage
# =========================================

def example_generate_om():
    """
    Example: Generate an Offering Memorandum from property data.

    This demonstrates the full flow:
    1. Agent receives property data
    2. Creates a template
    3. Adds dynamic text elements
    4. Injects data
    5. Renders output
    """

    # Sample property data (would come from Crexi API)
    property_data = {
        "property": {
            "name": "Sunset Plaza Shopping Center",
            "address": "1234 Commerce Boulevard, Austin, TX 78701",
            "price": 12500000,
            "sqft": 85000,
            "cap_rate": 0.0625,
            "year_built": 2018,
            "occupancy": 0.94,
            "noi": 781250,
            "highlights": """
                Prime retail location with excellent visibility on major thoroughfare.
                Strong tenant mix including national credit tenants.
                Below-market rents with significant upside potential.
                Recent capital improvements totaling $1.2M.
            """,
        },
        "broker": {
            "name": "John Smith",
            "phone": "(512) 555-1234",
            "email": "john@austincre.com",
            "company": "Austin Commercial Realty",
        },
    }

    # Create the agent
    agent = create_document_agent()

    # Run the agent with instructions
    result = agent.invoke({
        "messages": [
            {
                "role": "user",
                "content": f"""
Create an Offering Memorandum for this property:

Property: {property_data['property']['name']}
Address: {property_data['property']['address']}
Price: ${property_data['property']['price']:,}
Size: {property_data['property']['sqft']:,} SF
Cap Rate: {property_data['property']['cap_rate'] * 100:.1f}%

Create a professional template with:
1. A header with the property name and address (use dark blue background #1a365d)
2. Key metrics boxes showing Price, Size, and Cap Rate
3. An investment highlights section
4. Broker contact info in the footer

IMPORTANT: Use data bindings like {{{{property.name}}}} so we can inject the actual data.
Make sure text elements use overflow='shrink' so long property names don't overflow.

After creating the template, inject this data and render to HTML:
{property_data}

Save the output to output/sunset-plaza-om.html
""",
            }
        ],
        "property_data": property_data,
        "template_id": None,
    })

    print("Agent completed!")
    print(f"Final message: {result['messages'][-1].content}")

    return result


# =========================================
# Simpler Direct Usage (without full agent)
# =========================================

def direct_template_creation():
    """
    Example of using the tools directly without a full agent.
    Useful for simpler automation scripts.
    """
    from dynamic_template_engine import (
        create_template,
        add_text_element,
        add_shape_element,
        inject_data,
        render_html,
    )

    # 1. Create template
    result = create_template.invoke({
        "name": "Quick Property Flyer",
        "page_width": 612,
        "page_height": 792,
    })
    template_id = result["template_id"]
    print(f"Created template: {template_id}")

    # 2. Add header background
    add_shape_element.invoke({
        "template_id": template_id,
        "x": 0, "y": 0, "width": 612, "height": 100,
        "fill": "#1a365d",
    })

    # 3. Add property name (DYNAMIC - auto-shrinks!)
    add_text_element.invoke({
        "template_id": template_id,
        "x": 36, "y": 30,
        "width": 400, "height": 50,
        "content": "Property Name",
        "binding": "{{property.name}}",
        "font_size": 32,
        "min_font_size": 16,  # Won't go smaller than this
        "color": "#ffffff",
        "font_weight": 700,
        "overflow": "shrink",  # THE KEY FEATURE!
    })

    # 4. Add price
    add_text_element.invoke({
        "template_id": template_id,
        "x": 36, "y": 130,
        "width": 200, "height": 40,
        "content": "$0",
        "binding": "{{property.price|currency}}",
        "font_size": 28,
        "color": "#48bb78",
        "font_weight": 700,
    })

    # 5. Inject data
    inject_data.invoke({
        "template_id": template_id,
        "data": {
            "property": {
                "name": "The Metropolitan Downtown Mixed-Use Development Center",  # Long name!
                "price": 125750000,
            }
        }
    })

    # 6. Render
    result = render_html.invoke({
        "template_id": template_id,
        "output_path": "output/quick-flyer.html",
    })
    print(f"Rendered: {result}")


if __name__ == "__main__":
    # Run the direct example (doesn't require OpenAI API key)
    print("=" * 60)
    print("Direct Template Creation Example")
    print("=" * 60)
    direct_template_creation()

    # Uncomment to run the full agent example (requires OpenAI API key)
    # print("\n" + "=" * 60)
    # print("Full Agent Example")
    # print("=" * 60)
    # example_generate_om()
