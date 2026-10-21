import Sprite from '../base/sprite'
import {
  COLORS,
  drawStar,
  fillRoundRect,
  roundRectPath
} from '../ui/theme'

/**
 * 目标区域类
 * 石头需要被推到的目标位置（海洋馆展台聚光灯格）
 */
export default class Target extends Sprite {
  constructor(config) {
    super(config.x, config.y, config.width || 50, config.height || 50)

    // 脉冲动画
    this.pulse = 0
    this.pulseSpeed = 0.05
  }

  /**
   * 更新动画
   */
  update() {
    this.pulse = (this.pulse + this.pulseSpeed) % (Math.PI * 2)
  }

  /**
   * 检测石头是否在目标内
   * @param {Object} stone - 石头对象
   * @returns {boolean} 是否在目标内
   */
  contains(stone) {
    const stoneCenterX = stone.x + stone.width / 2
    const stoneCenterY = stone.y + stone.height / 2

    return stoneCenterX >= this.x &&
           stoneCenterX <= this.x + this.width &&
           stoneCenterY >= this.y &&
           stoneCenterY <= this.y + this.height
  }

  /**
   * 渲染目标区域
   * @param {CanvasRenderingContext2D} ctx - 画布上下文
   */
  render(ctx) {
    const centerX = this.x + this.width / 2
    const centerY = this.y + this.height / 2
    const alpha = 0.4 + Math.sin(this.pulse) * 0.15
    const scale = 1 + Math.sin(this.pulse) * 0.03

    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.scale(scale, scale)
    ctx.translate(-centerX, -centerY)

    // 地面光晕
    const glow = ctx.createRadialGradient(centerX, centerY, 2, centerX, centerY, this.width * 0.75)
    glow.addColorStop(0, `rgba(47, 191, 155, ${alpha})`)
    glow.addColorStop(1, 'rgba(47, 191, 155, 0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(centerX, centerY, this.width * 0.75, 0, Math.PI * 2)
    ctx.fill()

    // 展台格
    fillRoundRect(ctx, this.x + 2, this.y + 2, this.width - 4, this.height - 4, 10, 'rgba(255, 255, 255, 0.28)')

    // 虚线边框
    ctx.setLineDash([5, 4])
    roundRectPath(ctx, this.x + 3, this.y + 3, this.width - 6, this.height - 6, 9)
    ctx.strokeStyle = COLORS.mint
    ctx.lineWidth = 2.5
    ctx.stroke()
    ctx.setLineDash([])

    // 四角高亮
    ctx.strokeStyle = COLORS.white
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    const pad = 7
    const len = 7
    const corners = [
      [this.x + pad, this.y + pad, 1, 1],
      [this.x + this.width - pad, this.y + pad, -1, 1],
      [this.x + pad, this.y + this.height - pad, 1, -1],
      [this.x + this.width - pad, this.y + this.height - pad, -1, -1]
    ]
    corners.forEach(([x, y, dx, dy]) => {
      ctx.beginPath()
      ctx.moveTo(x + dx * len, y)
      ctx.lineTo(x, y)
      ctx.lineTo(x, y + dy * len)
      ctx.stroke()
    })

    // 中心星星
    drawStar(ctx, centerX, centerY, 8, COLORS.yellow, {
      stroke: COLORS.white,
      lineWidth: 1.8
    })

    ctx.restore()
  }
}
