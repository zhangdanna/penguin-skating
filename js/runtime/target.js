import Sprite from '../base/sprite'

/**
 * 目标区域类
 * 石头需要被推到的目标位置
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
    ctx.save()

    const centerX = this.x + this.width / 2
    const centerY = this.y + this.height / 2

    // 脉冲效果
    const alpha = 0.3 + Math.sin(this.pulse) * 0.2
    const scale = 1 + Math.sin(this.pulse) * 0.05

    ctx.translate(centerX, centerY)
    ctx.scale(scale, scale)
    ctx.translate(-centerX, -centerY)

    // 绘制外圈光晕
    ctx.fillStyle = `rgba(46, 204, 113, ${alpha})`
    ctx.beginPath()
    ctx.arc(centerX, centerY, this.width / 2 + 5, 0, Math.PI * 2)
    ctx.fill()

    // 绘制目标区域
    ctx.fillStyle = 'rgba(46, 204, 113, 0.5)'
    ctx.fillRect(this.x, this.y, this.width, this.height)

    // 绘制边框
    ctx.strokeStyle = '#27ae60'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.strokeRect(this.x, this.y, this.width, this.height)
    ctx.setLineDash([])

    // 绘制中心标记
    ctx.fillStyle = '#27ae60'
    ctx.beginPath()
    ctx.arc(centerX, centerY, 5, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }
}
