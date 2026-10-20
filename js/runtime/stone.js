import Sprite from '../base/sprite'
import Physics from '../physics/physics'

/**
 * 石头类
 * 可被企鹅推动的物体
 */
export default class Stone extends Sprite {
  constructor(config) {
    super(config.x, config.y, config.size || 40, config.size || 40)

    // 物理属性
    this.vx = 0
    this.vy = 0
    this.physics = new Physics()

    // 石头摩擦系数比冰面大
    this.friction = 0.92

    // 状态
    this.isMoving = false
    this.inTarget = false  // 是否在目标位置
  }

  /**
   * 更新物理状态
   */
  update() {
    if (this.vx === 0 && this.vy === 0) {
      this.isMoving = false
      return
    }

    // 应用摩擦力（石头摩擦更大）
    this.physics.applyFriction(this, this.friction)

    // 限制最大速度
    this.physics.clampSpeed(this, 6)

    // 更新位置
    this.physics.updatePosition(this)

    // 边界检测（石头碰到边界停止，不反弹）
    this.checkBoundsStop()

    // 判断是否停止
    if (this.physics.isStopped(this)) {
      this.vx = 0
      this.vy = 0
      this.isMoving = false
    }
  }

  /**
   * 边界检测（碰到边界停止）
   */
  checkBoundsStop() {
    if (this.x < 0) {
      this.x = 0
      this.vx = 0
    }
    if (this.x + this.width > canvas.width) {
      this.x = canvas.width - this.width
      this.vx = 0
    }
    if (this.y < 0) {
      this.y = 0
      this.vy = 0
    }
    if (this.y + this.height > canvas.height) {
      this.y = canvas.height - this.height
      this.vy = 0
    }
  }

  /**
   * 渲染石头
   * @param {CanvasRenderingContext2D} ctx - 画布上下文
   */
  render(ctx) {
    ctx.save()

    const centerX = this.x + this.width / 2
    const centerY = this.y + this.height / 2

    // 绘制石头阴影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
    ctx.beginPath()
    ctx.ellipse(centerX + 2, centerY + this.height / 2 - 5, this.width / 2 - 2, 5, 0, 0, Math.PI * 2)
    ctx.fill()

    // 绘制石头主体（不规则形状）
    ctx.fillStyle = this.inTarget ? '#27ae60' : '#7f8c8d'
    ctx.beginPath()
    ctx.moveTo(centerX - 15, centerY - 5)
    ctx.lineTo(centerX - 10, centerY - 15)
    ctx.lineTo(centerX + 5, centerY - 18)
    ctx.lineTo(centerX + 15, centerY - 10)
    ctx.lineTo(centerX + 18, centerY + 5)
    ctx.lineTo(centerX + 10, centerY + 15)
    ctx.lineTo(centerX - 5, centerY + 18)
    ctx.lineTo(centerX - 18, centerY + 8)
    ctx.closePath()
    ctx.fill()

    // 绘制高光
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.beginPath()
    ctx.ellipse(centerX - 5, centerY - 8, 5, 3, -0.5, 0, Math.PI * 2)
    ctx.fill()

    // 如果在目标位置，绘制标记
    if (this.inTarget) {
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(centerX - 8, centerY)
      ctx.lineTo(centerX - 2, centerY + 6)
      ctx.lineTo(centerX + 8, centerY - 6)
      ctx.stroke()
    }

    ctx.restore()
  }
}
