import { cp, mkdir } from 'node:fs/promises';
// Serve PDF font/CMap resources from our own Pages origin, without a CDN.
const target = new URL('../public/pdfjs/', import.meta.url);
await mkdir(target, { recursive: true });
for (const directory of ['cmaps', 'standard_fonts']) {
  await cp(
    new URL(`../node_modules/pdfjs-dist/${directory}/`, import.meta.url),
    new URL(directory, target),
    { recursive: true },
  );
}
await cp(
  new URL('../node_modules/pdfjs-dist/LICENSE', import.meta.url),
  new URL('LICENSE', target),
);
