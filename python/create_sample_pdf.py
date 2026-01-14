"""
Create a sample PDF template for testing the extractor.
"""

import fitz  # PyMuPDF

def create_sample_template():
    """Create a sample CRE offering memorandum template."""

    # Create a new PDF document
    doc = fitz.open()

    # Add a page (US Letter size: 612 x 792 points)
    page = doc.new_page(width=612, height=792)

    # 1. Add header background (dark blue rectangle)
    header_rect = fitz.Rect(0, 0, 612, 100)
    page.draw_rect(header_rect, color=None, fill=(0.1, 0.2, 0.36))  # Dark blue

    # 2. Add property name (white text on blue)
    page.insert_text(
        (36, 45),
        "Sunset Plaza",
        fontsize=32,
        fontname="helv",
        color=(1, 1, 1),  # White
    )

    # 3. Add address (light gray text)
    page.insert_text(
        (36, 75),
        "123 Main Street, Austin, TX 78701",
        fontsize=14,
        fontname="helv",
        color=(0.8, 0.85, 0.9),  # Light blue-gray
    )

    # 4. Add a metrics section with boxes
    # Price box
    price_box = fitz.Rect(36, 130, 200, 200)
    page.draw_rect(price_box, color=None, fill=(0.17, 0.21, 0.28))  # Dark gray
    page.insert_text((50, 155), "ASKING PRICE", fontsize=10, color=(0.6, 0.68, 0.76))
    page.insert_text((50, 185), "$5,500,000", fontsize=24, fontname="helv", color=(0.28, 0.73, 0.47))  # Green

    # Size box
    size_box = fitz.Rect(220, 130, 384, 200)
    page.draw_rect(size_box, color=None, fill=(0.17, 0.21, 0.28))
    page.insert_text((234, 155), "BUILDING SIZE", fontsize=10, color=(0.6, 0.68, 0.76))
    page.insert_text((234, 185), "45,000 SF", fontsize=24, fontname="helv", color=(1, 1, 1))

    # Cap rate box
    cap_box = fitz.Rect(404, 130, 576, 200)
    page.draw_rect(cap_box, color=None, fill=(0.17, 0.21, 0.28))
    page.insert_text((418, 155), "CAP RATE", fontsize=10, color=(0.6, 0.68, 0.76))
    page.insert_text((418, 185), "6.5%", fontsize=24, fontname="helv", color=(0.26, 0.6, 0.88))  # Blue

    # 5. Add Investment Highlights section
    page.insert_text((36, 250), "Investment Highlights", fontsize=20, fontname="helv", color=(0.1, 0.2, 0.36))

    highlights = [
        "• Prime retail location with excellent visibility",
        "• Strong tenant mix including national credit tenants",
        "• Below-market rents with significant upside potential",
        "• Recent capital improvements totaling $1.2M",
    ]

    y = 285
    for line in highlights:
        page.insert_text((36, y), line, fontsize=12, color=(0.29, 0.33, 0.42))
        y += 22

    # 6. Add footer
    footer_rect = fitz.Rect(0, 740, 612, 792)
    page.draw_rect(footer_rect, color=None, fill=(0.97, 0.98, 0.99))  # Light gray

    page.insert_text((36, 765), "John Smith | (512) 555-1234 | Austin Commercial Realty", fontsize=11, color=(0.44, 0.5, 0.59))

    # Save the PDF
    output_path = "sample_template.pdf"
    doc.save(output_path)
    doc.close()

    print(f"Created sample template: {output_path}")
    return output_path


if __name__ == "__main__":
    create_sample_template()
