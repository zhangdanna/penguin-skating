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
    const centerY = this.y + this.height / 2

    // 以 40px 冰块为设计基准，所有硬编码偏移按 k 等比缩放（D6）
    // 之前只有菱形本体跟着格子缩放，阴影、裂纹、高光、描边宽度都是固定像素，
    // 在 42px / 56px 格子上会明显错位。
    const k = Math.min(this.width, this.height) / 40
    // 0.464 → 0.5：菱形再大一点点。0.464 在 44px 格子上只有 20px 宽，
    // 叠在浅冰面上几乎看不见（截图实测要盯两秒才找到）。
    const size = 20 * k               // 菱形边长
    const radius = 5 * k
    const thickness = 4 * k           // 底部厚度
    const half = size / Math.SQRT2    // 菱形对角线的一半

    // 菱形 + 底部厚度整体上移 thickness/2，让视觉重心落在格子中心
    const cy = centerY - thickness / 2

    ctx.save()

    // 落地阴影（贴在格子底部，不跟着上移）
    ctx.fillStyle = 'rgba(19, 61, 90, 0.22)'
    ctx.beginPath()
    ctx.ellipse(cx, centerY + 20 * k, 15 * k, 4.5 * k, 0, 0, Math.PI * 2)
    ctx.fill()

    // 底部厚度：先画一层向下偏移的菱形
    // 侧面色用「折射后偏深一点的同一块冰」，不用深海军蓝 —— 深色侧壁
    // 会把冰读成实心塑料，冰晶的透光感全靠侧壁不能太沉。
    diamondPath(ctx, cx, cy + thickness, size, radius)
    ctx.fillStyle = '#8ACBEA'
    ctx.fill()
    ctx.strokeStyle = 'rgba(96, 168, 208, 0.75)'
    ctx.lineWidth = 1.5 * k
    ctx.stroke()

    // 冰晶主体
    diamondPath(ctx, cx, cy, size, radius)
    const ice = ctx.createLinearGradient(0, cy - 21 * k, 0, cy + 21 * k)
    ice.addColorStop(0, '#FFFFFF')
    ice.addColorStop(0.45, '#EAF8FF')
    ice.addColorStop(1, '#B5E2F8')
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

    // 裂纹 / 冰晶切面线（坐标按 k 缩放，避免小格子上裂纹糊成一团）
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const cracks = [
      [[-6, -15], [-2, -7], [-9, 1], [-5, 12], [-11, 17]],
      [[-16, 4], [-7, 2], [2, -2], [10, 2], [15, 5]],
      [[7, -11], [4, -4], [9, 3]]
    ]
    cracks.forEach(points => {
      ctx.beginPath()
      points.forEach(([px, py], index) => {
        const x = cx + px * k
        const y = cy + py * k
        if (index === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)'
      ctx.lineWidth = 2.2 * k
      ctx.stroke()
      ctx.strokeStyle = 'rgba(94, 176, 219, 0.6)'
      ctx.lineWidth = 1.2 * k
      ctx.stroke()
    })
    ctx.restore()

    // 左上高光
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.lineWidth = 2 * k
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(cx - 13 * k, cy - 7 * k)
    ctx.lineTo(cx - 2 * k, cy - 17 * k)
    ctx.stroke()

    // 外轮廓：让冰晶从浅色冰面中清晰跳出来
    // 中浅冰蓝，不是深蓝 —— 冰晶的边是折射光，压太深就成了塑料块的轮廓。
    // 真正拉开对比的是上面那层近白的冰体和白色高光。
    diamondPath(ctx, cx, cy, size, radius)
    ctx.strokeStyle = 'rgba(96, 170, 212, 0.88)'
    ctx.lineWidth = 2.4 * k
    ctx.stroke()

    // 气泡与冰晶闪光
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.beginPath()
    ctx.arc(cx + 4 * k, cy + 7 * k, 2 * k, 0, Math.PI * 2)
    ctx.arc(cx - 5 * k, cy + 12 * k, 1.4 * k, 0, Math.PI * 2)
    ctx.fill()
    drawSnowflake(ctx, cx + 8 * k, cy - 9 * k, 4.5 * k, 'rgba(255, 255, 255, 0.85)', 1.1 * k)

    // 已在目标位置：薄荷绿光晕 + 对勾
    if (this.inTarget) {
      ctx.save()
      ctx.strokeStyle = 'rgba(47, 191, 155, 0.85)'
      ctx.lineWidth = 2.4 * k
      diamondPath(ctx, cx, cy, size + 7 * k, radius + 2 * k)
      ctx.stroke()

      // 深色描边打底，避免对勾和浅色冰面糊在一起
      ctx.strokeStyle = 'rgba(16, 110, 86, 0.9)'
      ctx.lineWidth = 4 * k
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(cx - 7 * k, cy + 1 * k)
      ctx.lineTo(cx - 2 * k, cy + 6 * k)
      ctx.lineTo(cx + 7 * k, cy - 5 * k)
      ctx.stroke()

      ctx.strokeStyle = COLORS.white
      ctx.lineWidth = 2.5 * k
      ctx.beginPath()
      ctx.moveTo(cx - 7 * k, cy + 1 * k)
      ctx.lineTo(cx - 2 * k, cy + 6 * k)
      ctx.lineTo(cx + 7 * k, cy - 5 * k)
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
