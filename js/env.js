/**
 * 运行环境引导（必须是 game.js 的第一个 import）
 *
 * 职责
 * ────
 * 1. 创建上屏画布。微信小游戏没有 DOM，也**没有预置的全局 canvas**；
 *    上屏画布必须由 `wx.createCanvas()` 创建，且整个生命周期里「第一次调用」
 *    返回的才是显示在屏幕上的那张，之后调用得到的都是离屏画布。
 *    js/ui/* 与 js/runtime/* 里到处直接读 `canvas.width` / `canvas.height`，
 *    所以这里建好后要挂回全局对象。
 *
 * 2. 按设备像素比放大画布。小游戏上屏画布默认按**逻辑像素**分配后备缓冲区，
 *    在 pixelRatio = 3 的手机上等于用 1/3 分辨率渲染再拉伸到全屏 —— 这正是
 *    「画面发虚、文字边缘发毛」的根因。这里把后备缓冲区放大到
 *    逻辑尺寸 × dpr，渲染时统一 `ctx.scale(dpr)`，逻辑坐标完全不变。
 *
 * 为什么 H5 不能走 wx.createCanvas()
 * ─────────────────────────────────
 * 本地预览 / H5 包里的 wechat-adapter 已经把页面上那个 <canvas> 挂到了
 * `window.canvas`，它的 `wx.createCanvas()` 返回的是新建的**离屏**画布。
 * 如果这里再调一次，游戏就会画到一张不显示的画布上 —— 黑屏。
 * 所以先复用已有画布，只有在完全没有的时候才创建。
 */

/** 像素比上限：4x 屏上再往上加只会吃显存，视觉收益很小 */
const MAX_DPR = 3

/**
 * 收集所有可能的全局对象
 *
 * 小游戏是 GameGlobal；浏览器是 window（=== globalThis）；
 * 回归测试的 vm 沙箱里 globalThis 就是上下文对象。
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

/**
 * 读取窗口逻辑尺寸与像素比
 *
 * 小游戏的 getWindowInfo / getSystemInfoSync 一定带 pixelRatio；
 * H5 适配层返回的是固定 375×667 且不带 pixelRatio，因此 dpr 落回 1，
 * 预览画布尺寸保持不变。
 */
function getWindowMetrics() {
  if (typeof wx !== 'undefined') {
    try {
      let info = null
      if (typeof wx.getWindowInfo === 'function') info = wx.getWindowInfo()
      if ((!info || !info.windowWidth) && typeof wx.getSystemInfoSync === 'function') {
        info = wx.getSystemInfoSync()
      }
      if (info && info.windowWidth > 0 && info.windowHeight > 0) {
        const rawDpr = Number(info.pixelRatio)
        const dpr = rawDpr > 0 ? Math.min(rawDpr, MAX_DPR) : 1
        return {
          width: info.windowWidth,
          height: info.windowHeight,
          dpr
        }
      }
    } catch (e) {
      console.warn('[Env] 读取窗口信息失败:', e)
    }
  }

  if (typeof window !== 'undefined' && window.innerWidth > 0) {
    const rawDpr = Number(window.devicePixelRatio)
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: rawDpr > 0 ? Math.min(rawDpr, MAX_DPR) : 1
    }
  }

  return null
}

const globalObjects = collectGlobalObjects()

// ---- 1) 先找现成的上屏画布：H5 预览 / 已由适配层创建过的情况 ----
let screenCanvas = null
for (let i = 0; i < globalObjects.length; i++) {
  if (isCanvasLike(globalObjects[i].canvas)) {
    screenCanvas = globalObjects[i].canvas
    break
  }
}

// ---- 2) 微信小游戏：没有全局 canvas，由我们创建上屏画布 ----
// 注意这必须是整个生命周期里第一次调用 wx.createCanvas()，
// 否则拿到的会是离屏画布，画面就永远上不了屏。
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

// ---- 3) 按设备像素比放大后备缓冲区 ----
const metrics = getWindowMetrics()
const DPR = metrics ? metrics.dpr : 1

if (screenCanvas && metrics) {
  const pixelWidth = Math.round(metrics.width * DPR)
  const pixelHeight = Math.round(metrics.height * DPR)

  // 只有尺寸不对时才赋值：给 canvas.width 赋值会清空画布并重置上下文状态
  if (screenCanvas.width !== pixelWidth || screenCanvas.height !== pixelHeight) {
    screenCanvas.width = pixelWidth
    screenCanvas.height = pixelHeight
  }
}

// ---- 4) 挂到每一个全局对象上，裸的 `canvas` 才能被 js/ui/* 读到 ----
if (screenCanvas) {
  for (let i = 0; i < globalObjects.length; i++) {
    try {
      globalObjects[i].canvas = screenCanvas
    } catch (e) {
      // 个别环境的全局对象可能不可写，忽略即可
    }
  }
}

/**
 * 逻辑视口（单位：逻辑像素）
 *
 * 所有布局计算都应该用这个尺寸，而不是直接读 `canvas.width` ——
 * 后者是**物理像素**，在 3x 屏上会是逻辑尺寸的 3 倍。
 *
 * 返回值与改造前的 `canvas.width / canvas.height` 完全一致，
 * 因此布局行为不变，只是画得更清楚了。
 */
export function viewport() {
  if (!screenCanvas) return { width: 0, height: 0, dpr: DPR }

  const dpr = DPR > 0 ? DPR : 1
  return {
    width: screenCanvas.width / dpr,
    height: screenCanvas.height / dpr,
    dpr
  }
}

export { DPR }
export default screenCanvas
