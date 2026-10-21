import {
  COLORS,
  drawOceanBackdrop,
  fillRoundRect,
  roundRectPath
} from '../ui/theme'

/**
 * 背景类
 * 绘制极地海洋馆场景与浮冰棋盘
 */
export default class Background {
  /**
   * @param {CanvasRenderingContext2D} ctx - 画布上下文
   * @param {Object} grid - 棋盘配置 {cols, rows, cellSize, offsetX, offsetY}
   */
  constructor(ctx, grid) {
    this.ctx = ctx
    this.width = canvas.width
    this.height = canvas.height
    this.grid = grid

    // 棋盘上的随机闪光点
    this.sparkles = this.generateSparkles()
  }

  /**
   * 生成棋盘闪光点（按格子随机分布）
   */
  generateSparkles() {
    const sparkles = []
    const count = 12

    for (let i = 0; i < count; i++) {
      sparkles.push({
        col: Math.floor(Math.random() * this.grid.cols),
        row: Math.floor(Math.random() * this.grid.rows),
        offsetX: 10 + Math.random() * (this.grid.cellSize - 20),
        offsetY: 10 + Math.random() * (this.grid.cellSize - 20),
        size: 1 + Math.random() * 1.8,
        phase: Math.random() * Math.PI * 2
      })
    }

    return sparkles
  }

  /**
   * 渲染背景
   */
  render() {
    const time = Date.now() / 1000

    // 海洋馆场景（水体、光束、气泡、鱼群、沙底珊瑚）
    drawOceanBackdrop(this.ctx, time)

    // 浮冰棋盘
    this.renderBoard(time)
  }

  /**
   * 渲染浮冰棋盘
   */
  renderBoard(time) {
    const ctx = this.ctx
    const { cols, rows, cellSize, offsetX, offsetY } = this.grid
    const boardWidth = cols * cellSize
    const boardHeight = rows * cellSize

    // 棋盘底座：玻璃展台
    ctx.save()
    ctx.shadowColor = 'rgba(31, 58, 95, 0.22)'
    ctx.shadowBlur = 18
    ctx.shadowOffsetY = 8
    fillRoundRect(
      ctx,
      offsetX - 8,
      offsetY - 8,
      boardWidth + 16,
      boardHeight + 16,
      20,
      'rgba(255, 255, 255, 0.35)'
    )
    ctx.restore()

    // 浮冰瓷砖
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = offsetX + col * cellSize + 3
        const y = offsetY + row * cellSize + 3
        const size = cellSize - 6
        const isLight = (row + col) % 2 === 0

        const fill = isLight ? 'rgba(255, 255, 255, 0.66)' : 'rgba(196, 240, 255, 0.58)'
        fillRoundRect(ctx, x, y, size, size, 10, fill)

        // 冰面高光
        ctx.save()
        ctx.globalAlpha = 0.55
        ctx.beginPath()
        ctx.moveTo(x + 8, y + 3)
        ctx.lineTo(x + size - 8, y + 3)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.lineWidth = 1.5
        ctx.lineCap = 'round'
        ctx.stroke()
        ctx.restore()

        // 瓷砖描边
        roundRectPath(ctx, x, y, size, size, 10)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)'
        ctx.lineWidth = 1.2
        ctx.stroke()
      }
    }

    // 棋盘外框
    roundRectPath(ctx, offsetX - 8, offsetY - 8, boardWidth + 16, boardHeight + 16, 20)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
    ctx.lineWidth = 3
    ctx.stroke()

    // 闪光点
    this.sparkles.forEach(sparkle => {
      const alpha = ((Math.sin(time * 2 + sparkle.phase) + 1) / 2) * 0.8
      const x = offsetX + sparkle.col * cellSize + sparkle.offsetX
      const y = offsetY + sparkle.row * cellSize + sparkle.offsetY

      ctx.save()
      ctx.globalAlpha = alpha
      ctx.strokeStyle = COLORS.white
      ctx.lineWidth = 1.2
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x - sparkle.size, y)
      ctx.lineTo(x + sparkle.size, y)
      ctx.moveTo(x, y - sparkle.size)
      ctx.lineTo(x, y + sparkle.size)
      ctx.stroke()
      ctx.restore()
    })
  }
}
