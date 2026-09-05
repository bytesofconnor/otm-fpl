#!/usr/bin/env tsx
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const PUBLIC_DIR = join(process.cwd(), 'public');
const SOURCE_SVG = join(PUBLIC_DIR, 'otm-ball.svg');

async function generateIcon(size: number, output: string, addPadding = false) {
  console.log(`Generating ${output} (${size}x${size})...`);
  
  const svgBuffer = readFileSync(SOURCE_SVG);
  
  let pipeline = sharp(svgBuffer)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 10, g: 18, b: 14, alpha: 1 }, // #0a120e
    });

  if (addPadding) {
    // For maskable icons, add 10% padding on each side (safe zone)
    const innerSize = Math.floor(size * 0.8);
    const padding = Math.floor((size - innerSize) / 2);
    
    pipeline = sharp(svgBuffer)
      .resize(innerSize, innerSize, {
        fit: 'contain',
        background: { r: 10, g: 18, b: 14, alpha: 1 },
      })
      .extend({
        top: padding,
        bottom: padding,
        left: padding,
        right: padding,
        background: { r: 10, g: 18, b: 14, alpha: 1 },
      });
  }

  await pipeline.png().toFile(join(PUBLIC_DIR, output));
  console.log(`✓ ${output} created`);
}

async function main() {
  console.log('🎨 Generating PWA icons from otm-ball.svg...\n');

  // Apple touch icon
  await generateIcon(180, 'apple-touch-icon.png');

  // Standard PWA icons
  await generateIcon(192, 'icon-192.png');
  await generateIcon(512, 'icon-512.png');

  // Maskable icons (with padding for safe zone)
  await generateIcon(192, 'icon-192-maskable.png', true);
  await generateIcon(512, 'icon-512-maskable.png', true);

  // Favicon variations
  await generateIcon(32, 'favicon-32x32.png');
  await generateIcon(16, 'favicon-16x16.png');

  console.log('\n✨ All icons generated successfully!');
}

main().catch((error) => {
  console.error('Error generating icons:', error);
  process.exit(1);
});
