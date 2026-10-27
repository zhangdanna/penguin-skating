import Sprite from '../base/sprite'
import { COLORS, drawPenguin, drawStar } from '../ui/theme'

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
 * 情绪默认持续时间（毫秒），0 表示常驻到下一次切换
 *
 * happy 是一次性反馈，1.2 秒后自动回落到 idle；
 * sad 要一直挂到复活或重开，所以是 0。
 */
const MOOD_DURATION = {
  idle: 0,
  happy: 1200,
  sad: 0
}

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

    // 情绪：idle / happy / sad
    this.mood = 'idle'
    this.moodStartedAt = 0
    this.moodDuration = 0

    // 触摸记录
    this.touchStartX = null
    this.touchStartY = null
    this.swiped = false  // 本次手势是否构成有效滑动
    this.swipeDirection = null  // 锁定的滑动方向
  }

  /**
   * 切换情绪
   * @param {string} mood - idle / happy / sad
   * @param {number} [duration] - 持续毫秒数，0 表示常驻；不传则取默认值
   */
  setMood(mood, duration) {
    this.mood = mood || 'idle'
    this.moodStartedAt = Date.now()
    this.moodDuration = Number.isFinite(duration) ? duration : (MOOD_DURATION[this.mood] || 0)
  }

  /**
   * 当前情绪（到时自动回落到 idle）
   * @returns {string}
   */
  getMood() {
    if (this.moodDuration > 0 && Date.now() - this.moodStartedAt >= this.moodDuration) {
      this.mood = 'idle'
      this.moodDuration = 0
    }
    return this.mood
  }

  /**
   * 复位情绪（复活、重开时调用）
   */
  resetMood() {
    this.mood = 'idle'
    this.moodStartedAt = 0
    this.moodDuration = 0
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
   * 清空滑动状态（撤销 / 瞬移后调用，避免残留方向被下一帧当成新滑动）
   */
  resetSwipe() {
    this.touchStartX = null
    this.touchStartY = null
    this.swiped = false
    this.swipeDirection = null
    this.isMoving = false
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
    const mood = this.getMood()
    const now = Date.now() / 1000

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

    // 三套动作曲线：待机呼吸 / 开心蹦跳 / 难过发抖
    let bob = 0
    let angle = 0
    if (mood === 'happy') {
      const hop = Math.abs(Math.sin(now * 6.5))
      bob = -hop * 5
      angle = Math.sin(now * 6.5) * 0.05
    } else if (mood === 'sad') {
      bob = 1.5 + Math.sin(now * 1.2) * 0.6
      angle = Math.sin(now * 16) * 0.015
    } else if (this.isMoving) {
      bob = 0
    } else {
      bob = Math.sin(now * 2.2) * 1.5
      angle = Math.sin(now * 1.4) * 0.02
    }

    // 企鹅按格子尺寸等比缩放（50px 格子时为原始大小）
    const scale = this.width / 50
    drawPenguin(ctx, centerX, centerY + bob, scale, {
      direction: this.direction,
      mood,
      angle
    })

    // 推冰成功：绕着企鹅转三颗小星星
    if (mood === 'happy') {
      for (let i = 0; i < 3; i++) {
        const a = now * 2.4 + (i * Math.PI * 2) / 3
        const r = (24 + Math.sin(now * 3 + i) * 4) * scale
        const size = (2.4 + Math.sin(now * 5 + i * 2) * 0.7) * scale
        drawStar(
          ctx,
          centerX + Math.cos(a) * r,
          centerY + bob + Math.sin(a) * r * 0.7 - 12 * scale,
          size,
          COLORS.yellow
        )
      }
    }
  }
}
