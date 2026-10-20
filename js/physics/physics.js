/**
 * 物理引擎
 * 处理冰面滑行物理效果
 */

export default class Physics {
  constructor() {
    // 冰面摩擦系数（很小，模拟滑行）
    this.iceFriction = 0.98
    // 雪地摩擦系数
    this.snowFriction = 0.95
    // 最大速度
    this.maxSpeed = 8
    // 停止阈值
    this.stopThreshold = 0.1
  }

  /**
   * 应用摩擦力
   * @param {Object} obj - 物理对象 {vx, vy}
   * @param {number} friction - 摩擦系数
   */
  applyFriction(obj, friction = this.iceFriction) {
    obj.vx *= friction
    obj.vy *= friction
  }

  /**
   * 限制最大速度
   * @param {Object} obj - 物理对象 {vx, vy}
   * @param {number} maxSpeed - 最大速度
   */
  clampSpeed(obj, maxSpeed = this.maxSpeed) {
    const speed = Math.sqrt(obj.vx * obj.vx + obj.vy * obj.vy)
    if (speed > maxSpeed) {
      obj.vx = (obj.vx / speed) * maxSpeed
      obj.vy = (obj.vy / speed) * maxSpeed
    }
  }

  /**
   * 判断是否停止
   * @param {Object} obj - 物理对象 {vx, vy}
   * @returns {boolean} 是否停止
   */
  isStopped(obj) {
    return Math.abs(obj.vx) < this.stopThreshold &&
           Math.abs(obj.vy) < this.stopThreshold
  }

  /**
   * 更新位置
   * @param {Object} obj - 物理对象 {x, y, vx, vy}
   */
  updatePosition(obj) {
    obj.x += obj.vx
    obj.y += obj.vy
  }

  /**
   * 边界检测与反弹
   * @param {Object} obj - 物理对象 {x, y, vx, vy, width, height}
   * @param {number} canvasWidth - 画布宽度
   * @param {number} canvasHeight - 画布高度
   * @param {number} bounceFactor - 反弹系数
   */
  checkBounds(obj, canvasWidth, canvasHeight, bounceFactor = 0.5) {
    let bounced = false

    if (obj.x < 0) {
      obj.x = 0
      obj.vx = -obj.vx * bounceFactor
      bounced = true
    }
    if (obj.x + obj.width > canvasWidth) {
      obj.x = canvasWidth - obj.width
      obj.vx = -obj.vx * bounceFactor
      bounced = true
    }
    if (obj.y < 0) {
      obj.y = 0
      obj.vy = -obj.vy * bounceFactor
      bounced = true
    }
    if (obj.y + obj.height > canvasHeight) {
      obj.y = canvasHeight - obj.height
      obj.vy = -obj.vy * bounceFactor
      bounced = true
    }

    return bounced
  }
}
