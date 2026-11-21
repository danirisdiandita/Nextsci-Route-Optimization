// Prerenders the landing page into dist/index.html so crawlers get the full page without running JavaScript.
// Runs after `vite build` and `vite build --ssr src/entry-server.tsx --outDir dist-ssr` (see `npm run build`).
// Set SITE_URL, such as https://nextsci.example, to add the canonical URL and write sitemap.xml.
import { readFile, rm, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const { render } = await import(pathToFileURL('dist-ssr/entry-server.js').href)
const site = process.env.SITE_URL?.replace(/\/+$/, '')

const html = await readFile('dist/index.html', 'utf8')
if (!html.includes('<!--app-html-->') || !html.includes('<!--seo-url-->')) {
  throw new Error('index.html lost its <!--app-html--> or <!--seo-url--> placeholder')
}
const seo = site ? `<link rel="canonical" href="${site}/" />\n    <meta property="og:url" content="${site}/" />` : ''
await writeFile('dist/index.html', html.replace('<!--app-html-->', render()).replace('<!--seo-url-->', seo))

await writeFile('dist/robots.txt', `User-agent: *\nAllow: /\n${site ? `Sitemap: ${site}/sitemap.xml\n` : ''}`)
if (site) {
  await writeFile(
    'dist/sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${site}/</loc></url>\n</urlset>\n`,
  )
}
await rm('dist-ssr', { recursive: true, force: true })
console.log(`prerendered dist/index.html${site ? ` for ${site}` : ' (no SITE_URL: skipped canonical URL and sitemap)'}`)
