/**
 * 离屏静态层缓存（D7）
 *
 * 背景里的水体渐变、玻璃反光、沙底珊瑚、棋盘 63 块浮冰瓷砖……
 * 这些东西每帧都一样，却要重画上百次路径（还带 shadowBlur）。
 * 把它们画进一张离屏 canvas，之后每帧只 drawImage 一次。
 *
 * 布局变化（窗口 resize、换关卡）时用 key 触发重建。
 *
 * 离屏画布按**设备像素**分配（逻辑尺寸 × dpr），绘制前先把上下文缩放 dpr，
 * 否则整张背景会被放大 dpr 倍拉伸 —— 这也是画面发虚的来源之一。
 */
import { DPR } from '../env'

export default class LayerCache {  /**
   * @param {string} name - 调试用名称，会出现在日志里
   */
  constructor(name = 'layer') {
    this.name = name
    this.canvas = null
    this.ctx = null
    this.key = ''
  }

  /**
   * 懒创建离屏画布
   * @returns {boolean} 是否可用
   */
  isReady() {
    if (this.canvas && this.ctx) return true
    if (typeof wx === 'undefined' || typeof wx.createCanvas !== 'function') return false

    try {
      const offscreen = wx.createCanvas()
      if (!offscreen || typeof offscreen.getContext !== 'function') return false

      const offscreenCtx = offscreen.getContext('2d')
      if (!offscreenCtx) return false

      this.canvas = offscreen
      this.ctx = offscreenCtx
      return true
    } catch (e) {
      console.warn(`[LayerCache] ${this.name} 离屏画布创建失败，回落到逐帧绘制:`, e)
      return false
    }
  }

  /**
   * 绘制并缓存
   * @param {CanvasRenderingContext2D} ctx - 主画布上下文
   * @param {string} key - 缓存键，变化即重建
   * @param {number} width - 画布宽
   * @param {number} height - 画布高
   * @param {Function} draw - 绘制回调，接收离屏上下文
   * @returns {boolean} true = 走了缓存，false = 环境不支持，调用方需自行绘制
   */
  render(ctx, key, width, height, draw) {
    if (!this.isReady()) return false

    const dpr = DPR > 0 ? DPR : 1
    const pixelWidth = Math.max(1, Math.round(width * dpr))
    const pixelHeight = Math.max(1, Math.round(height * dpr))

    const needsRebuild =
      this.key !== key ||
      this.canvas.width !== pixelWidth ||
      this.canvas.height !== pixelHeight

    if (needsRebuild) {
      // 改尺寸会重置上下文状态，必须整层重画
      this.canvas.width = pixelWidth
      this.canvas.height = pixelHeight
      this.key = key

      // 按设备像素分配后，绘制仍用逻辑坐标
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      this.ctx.clearRect(0, 0, width, height)
      draw(this.ctx)
    }

    ctx.drawImage(this.canvas, 0, 0, width, height)
    return true
  }

  /**
   * 主动失效（例如切换关卡后棋盘布局变了）
   */
  invalidate() {
    this.key = ''
  }
}
