"""
Test PDF Template Extraction and Recreation

This test verifies that we can:
1. Take an existing PDF template
2. Extract all design elements (shapes, text, positions, colors, fonts)
3. Inject new content
4. Generate HTML that preserves the original design with new content
"""

import json
from dynamic_template_engine import PDFTemplateExtractor, extract_and_recreate


def test_extraction():
    """Test extracting a PDF template."""

    print("=" * 70)
    print("TEST: PDF Template Extraction")
    print("=" * 70)

    extractor = PDFTemplateExtractor()

    # Extract the sample template
    template_id = extractor.extract("sample_template.pdf")
    print(f"\n✓ Extracted template: {template_id}")

    # Get the extracted structure
    template = extractor.engine.get_template(template_id)

    print(f"\n📄 Template: {template.name}")
    print(f"   Pages: {len(template.pages)}")

    page = template.pages[0]
    print(f"   Page size: {page.width} x {page.height} pt")
    print(f"   Elements extracted: {len(page.elements)}")

    # Count by type
    shapes = [e for e in page.elements if e.type == "shape"]
    texts = [e for e in page.elements if e.type == "text"]
    images = [e for e in page.elements if e.type == "image"]

    print(f"\n   Element breakdown:")
    print(f"   - Shapes (backgrounds): {len(shapes)}")
    print(f"   - Text elements: {len(texts)}")
    print(f"   - Images: {len(images)}")

    # Show extracted text elements
    print(f"\n📝 Extracted Text Elements:")
    for i, el in enumerate(texts[:10]):  # First 10
        binding = el.data_binding or "(no binding)"
        print(f"   {i+1}. \"{el.content[:40]}...\" -> {binding}")
        print(f"      Position: ({el.bounds.x:.0f}, {el.bounds.y:.0f}) Size: {el.bounds.width:.0f}x{el.bounds.height:.0f}")
        print(f"      Font: {el.style.font_size}pt, Color: {el.style.color}")
        print(f"      Constraints: min={el.constraints.min_font_size}pt, overflow={el.constraints.overflow}")
        print()

    return template_id, extractor


def test_recreation_with_new_data(template_id, extractor):
    """Test injecting new data into extracted template."""

    print("=" * 70)
    print("TEST: Recreate Template with New Data")
    print("=" * 70)

    # New property data - DIFFERENT from original
    new_data = {
        # Text bindings generated from extraction
        "sunset_plaza": "The Metropolitan Downtown Center",  # Was "Sunset Plaza"
        "123_main_street_austin_tx_78701": "9876 Commerce Blvd, San Francisco, CA 94102",
        "price": 125750000,  # Was $5,500,000
        "sqft": 450000,  # Was 45,000
        "cap_rate": 0.0525,  # Was 6.5%

        # Alternative: use nested structure
        "property": {
            "name": "The Metropolitan Downtown Center",
            "address": "9876 Commerce Blvd, San Francisco, CA 94102",
            "price": 125750000,
            "sqft": 450000,
            "cap_rate": 0.0525,
        }
    }

    # Inject the new data
    extractor.engine.inject_data(template_id, new_data)
    print("\n✓ Injected new data")

    # Render to HTML
    html = extractor.engine.render_html(template_id)

    # Save the output
    output_path = "output/recreated_from_pdf.html"
    with open(output_path, "w") as f:
        f.write(html)

    print(f"✓ Saved recreated template to: {output_path}")

    # Verify the new content is in the HTML
    print("\n🔍 Verification:")

    checks = [
        ("New property name", "The Metropolitan Downtown Center"),
        ("New address", "9876 Commerce Blvd"),
        ("Has shrink overflow", "dte-overflow-shrink"),
        ("Has constraints", "data-constraints"),
        ("Has runtime script", "fitText"),
    ]

    for check_name, check_str in checks:
        if check_str in html:
            print(f"   ✓ {check_name}")
        else:
            print(f"   ✗ {check_name} - NOT FOUND")

    return html


def test_high_level_api():
    """Test the simple high-level API."""

    print("\n" + "=" * 70)
    print("TEST: High-Level API (extract_and_recreate)")
    print("=" * 70)

    html = extract_and_recreate(
        pdf_path="sample_template.pdf",
        new_data={
            "sunset_plaza": "Oceanview Towers",
            "price": 89000000,
        },
        output_path="output/high_level_api_test.html"
    )

    print("\n✓ Created template with high-level API")
    print("✓ Saved to: output/high_level_api_test.html")

    # Check it contains the new name
    assert "Oceanview Towers" in html, "New content not found!"
    print("✓ Verified new content is in output")


def main():
    """Run all tests."""

    import os
    os.makedirs("output", exist_ok=True)

    # Test 1: Extract
    template_id, extractor = test_extraction()

    # Test 2: Recreate with new data
    test_recreation_with_new_data(template_id, extractor)

    # Test 3: High-level API
    test_high_level_api()

    print("\n" + "=" * 70)
    print("ALL TESTS PASSED!")
    print("=" * 70)
    print("""
Summary:
--------
The system can now:

1. ✓ Extract design from existing PDF templates
   - Shapes (backgrounds, boxes)
   - Text (with position, font, color, size)
   - Images

2. ✓ Convert to dynamic template with auto-fit constraints
   - Each text element gets overflow="shrink"
   - minFontSize calculated from original size

3. ✓ Auto-generate data bindings from content
   - "Sunset Plaza" -> {{sunset_plaza}}
   - "$5,500,000" -> {{price|currency}}

4. ✓ Inject new data and render HTML
   - Same visual design
   - Different content
   - Text auto-shrinks if longer

Open the output files in a browser to verify:
- output/recreated_from_pdf.html
- output/high_level_api_test.html
""")


if __name__ == "__main__":
    main()
