// CI smoke test: serve the production build, open /space in headless Chromium (SwiftShader WebGL),
// wait for the building to load, switch levels/views, and fail on page errors, failed requests,
// or an empty render. Results are emitted as GitHub annotations.
// usage: node scripts/smoke.mjs http://127.0.0.1:4173
import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://127.0.0.1:4173'
const notice = (title, msg) => console.log(`::notice title=${title}::${msg}`)
const fail = (msg) => {
  console.log(`::error title=smoke::${msg}`)
  process.exitCode = 1
}

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
const problems = []
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console: ${m.text().slice(0, 300)}`)
})
page.on('response', (r) => {
  if (r.status() >= 400) problems.push(`http ${r.status()} ${r.url()}`)
})

const stats = () => page.evaluate(() => window.__428 ?? null)
const statusText = () =>
  page.evaluate(() => {
    const el = [...document.querySelectorAll('div')].find((d) => /Scan model v33|Loading building|failed to load/.test(d.textContent ?? '') && d.children.length <= 2)
    return el?.textContent ?? ''
  })
async function settle(label) {
  await page.waitForTimeout(2500)
  const s = await stats()
  const t = await statusText()
  notice(label, `${t} | drawn ${s?.triangles ?? 0} tris, ${s?.calls ?? 0} calls, ${s?.textures ?? 0} textures, frame ${s?.frames ?? 0}`)
  return s
}

const t0 = Date.now()
await page.goto(`${BASE}/space?debug`)
try {
  await page.waitForFunction(() => document.body.innerText.includes('Scan model v33'), null, { timeout: 180000 })
} catch {
  fail(`building did not finish loading: "${await statusText()}"`)
}
notice('load', `ground layers ready in ${((Date.now() - t0) / 1000).toFixed(1)} s (SwiftShader, local server)`)

const ground = await settle('ground-overview')
if (!ground || ground.triangles < 100000) fail(`ground view drew too little: ${JSON.stringify(ground)}`)

const click = async (name) => page.getByRole('button', { name, exact: true }).click()
await click('Plan')
await settle('ground-plan')
await click('Upper')
await page.waitForFunction(() => document.body.innerText.includes('Scan model v33'), null, { timeout: 120000 }).catch(() => undefined)
const upper = await settle('upper-plan')
if (!upper || upper.triangles <= (ground?.triangles ?? 0)) fail(`upper level did not add geometry: ${JSON.stringify(upper)}`)
await click('Hall')
await settle('hall-all')
await click('Mezzanine')
await settle('mezzanine-all')

const unique = [...new Set(problems)]
if (unique.length) fail(`${unique.length} page problem(s): ${unique.slice(0, 5).join(' || ')}`)
else notice('errors', 'no page errors, console errors or failed requests')
await browser.close()
