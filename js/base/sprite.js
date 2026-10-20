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
}
