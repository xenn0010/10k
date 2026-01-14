/**
 * Demo: Dynamic Template Engine
 *
 * This demo shows how the engine handles text overflow gracefully.
 * The same template works with short or long content - text automatically
 * scales to fit within its container.
 */

import { DynamicTemplateEngine, Template } from '../src/index.js';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('🚀 Dynamic Template Engine Demo\n');

  const engine = new DynamicTemplateEngine();

  // Create a sample CRE (Commercial Real Estate) Offering Memorandum template
  const template = engine.createTemplate({
    name: 'Property Offering Memorandum',
    pages: [
      engine.createPage({
        size: { width: 612, height: 792, unit: 'pt' }, // US Letter
        background: '#ffffff',
        elements: [
          // Header bar
          engine.createShapeElement({
            x: 0,
            y: 0,
            width: 612,
            height: 80,
            shapeType: 'rectangle',
            style: { fill: '#1a365d', stroke: 'none' },
          }),

          // Property Name - DYNAMIC (handles long names!)
          engine.createTextElement({
            x: 36,
            y: 20,
            width: 400,
            height: 40,
            content: 'Property Name',
            binding: '{{property.name}}',
            style: {
              fontFamily: 'Arial',
              fontSize: 28,
              fontWeight: 700,
              color: '#ffffff',
            },
            constraints: {
              minFontSize: 14,
              maxFontSize: 28,
              overflow: 'shrink', // KEY: Auto-shrink if text is too long
            },
          }),

          // Address - DYNAMIC
          engine.createTextElement({
            x: 36,
            y: 50,
            width: 400,
            height: 24,
            content: 'Address',
            binding: '{{property.address}}',
            style: {
              fontFamily: 'Arial',
              fontSize: 14,
              fontWeight: 400,
              color: '#e2e8f0',
            },
            constraints: {
              minFontSize: 10,
              maxFontSize: 14,
              overflow: 'shrink',
            },
          }),

          // Hero Image
          engine.createImageElement({
            x: 36,
            y: 100,
            width: 540,
            height: 280,
            src: 'placeholder.jpg',
            binding: '{{property.heroImage}}',
            objectFit: 'cover',
          }),

          // Price box with background
          engine.createShapeElement({
            x: 36,
            y: 400,
            width: 180,
            height: 70,
            shapeType: 'rectangle',
            style: {
              fill: '#2d3748',
              borderRadius: 8,
            },
          }),

          // Price label
          engine.createTextElement({
            x: 50,
            y: 410,
            width: 150,
            height: 20,
            content: 'ASKING PRICE',
            style: {
              fontFamily: 'Arial',
              fontSize: 11,
              fontWeight: 600,
              color: '#a0aec0',
            },
          }),

          // Price value - DYNAMIC
          engine.createTextElement({
            x: 50,
            y: 430,
            width: 150,
            height: 30,
            content: '$0',
            binding: '{{property.price|currency}}',
            style: {
              fontFamily: 'Arial',
              fontSize: 24,
              fontWeight: 700,
              color: '#48bb78',
            },
            constraints: {
              minFontSize: 16,
              maxFontSize: 24,
              overflow: 'shrink',
            },
          }),

          // Square Footage box
          engine.createShapeElement({
            x: 230,
            y: 400,
            width: 180,
            height: 70,
            shapeType: 'rectangle',
            style: {
              fill: '#2d3748',
              borderRadius: 8,
            },
          }),

          // SF label
          engine.createTextElement({
            x: 244,
            y: 410,
            width: 150,
            height: 20,
            content: 'BUILDING SIZE',
            style: {
              fontFamily: 'Arial',
              fontSize: 11,
              fontWeight: 600,
              color: '#a0aec0',
            },
          }),

          // SF value - DYNAMIC
          engine.createTextElement({
            x: 244,
            y: 430,
            width: 150,
            height: 30,
            content: '0 SF',
            binding: '{{property.sqft|sqft}}',
            style: {
              fontFamily: 'Arial',
              fontSize: 24,
              fontWeight: 700,
              color: '#ffffff',
            },
            constraints: {
              minFontSize: 16,
              maxFontSize: 24,
              overflow: 'shrink',
            },
          }),

          // Cap Rate box
          engine.createShapeElement({
            x: 424,
            y: 400,
            width: 152,
            height: 70,
            shapeType: 'rectangle',
            style: {
              fill: '#2d3748',
              borderRadius: 8,
            },
          }),

          // Cap Rate label
          engine.createTextElement({
            x: 438,
            y: 410,
            width: 120,
            height: 20,
            content: 'CAP RATE',
            style: {
              fontFamily: 'Arial',
              fontSize: 11,
              fontWeight: 600,
              color: '#a0aec0',
            },
          }),

          // Cap Rate value - DYNAMIC
          engine.createTextElement({
            x: 438,
            y: 430,
            width: 120,
            height: 30,
            content: '0%',
            binding: '{{property.capRate|percent}}',
            style: {
              fontFamily: 'Arial',
              fontSize: 24,
              fontWeight: 700,
              color: '#4299e1',
            },
            constraints: {
              minFontSize: 16,
              maxFontSize: 24,
              overflow: 'shrink',
            },
          }),

          // Investment Highlights section
          engine.createTextElement({
            x: 36,
            y: 500,
            width: 300,
            height: 28,
            content: 'Investment Highlights',
            style: {
              fontFamily: 'Arial',
              fontSize: 20,
              fontWeight: 700,
              color: '#1a365d',
            },
          }),

          // Highlights content - DYNAMIC (handles long descriptions!)
          engine.createTextElement({
            x: 36,
            y: 535,
            width: 540,
            height: 180,
            content: 'Property highlights will appear here...',
            binding: '{{property.highlights}}',
            style: {
              fontFamily: 'Arial',
              fontSize: 12,
              fontWeight: 400,
              color: '#4a5568',
              lineHeight: 1.6,
            },
            constraints: {
              minFontSize: 9,
              maxFontSize: 12,
              overflow: 'shrink', // Will shrink font to fit all content
              textAlign: 'left',
              verticalAlign: 'top',
            },
          }),

          // Footer
          engine.createShapeElement({
            x: 0,
            y: 740,
            width: 612,
            height: 52,
            shapeType: 'rectangle',
            style: { fill: '#f7fafc' },
          }),

          // Broker info - DYNAMIC
          engine.createTextElement({
            x: 36,
            y: 755,
            width: 300,
            height: 24,
            content: 'Contact Broker',
            binding: '{{broker.name}} | {{broker.phone}}',
            style: {
              fontFamily: 'Arial',
              fontSize: 11,
              fontWeight: 500,
              color: '#718096',
            },
            constraints: {
              overflow: 'ellipsis',
            },
          }),

          // Company - DYNAMIC
          engine.createTextElement({
            x: 400,
            y: 755,
            width: 176,
            height: 24,
            content: 'Company',
            binding: '{{broker.company}}',
            style: {
              fontFamily: 'Arial',
              fontSize: 11,
              fontWeight: 500,
              color: '#718096',
              textAlign: 'right',
            },
            constraints: {
              textAlign: 'right',
              overflow: 'ellipsis',
            },
          }),
        ],
      }),
    ],
  });

  // Test with SHORT content
  const shortData = {
    property: {
      name: 'Sunset Plaza',
      address: '123 Main St, Austin, TX',
      heroImage: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800',
      price: 5500000,
      sqft: 45000,
      capRate: 0.065,
      highlights: 'Prime location with excellent visibility. Recently renovated.',
    },
    broker: {
      name: 'John Smith',
      phone: '(512) 555-1234',
      company: 'Austin CRE',
    },
  };

  // Test with LONG content (this would break static templates!)
  const longData = {
    property: {
      name: 'The Metropolitan Downtown Mixed-Use Development Center',
      address: '12345 West Commerce Boulevard, Suite 100-200, San Francisco, CA 94102',
      heroImage: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800',
      price: 125750000,
      sqft: 450000,
      capRate: 0.0525,
      highlights: `This exceptional Class A mixed-use development represents a rare opportunity to acquire a trophy asset in one of the nation's most dynamic markets. The property features 450,000 square feet of premium office and retail space across 25 floors, with floor-to-ceiling windows offering panoramic city views. Recent capital improvements totaling $15M include a complete lobby renovation, new HVAC systems, and upgraded common areas. The property is 95% leased to a diverse tenant roster including Fortune 500 companies, with a weighted average lease term of 7.2 years. Additional highlights include a 500-space parking structure, LEED Gold certification, and proximity to major transit hubs. The surrounding neighborhood has seen significant growth with new residential developments and amenities.`,
    },
    broker: {
      name: 'Sarah Johnson-Williams',
      phone: '(415) 555-9876',
      company: 'Pacific Coast Commercial Real Estate Partners',
    },
  };

  // Generate HTML for both versions
  console.log('📝 Generating templates...\n');

  // Short content version
  const shortTemplate = await engine.inject(template, shortData);
  const shortHtml = engine.generateHTML(shortTemplate);

  // Long content version
  const longTemplate = await engine.inject(template, longData);
  const longHtml = engine.generateHTML(longTemplate);

  // Save outputs
  const outputDir = path.join(process.cwd(), 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(path.join(outputDir, 'short-content.html'), shortHtml);
  fs.writeFileSync(path.join(outputDir, 'long-content.html'), longHtml);

  console.log('✅ Generated HTML files:');
  console.log('   - output/short-content.html (normal content)');
  console.log('   - output/long-content.html (long content - auto-fitted!)\n');

  console.log('🎯 KEY INNOVATION:');
  console.log('   The same template handles both short and long content.');
  console.log('   Text automatically shrinks to fit within containers.');
  console.log('   No overflow, no broken layouts!\n');

  // Show the template JSON structure
  fs.writeFileSync(
    path.join(outputDir, 'template.json'),
    JSON.stringify(template, null, 2)
  );
  console.log('📋 Template structure saved to: output/template.json\n');

  await engine.dispose();
  console.log('✨ Demo complete!\n');
}

main().catch(console.error);
