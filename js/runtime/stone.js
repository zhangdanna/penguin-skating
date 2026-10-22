import Sprite from '../base/sprite'
import {
  COLORS,
  drawSnowflake,
  roundRectPath
} from '../ui/theme'

/**
 * 冰块类（可推动的冰晶）
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
   * 渲染可推动的冰晶（菱形冰块 + 切面 + 裂纹高光）
   * @param {CanvasRenderingContext2D} ctx - 画布上下文
   */
  render(ctx) {
    const cx = this.x + this.width / 2
    const cy = this.y + this.height / 2
    const size = Math.min(this.width, this.height) * 0.58  // 菱形边长
    const radius = 5
    const thickness = 4  // 底部厚度
    const half = size / Math.SQRT2  // 菱形对角线的一半

    ctx.save()

    // 落地阴影
    ctx.fillStyle = 'rgba(19, 61, 90, 0.22)'
    ctx.beginPath()
    ctx.ellipse(cx, cy + 20, 15, 4.5, 0, 0, Math.PI * 2)
    ctx.fill()

    // 底部厚度：先画一层向下偏移的菱形
    diamondPath(ctx, cx, cy + thickness, size, radius)
    ctx.fillStyle = '#63B2D8'
    ctx.fill()
    ctx.strokeStyle = 'rgba(37, 110, 150, 0.7)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // 冰晶主体
    diamondPath(ctx, cx, cy, size, radius)
    const ice = ctx.createLinearGradient(0, cy - 21, 0, cy + 21)
    ice.addColorStop(0, '#F8FDFF')
    ice.addColorStop(0.45, '#E2F4FF')
    ice.addColorStop(1, '#A6D9F5')
    ctx.fillStyle = ice
    ctx.fill()

    // 切面：左上受光面 + 右下背光面
    ctx.save()
    diamondPath(ctx, cx, cy, size, radius)
    ctx.clip()

    ctx.beginPath()
    ctx.moveTo(cx, cy - half)
    ctx.lineTo(cx - half, cy)
    ctx.lineTo(cx, cy)
    ctx.closePath()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(cx + half, cy)
    ctx.lineTo(cx, cy + half)
    ctx.lineTo(cx, cy)
    ctx.closePath()
    ctx.fillStyle = 'rgba(86, 173, 220, 0.2)'
    ctx.fill()

    // 裂纹 / 冰晶切面线
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const cracks = [
      [[cx - 6, cy - 15], [cx - 2, cy - 7], [cx - 9, cy + 1], [cx - 5, cy + 12], [cx - 11, cy + 17]],
      [[cx - 16, cy + 4], [cx - 7, cy + 2], [cx + 2, cy - 2], [cx + 10, cy + 2], [cx + 15, cy + 5]],
      [[cx + 7, cy - 11], [cx + 4, cy - 4], [cx + 9, cy + 3]]
    ]
    cracks.forEach(points => {
      ctx.beginPath()
      points.forEach(([px, py], index) => {
        if (index === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      })
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)'
      ctx.lineWidth = 2.2
      ctx.stroke()
      ctx.strokeStyle = 'rgba(94, 176, 219, 0.6)'
      ctx.lineWidth = 1.2
      ctx.stroke()
    })
    ctx.restore()

    // 左上高光
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(cx - 13, cy - 7)
    ctx.lineTo(cx - 2, cy - 17)
    ctx.stroke()

    // 外轮廓：让冰晶从浅色冰面中清晰跳出来
    diamondPath(ctx, cx, cy, size, radius)
    ctx.strokeStyle = 'rgba(64, 148, 196, 0.9)'
    ctx.lineWidth = 2.2
    ctx.stroke()

    // 气泡与冰晶闪光
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.beginPath()
    ctx.arc(cx + 4, cy + 7, 2, 0, Math.PI * 2)
    ctx.arc(cx - 5, cy + 12, 1.4, 0, Math.PI * 2)
    ctx.fill()
    drawSnowflake(ctx, cx + 8, cy - 9, 4.5, 'rgba(255, 255, 255, 0.85)', 1.1)

    // 已在目标位置：薄荷绿光晕 + 对勾
    if (this.inTarget) {
      ctx.save()
      ctx.strokeStyle = 'rgba(47, 191, 155, 0.85)'
      ctx.lineWidth = 2.4
      diamondPath(ctx, cx, cy, size + 7, radius + 2)
      ctx.stroke()

      // 深色描边打底，避免对勾和浅色冰面糊在一起
      ctx.strokeStyle = 'rgba(16, 110, 86, 0.9)'
      ctx.lineWidth = 4
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(cx - 7, cy + 1)
      ctx.lineTo(cx - 2, cy + 6)
      ctx.lineTo(cx + 7, cy - 5)
      ctx.stroke()

      ctx.strokeStyle = COLORS.white
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(cx - 7, cy + 1)
      ctx.lineTo(cx - 2, cy + 6)
      ctx.lineTo(cx + 7, cy - 5)
      ctx.stroke()
      ctx.restore()
    }

    ctx.restore()
  }
}

/**
 * 绘制菱形冰块路径（圆角正方形旋转 45°）
 */
function diamondPath(ctx, cx, cy, size, radius) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(Math.PI / 4)
  roundRectPath(ctx, -size / 2, -size / 2, size, size, radius)
  ctx.restore()
}
