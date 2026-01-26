import puppeteer from 'puppeteer';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'public', 'icons');

// Ensure icons directory exists
mkdirSync(iconsDir, { recursive: true });

async function generateIcon(page, size, filename, maskable = false) {
  const cornerRadius = maskable ? 0 : Math.floor(size * 0.18);
  const safeZone = maskable ? 0.65 : 0.92;

  const babySize = Math.floor(size * safeZone * 0.52);
  const poopSize = Math.floor(size * safeZone * 0.44);
  const poopTop = Math.floor(size * 0.48);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          width: ${size}px;
          height: ${size}px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #6366f1;
          border-radius: ${cornerRadius}px;
          overflow: hidden;
          font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif;
        }
        .baby {
          font-size: ${babySize}px;
          line-height: 1;
          margin-top: -${Math.floor(size * 0.04)}px;
        }
        .poops {
          display: flex;
          gap: ${Math.floor(size * 0.01)}px;
          margin-top: -${Math.floor(size * 0.08)}px;
        }
        .poop {
          font-size: ${poopSize}px;
          line-height: 1;
        }
      </style>
    </head>
    <body>
      <div class="baby">👶</div>
      <div class="poops">
        <span class="poop">💩</span>
        <span class="poop">💩</span>
      </div>
    </body>
    </html>
  `;

  await page.setContent(html);
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });

  await page.screenshot({
    path: join(iconsDir, filename),
    type: 'png',
    omitBackground: false,
  });

  console.log(`Generated: ${filename}`);
}

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Regular icons
    await generateIcon(page, 192, 'icon-192.png', false);
    await generateIcon(page, 512, 'icon-512.png', false);

    // Maskable icons
    await generateIcon(page, 192, 'icon-maskable-192.png', true);
    await generateIcon(page, 512, 'icon-maskable-512.png', true);

    // Favicon and apple touch icon
    await generateIcon(page, 32, 'favicon-32.png', false);
    await generateIcon(page, 180, 'apple-touch-icon.png', false);

    console.log('\nAll icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
