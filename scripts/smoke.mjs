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
  page.evaluate(() => document.querySelector('[data-testid="model-status"]')?.textContent ?? '(no status element)')
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

// --- Day 2: object interactions (add, nudge, rotate, duplicate, drag, lock, delete) ---------
const sel = () =>
  page.evaluate(() => {
    const st = window.__428?.scene?.getState()
    if (!st) return null
    const o = st.objects.find((x) => x.id === st.selectedId) ?? null
    return { count: st.objects.length, dragging: st.draggingId, obj: o && { id: o.id, x: o.x, y: o.y, z: o.z, rotY: o.rotY, locked: o.locked } }
  })
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol
const expect = (cond, msg) => (cond ? true : (fail(`interaction: ${msg}`), false))

const before = (await sel()) ?? { count: 0, obj: null }
expect(!before.obj, 'nothing should be selected at start')
await page.getByRole('button', { name: /^Desk 1600/ }).click()
let s = await sel()
if (expect(s?.obj, 'clicking a catalog item should add and select an object')) {
  expect(s.count === before.count + 1, `object count should grow by 1 (was ${before.count}, now ${s.count})`)
  const o0 = s.obj

  await page.keyboard.press('ArrowRight')
  s = await sel()
  expect(near(s.obj.x, o0.x + 0.1), `ArrowRight should nudge +0.1 m in X (${o0.x} → ${s.obj.x})`)
  await page.keyboard.press('Shift+ArrowUp')
  s = await sel()
  expect(near(s.obj.z, o0.z - 0.5), `Shift+ArrowUp should nudge −0.5 m in Z (${o0.z} → ${s.obj.z})`)

  await page.keyboard.press('r')
  s = await sel()
  expect(near(s.obj.rotY, Math.PI / 12), `R should rotate 15° (rotY=${s.obj.rotY})`)
  await click('90°')
  s = await sel()
  expect(near(s.obj.rotY, Math.PI / 12 + Math.PI / 2), `90° button should add a quarter turn (rotY=${s.obj.rotY})`)

  await page.keyboard.press('Control+d')
  s = await sel()
  expect(s.count === before.count + 2 && s.obj.id !== o0.id, 'Ctrl+D should duplicate and select the copy')

  // Real pointer drag in Plan view: press on the copy's box and move 120 px to the right (+X).
  const p0 = s.obj
  const pt = await page.evaluate(([x, y, z]) => window.__428.project(x, y, z), [p0.x, p0.y + 0.3, p0.z])
  await page.mouse.move(pt.x, pt.y)
  await page.mouse.down()
  await page.mouse.move(pt.x + 40, pt.y, { steps: 4 })
  const mid = await sel()
  expect(mid.dragging === p0.id, 'orbit should be paused (draggingId set) during a drag')
  await page.mouse.move(pt.x + 120, pt.y, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(200)
  s = await sel()
  expect(s.obj.id === p0.id, 'drag should keep the dragged object selected')
  expect(s.obj.x - p0.x > 1.0, `drag right should move +X by metres (${p0.x} → ${s.obj.x})`)
  expect(Math.abs(s.obj.z - p0.z) < 0.5, `drag right should not move Z much (${p0.z} → ${s.obj.z})`)
  expect(near(s.obj.x * 10, Math.round(s.obj.x * 10), 1e-6), `dragged X should land on the 0.1 m grid (${s.obj.x})`)
  expect(s.dragging === null, 'draggingId should clear after pointer up')
  notice('drag', `pointer drag moved the object ${(s.obj.x - p0.x).toFixed(2)} m in X, ${(s.obj.z - p0.z).toFixed(2)} m in Z`)

  await page.keyboard.press('l')
  s = await sel()
  expect(s.obj.locked === true, 'L should lock the object')
  const lockedX = s.obj.x
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Delete')
  s = await sel()
  expect(s.obj && near(s.obj.x, lockedX) && s.count === before.count + 2, 'locked object should ignore nudge and delete')
  await page.keyboard.press('l')
  await page.keyboard.press('Delete')
  s = await sel()
  expect(!s.obj && s.count === before.count + 1, 'Delete should remove the unlocked object and clear selection')
  await page.keyboard.press('Escape')
}
notice('interactions', 'add / nudge / rotate / duplicate / drag / lock / delete exercised')

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
