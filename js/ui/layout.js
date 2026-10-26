/**
 * 界面布局：设计稿坐标系 + 等比缩放（C1）
 *
 * 背景：此前所有 UI 场景都把坐标按 375×667 写死，导致
 *   - 320×568（iPhone SE）上按钮/说明文字出屏
 *   - 390×844、412×915 上整体偏左偏上
 *   - iPad 上大面积留白
 *
 * 方案：UI 场景一律按 375×667 的设计稿坐标书写，
 * 渲染时统一做"等比缩放 + 居中"，触摸坐标做反向映射。
 * 这样一套坐标就能适配所有屏幕，且不会拉伸变形。
 *
 * 用法：
 *   render(ctx) {
 *     drawOverlay(ctx, 0.6)          // 遮罩用真实像素铺满
 *     const s = stage()
 *     ctx.save()
 *     s.apply(ctx)                   // 之后全部用设计稿坐标
 *     ...
 *     ctx.restore()
 *   }
 *
 *   onTouchStart(touch) {
 *     const t = stage().unproject(touch)
 *     ...
 *   }
 */

import { viewport } from '../env'

export const DESIGN_WIDTH = 375
export const DESIGN_HEIGHT = 667
/** 设计稿水平中心线 */
export const CENTER_X = DESIGN_WIDTH / 2

/** 设计稿纵向参考线 */
export const DESIGN = {
  width: DESIGN_WIDTH,
  height: DESIGN_HEIGHT,
  centerX: CENTER_X,
  centerY: DESIGN_HEIGHT / 2
}

/**
 * 当前舞台参数
 * @returns {{scale:number, offsetX:number, offsetY:number, apply:Function, unproject:Function, project:Function}}
 */
export function stage() {
  const { width, height } = viewport()
  const scale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT)
  const offsetX = (width - DESIGN_WIDTH * scale) / 2
  const offsetY = (height - DESIGN_HEIGHT * scale) / 2

  return {
    scale,
    offsetX,
    offsetY,

    /** 把绘图上下文切到设计稿坐标系 */
    apply(ctx) {
      ctx.translate(offsetX, offsetY)
      ctx.scale(scale, scale)
    },

    /** 屏幕坐标 → 设计稿坐标 */
    unproject(touch) {
      if (!touch) return touch
      return {
        ...touch,
        clientX: (touch.clientX - offsetX) / scale,
        clientY: (touch.clientY - offsetY) / scale
      }
    },

    /** 设计稿坐标 → 屏幕坐标 */
    project(x, y) {
      return { x: x * scale + offsetX, y: y * scale + offsetY }
    }
  }
}
