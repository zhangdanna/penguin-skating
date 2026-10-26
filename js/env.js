/**
 * 运行环境引导（必须是 game.js 的第一个 import）
 *
 * 为什么需要这个文件
 * ─────────────────
 * 微信小游戏没有 DOM，也**没有预置的全局 canvas**。上屏画布必须由
 * `wx.createCanvas()` 创建，并且整个生命周期里「第一次调用」返回的才是
 * 显示在屏幕上的那张，之后调用得到的都是离屏画布。
 *
 * 而 js/ui/* 与 js/runtime/* 里到处直接读 `canvas.width` / `canvas.height`
 * （官方示例同样如此，只是它在 game.js 里用 `canvas = wx.createCanvas()`
 * 隐式创建了全局变量）。本项目一直没有这段初始化代码，只在本地 H5 预览的
 * wechat-adapter 里补了 `window.canvas`，所以：
 *   - 浏览器 / H5 预览：正常
 *   - 微信小游戏真机：game.js 一执行就抛
 *     `ReferenceError: Can't find variable: canvas`
 *     → 首帧都渲染不出来，表现为纯黑屏、drawcall 0、审核判定"卡住无法继续游戏"
 *
 * 因此这里在入口最前面把上屏画布建好并挂到全局对象上。
 *
 * 为什么 H5 不能走 wx.createCanvas()
 * ─────────────────
 * 本地预览 / H5 包里的 wechat-adapter 已经把页面上那个 <canvas> 挂到了
 * `window.canvas`，它的 `wx.createCanvas()` 返回的是新建的**离屏**画布。
 * 如果这里再调一次，游戏就会画到一张不显示的画布上 —— 同样是黑屏。
 * 所以先复用已有画布，只有在完全没有的时候才创建。
 */

/**
 * 收集所有可能的全局对象
 *
 * 小游戏是 GameGlobal；浏览器是 window（=== globalThis）；
 * 回归测试的 vm 沙箱里 globalThis 就是上下文对象。
 * 三个都收进来，既能读到已存在的画布，也能把新画布挂到每一个上面，
 * 保证裸的 `canvas` 标识符在哪个作用域里都能解析到。
 */
function collectGlobalObjects() {
  const list = []
  const push = (obj) => {
    if (obj && typeof obj === 'object' && list.indexOf(obj) === -1) list.push(obj)
  }

  if (typeof GameGlobal !== 'undefined') push(GameGlobal)
  if (typeof globalThis !== 'undefined') push(globalThis)
  if (typeof window !== 'undefined') push(window)

  return list
}

/**
 * 判断是否像一个可用的 Canvas
 */
function isCanvasLike(value) {
  return !!value && typeof value.getContext === 'function'
}

const globalObjects = collectGlobalObjects()

// 1) 先找现成的上屏画布：H5 预览 / 已由适配层创建过的情况
let screenCanvas = null
for (let i = 0; i < globalObjects.length; i++) {
  if (isCanvasLike(globalObjects[i].canvas)) {
    screenCanvas = globalObjects[i].canvas
    break
  }
}

// 2) 微信小游戏：没有全局 canvas，由我们创建上屏画布
//    注意这必须是整个生命周期里第一次调用 wx.createCanvas()，
//    否则拿到的会是离屏画布，画面就永远上不了屏。
if (!screenCanvas && typeof wx !== 'undefined' && typeof wx.createCanvas === 'function') {
  try {
    const created = wx.createCanvas()
    if (isCanvasLike(created)) {
      screenCanvas = created
    } else {
      console.error('[Env] wx.createCanvas() 返回的对象不可用')
    }
  } catch (e) {
    console.error('[Env] 创建上屏画布失败:', e)
  }
}

// 3) 挂到每一个全局对象上，js/ui/* 与 js/runtime/* 才能直接使用裸的 `canvas`
if (screenCanvas) {
  for (let i = 0; i < globalObjects.length; i++) {
    try {
      globalObjects[i].canvas = screenCanvas
    } catch (e) {
      // 个别环境的全局对象可能不可写，忽略即可
    }
  }
}

export default screenCanvas
