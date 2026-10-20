import Sprite from '../base/sprite'
import Physics from '../physics/physics'

/**
 * 企鹅类
 * 玩家控制的角色，在冰面上滑行
 */
export default class Penguin extends Sprite {
  constructor(config) {
    super(config.x, config.y, 40, 40)

    // 物理属性
    this.vx = 0
    this.vy = 0
    this.physics = new Physics()

    // 状态
    this.isMoving = false
    this.direction = 'down'  // up, down, left, right

    // 触摸记录
    this.touchStartX = null
    this.touchStartY = null

    // 推动力
    this.pushForce = 5
  }

  /**
   * 处理触摸开始
   * @param {Object} touch - 触摸事件 {clientX, clientY}
   */
  handleTouchStart(touch) {
    this.touchStartX = touch.clientX
    this.touchStartY = touch.clientY
  }

  /**
   * 处理触摸移动
   * @param {Object} touch - 触摸事件 {clientX, clientY}
   */
  handleTouchMove(touch) {
    if (this.touchStartX === null) return

    const dx = touch.clientX - this.touchStartX
    const dy = touch.clientY - this.touchStartY
    const distance = Math.sqrt(dx * dx + dy * dy)

    // 滑动距离超过阈值才更新方向
    if (distance > 10) {
      const angle = Math.atan2(dy, dx)
      this.direction = this.getDirection(angle)
    }
  }

  /**
   * 处理触摸结束
   */
  handleTouchEnd() {
    this.applyForce()
    this.touchStartX = null
    this.touchStartY = null
  }

  /**
   * 根据角度获取方向
   * @param {number} angle - 弧度角度
   * @returns {string} 方向
   */
  getDirection(angle) {
    const deg = angle * 180 / Math.PI
    if (deg >= -45 && deg < 45) return 'right'
    if (deg >= 45 && deg < 135) return 'down'
    if (deg >= -135 && deg < -45) return 'up'
    return 'left'
  }

  /**
   * 施加推力
   */
  applyForce() {
    switch (this.direction) {
      case 'up':
        this.vy = -this.pushForce
        break
      case 'down':
        this.vy = this.pushForce
        break
      case 'left':
        this.vx = -this.pushForce
        break
      case 'right':
        this.vx = this.pushForce
        break
    }
    this.isMoving = true

    // 振动反馈
    if (typeof wx !== 'undefined') {
      wx.vibrateShort({ type: 'light' })
    }
  }

  /**
   * 更新物理状态
   */
  update() {
    if (!this.isMoving) return

    // 应用摩擦力
    this.physics.applyFriction(this)

    // 限制最大速度
    this.physics.clampSpeed(this)

    // 更新位置
    this.physics.updatePosition(this)

    // 边界检测
    this.physics.checkBounds(this, canvas.width, canvas.height)

    // 判断是否停止
    if (this.physics.isStopped(this)) {
      this.vx = 0
      this.vy = 0
      this.isMoving = false
    }
  }

  /**
   * 推动石头
   * @param {Object} stone - 石头对象
   */
  pushStone(stone) {
    // 计算推动方向
    const dx = stone.x - this.x
    const dy = stone.y - this.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance > 0) {
      // 传递50%的推力
      stone.vx += (dx / distance) * this.pushForce * 0.5
      stone.vy += (dy / distance) * this.pushForce * 0.5
    }

    // 振动反馈
    if (typeof wx !== 'undefined') {
      wx.vibrateShort({ type: 'medium' })
    }
  }

  /**
   * 渲染企鹅
   * @param {CanvasRenderingContext2D} ctx - 画布上下文
   */
  render(ctx) {
    ctx.save()

    // 绘制企鹅身体（简化版几何图形）
    const centerX = this.x + this.width / 2
    const centerY = this.y + this.height / 2

    // 身体（椭圆）
    ctx.fillStyle = '#2c3e50'
    ctx.beginPath()
    ctx.ellipse(centerX, centerY + 5, 15, 18, 0, 0, Math.PI * 2)
    ctx.fill()

    // 肚子（白色椭圆）
    ctx.fillStyle = '#ecf0f1'
    ctx.beginPath()
    ctx.ellipse(centerX, centerY + 8, 10, 13, 0, 0, Math.PI * 2)
    ctx.fill()

    // 头部（圆形）
    ctx.fillStyle = '#2c3e50'
    ctx.beginPath()
    ctx.arc(centerX, centerY - 10, 12, 0, Math.PI * 2)
    ctx.fill()

    // 眼睛
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(centerX - 4, centerY - 12, 3, 0, Math.PI * 2)
    ctx.arc(centerX + 4, centerY - 12, 3, 0, Math.PI * 2)
    ctx.fill()

    // 瞳孔（根据方向偏移）
    ctx.fillStyle = '#000000'
    const eyeOffset = this.getEyeOffset()
    ctx.beginPath()
    ctx.arc(centerX - 4 + eyeOffset.x, centerY - 12 + eyeOffset.y, 1.5, 0, Math.PI * 2)
    ctx.arc(centerX + 4 + eyeOffset.x, centerY - 12 + eyeOffset.y, 1.5, 0, Math.PI * 2)
    ctx.fill()

    // 嘴巴（三角形）
    ctx.fillStyle = '#e67e22'
    ctx.beginPath()
    ctx.moveTo(centerX, centerY - 8)
    ctx.lineTo(centerX - 3, centerY - 5)
    ctx.lineTo(centerX + 3, centerY - 5)
    ctx.closePath()
    ctx.fill()

    // 脚
    ctx.fillStyle = '#e67e22'
    ctx.beginPath()
    ctx.ellipse(centerX - 6, centerY + 20, 5, 3, 0, 0, Math.PI * 2)
    ctx.ellipse(centerX + 6, centerY + 20, 5, 3, 0, 0, Math.PI * 2)
    ctx.fill()

    // 翅膀
    ctx.fillStyle = '#34495e'
    ctx.beginPath()
    ctx.ellipse(centerX - 12, centerY + 5, 4, 10, -0.3, 0, Math.PI * 2)
    ctx.ellipse(centerX + 12, centerY + 5, 4, 10, 0.3, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }

  /**
   * 根据方向获取眼睛偏移
   * @returns {Object} 眼睛偏移 {x, y}
   */
  getEyeOffset() {
    switch (this.direction) {
      case 'up': return { x: 0, y: -1 }
      case 'down': return { x: 0, y: 1 }
      case 'left': return { x: -1, y: 0 }
      case 'right': return { x: 1, y: 0 }
      default: return { x: 0, y: 0 }
    }
  }
}
