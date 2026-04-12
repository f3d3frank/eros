import puppeteer from 'puppeteer';
import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('.', import.meta.url));
const OUT = join(DIR, 'temporary screenshots');

const url   = process.argv[2] ?? 'http://localhost:3000';
const label = process.argv[3] ?? '';

await mkdir(OUT, { recursive: true });

// Auto-incrementar número de screenshot
const existing = await readdir(OUT).then(files =>
  files
    .filter(f => f.startsWith('screenshot-') && f.endsWith('.png'))
    .map(f => parseInt(f.match(/screenshot-(\d+)/)?.[1] ?? '0', 10))
    .filter(n => !isNaN(n))
).catch(() => []);

const next = existing.length ? Math.max(...existing) + 1 : 1;
const filename = label
  ? `screenshot-${next}-${label}.png`
  : `screenshot-${next}.png`;

const outPath = join(OUT, filename);

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 });

// Esperar a que el video cargue (evitar frame negro)
await page.evaluate(() =>
  new Promise(resolve => {
    const v = document.querySelector('video');
    if (!v) return resolve();
    if (v.readyState >= 2) return resolve();
    v.addEventListener('loadeddata', resolve, { once: true });
    setTimeout(resolve, 3000);
  })
);

// Scroll gradual para activar todos los IntersectionObserver (AOS)
await page.evaluate(async () => {
  const totalHeight = document.body.scrollHeight;
  const step = 350;
  for (let y = 0; y < totalHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise(r => setTimeout(r, 80));
  }
  window.scrollTo(0, 0);
  await new Promise(r => setTimeout(r, 300));
});

// Forzar todos los elementos AOS a visible por si el Observer no llegó a tiempo
await page.evaluate(() =>
  new Promise(resolve => {
    document.querySelectorAll('.aos').forEach(el => el.classList.add('visible'));
    setTimeout(resolve, 900);
  })
);

await page.screenshot({ path: outPath, fullPage: true });
await browser.close();

console.log(`✓ Screenshot saved: ${outPath}`);
