import pw from 'file:///C:/Users/danna.zhang/.workbuddy-ai/binaries/node/workspace/node_modules/playwright/index.js'
const { chromium } = pw

const out = process.argv[2] || 'design-preview/food-hud.png'
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 420, height: 760 } })
page.on('pageerror', (e) => console.error('[pageerror]', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.error('[console]', m.text()) })

await page.goto(`http://localhost:8080/local-preview/index.html?t=${Date.now()}`, { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)

// 点主按钮（第 N 关）：设计稿坐标 → client 坐标
await page.evaluate(() => {
  const canvas = document.querySelector('canvas')
  const rect = canvas.getBoundingClientRect()
  const toClient = (dx, dy) => ({
    x: rect.left + dx * rect.width / canvas.width,
    y: rect.top + dy * rect.height / canvas.height
  })
  const p = toClient(187.5, 423)
  const t = new Touch({ identifier: 1, target: canvas, clientX: p.x, clientY: p.y })
  canvas.dispatchEvent(new TouchEvent('touchstart', { touches: [t], targetTouches: [t], changedTouches: [t], bubbles: true, cancelable: true }))
  canvas.dispatchEvent(new TouchEvent('touchend', { touches: [], targetTouches: [], changedTouches: [t], bubbles: true, cancelable: true }))
})
await page.waitForTimeout(1800)
await page.locator('canvas').screenshot({ path: out })
console.log('saved', out)
await browser.close()
