import Sprite from '../base/sprite'
import {
  COLORS,
  drawSnowflake,
  fillRoundRect,
  roundRectPath
} from '../ui/theme'

/**
 * 石头类（视觉上是一块可推动的冰块立方体）
 * 可被企鹅推动的物体，按格移动
 */
export default class Stone extends Sprite {
  constructor(config) {
    super(config.x, config.y, config.size || 40, config.size || 40)

    // 状态
    this.isMoving = false
    this.inTarget = false  // 是否在目标位置
  }

  /**
   * 更新移动动画
   */
  update() {
    this.updateTween()
  }

  /**
   * 渲染冰块立方体
   * @param {CanvasRenderingContext2D} ctx - 画布上下文
   */
  render(ctx) {
    const centerX = this.x + this.width / 2
    const centerY = this.y + this.height / 2
    const half = this.width / 2 - 4

    ctx.save()

    // 底部阴影
    ctx.fillStyle = 'rgba(31, 58, 95, 0.18)'
    ctx.beginPath()
    ctx.ellipse(centerX, this.y + this.height - 4, half * 0.85, 4.5, 0, 0, Math.PI * 2)
    ctx.fill()

    // 冰块主体
    const ice = ctx.createLinearGradient(centerX - half, centerY - half, centerX + half, centerY + half)
    ice.addColorStop(0, '#F0FDFF')
    ice.addColorStop(0.45, '#AEE8FF')
    ice.addColorStop(1, '#63C7EC')
    fillRoundRect(ctx, centerX - half, centerY - half, half * 2, half * 2, 9, ice)

    // 冰晶内斜面
    ctx.save()
    ctx.globalAlpha = 0.75
    ctx.beginPath()
    ctx.moveTo(centerX - half + 5, centerY - half + 5)
    ctx.lineTo(centerX + half - 9, centerY - half + 5)
    ctx.lineTo(centerX + half - 5, centerY - half + 9)
    ctx.lineTo(centerX - half + 5, centerY - half + 12)
    ctx.closePath()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.fill()
    ctx.restore()

    // 冰块描边
    roundRectPath(ctx, centerX - half, centerY - half, half * 2, half * 2, 9)
    ctx.strokeStyle = this.inTarget ? COLORS.mint : 'rgba(255, 255, 255, 0.95)'
    ctx.lineWidth = this.inTarget ? 3 : 2
    ctx.stroke()

    // 内部气泡
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
    ctx.beginPath()
    ctx.arc(centerX + 5, centerY + 2, 2.4, 0, Math.PI * 2)
    ctx.arc(centerX - 6, centerY + 8, 1.6, 0, Math.PI * 2)
    ctx.arc(centerX + 9, centerY - 7, 1.3, 0, Math.PI * 2)
    ctx.fill()

    // 雪花纹样
    drawSnowflake(ctx, centerX - 2, centerY - 2, 6.5, 'rgba(255, 255, 255, 0.9)', 1.4)

    // 已在目标位置：薄荷绿光晕 + 对勾
    if (this.inTarget) {
      ctx.save()
      ctx.strokeStyle = 'rgba(47, 191, 155, 0.55)'
      ctx.lineWidth = 2
      roundRectPath(ctx, centerX - half - 3, centerY - half - 3, half * 2 + 6, half * 2 + 6, 11)
      ctx.stroke()

      ctx.strokeStyle = COLORS.white
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(centerX - 7, centerY + 1)
      ctx.lineTo(centerX - 2, centerY + 6)
      ctx.lineTo(centerX + 7, centerY - 5)
      ctx.stroke()
      ctx.restore()
    }

    ctx.restore()
  }
}
