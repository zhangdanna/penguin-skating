/**
 * 成就展示场景
 * 显示所有成就和解锁状态
 */
import Button from './button'
import {
  COLORS,
  drawGlassPanel,
  drawOverlay,
  drawStickerText,
  fillRoundRect,
  font,
  roundRectPath
} from './theme'

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
    this.closeButton = new Button({
      x: canvas.width - 60,
      y: 20,
      width: 40,
      height: 40,
      text: '✕',
      fontSize: 16,
      bgColor: COLORS.coral,
      hoverColor: '#E85F4F',
      borderColor: '#C94A3C',
      onClick: () => this.hide()
    })
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
   * 场景进入
   */
  onEnter() {
    this.show()
  }

  /**
   * 场景退出
   */
  onExit() {
    this.isVisible = false
  }

  /**
   * 触摸开始
   */
  onTouchStart(e) {
    if (!this.isVisible) return

    const touch = e.touches ? e.touches[0] : e
    this.touchStartY = touch.clientY

    // 检查关闭按钮
    this.closeButton.onTouchStart(touch)
  }

  /**
   * 触摸移动（滚动）
   */
  onTouchMove(e) {
    if (!this.isVisible) return

    const touch = e.touches ? e.touches[0] : e
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

    const touch = e.changedTouches ? e.changedTouches[0] : e
    this.closeButton.onTouchEnd(touch)
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

    // 遮罩 + 奶油面板
    drawOverlay(ctx, 0.55)
    drawGlassPanel(ctx, 16, 10, canvas.width - 32, canvas.height - 20, 28, {
      fill: 'rgba(255, 252, 246, 0.96)'
    })

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
    drawStickerText(ctx, '成就系统', canvas.width / 2, 46, {
      size: 26,
      color: COLORS.lavenderDeep,
      stroke: COLORS.white,
      strokeWidth: 4
    })
  }

  /**
   * 渲染进度
   */
  renderProgress(ctx) {
    const progress = this.achievementManager.getProgress()

    // 进度条背景
    const barX = 30
    const barY = 66
    const barWidth = canvas.width - 60
    const barHeight = 18

    fillRoundRect(ctx, barX, barY, barWidth, barHeight, 9, 'rgba(31, 58, 95, 0.1)')

    // 进度条
    const progressWidth = (barWidth * progress.percentage) / 100
    if (progressWidth > 0) {
      fillRoundRect(ctx, barX, barY, Math.max(progressWidth, 12), barHeight, 9, COLORS.mint)
    }

    // 进度文字
    ctx.fillStyle = COLORS.navy
    ctx.font = font(12)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(
      `${progress.unlocked} / ${progress.total} (${Math.floor(progress.percentage)}%)`,
      canvas.width / 2,
      barY + 34
    )
  }

  /**
   * 渲染成就列表
   */
  renderAchievements(ctx) {
    const allAchievements = this.achievementManager.getAllAchievements()
    const startY = 112
    const itemHeight = 90

    // 计算最大滚动
    this.maxScroll = Math.max(0, allAchievements.length * itemHeight - (canvas.height - startY - 50))

    ctx.save()

    // 裁剪区域
    ctx.beginPath()
    ctx.rect(0, startY, canvas.width, canvas.height - startY - 24)
    ctx.clip()

    allAchievements.forEach((achievement, index) => {
      const y = startY + index * itemHeight - this.scrollY

      // 只渲染可见区域
      if (y + itemHeight < startY || y > canvas.height - 24) return

      this.renderAchievementItem(ctx, achievement, 26, y, canvas.width - 52, itemHeight - 10)
    })

    ctx.restore()
  }

  /**
   * 渲染单个成就项
   */
  renderAchievementItem(ctx, achievement, x, y, width, height) {
    // 卡片
    fillRoundRect(
      ctx,
      x,
      y,
      width,
      height,
      achievement.unlocked ? 16 : 14,
      achievement.unlocked ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.55)'
    )

    // 边框
    roundRectPath(ctx, x, y, width, height, achievement.unlocked ? 16 : 14)
    ctx.strokeStyle = achievement.unlocked ? COLORS.mint : 'rgba(31, 58, 95, 0.12)'
    ctx.lineWidth = achievement.unlocked ? 2 : 1.5
    ctx.stroke()

    // 图标
    ctx.font = '30px Arial'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(achievement.icon, x + 14, y + height / 2)

    // 名称
    ctx.fillStyle = achievement.unlocked ? COLORS.navy : COLORS.navySoft
    ctx.font = font(15)
    ctx.fillText(achievement.name, x + 58, y + 24)

    // 描述
    ctx.fillStyle = COLORS.navySoft
    ctx.font = font(12, 'normal')
    ctx.fillText(achievement.description, x + 58, y + 46)

    // 奖励
    const rewardText = this.formatReward(achievement.reward)
    ctx.fillStyle = COLORS.yellowDeep
    ctx.font = font(12)
    ctx.fillText(`奖励: ${rewardText}`, x + 58, y + 67)

    // 解锁状态
    if (achievement.unlocked) {
      ctx.fillStyle = COLORS.mintDeep
      ctx.font = font(13)
      ctx.textAlign = 'right'
      ctx.fillText('✓ 已解锁', x + width - 14, y + height / 2)
    } else {
      ctx.fillStyle = 'rgba(31, 58, 95, 0.35)'
      ctx.font = '14px Arial'
      ctx.textAlign = 'right'
      ctx.fillText('🔒', x + width - 14, y + height / 2)
    }
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
