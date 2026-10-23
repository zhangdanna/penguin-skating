import {
  COLORS,
  drawCandyButton,
  drawGlassPanel,
  drawStickerText,
  fillRoundRect,
  font
} from './theme'

/**
 * 游戏内HUD
 * 顶部：食物与关卡信息；底部：暂停/重玩/返回操作按钮
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
    this.onBackClick = null

    this.computeLayout()
  }

  /**
   * 按当前画布尺寸计算面板与操作按钮位置
   * 窗口尺寸变化时由 relayout() 重新调用
   */
  computeLayout() {
    // 顶部信息面板（食物行由 FoodDisplay 绘制在同一面板内）
    this.panel = {
      x: 8,
      y: 6,
      width: canvas.width - 16,
      height: 82
    }

    // 底部操作按钮（图标 + 文案，一行展示）
    const marginX = 12
    const gap = 8
    const buttonWidth = (canvas.width - marginX * 2 - gap * 2) / 3
    const buttonY = canvas.height - 52

    const buttonConfigs = [
      {
        icon: 'pause',
        label: '暂停',
        color: COLORS.orange,
        hoverColor: COLORS.orangeDeep,
        shadowColor: COLORS.orangeDeep,
        onClick: () => this.onPauseClick && this.onPauseClick()
      },
      {
        icon: 'replay',
        label: '重玩',
        color: COLORS.water,
        hoverColor: COLORS.waterDeep,
        shadowColor: COLORS.waterDeep,
        onClick: () => this.onRestartClick && this.onRestartClick()
      },
      {
        icon: 'back',
        label: '返回',
        color: COLORS.lavender,
        hoverColor: COLORS.lavenderDeep,
        shadowColor: COLORS.lavenderDeep,
        onClick: () => this.onBackClick && this.onBackClick()
      }
    ]

    this.actionButtons = buttonConfigs.map((config, index) => ({
      ...config,
      x: marginX + index * (buttonWidth + gap),
      y: buttonY,
      width: buttonWidth,
      height: 40,
      hovered: false
    }))
  }

  /**
   * 窗口尺寸变化后重建布局
   */
  relayout() {
    this.computeLayout()
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
    ctx.fillText(`步数 ${this.moves} · 标准 ${this.par}`, canvas.width / 2, infoY)

    // 计时
    ctx.font = font(16)
    ctx.textAlign = 'right'
    ctx.fillStyle = COLORS.navy
    ctx.fillText(this.formatTime(this.time), x + width - 14, infoY)

    ctx.restore()
  }

  /**
   * 渲染底部操作按钮
   */
  renderActionButton(ctx, btn) {
    drawCandyButton(ctx, btn.x, btn.y, btn.width, btn.height, {
      color: btn.hovered ? btn.hoverColor : btn.color,
      shadowColor: btn.shadowColor,
      pressed: btn.hovered
    })

    const offsetY = btn.hovered ? 2 : 0
    const centerY = btn.y + btn.height / 2 + offsetY
    const iconWidth = 11
    const iconGap = 4

    ctx.save()
    ctx.font = font(14)
    const textWidth = ctx.measureText(btn.label).width
    ctx.restore()

    const totalWidth = iconWidth + iconGap + textWidth
    const startX = btn.x + (btn.width - totalWidth) / 2

    this.drawIcon(ctx, btn.icon, startX + iconWidth / 2, centerY)
    drawStickerText(ctx, btn.label, startX + iconWidth + iconGap, centerY, {
      size: 14,
      color: COLORS.white,
      strokeWidth: 2.5,
      align: 'left'
    })
  }

  /**
   * 绘制按钮图标
   */
  drawIcon(ctx, type, cx, cy) {
    ctx.save()
    ctx.strokeStyle = COLORS.white
    ctx.fillStyle = COLORS.white
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (type === 'pause') {
      fillRoundRect(ctx, cx - 5, cy - 6, 3.5, 12, 1.5, COLORS.white)
      fillRoundRect(ctx, cx + 1.5, cy - 6, 3.5, 12, 1.5, COLORS.white)
    } else if (type === 'replay') {
      ctx.beginPath()
      ctx.arc(cx, cy, 5.5, Math.PI * 0.55, Math.PI * 1.85)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(cx - 5.5, cy - 2.5)
      ctx.lineTo(cx - 5.5, cy + 2.5)
      ctx.lineTo(cx - 1.5, cy)
      ctx.closePath()
      ctx.fill()
    } else if (type === 'back') {
      ctx.beginPath()
      ctx.moveTo(cx + 5, cy)
      ctx.lineTo(cx - 5, cy)
      ctx.moveTo(cx - 1, cy - 4)
      ctx.lineTo(cx - 5, cy)
      ctx.lineTo(cx - 1, cy + 4)
      ctx.stroke()
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
        btn.hovered = true
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
        if (btn.onClick) btn.onClick()
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
