import Button from './button'

/**
 * 游戏内HUD
 * 显示关卡信息、步数、时间等
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
      x: canvas.width - 70,
      y: 20,
      width: 50,
      height: 50,
      text: '⏸',
      fontSize: 24,
      bgColor: 'rgba(0, 0, 0, 0.3)',
      hoverColor: 'rgba(0, 0, 0, 0.5)',
      borderColor: 'transparent',
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

    // 顶部背景条
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    ctx.fillRect(0, 0, canvas.width, 80)

    // 关卡信息
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 18px Arial'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(`关卡 ${this.level}`, 20, 20)

    // 步数
    ctx.font = '16px Arial'
    const movesColor = this.moves <= this.par ? '#2ecc71' : '#e74c3c'
    ctx.fillStyle = movesColor
    ctx.fillText(`步数: ${this.moves}`, 20, 48)

    // 标准步数
    ctx.fillStyle = '#95a5a6'
    ctx.font = '12px Arial'
    ctx.fillText(`标准: ${this.par}`, 100, 52)

    // 时间
    ctx.fillStyle = '#ffffff'
    ctx.font = '16px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(this.formatTime(this.time), canvas.width / 2, 35)

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
