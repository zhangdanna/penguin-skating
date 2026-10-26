/**
 * 环境引导验证：模拟不同运行环境，确认 js/env.js 的行为
 *
 *   场景 A：微信小游戏，无全局 canvas，dpr=3
 *   场景 B：微信小游戏，已有全局 canvas（极少见）
 *   场景 C：H5 预览，window.canvas 已存在、适配层不返回 pixelRatio
 *   场景 D：GameGlobal 作为全局对象名
 *
 * 关注两点：
 *   1. 上屏画布到底有没有被创建 / 是否复用了正确的那一张
 *   2. 后备缓冲区是否按 dpr 放大，而 viewport() 仍返回逻辑尺寸
 */
import vm from 'node:vm'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve('.')
const raw = fs.readFileSync(path.join(ROOT, 'js/env.js'), 'utf8')

// 把 ESM 语法改写成可在 vm 里直接执行的脚本
const source = raw
  .replace(/export function viewport\s*\(/g, 'function viewport(')
  .replace(/export \{ DPR \}\s*/g, '')
  .replace(/export default screenCanvas\s*$/, '__result = screenCanvas')

function makeCanvas(tag, width = 375, height = 667) {
  return { tag, width, height, getContext: () => ({ tag }) }
}

let failures = 0

function run(name, sandbox, expect) {
  const ctx = vm.createContext(sandbox)
  ctx.globalThis = ctx

  let out
  try {
    vm.runInContext(`let __result = null;\n${source}\n`, ctx)
    out = vm.runInContext('__result', ctx)
  } catch (e) {
    console.log(`❌ ${name}: 抛异常 → ${e.message}`)
    failures++
    return
  }

  const gotCanvasTag = out && out.tag
  const gotBacking = out ? `${out.width}x${out.height}` : 'null'
  const vp = vm.runInContext('viewport()', ctx)

  const ok =
    gotCanvasTag === expect.canvasTag &&
    gotBacking === expect.backing &&
    vp.width === expect.logicalWidth &&
    vp.height === expect.logicalHeight

  console.log(`${ok ? '✅' : '❌'} ${name}`)
  console.log(
    `   画布=${gotCanvasTag} 后备缓冲=${gotBacking} ` +
    `viewport=${vp.width}x${vp.height}@${vp.dpr}x ` +
    `（期望 ${expect.canvasTag} / ${expect.backing} / ${expect.logicalWidth}x${expect.logicalHeight}）`
  )
  if (!ok) failures++
}

// ---- A：微信小游戏，dpr = 3 ----
const miniScreen = makeCanvas('screen')
run('微信小游戏 dpr=3：创建上屏画布并按 dpr 放大后备缓冲', {
  wx: {
    createCanvas: () => miniScreen,
    getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 3 })
  }
}, {
  canvasTag: 'screen',
  backing: '1170x2532',
  logicalWidth: 390,
  logicalHeight: 844
})

// ---- B：小游戏里已经有全局 canvas（不应重复创建） ----
const preset = makeCanvas('preset')
run('微信小游戏：已有全局 canvas → 复用它', {
  canvas: preset,
  wx: {
    createCanvas: () => { throw new Error('不该再调 createCanvas') },
    getWindowInfo: () => ({ windowWidth: 375, windowHeight: 667, pixelRatio: 2 })
  }
}, {
  canvasTag: 'preset',
  backing: '750x1334',
  logicalWidth: 375,
  logicalHeight: 667
})

// ---- C：H5 预览，适配层不返回 pixelRatio ----
const h5Screen = makeCanvas('h5-screen')
run('H5 预览：复用 window.canvas，dpr 落回 1，不改尺寸', {
  window: { canvas: h5Screen },
  wx: {
    createCanvas: () => makeCanvas('h5-offscreen'),
    getSystemInfoSync: () => ({ windowWidth: 375, windowHeight: 667 })
  }
}, {
  canvasTag: 'h5-screen',
  backing: '375x667',
  logicalWidth: 375,
  logicalHeight: 667
})

// ---- D：GameGlobal 作为全局对象名 ----
const ggScreen = makeCanvas('gg-screen')
run('GameGlobal 环境：画布挂到 GameGlobal.canvas 上', {
  GameGlobal: {},
  wx: {
    createCanvas: () => ggScreen,
    getWindowInfo: () => ({ windowWidth: 360, windowHeight: 780, pixelRatio: 3 })
  }
}, {
  canvasTag: 'gg-screen',
  backing: '1080x2340',
  logicalWidth: 360,
  logicalHeight: 780
})

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`)
process.exit(failures === 0 ? 0 : 1)
