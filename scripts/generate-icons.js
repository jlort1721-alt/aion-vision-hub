#!/usr/bin/env node
/**
 * PWA Icon Generator for AION Vision Hub
 *
 * Generates PNG icons from the SVG template at all required PWA sizes.
 *
 * Prerequisites:
 *   npm install sharp (or use any PNG-capable tool)
 *
 * Usage:
 *   node scripts/generate-icons.js
 *
 * If sharp is not available, this script creates placeholder PNGs
 * using a canvas-based approach. For production, replace with
 * professionally designed icons.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ICONS_DIR = join(__dirname, '..', 'public', 'icons');

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

// SVG template for AION icon - camera/eye motif with blue accent
function generateSVG(size, maskable = false) {
  const padding = maskable ? Math.floor(size * 0.1) : 0;
  const innerSize = size - padding * 2;
  const cx = size / 2;
  const cy = size / 2;
  const r = innerSize * 0.35;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#0a0f1e" rx="${maskable ? 0 : size * 0.15}"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#3b82f6" stroke-width="${Math.max(2, size * 0.04)}"/>
  <circle cx="${cx}" cy="${cy}" r="${r * 0.4}" fill="#3b82f6"/>
  <circle cx="${cx}" cy="${cy}" r="${r * 0.15}" fill="#0a0f1e"/>
  <path d="M${cx - r * 1.2},${cy} Q${cx},${cy - r * 0.8} ${cx + r * 1.2},${cy}" fill="none" stroke="#60a5fa" stroke-width="${Math.max(1.5, size * 0.025)}" stroke-linecap="round"/>
  <path d="M${cx - r * 1.2},${cy} Q${cx},${cy + r * 0.8} ${cx + r * 1.2},${cy}" fill="none" stroke="#60a5fa" stroke-width="${Math.max(1.5, size * 0.025)}" stroke-linecap="round"/>
  <text x="${cx}" y="${cy + r + innerSize * 0.12}" text-anchor="middle" fill="#e2e8f0" font-family="system-ui, sans-serif" font-weight="700" font-size="${innerSize * 0.1}">AION</text>
</svg>`;
}

// Create icons directory
if (!existsSync(ICONS_DIR)) {
  mkdirSync(ICONS_DIR, { recursive: true });
}

// Try to use sharp for PNG conversion, fall back to SVG
async function generateIcons() {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.log('sharp not installed - generating SVG icons as fallback');
    console.log('For PNG icons, run: npm install sharp && node scripts/generate-icons.js');
    sharp = null;
  }

  for (const size of SIZES) {
    const svg = generateSVG(size, false);
    const maskableSvg = generateSVG(size, true);

    if (sharp) {
      // Generate PNG with sharp
      await sharp(Buffer.from(svg)).png().toFile(join(ICONS_DIR, `icon-${size}.png`));
      console.log(`Generated icon-${size}.png`);

      if (size === 192 || size === 512) {
        await sharp(Buffer.from(maskableSvg)).png().toFile(join(ICONS_DIR, `icon-maskable-${size}.png`));
        console.log(`Generated icon-maskable-${size}.png`);
      }
    } else {
      // Write SVG as fallback (browsers can use SVG icons)
      writeFileSync(join(ICONS_DIR, `icon-${size}.svg`), svg);
      console.log(`Generated icon-${size}.svg (SVG fallback)`);

      if (size === 192 || size === 512) {
        writeFileSync(join(ICONS_DIR, `icon-maskable-${size}.svg`), maskableSvg);
        console.log(`Generated icon-maskable-${size}.svg (SVG fallback)`);
      }
    }
  }

  console.log('\nIcon generation complete!');
  if (!sharp) {
    console.log('\nNOTE: SVG fallbacks were generated. For full PWA compliance:');
    console.log('1. Install sharp: npm install --save-dev sharp');
    console.log('2. Re-run: node scripts/generate-icons.js');
    console.log('Or replace icons manually with PNG files at the listed sizes.');
  }
}

generateIcons().catch(console.error);
