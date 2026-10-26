/**
 * 成就解锁通知组件
 * 在屏幕上显示新解锁的成就
 */
import {
  COLORS,
  drawGlassPanel,
  drawStar,
  font
} from './theme'
import { viewport } from '../env'

export default class AchievementNotification {
  constructor() {
    this.notifications = []
    this.maxNotifications = 3
  }

  /**
   * 添加通知
   */
  add(achievement) {
    this.notifications.push({
      achievement,
      alpha: 1,
      y: 100,
      timer: 0,
      duration: 180 // 3秒
    })

    // 限制最大通知数
    if (this.notifications.length > this.maxNotifications) {
      this.notifications.shift()
    }
  }

  /**
   * 更新
   */
  update() {
    this.notifications.forEach(notification => {
      notification.timer++

      // 淡出效果
      if (notification.timer > notification.duration - 60) {
        notification.alpha -= 0.02
      }
    })

    // 移除完成的通知
    this.notifications = this.notifications.filter(n => n.alpha > 0)
  }

  /**
   * 渲染
   */
  render(ctx) {
    this.notifications.forEach((notification, index) => {
      this.renderNotification(ctx, notification, index)
    })
  }

  /**
   * 渲染单个通知
   */
  renderNotification(ctx, notification, index) {
    const achievement = notification.achievement
    const x = viewport().width / 2
    const y = notification.y + index * 80

    ctx.save()
    ctx.globalAlpha = notification.alpha

    // 奶油卡片
    drawGlassPanel(ctx, x - 130, y - 26, 260, 52, 26, {
      fill: 'rgba(255, 249, 238, 0.95)',
      shadow: 'rgba(31, 58, 95, 0.25)'
    })

    // 金色徽章
    ctx.beginPath()
    ctx.fillStyle = COLORS.yellow
    ctx.arc(x - 102, y, 17, 0, Math.PI * 2)
    ctx.fill()
    drawStar(ctx, x - 102, y, 10, 'rgba(255, 255, 255, 0.35)')

    // 成就图标
    ctx.font = '18px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(achievement.icon, x - 102, y)

    // 文字
    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.yellowDeep
    ctx.font = font(13)
    ctx.fillText('成就解锁!', x - 78, y - 9)

    ctx.fillStyle = COLORS.navy
    ctx.font = font(12, 'normal')
    ctx.fillText(achievement.name, x - 78, y + 9)

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
