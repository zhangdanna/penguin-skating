/**
 * 棋盘静态截图（冰墙 / 冰窟窿 / 目标点辨识度自查）
 *
 * 用 local-preview/wall-preview.html 渲染指定关卡，只画静态层（背景 + 目标 +
 * 障碍 + 冰块），不跑主循环 —— 用于快速回归「障碍物和冰面糊在一起」这类
 * 视觉问题，比进游戏一关关点快得多。
 *
 * 前置：另开一个终端跑 `node local-preview/server.js`
 * 运行：node tools/shot-wall.mjs [关卡号] [输出路径]
 */

import pw from 'file:///C:/Users/danna.zhang/.workbuddy-ai/binaries/node/workspace/node_modules/playwright/index.js'

const { chromium } = pw

const level = Number(process.argv[2]) || 200
const out = process.argv[3] || `design-preview/level-${level}.png`

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 420, height: 720 } })

page.on('pageerror', (e) => console.error('[pageerror]', e.message))

await page.goto(
  `http://localhost:8080/local-preview/wall-preview.html?level=${level}&t=${Date.now()}`,
  { waitUntil: 'networkidle' }
)
await page.waitForFunction(() => window.__ready === true, { timeout: 10000 })
await page.waitForTimeout(300)

const canvas = await page.$('#gameCanvas')
await canvas.screenshot({ path: out })

console.log(`✅ 已保存 ${out}（第 ${level} 关）`)

await browser.close()
