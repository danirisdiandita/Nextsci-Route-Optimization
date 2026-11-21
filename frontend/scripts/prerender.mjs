// Prerenders every page in src/pages.ts into dist/<path>/index.html so crawlers get the full page without running JavaScript.
// Runs after `vite build` and `vite build --ssr src/entry-server.tsx --outDir dist-ssr` (see `npm run build`).
// Set SITE_URL, such as https://nextsci.example, to add the canonical URL and write sitemap.xml.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const { render, pages } = await import(pathToFileURL('dist-ssr/entry-server.js').href)
const site = process.env.SITE_URL?.replace(/\/+$/, '')

const html = await readFile('dist/index.html', 'utf8')
if (!html.includes('<!--app-html-->') || !html.includes('<!--seo-url-->')) {
  throw new Error('index.html lost its <!--app-html--> or <!--seo-url--> placeholder')
}
const titleTag = /<title>[^<]*<\/title>/
const ogTitle = /<meta property="og:title" content="[^"]*" \/>/
if (!titleTag.test(html) || !ogTitle.test(html)) throw new Error('index.html lost its <title> or og:title tag')

for (const page of pages) {
  const seo = site
    ? `<link rel="canonical" href="${site}${page.path}" />\n    <meta property="og:url" content="${site}${page.path}" />`
    : ''
  const out = html
    .replace(titleTag, `<title>${page.title}</title>`)
    .replace(ogTitle, `<meta property="og:title" content="${page.title}" />`)
    .replace('<!--app-html-->', render(page.id))
    .replace('<!--seo-url-->', seo)
  await mkdir(`dist${page.path}`, { recursive: true })
  await writeFile(`dist${page.path}index.html`, out)
}

await writeFile('dist/robots.txt', `User-agent: *\nAllow: /\n${site ? `Sitemap: ${site}/sitemap.xml\n` : ''}`)
if (site) {
  await writeFile(
    'dist/sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `  <url><loc>${site}${p.path}</loc></url>\n`).join('')}</urlset>\n`,
  )
}
await rm('dist-ssr', { recursive: true, force: true })
console.log(`prerendered ${pages.map((p) => p.path).join(' ')}${site ? ` for ${site}` : ' (no SITE_URL: skipped canonical URL and sitemap)'}`)
