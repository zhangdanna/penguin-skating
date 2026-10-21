import Button from './button'
import {
  COLORS,
  drawCandyButton,
  drawGlassPanel,
  drawStickerText,
  fillRoundRect,
  font,
  roundRectPath
} from './theme'

/**
 * 游戏内HUD
 * 显示关卡信息、步数、时间等（亚克力导览牌风格）
 */
export default class GameHUD {
  constructor() {
    this.level = 1
    this.moves = 0
    this.time = 0
    this.par = 3
    this.isVisible = true

    // 暂停按钮
    this.pauseButton = new Button({
      x: canvas.width - 62,
      y: 16,
      width: 44,
      height: 44,
      text: 'Ⅱ',
      fontSize: 18,
      bgColor: COLORS.orange,
      hoverColor: COLORS.orangeDeep,
      borderColor: '#B55F22',
      onClick: () => {
        if (this.onPauseClick) {
          this.onPauseClick()
        }
      }
    })

    // 暂停回调
    this.onPauseClick = null
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

    ctx.save()

    // 亚克力导览牌
    drawGlassPanel(ctx, 10, 8, canvas.width - 20, 64, 20, {
      fill: 'rgba(255, 255, 255, 0.86)'
    })

    // 关卡徽章
    drawCandyButton(ctx, 20, 16, 92, 24, {
      color: COLORS.mint,
      shadowColor: COLORS.mintDeep,
      radius: 12
    })
    drawStickerText(ctx, `关卡 ${this.level}`, 66, 28, {
      size: 13,
      color: COLORS.white,
      strokeWidth: 2.5
    })

    // 步数
    ctx.font = font(15)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = this.moves <= this.par ? COLORS.mintDeep : COLORS.coral
    ctx.fillText(`步数 ${this.moves}`, 22, 54)

    ctx.font = font(11, 'normal')
    ctx.fillStyle = COLORS.navySoft
    ctx.fillText(`标准 ${this.par}`, 92, 54)

    // 计时胶囊
    const timerX = canvas.width / 2 - 40
    fillRoundRect(ctx, timerX, 16, 80, 26, 13, 'rgba(91, 200, 245, 0.22)')
    roundRectPath(ctx, timerX, 16, 80, 26, 13)
    ctx.strokeStyle = 'rgba(91, 200, 245, 0.6)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    ctx.font = font(15)
    ctx.fillStyle = COLORS.navy
    ctx.textAlign = 'center'
    ctx.fillText(this.formatTime(this.time), canvas.width / 2, 30)

    // 暂停按钮
    this.pauseButton.render(ctx)

    ctx.restore()
  }

  /**
   * 处理触摸开始
   */
  onTouchStart(touch) {
    return this.pauseButton.onTouchStart(touch)
  }

  /**
   * 处理触摸结束
   */
  onTouchEnd(touch) {
    return this.pauseButton.onTouchEnd(touch)
  }
}
