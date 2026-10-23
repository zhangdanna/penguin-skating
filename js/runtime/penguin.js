import Sprite from '../base/sprite'
import { drawPenguin } from '../ui/theme'

/**
 * 滑动判定阈值（px，逻辑像素）
 *
 * 原来只有 10px，手指按住时的轻微抖动（尤其是单手滑屏拇指落点）
 * 就会被当成一次滑动，导致「想点暂停却推了一步」。
 * 24px 大致相当于一个指尖的抖动范围，同时仍明显小于一格（42~56px），
 * 滑一格不需要刻意拉长距离。
 */
const SWIPE_THRESHOLD = 24

/**
 * 企鹅类
 * 玩家控制的角色，按格移动
 */
export default class Penguin extends Sprite {
  constructor(config) {
    super(config.x, config.y, config.size || 40, config.size || 40)

    // 状态
    this.isMoving = false
    this.direction = 'down'  // up, down, left, right

    // 触摸记录
    this.touchStartX = null
    this.touchStartY = null
    this.swiped = false  // 本次手势是否构成有效滑动
    this.swipeDirection = null  // 锁定的滑动方向
  }

  /**
   * 处理触摸开始
   * @param {Object} touch - 触摸事件 {clientX, clientY}
   */
  handleTouchStart(touch) {
    this.touchStartX = touch.clientX
    this.touchStartY = touch.clientY
    this.swiped = false
    this.swipeDirection = null
  }

  /**
   * 处理触摸移动
   * @param {Object} touch - 触摸事件 {clientX, clientY}
   */
  handleTouchMove(touch) {
    if (this.touchStartX === null) return

    // 方向一旦确定就锁定：手指划出去再轻微回摆不该把方向改掉
    if (this.swiped) return

    const dx = touch.clientX - this.touchStartX
    const dy = touch.clientY - this.touchStartY
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance >= SWIPE_THRESHOLD) {
      this.swipeDirection = this.getDirection(Math.atan2(dy, dx))
      this.direction = this.swipeDirection
      this.swiped = true
    }
  }

  /**
   * 处理触摸结束
   * @returns {string|null} 本次滑动的方向，未构成滑动则返回null
   */
  handleTouchEnd() {
    const direction = this.swiped ? this.swipeDirection : null
    this.touchStartX = null
    this.touchStartY = null
    this.swiped = false
    this.swipeDirection = null
    return direction
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
   * 更新移动动画
   */
  update() {
    this.updateTween()
  }

  /**
   * 渲染企鹅
   * @param {CanvasRenderingContext2D} ctx - 画布上下文
   */
  render(ctx) {
    const centerX = this.x + this.width / 2
    const centerY = this.y + this.height / 2
    // 待机时轻微上下浮动
    const bob = this.isMoving ? 0 : Math.sin(Date.now() * 0.005) * 1.2

    // 滑行时的霜迹
    if (this.isMoving) {
      const trail = {
        up: [0, 1],
        down: [0, -1],
        left: [1, 0],
        right: [-1, 0]
      }[this.direction] || [0, 1]

      ctx.save()
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)'
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath()
        ctx.arc(
          centerX + trail[0] * (18 + i * 7),
          centerY + trail[1] * (18 + i * 7),
          3.5 - i * 0.7,
          0,
          Math.PI * 2
        )
        ctx.fill()
      }
      ctx.restore()
    }

    // 企鹅按格子尺寸等比缩放（50px 格子时为原始大小）
    drawPenguin(ctx, centerX, centerY + bob, this.width / 50, { direction: this.direction })
  }
}
