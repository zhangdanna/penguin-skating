/**
 * 背景类
 * 绘制冰面背景
 */
export default class Background {
  constructor(ctx) {
    this.ctx = ctx
    this.width = canvas.width
    this.height = canvas.height

    // 冰面纹理参数
    this.cracks = this.generateCracks()
    this.sparkles = this.generateSparkles()
  }

  /**
   * 生成冰面裂纹
   * @returns {Array} 裂纹数据
   */
  generateCracks() {
    const cracks = []
    const count = 8

    for (let i = 0; i < count; i++) {
      cracks.push({
        x1: Math.random() * this.width,
        y1: Math.random() * this.height,
        x2: Math.random() * this.width,
        y2: Math.random() * this.height,
        alpha: 0.1 + Math.random() * 0.1
      })
    }

    return cracks
  }

  /**
   * 生成冰面闪光点
   * @returns {Array} 闪光点数据
   */
  generateSparkles() {
    const sparkles = []
    const count = 20

    for (let i = 0; i < count; i++) {
      sparkles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: 1 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2
      })
    }

    return sparkles
  }

  /**
   * 渲染背景
   */
  render() {
    const ctx = this.ctx

    // 绘制冰面底色（渐变）
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height)
    gradient.addColorStop(0, '#e8f4f8')
    gradient.addColorStop(0.5, '#d4e9f0')
    gradient.addColorStop(1, '#c0dde5')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, this.width, this.height)

    // 绘制冰面裂纹
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.lineWidth = 1
    this.cracks.forEach(crack => {
      ctx.globalAlpha = crack.alpha
      ctx.beginPath()
      ctx.moveTo(crack.x1, crack.y1)
      ctx.lineTo(crack.x2, crack.y2)
      ctx.stroke()
    })
    ctx.globalAlpha = 1

    // 绘制闪光点
    const time = Date.now() * 0.001
    this.sparkles.forEach(sparkle => {
      const alpha = (Math.sin(time + sparkle.phase) + 1) / 2 * 0.8
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
      ctx.beginPath()
      ctx.arc(sparkle.x, sparkle.y, sparkle.size, 0, Math.PI * 2)
      ctx.fill()
    })

    // 绘制网格线（可选，用于调试）
    this.renderGrid()
  }

  /**
   * 渲染网格线（调试用）
   */
  renderGrid() {
    const ctx = this.ctx
    const gridSize = 50

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 0.5

    // 垂直线
    for (let x = 0; x <= this.width; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, this.height)
      ctx.stroke()
    }

    // 水平线
    for (let y = 0; y <= this.height; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(this.width, y)
      ctx.stroke()
    }
  }
}
