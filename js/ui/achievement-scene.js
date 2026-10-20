/**
 * 成就展示场景
 * 显示所有成就和解锁状态
 */
import Button from './button'

export default class AchievementScene {
  constructor(achievementManager, onClose) {
    this.achievementManager = achievementManager
    this.onClose = onClose
    this.isVisible = false

    // 分页
    this.currentPage = 0
    this.itemsPerPage = 6
    this.totalPages = 0

    // 滚动
    this.scrollY = 0
    this.maxScroll = 0

    this.init()
  }

  init() {
    // 计算总页数
    const allAchievements = this.achievementManager.getAllAchievements()
    this.totalPages = Math.ceil(allAchievements.length / this.itemsPerPage)

    // 关闭按钮
    this.closeButton = new Button(
      canvas.width - 60,
      20,
      40,
      40,
      '✕',
      '#e74c3c',
      () => this.hide()
    )
  }

  /**
   * 显示
   */
  show() {
    this.isVisible = true
    this.currentPage = 0
    this.scrollY = 0
  }

  /**
   * 隐藏
   */
  hide() {
    this.isVisible = false
    if (this.onClose) {
      this.onClose()
    }
  }

  /**
   * 触摸开始
   */
  onTouchStart(e) {
    if (!this.isVisible) return

    const touch = e.touches[0]
    this.touchStartY = touch.clientY

    // 检查关闭按钮
    if (this.closeButton.contains(touch.clientX, touch.clientY)) {
      this.closeButton.onTouchStart()
    }
  }

  /**
   * 触摸移动（滚动）
   */
  onTouchMove(e) {
    if (!this.isVisible) return

    const touch = e.touches[0]
    const deltaY = this.touchStartY - touch.clientY
    this.touchStartY = touch.clientY

    this.scrollY += deltaY
    this.scrollY = Math.max(0, Math.min(this.scrollY, this.maxScroll))
  }

  /**
   * 触摸结束
   */
  onTouchEnd(e) {
    if (!this.isVisible) return

    const touch = e.changedTouches[0]
    this.closeButton.onTouchEnd(touch.clientX, touch.clientY)
  }

  /**
   * 更新
   */
  update() {
    if (!this.isVisible) return
  }

  /**
   * 渲染
   */
  render(ctx) {
    if (!this.isVisible) return

    // 半透明背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // 标题
    this.renderTitle(ctx)

    // 进度
    this.renderProgress(ctx)

    // 成就列表
    this.renderAchievements(ctx)

    // 关闭按钮
    this.closeButton.render(ctx)
  }

  /**
   * 渲染标题
   */
  renderTitle(ctx) {
    ctx.save()

    ctx.fillStyle = '#f1c40f'
    ctx.font = 'bold 28px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('成就系统', canvas.width / 2, 50)

    ctx.restore()
  }

  /**
   * 渲染进度
   */
  renderProgress(ctx) {
    const progress = this.achievementManager.getProgress()

    ctx.save()

    // 进度条背景
    const barX = 30
    const barY = 70
    const barWidth = canvas.width - 60
    const barHeight = 20

    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.beginPath()
    ctx.roundRect(barX, barY, barWidth, barHeight, 10)
    ctx.fill()

    // 进度条
    const progressWidth = (barWidth * progress.percentage) / 100
    ctx.fillStyle = '#f1c40f'
    ctx.beginPath()
    ctx.roundRect(barX, barY, progressWidth, barHeight, 10)
    ctx.fill()

    // 进度文字
    ctx.fillStyle = '#ffffff'
    ctx.font = '14px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(
      `${progress.unlocked} / ${progress.total} (${Math.floor(progress.percentage)}%)`,
      canvas.width / 2,
      barY + 15
    )

    ctx.restore()
  }

  /**
   * 渲染成就列表
   */
  renderAchievements(ctx) {
    const allAchievements = this.achievementManager.getAllAchievements()
    const startY = 110
    const itemHeight = 90

    // 计算最大滚动
    this.maxScroll = Math.max(0, allAchievements.length * itemHeight - (canvas.height - startY - 50))

    ctx.save()

    // 裁剪区域
    ctx.beginPath()
    ctx.rect(0, startY, canvas.width, canvas.height - startY - 50)
    ctx.clip()

    allAchievements.forEach((achievement, index) => {
      const y = startY + index * itemHeight - this.scrollY

      // 只渲染可见区域
      if (y + itemHeight < startY || y > canvas.height - 50) return

      this.renderAchievementItem(ctx, achievement, 20, y, canvas.width - 40, itemHeight - 10)
    })

    ctx.restore()
  }

  /**
   * 渲染单个成就项
   */
  renderAchievementItem(ctx, achievement, x, y, width, height) {
    ctx.save()

    // 背景
    const bgColor = achievement.unlocked ? 'rgba(46, 204, 113, 0.3)' : 'rgba(255, 255, 255, 0.1)'
    ctx.fillStyle = bgColor
    ctx.beginPath()
    ctx.roundRect(x, y, width, height, 10)
    ctx.fill()

    // 边框
    ctx.strokeStyle = achievement.unlocked ? '#2ecc71' : '#7f8c8d'
    ctx.lineWidth = 2
    ctx.stroke()

    // 图标
    ctx.font = '32px Arial'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(achievement.icon, x + 15, y + height / 2)

    // 名称
    ctx.fillStyle = achievement.unlocked ? '#ffffff' : '#95a5a6'
    ctx.font = 'bold 16px Arial'
    ctx.fillText(achievement.name, x + 60, y + 25)

    // 描述
    ctx.fillStyle = achievement.unlocked ? '#bdc3c7' : '#7f8c8d'
    ctx.font = '12px Arial'
    ctx.fillText(achievement.description, x + 60, y + 45)

    // 奖励
    const rewardText = this.formatReward(achievement.reward)
    ctx.fillStyle = '#f1c40f'
    ctx.font = '12px Arial'
    ctx.fillText(`奖励: ${rewardText}`, x + 60, y + 65)

    // 解锁状态
    if (achievement.unlocked) {
      ctx.fillStyle = '#2ecc71'
      ctx.font = 'bold 14px Arial'
      ctx.textAlign = 'right'
      ctx.fillText('✓ 已解锁', x + width - 15, y + height / 2)
    } else {
      ctx.fillStyle = '#7f8c8d'
      ctx.font = '14px Arial'
      ctx.textAlign = 'right'
      ctx.fillText('🔒', x + width - 15, y + height / 2)
    }

    ctx.restore()
  }

  /**
   * 格式化奖励
   */
  formatReward(reward) {
    const parts = []
    if (reward.fish) parts.push(`${reward.fish}🐟`)
    if (reward.shrimp) parts.push(`${reward.shrimp}🦐`)
    if (reward.squid) parts.push(`${reward.squid}🦑`)
    if (reward.goldfish) parts.push(`${reward.goldfish}🐠`)
    return parts.join(' ')
  }

  /**
   * 检查是否包含某点
   */
  contains(x, y) {
    return this.isVisible
  }
}
