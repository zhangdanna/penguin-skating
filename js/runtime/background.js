import {
  COLORS,
  drawOceanCached,
  drawOceanMotion,
  fillRoundRect,
  roundRectPath
} from '../ui/theme'
import LayerCache from '../utils/layer-cache'

/**
 * 背景类
 * 绘制极地海洋馆场景与浮冰棋盘
 *
 * D7：静态部分（水体渐变、玻璃反光、沙底珊瑚、棋盘底座与 63 块浮冰瓷砖）
 * 缓存到离屏 canvas，每帧只重绘光束 / 气泡 / 鱼群 / 海草 / 闪光点。
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

    // 棋盘静态层（展台底座 + 浮冰瓷砖 + 外框）
    this.boardLayer = new LayerCache('board')

    // 棋盘上的随机闪光点（动态闪烁，不缓存）
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
   * 棋盘布局签名：任何一项变化都要重建静态层
   */
  getBoardKey() {
    const { cols, rows, cellSize, offsetX, offsetY } = this.grid
    return `${cols}x${rows}@${cellSize}:${offsetX},${offsetY}`
  }

  /**
   * 渲染背景
   */
  render() {
    const time = Date.now() / 1000

    // 海洋静态层（与菜单 / 排行榜共用同一份离屏缓存）
    drawOceanCached(this.ctx)

    // 海洋动态层
    drawOceanMotion(this.ctx, time)

    // 浮冰棋盘
    this.renderBoard(time)
  }

  /**
   * 渲染浮冰棋盘
   */
  renderBoard(time) {
    const ctx = this.ctx
    const { cols, rows, cellSize, offsetX, offsetY } = this.grid
    const width = canvas.width
    const height = canvas.height

    // 底座 + 瓷砖 + 外框一次性画进离屏层
    const cached = this.boardLayer.render(
      ctx, this.getBoardKey(), width, height,
      (layerCtx) => this.drawBoardStatic(layerCtx)
    )
    if (!cached) {
      this.drawBoardStatic(ctx)
    }

    // 闪光点（每帧闪烁，保持实时绘制）
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

  /**
   * 棋盘静态部分：玻璃展台底座 + 浮冰瓷砖 + 外框
   * @param {CanvasRenderingContext2D} ctx - 目标上下文（主画布或离屏层）
   */
  drawBoardStatic(ctx) {
    const { cols, rows, cellSize, offsetX, offsetY } = this.grid
    const boardWidth = cols * cellSize
    const boardHeight = rows * cellSize

    // 棋盘底座：玻璃展台
    // D7：原来用 shadowBlur=18 做投影，这是每帧最贵的一笔；
    // 现在改成两层半透明圆角矩形模拟柔和投影，效果接近但成本低一个数量级
    fillRoundRect(
      ctx,
      offsetX - 12,
      offsetY - 4,
      boardWidth + 24,
      boardHeight + 24,
      24,
      'rgba(31, 58, 95, 0.10)'
    )
    fillRoundRect(
      ctx,
      offsetX - 9,
      offsetY - 7,
      boardWidth + 18,
      boardHeight + 18,
      21,
      'rgba(255, 255, 255, 0.35)'
    )

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
  }
}
