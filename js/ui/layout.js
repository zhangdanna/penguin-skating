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

// ─────────────────────────────────────────────────────────────
// 对局界面纵向布局（唯一数据源）
//
// 顶部 HUD 面板、棋盘、底部操作条这三块之间的距离是**可伸缩**的：
//   - 小屏（iPhone SE / 8）纵向没有富余，间距取最小值，优先保证棋盘塞得下
//   - 长屏（iPhone 14 / Android 大屏 / iPad）富余空间先拿去拉开间距，
//     而不是全部堆在屏幕上下边缘，避免出现"上下大片空白、中间挤成一团"
//
// 排行榜等其它场景要跟对局界面对齐顶部留白时，直接调用 computeBoardLayout()，
// 不要各自写一份数字。
// ─────────────────────────────────────────────────────────────

/** 棋盘列数 / 行数 */
export const GRID_COLS = 7
export const GRID_ROWS = 9

/** 棋盘左右最小外边距 */
export const LAYOUT_MARGIN_X = 10
/** HUD 面板距内容区顶部的内边距 */
export const HUD_TOP_PAD = 6
/** 顶部信息面板高度（食物行 + 关卡/步数/计时行） */
export const HUD_PANEL_HEIGHT = 82
/** 底部操作按钮边长（大图标卡片） */
export const HUD_BUTTON_HEIGHT = 76
/** 底部按钮距内容区底部 */
export const BOTTOM_PAD = 10

/** HUD 面板 ↔ 棋盘的间距范围 */
export const GAP_HUD_BOARD_MIN = 12
export const GAP_HUD_BOARD_MAX = 40
/** 棋盘 ↔ 底部按钮的间距范围 */
export const GAP_BOARD_BUTTONS_MIN = 16
export const GAP_BOARD_BUTTONS_MAX = 52

/** 间距最多把屏幕上下留白吃到只剩这么多 */
const EDGE_MIN = 24
/** 富余空间里分给间距的比例，剩下的继续留在上下边缘 */
const SLACK_TO_GAP_RATIO = 0.8
/** 富余空间在上下两处间距的分配比例（底部按钮更靠边，多分一点） */
const GAP_SPLIT_TOP = 0.4

const MIN_CELL_SIZE = 28
const MAX_CELL_SIZE = 72

/**
 * 计算对局界面的纵向布局
 *
 * 返回的坐标都是逻辑像素，可直接用于绘制。
 *
 * @param {{width:number, height:number}} vp - viewport() 的结果
 * @returns {{
 *   cellSize:number, boardWidth:number, boardHeight:number,
 *   boardOffsetX:number, boardOffsetY:number,
 *   contentTopY:number, hudPanelY:number, actionBarY:number,
 *   gapHudBoard:number, gapBoardButtons:number
 * }}
 */
export function computeBoardLayout(vp) {
  const width = vp.width
  const height = vp.height

  // 1) 先用「最小间距」估算固定高度，保证小屏优先把棋盘塞下
  const chromeMin = HUD_TOP_PAD + HUD_PANEL_HEIGHT +
    GAP_HUD_BOARD_MIN + GAP_BOARD_BUTTONS_MIN +
    HUD_BUTTON_HEIGHT + BOTTOM_PAD

  const availWidth = width - LAYOUT_MARGIN_X * 2
  const availHeight = height - chromeMin

  const byWidth = Math.floor(availWidth / GRID_COLS)
  const byHeight = Math.floor(availHeight / GRID_ROWS)
  const cellSize = Math.max(MIN_CELL_SIZE, Math.min(byWidth, byHeight, MAX_CELL_SIZE))

  const boardWidth = cellSize * GRID_COLS
  const boardHeight = cellSize * GRID_ROWS

  // 2) 富余的纵向空间：先保证上下各留 EDGE_MIN，其余按比例拿去拉开间距
  const slack = height - chromeMin - boardHeight
  const spare = Math.max(0, slack - EDGE_MIN * 2)
  const gapExtraMax = (GAP_HUD_BOARD_MAX - GAP_HUD_BOARD_MIN) +
    (GAP_BOARD_BUTTONS_MAX - GAP_BOARD_BUTTONS_MIN)
  const gapExtra = Math.min(Math.round(spare * SLACK_TO_GAP_RATIO), gapExtraMax)

  // 取整后可能各自越界，分别夹紧到上限
  const gapHudBoard = Math.min(
    GAP_HUD_BOARD_MIN + Math.round(gapExtra * GAP_SPLIT_TOP),
    GAP_HUD_BOARD_MAX
  )
  const gapBoardButtons = Math.min(
    GAP_BOARD_BUTTONS_MIN + Math.round(gapExtra * (1 - GAP_SPLIT_TOP)),
    GAP_BOARD_BUTTONS_MAX
  )

  const contentHeight = HUD_TOP_PAD + HUD_PANEL_HEIGHT + gapHudBoard +
    boardHeight + gapBoardButtons + HUD_BUTTON_HEIGHT + BOTTOM_PAD

  // 整块内容垂直居中，上下留白相等
  const contentTopY = Math.max(0, Math.round((height - contentHeight) / 2))
  const hudPanelY = contentTopY + HUD_TOP_PAD
  const boardOffsetY = Math.round(hudPanelY + HUD_PANEL_HEIGHT + gapHudBoard)

  return {
    cellSize,
    boardWidth,
    boardHeight,
    boardOffsetX: Math.round((width - boardWidth) / 2),
    boardOffsetY,
    contentTopY,
    hudPanelY,
    actionBarY: Math.round(boardOffsetY + boardHeight + gapBoardButtons),
    gapHudBoard,
    gapBoardButtons
  }
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
