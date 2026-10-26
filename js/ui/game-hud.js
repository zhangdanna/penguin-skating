import {
  COLORS,
  drawGlassPanel,
  fillRoundRect,
  font,
  strokeRoundRect
} from './theme'
import { viewport } from '../env'
import { HUD_PANEL_HEIGHT, HUD_BUTTON_HEIGHT } from './layout'

// 面板 / 按钮尺寸的唯一数据源在 layout.js（与 computeBoardLayout 共用），
// 这里只做转出，保持既有引用路径不变
export { HUD_PANEL_HEIGHT, HUD_BUTTON_HEIGHT }

/** 卡片之间的间距 */
const BUTTON_GAP = 14
/** 卡片圆角 */
const BUTTON_RADIUS = 24
/** 卡片底部实色投影厚度（糖果质感） */
const BUTTON_DEPTH = 4
/** 「退一步」单步消耗 */
export const UNDO_FOOD_COST = 2

/**
 * 游戏内HUD
 * 顶部：食物与关卡信息；底部：暂停 / 退一步 / 重玩
 *
 * 面板与按钮的纵向位置不钉死在屏幕上下边缘，而是由 game.js 根据棋盘位置
 * 算好后传进来（bounds），这样顶部/底部就能贴着棋盘，不再留大片空白。
 */
export default class GameHUD {
  constructor() {
    this.level = 1
    this.moves = 0
    this.time = 0
    this.par = 3
    this.isVisible = true

    // 操作按钮回调
    this.onPauseClick = null
    this.onRestartClick = null
    this.onUndoClick = null

    // 退一步状态（由 game.js 每次移动后同步）
    this.undoCost = UNDO_FOOD_COST
    this.undoSteps = 0
    this.foodTotal = 0

    // 纵向锚点，未传入时退回默认（贴屏幕边缘）
    this.panelY = 6
    this.buttonY = null

    this.computeLayout()
  }

  /**
   * 按当前画布尺寸计算面板与操作按钮位置
   * @param {{panelY?:number, buttonY?:number}} [bounds] - 由棋盘布局推出的纵向锚点
   */
  computeLayout(bounds) {
    if (bounds) {
      if (typeof bounds.panelY === 'number') this.panelY = bounds.panelY
      if (typeof bounds.buttonY === 'number') this.buttonY = bounds.buttonY
    }

    const vp = viewport()

    // 顶部信息面板（食物行由 FoodDisplay 绘制在同一面板内）
    this.panel = {
      x: 8,
      y: this.panelY,
      width: vp.width - 16,
      height: HUD_PANEL_HEIGHT
    }

    // 底部三张卡片，整体水平居中
    const size = HUD_BUTTON_HEIGHT
    const totalWidth = size * 3 + BUTTON_GAP * 2
    const startX = Math.round((vp.width - totalWidth) / 2)
    const buttonY = typeof this.buttonY === 'number'
      ? this.buttonY
      : vp.height - size - 12

    const buttonConfigs = [
      {
        id: 'pause',
        icon: 'pause',
        label: '暂停',
        color: COLORS.orange,
        deepColor: COLORS.orangeDeep,
        onClick: () => this.onPauseClick && this.onPauseClick()
      },
      {
        id: 'undo',
        icon: 'undo',
        label: '退一步',
        color: COLORS.water,
        deepColor: COLORS.waterDeep,
        badge: `-${this.undoCost}🐟`,
        onClick: () => this.onUndoClick && this.onUndoClick()
      },
      {
        id: 'restart',
        icon: 'replay',
        label: '重玩',
        color: COLORS.lavender,
        deepColor: COLORS.lavenderDeep,
        onClick: () => this.onRestartClick && this.onRestartClick()
      }
    ]

    this.actionButtons = buttonConfigs.map((config, index) => ({
      ...config,
      x: startX + index * (size + BUTTON_GAP),
      y: buttonY,
      width: size,
      height: size,
      hovered: false,
      disabled: false
    }))

    this.refreshActionButtons()
  }

  /**
   * 窗口尺寸变化后重建布局
   * @param {{panelY?:number, buttonY?:number}} [bounds]
   */
  relayout(bounds) {
    this.computeLayout(bounds)
  }

  /**
   * 同步「退一步」的可用状态
   * @param {{steps?:number, food?:number}} state
   */
  setUndoState(state = {}) {
    if (typeof state.steps === 'number') this.undoSteps = state.steps
    if (typeof state.food === 'number') this.foodTotal = state.food
    this.refreshActionButtons()
  }

  /**
   * 按当前步数 / 食物量 / 是否已移动，刷新底部三张卡片的可用状态
   *
   * - 退一步：没有历史步数或食物不够时置灰
   * - 重玩：还没走过第一步时置灰（点了等于什么都没做，还会白扣一次入场食物）
   */
  refreshActionButtons() {
    if (!this.actionButtons) return

    const undo = this.actionButtons.find(item => item.id === 'undo')
    if (undo) {
      undo.disabled = this.undoSteps <= 0 || this.foodTotal < this.undoCost
    }

    const restart = this.actionButtons.find(item => item.id === 'restart')
    if (restart) {
      restart.disabled = this.moves <= 0
    }
  }

  /**
   * 兼容旧调用名
   */
  refreshUndoButton() {
    this.refreshActionButtons()
  }

  /**
   * 设置关卡信息
   */
  setLevelInfo(level, par) {
    this.level = level
    this.par = par
  }

  /**
   * 更新步数
   */
  setMoves(moves) {
    this.moves = moves
    // 步数决定「重玩」是否可用，改完立刻同步按钮状态
    this.refreshActionButtons()
  }

  /**
   * 更新时间
   */
  setTime(time) {
    this.time = time
  }

  /**
   * 格式化时间
   */
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  /**
   * 渲染HUD
   */
  render(ctx) {
    if (!this.isVisible) return

    this.renderPanel(ctx)
    this.actionButtons.forEach(btn => this.renderActionButton(ctx, btn))
  }

  /**
   * 渲染顶部信息面板（关卡、步数、计时）
   */
  renderPanel(ctx) {
    const { x, y, width, height } = this.panel

    drawGlassPanel(ctx, x, y, width, height, 18, {
      fill: 'rgba(255, 255, 255, 0.86)'
    })

    ctx.save()
    ctx.textBaseline = 'middle'

    const infoY = y + 64

    // 第N关（不加背景色）
    ctx.font = font(16)
    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.navy
    ctx.fillText(`第${this.level}关`, 20, infoY)

    // 步数与标准步数
    ctx.font = font(14)
    ctx.textAlign = 'center'
    ctx.fillStyle = this.moves <= this.par ? COLORS.mintDeep : COLORS.coral
    ctx.fillText(`步数 ${this.moves} · 标准 ${this.par}`, viewport().width / 2, infoY)

    // 计时
    ctx.font = font(16)
    ctx.textAlign = 'right'
    ctx.fillStyle = COLORS.navy
    ctx.fillText(this.formatTime(this.time), x + width - 14, infoY)

    ctx.restore()
  }

  /**
   * 渲染底部操作按钮（大图标卡片 + 小字标签 + 消耗角标）
   */
  renderActionButton(ctx, btn) {
    const pressed = btn.hovered && !btn.disabled
    const offsetY = pressed ? 2 : 0

    ctx.save()
    if (btn.disabled) ctx.globalAlpha = 0.42

    // 底部实色投影：按下时压扁，制造回弹手感
    fillRoundRect(
      ctx,
      btn.x,
      btn.y + (pressed ? BUTTON_DEPTH - 2 : BUTTON_DEPTH),
      btn.width,
      btn.height,
      BUTTON_RADIUS,
      btn.deepColor
    )

    // 白色卡片 + 彩色描边
    fillRoundRect(ctx, btn.x, btn.y + offsetY, btn.width, btn.height, BUTTON_RADIUS, COLORS.paper)
    strokeRoundRect(
      ctx,
      btn.x,
      btn.y + offsetY,
      btn.width,
      btn.height,
      BUTTON_RADIUS,
      btn.color,
      2.5
    )

    // 大图标
    this.drawIcon(
      ctx,
      btn.icon,
      btn.x + btn.width / 2,
      btn.y + offsetY + 30,
      btn.color,
      btn.deepColor
    )

    // 小字标签
    ctx.font = font(11)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = COLORS.navy
    ctx.fillText(btn.label, btn.x + btn.width / 2, btn.y + offsetY + 61)

    ctx.restore()

    // 消耗角标贴在卡片右上角外沿，不随卡片按压位移
    if (btn.badge) {
      this.drawBadge(ctx, btn)
    }
  }

  /**
   * 绘制右上角的消耗角标（如 -2🐟）
   */
  drawBadge(ctx, btn) {
    const label = btn.badge

    ctx.save()
    ctx.font = font(11)

    const textWidth = ctx.measureText(label).width
    const width = Math.round(textWidth + 14)
    const height = 20
    const x = btn.x + btn.width - width + 8
    const y = btn.y - 9

    if (btn.disabled) ctx.globalAlpha = 0.42

    fillRoundRect(ctx, x, y, width, height, height / 2, btn.deepColor)
    strokeRoundRect(ctx, x, y, width, height, height / 2, COLORS.white, 2)

    ctx.fillStyle = COLORS.white
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, x + width / 2, y + height / 2 + 0.5)

    ctx.restore()
  }

  /**
   * 绘制按钮图标
   *
   * 三张参考图（均为实心填充、圆角端点）：
   *   - 退一步：左侧实心三角箭头 + 向右再向下弯折的粗带子
   *   - 重玩  ：缺口在右上的圆环 + 右上角朝外的箭头
   *   - 暂停  ：两条细长的圆角竖条
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {'pause'|'undo'|'replay'} type
   * @param {number} cx 图标中心 x
   * @param {number} cy 图标中心 y
   * @param {string} color 主色
   * @param {string} deepColor 深色（描边/箭头）
   */
  drawIcon(ctx, type, cx, cy, color, deepColor) {
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (type === 'pause') {
      // 两条细长圆角竖条：条宽 6、间隙 3、高 22
      fillRoundRect(ctx, cx - 7.5, cy - 11, 6, 22, 3, color)
      fillRoundRect(ctx, cx + 1.5, cy - 11, 6, 22, 3, color)
    } else if (type === 'undo') {
      // 退一步：带子从箭头根部水平向右，圆角向下弯折，末端圆头
      ctx.strokeStyle = color
      ctx.lineWidth = 5.5
      ctx.beginPath()
      ctx.moveTo(cx - 4, cy - 6)
      ctx.lineTo(cx + 2, cy - 6)
      ctx.quadraticCurveTo(cx + 10, cy - 6, cx + 10, cy + 2)
      ctx.lineTo(cx + 10, cy + 7)
      ctx.stroke()

      // 左侧实心三角箭头，尖端朝左
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(cx - 14, cy - 6)
      ctx.lineTo(cx - 4, cy - 12.5)
      ctx.lineTo(cx - 4, cy + 0.5)
      ctx.closePath()
      ctx.fill()
    } else if (type === 'replay') {
      // 重玩：圆环缺口留在右上方，箭头沿切线方向接在缺口下端
      const r = 7.4
      const endAngle = -Math.PI / 3
      ctx.strokeStyle = color
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.arc(cx, cy, r, Math.PI / 12, endAngle)
      ctx.stroke()

      // 箭头：尖端沿顺时针切线方向伸出，底边与圆环末端齐平
      const ax = cx + r * Math.cos(endAngle)
      const ay = cy + r * Math.sin(endAngle)
      const tangent = endAngle + Math.PI / 2
      const dirX = Math.cos(tangent)
      const dirY = Math.sin(tangent)
      const perpX = -dirY
      const perpY = dirX
      const half = 4.8

      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(ax + dirX * 6.5, ay + dirY * 6.5)
      ctx.lineTo(ax - dirX * 1.5 + perpX * half, ay - dirY * 1.5 + perpY * half)
      ctx.lineTo(ax - dirX * 1.5 - perpX * half, ay - dirY * 1.5 - perpY * half)
      ctx.closePath()
      ctx.fill()
    }

    ctx.restore()
  }

  /**
   * 处理触摸开始
   */
  onTouchStart(touch) {
    let handled = false

    this.actionButtons.forEach(btn => {
      if (this.contains(btn, touch)) {
        if (!btn.disabled) btn.hovered = true
        handled = true
      }
    })

    return handled
  }

  /**
   * 处理触摸结束
   */
  onTouchEnd(touch) {
    let handled = false

    this.actionButtons.forEach(btn => {
      const wasHovered = btn.hovered
      btn.hovered = false

      if (wasHovered && this.contains(btn, touch)) {
        if (!btn.disabled && btn.onClick) btn.onClick()
        handled = true
      }
    })

    return handled
  }

  /**
   * 判断触摸点是否在按钮内
   */
  contains(btn, touch) {
    return touch.clientX >= btn.x && touch.clientX <= btn.x + btn.width &&
           touch.clientY >= btn.y && touch.clientY <= btn.y + btn.height
  }
}
