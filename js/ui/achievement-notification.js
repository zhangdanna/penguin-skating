/**
 * 成就解锁通知（串行单条）
 *
 * 原来的实现把队列里的成就**同时**画出来（`y = 100 + index * 80`），
 * 一次通关解锁 3 个就会叠成三张卡片糊住结算面板；而且每条都走
 * `drawGlassPanel`，它内部是 3 层递进放大的半透明圆角矩形，
 * 3 条叠一起就是 9 层灰块互相穿插 —— 也就是玩家看到的"底部多层阴影"。
 *
 * 现在：
 *   - 队列里同一时刻只渲染**队首 1 条**，播完才轮到下一条；
 *   - 阴影压成单层柔光，不再叠层；
 *   - 通关场景不走这里（新解锁成就画在结算面板内部，见 result-scene.js），
 *     本组件只服务复活等非结算场景。
 */
import { COLORS, fillRoundRect, font, roundRectPath } from './theme'
import { viewport } from '../env'

/** 滑入 / 停留 / 上滑淡出（毫秒） */
const IN_MS = 240
const HOLD_MS = 1500
const OUT_MS = 260
/** 按 60fps 估算的单帧时长：update() 由渲染循环逐帧驱动，不依赖 Date.now() */
const FRAME_MS = 1000 / 60
/** 队列上限：一次通关理论上不会超过这个数，多出来的直接丢弃，避免排队排到天荒地老 */
const MAX_QUEUE = 4

/** 卡片尺寸 */
const CARD = {
  width: 248,
  height: 46,
  radius: 23,
  iconRadius: 15,
  /** 卡片顶距屏幕顶的比例（顶部被 HUD 占着，往下挪一点更安全） */
  topRatio: 0.24
}

export default class AchievementNotification {
  constructor() {
    /** 待播队列，[0] 就是当前正在显示的那条 */
    this.notifications = []
  }

  /**
   * 加入队列
   * @param {Object} achievement
   */
  add(achievement) {
    if (!achievement) return

    // 同一条成就重复入队没有意义（多个 record* 入口都会触发 checkAchievements）
    if (this.notifications.some(item => item.achievement.id === achievement.id)) {
      return
    }

    this.notifications.push({ achievement, elapsed: 0 })

    // 只保留最近几条，超出直接丢掉最早排队的那条
    while (this.notifications.length > MAX_QUEUE) {
      this.notifications.shift()
    }
  }

  /**
   * 逐帧推进当前这一条的生命周期
   */
  update() {
    const head = this.notifications[0]
    if (!head) return

    head.elapsed += FRAME_MS

    if (head.elapsed >= IN_MS + HOLD_MS + OUT_MS) {
      this.notifications.shift()
    }
  }

  /**
   * 当前这一条的透明度与纵向偏移
   * @param {number} elapsed
   * @returns {{alpha:number, offsetY:number}}
   */
  getFrameState(elapsed) {
    if (elapsed < IN_MS) {
      // easeOutCubic：起步快、收尾软，像从上方轻轻落下来
      const p = elapsed / IN_MS
      const eased = 1 - Math.pow(1 - p, 3)
      return { alpha: eased, offsetY: -14 * (1 - eased) }
    }

    if (elapsed > IN_MS + HOLD_MS) {
      const p = Math.min(1, (elapsed - IN_MS - HOLD_MS) / OUT_MS)
      return { alpha: 1 - p, offsetY: -10 * p }
    }

    return { alpha: 1, offsetY: 0 }
  }

  /**
   * 渲染：只画队首一条
   */
  render(ctx) {
    const head = this.notifications[0]
    if (!head) return

    const { alpha, offsetY } = this.getFrameState(head.elapsed)
    if (alpha <= 0) return

    const vp = viewport()
    const width = CARD.width
    const height = CARD.height
    const x = Math.round((vp.width - width) / 2)
    const y = Math.round(vp.height * CARD.topRatio) + offsetY
    const achievement = head.achievement

    ctx.save()
    ctx.globalAlpha = alpha

    // 单层柔光：一层就够，叠多层会在卡片下沿堆出硬边
    fillRoundRect(
      ctx, x, y + 3, width, height, CARD.radius,
      'rgba(31, 58, 95, 0.12)'
    )

    // 奶油卡片
    fillRoundRect(ctx, x, y, width, height, CARD.radius, 'rgba(255, 249, 238, 0.97)')
    roundRectPath(ctx, x, y, width, height, CARD.radius)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.lineWidth = 2
    ctx.stroke()

    // 金色徽章 + 成就图标
    const iconX = x + 15 + CARD.iconRadius
    const iconY = y + height / 2
    ctx.beginPath()
    ctx.fillStyle = COLORS.yellow
    ctx.arc(iconX, iconY, CARD.iconRadius, 0, Math.PI * 2)
    ctx.fill()

    ctx.font = '16px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = COLORS.navy
    ctx.fillText(achievement.icon || '🏆', iconX, iconY)

    // 文案：上面一行小字标签，下面一行成就名
    const textX = iconX + CARD.iconRadius + 12
    ctx.textAlign = 'left'

    ctx.fillStyle = COLORS.yellowDeep
    ctx.font = font(11)
    ctx.fillText('成就解锁', textX, iconY - 8)

    ctx.fillStyle = COLORS.navy
    ctx.font = font(14)
    ctx.fillText(achievement.name, textX, iconY + 9)

    // 后面还有几条没播，给个提示，避免玩家以为只解锁了一个
    const rest = this.notifications.length - 1
    if (rest > 0) {
      ctx.textAlign = 'right'
      ctx.fillStyle = COLORS.navySoft
      ctx.font = font(11, 'normal')
      ctx.fillText(`+${rest}`, x + width - 16, iconY)
    }

    ctx.restore()
  }

  /**
   * 是否有通知
   */
  hasNotifications() {
    return this.notifications.length > 0
  }

  /**
   * 清除所有通知
   */
  clear() {
    this.notifications = []
  }
}
