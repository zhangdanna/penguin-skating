/**
 * 成就解锁通知组件
 * 在屏幕上显示新解锁的成就
 */
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
    const x = canvas.width / 2
    const y = notification.y + index * 80

    ctx.save()

    ctx.globalAlpha = notification.alpha

    // 背景
    const gradient = ctx.createLinearGradient(x - 120, y, x + 120, y)
    gradient.addColorStop(0, 'rgba(241, 196, 15, 0)')
    gradient.addColorStop(0.5, 'rgba(241, 196, 15, 0.8)')
    gradient.addColorStop(1, 'rgba(241, 196, 15, 0)')

    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.roundRect(x - 120, y - 25, 240, 50, 25)
    ctx.fill()

    // 图标
    ctx.font = '24px Arial'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(achievement.icon, x - 100, y)

    // 文字
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 14px Arial'
    ctx.fillText('成就解锁!', x - 65, y - 8)

    ctx.font = '12px Arial'
    ctx.fillText(achievement.name, x - 65, y + 10)

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
