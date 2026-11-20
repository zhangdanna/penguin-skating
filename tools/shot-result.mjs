import pw from 'file:///C:/Users/danna.zhang/.workbuddy-ai/binaries/node/workspace/node_modules/playwright/index.js'
const { chromium } = pw

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.error('[pageerror]', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.error('[console]', m.text()) })

await page.goto(`http://localhost:8080/design-preview/result-scene-check.html?t=${Date.now()}`, { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 })

const cases = [
  { name: '3star', moves: 10, par: 10 },
  { name: '2star', moves: 13, par: 10 },
  { name: '1star', moves: 24, par: 10 }
]

for (const c of cases) {
  const info = await page.evaluate(([m, p]) => window.__renderResult(m, p), [c.moves, c.par])
  console.log(c.name, JSON.stringify(info))
  await page.locator('#c').screenshot({ path: `design-preview/result-${c.name}.png` })
}

await browser.close()
console.log('done')
