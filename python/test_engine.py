"""
Test the Dynamic Template Engine
Verify that text auto-shrinks in the generated HTML
"""

import os
from dynamic_template_engine.engine import DynamicTemplateEngine

def test_dynamic_text_fitting():
    """Test that the engine generates HTML with auto-shrink capability."""

    engine = DynamicTemplateEngine()

    # Create a template
    template_id = engine.create_template(
        name="Test Template",
        page_width=612,
        page_height=792,
    )
    print(f"Created template: {template_id}")

    # Add a header background
    engine.add_shape_element(
        template_id=template_id,
        x=0, y=0, width=612, height=80,
        fill="#1a365d",
    )

    # Add a text element with SHRINK overflow - this is the key!
    engine.add_text_element(
        template_id=template_id,
        x=36, y=20,
        width=400, height=50,
        content="Property Name Placeholder",
        binding="{{property.name}}",
        font_size=32,
        min_font_size=12,  # Will shrink down to 12pt if needed
        color="#ffffff",
        font_weight=700,
        overflow="shrink",  # THE KEY FEATURE
    )

    # Add price with currency formatter
    engine.add_text_element(
        template_id=template_id,
        x=36, y=120,
        width=250, height=40,
        content="$0",
        binding="{{property.price|currency}}",
        font_size=28,
        color="#48bb78",
        font_weight=700,
    )

    print("\n" + "="*60)
    print("TEST 1: Short property name (should fit at full size)")
    print("="*60)

    # Test with SHORT content
    engine.inject_data(template_id, {
        "property": {
            "name": "Sunset Plaza",
            "price": 5500000,
        }
    })

    html_short = engine.render_html(template_id)

    # Check that the HTML contains the runtime script
    assert "fitText" in html_short, "Missing text fitting runtime!"
    assert "dte-overflow-shrink" in html_short, "Missing shrink class!"
    assert "data-constraints" in html_short, "Missing constraints data!"
    assert "Sunset Plaza" in html_short, "Content not injected!"
    assert "$5,500,000.00" in html_short, "Currency formatter not working!"

    print("✓ Short name injected: 'Sunset Plaza'")
    print("✓ Price formatted: '$5,500,000.00'")
    print("✓ Runtime script included")
    print("✓ Shrink class applied")

    # Save short version
    os.makedirs("output", exist_ok=True)
    with open("output/test-short.html", "w") as f:
        f.write(html_short)
    print("✓ Saved to output/test-short.html")

    print("\n" + "="*60)
    print("TEST 2: Long property name (should trigger auto-shrink)")
    print("="*60)

    # Reset and test with LONG content
    template_id2 = engine.create_template(name="Test Long", page_width=612, page_height=792)
    engine.add_shape_element(template_id=template_id2, x=0, y=0, width=612, height=80, fill="#1a365d")
    engine.add_text_element(
        template_id=template_id2,
        x=36, y=20,
        width=400, height=50,
        content="Property Name",
        binding="{{property.name}}",
        font_size=32,
        min_font_size=12,
        color="#ffffff",
        font_weight=700,
        overflow="shrink",
    )

    # Inject LONG property name
    long_name = "The Metropolitan Downtown Mixed-Use Development Center & Commercial Complex"
    engine.inject_data(template_id2, {
        "property": {
            "name": long_name,
        }
    })

    html_long = engine.render_html(template_id2)

    assert long_name in html_long, "Long content not injected!"
    assert "minFontSize" in html_long, "Min font size constraint missing!"

    print(f"✓ Long name injected: '{long_name[:40]}...'")
    print("✓ Constraints include minFontSize: 12")

    with open("output/test-long.html", "w") as f:
        f.write(html_long)
    print("✓ Saved to output/test-long.html")

    print("\n" + "="*60)
    print("TEST 3: Verify the JavaScript runtime")
    print("="*60)

    # Check the runtime script content
    runtime_checks = [
        ("Binary search algorithm", "while (high - low > 0.5)"),
        ("Font size adjustment", "element.style.fontSize"),
        ("Overflow detection", "scrollWidth > element.clientWidth"),
        ("Constraints parsing", "JSON.parse(element.dataset.constraints"),
    ]

    for check_name, check_str in runtime_checks:
        assert check_str in html_long, f"Missing: {check_name}"
        print(f"✓ {check_name}: present")

    print("\n" + "="*60)
    print("ALL TESTS PASSED!")
    print("="*60)
    print("""
The generated HTML includes:

1. CSS class 'dte-overflow-shrink' on text elements
2. data-constraints attribute with minFontSize/maxFontSize
3. JavaScript runtime that:
   - Finds all .dte-overflow-shrink elements
   - Uses binary search to find optimal font size
   - Shrinks font until text fits in container
   - Respects minFontSize constraint

Open the HTML files in a browser to see it in action:
- output/test-short.html (text fits at 32pt)
- output/test-long.html (text auto-shrinks to fit)
""")

if __name__ == "__main__":
    test_dynamic_text_fitting()
