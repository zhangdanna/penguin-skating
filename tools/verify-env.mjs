/**
 * 临时验证：模拟两种运行环境，确认 js/env.js 的行为
 *   环境 A：微信小游戏 —— 没有全局 canvas，有 wx.createCanvas()
 *   环境 B：H5 预览   —— 有 window.canvas，wx.createCanvas() 会返回另一张离屏画布
 */
import vm from 'node:vm'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve('.')
const source = fs.readFileSync(path.join(ROOT, 'js/env.js'), 'utf8')
  // 去掉 ESM 语法，转成可在 vm 里 eval 的形式
  .replace(/export default screenCanvas\s*$/, '__result = screenCanvas')

function makeCanvas(tag) {
  return { tag, width: 375, height: 667, getContext: () => ({ tag }) }
}

function run(name, sandbox, expect) {
  const ctx = vm.createContext(sandbox)
  ctx.globalThis = ctx
  let out
  try {
    vm.runInContext(`let __result = null;\n${source}\n`, ctx)
    out = vm.runInContext('__result', ctx)
  } catch (e) {
    console.log(`❌ ${name}: 抛异常 → ${e.message}`)
    return
  }

  const gotTag = out && out.tag
  const globalTag = ctx.canvas && ctx.canvas.tag
  const ok = gotTag === expect.canvasTag && globalTag === expect.globalTag

  console.log(`${ok ? '✅' : '❌'} ${name}`)
  console.log(`   导出画布 = ${gotTag} / 全局 canvas = ${globalTag} / 期望 = ${expect.canvasTag} & ${expect.globalTag}`)
}

// ---- 环境 A：微信小游戏 ----
const miniScreen = makeCanvas('screen')
run('微信小游戏：没有全局 canvas → 用 wx.createCanvas() 建上屏画布', {
  wx: {
    createCanvas: () => miniScreen
  }
}, { canvasTag: 'screen', globalTag: 'screen' })

// ---- 环境 B：H5 预览 ----
const h5Screen = makeCanvas('h5-screen')
const h5Offscreen = makeCanvas('h5-offscreen')
run('H5 预览：已有 window.canvas → 复用它，不去 createCanvas', {
  window: { canvas: h5Screen },
  wx: {
    createCanvas: () => h5Offscreen
  }
}, { canvasTag: 'h5-screen', globalTag: 'h5-screen' })

// ---- 环境 C：GameGlobal（小游戏真实全局对象名） ----
const ggScreen = makeCanvas('gg-screen')
run('GameGlobal 环境：挂到 GameGlobal.canvas 上', {
  GameGlobal: {},
  wx: {
    createCanvas: () => ggScreen
  }
}, { canvasTag: 'gg-screen', globalTag: 'gg-screen' })
