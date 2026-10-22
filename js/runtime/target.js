import Sprite from '../base/sprite'
import {
  COLORS,
  roundRectPath
} from '../ui/theme'

// 与可推动冰块保持一致的配色：描边、冰体、底部厚度
const ICE_EDGE = 'rgba(64, 148, 196, 0.95)'
const ICE_FILL = '#A6D9F5'
const ICE_DEEP = '#63B2D8'
const ICE_GLOW = '64, 148, 196'

/**
 * 目标区域类
 * 冰块需要被推到的目标位置（海洋馆展台）
 * 视觉上是一圈会呼吸发光的水框 + 中间的小鱼提示
 */
export default class Target extends Sprite {
  constructor(config) {
    super(config.x, config.y, config.width || 50, config.height || 50)

    // 目标区域由若干格子组成，容纳所有需要送达的冰块
    this.cellSize = config.cellSize || 50
    this.cols = Math.max(1, Math.round(this.width / this.cellSize))
    this.rows = Math.max(1, Math.round(this.height / this.cellSize))

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
   * 检测冰块是否在目标内
   * @param {Object} stone - 冰块对象
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
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const centerX = this.x + col * this.cellSize + this.cellSize / 2
        const centerY = this.y + row * this.cellSize + this.cellSize / 2
        const pulse = (Math.sin(this.pulse + (row + col) * 0.5) + 1) / 2
        const scale = 1 + Math.sin(this.pulse + (row + col) * 0.5) * 0.025
        this.renderCell(ctx, centerX, centerY, pulse, scale)
      }
    }
  }

  /**
   * 绘制单个目标格
   */
  renderCell(ctx, centerX, centerY, pulse, scale) {
    const sizeScale = this.cellSize / 50

    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.scale(scale, scale)
    ctx.translate(-centerX, -centerY)

    // 柔和的水色光晕
    const glow = ctx.createRadialGradient(centerX, centerY, 3, centerX, centerY, this.cellSize * 0.8)
    glow.addColorStop(0, `rgba(${ICE_GLOW}, ${0.26 + pulse * 0.12})`)
    glow.addColorStop(1, `rgba(${ICE_GLOW}, 0)`)
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(centerX, centerY, this.cellSize * 0.8, 0, Math.PI * 2)
    ctx.fill()

    // 发光边缘：颜色与冰块描边一致
    ctx.save()
    ctx.shadowColor = `rgba(${ICE_GLOW}, 0.85)`
    ctx.shadowBlur = 6 + pulse * 8
    roundRectPath(ctx, centerX - 21 * sizeScale, centerY - 21 * sizeScale, 42 * sizeScale, 42 * sizeScale, 13 * sizeScale)
    ctx.strokeStyle = ICE_EDGE
    ctx.lineWidth = 2.4
    ctx.stroke()
    ctx.restore()

    // 内侧细白线，增加冰面质感
    roundRectPath(ctx, centerX - 17 * sizeScale, centerY - 17 * sizeScale, 34 * sizeScale, 34 * sizeScale, 10 * sizeScale)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)'
    ctx.lineWidth = 1.2
    ctx.stroke()

    // 中间的小鱼提示
    ctx.save()
    ctx.scale(sizeScale, sizeScale)
    drawFish(ctx, centerX / sizeScale, (centerY + 1) / sizeScale)
    ctx.restore()

    ctx.restore()
  }
}

/**
 * 绘制目标提示小鱼
 */
function drawFish(ctx, cx, cy) {
  ctx.save()
  ctx.translate(cx, cy)

  // 尾巴
  ctx.beginPath()
  ctx.moveTo(-6, 0)
  ctx.lineTo(-12, -5.5)
  ctx.quadraticCurveTo(-10.5, 0, -12, 5.5)
  ctx.closePath()
  ctx.fillStyle = ICE_FILL
  ctx.strokeStyle = ICE_EDGE
  ctx.lineWidth = 1.6
  ctx.fill()
  ctx.stroke()

  // 背鳍
  ctx.beginPath()
  ctx.moveTo(-1, -5.5)
  ctx.quadraticCurveTo(1.5, -9.5, 4.5, -6)
  ctx.closePath()
  ctx.fillStyle = ICE_DEEP
  ctx.fill()

  // 身体
  ctx.beginPath()
  ctx.ellipse(1, 0, 9.5, 6.2, 0, 0, Math.PI * 2)
  ctx.fillStyle = ICE_FILL
  ctx.fill()
  ctx.strokeStyle = ICE_EDGE
  ctx.lineWidth = 1.6
  ctx.stroke()

  // 肚皮高光
  ctx.beginPath()
  ctx.ellipse(1.5, 2, 6, 2.6, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
  ctx.fill()

  // 眼睛
  ctx.beginPath()
  ctx.arc(5.2, -1.6, 1.9, 0, Math.PI * 2)
  ctx.fillStyle = COLORS.white
  ctx.fill()
  ctx.beginPath()
  ctx.arc(5.6, -1.6, 1, 0, Math.PI * 2)
  ctx.fillStyle = COLORS.navyDeep
  ctx.fill()

  ctx.restore()
}
