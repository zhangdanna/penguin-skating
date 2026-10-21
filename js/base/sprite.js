/**
 * 精灵基类
 * 所有游戏对象的基础类，提供位置、尺寸、渲染和碰撞检测功能
 */
export default class Sprite {
  constructor(x, y, width, height) {
    this.x = x
    this.y = y
    this.width = width
    this.height = height
    this.visible = true
  }

  /**
   * AABB碰撞检测
   * @param {Sprite} other - 另一个精灵对象
   * @returns {boolean} 是否碰撞
   */
  collidesWith(other) {
    return this.x < other.x + other.width &&
           this.x + this.width > other.x &&
           this.y < other.y + other.height &&
           this.y + this.height > other.y
  }

  /**
   * 渲染方法（子类重写）
   * @param {CanvasRenderingContext2D} ctx - 画布上下文
   */
  render(ctx) {
    // 子类实现
  }

  /**
   * 更新方法（子类重写）
   */
  update() {
    // 子类实现
  }

  /**
   * 平移到目标位置（用于按格移动的补间动画）
   * @param {number} x - 目标x坐标
   * @param {number} y - 目标y坐标
   * @param {number} duration - 动画时长（毫秒）
   */
  moveTo(x, y, duration = 120) {
    this.moveFromX = this.x
    this.moveFromY = this.y
    this.moveToX = x
    this.moveToY = y
    this.moveStartTime = Date.now()
    this.moveDuration = duration
    this.isMoving = true
  }

  /**
   * 更新补间动画（由子类的update调用）
   */
  updateTween() {
    if (!this.isMoving) return

    const progress = Math.min(1, (Date.now() - this.moveStartTime) / this.moveDuration)
    // smoothstep缓动
    const eased = progress * progress * (3 - 2 * progress)

    this.x = this.moveFromX + (this.moveToX - this.moveFromX) * eased
    this.y = this.moveFromY + (this.moveToY - this.moveFromY) * eased

    if (progress >= 1) {
      this.x = this.moveToX
      this.y = this.moveToY
      this.isMoving = false
    }
  }
}
