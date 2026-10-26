/**
 * 食物显示组件
 * 显示在关卡页顶部，一行展示所有食物类型
 */
import { COLORS, font } from './theme'
import { viewport } from '../env'

export default class FoodDisplay {
  constructor(foodManager) {
    this.foodManager = foodManager
    this.isVisible = true
    this.x = 8
    this.y = 6
    this.width = viewport().width - 16

    // 动画
    this.animationTimer = 0
    this.showReward = false
    this.rewardText = ''
    this.rewardAlpha = 0
  }

  /**
   * 设置位置
   */
  setPosition(x, y) {
    this.x = x
    this.y = y
  }

  /**
   * 设置宽度
   */
  setSize(width) {
    this.width = width
  }

  /**
   * 显示/隐藏
   */
  setVisible(visible) {
    this.isVisible = visible
  }

  /**
   * 显示奖励动画
   */
  showRewardAnimation(rewards) {
    const parts = []
    if (rewards.fish > 0) parts.push(`+${rewards.fish}🐟`)
    if (rewards.shrimp > 0) parts.push(`+${rewards.shrimp}🦐`)
    if (rewards.squid > 0) parts.push(`+${rewards.squid}🦑`)
    if (rewards.goldfish > 0) parts.push(`+${rewards.goldfish}🐠`)

    this.rewardText = parts.join(' ')
    // 食物已满时可能一个都没发出去，别弹一条空飘字
    if (!this.rewardText) return
    this.showReward = true
    this.rewardAlpha = 1
    this.animationTimer = 0
  }

  /**
   * 更新
   */
  update() {
    // 更新恢复时间
    this.foodManager.checkRecovery()

    // 更新奖励动画
    if (this.showReward) {
      this.animationTimer++
      if (this.animationTimer > 60) {
        this.rewardAlpha -= 0.02
        if (this.rewardAlpha <= 0) {
          this.showReward = false
        }
      }
    }
  }

  /**
   * 渲染
   */
  render(ctx) {
    if (!this.isVisible) return

    const status = this.foodManager.getFoodStatus()

    this.renderFoodIcons(ctx, status)

    if (this.showReward) {
      this.renderRewardAnimation(ctx)
    }
  }

  /**
   * 一行展示所有食物（图标 + 数量）
   */
  renderFoodIcons(ctx, status) {
    const foods = [
      { icon: '🐟', count: status.food.fish },
      { icon: '🦐', count: status.food.shrimp },
      { icon: '🦑', count: status.food.squid },
      { icon: '🐠', count: status.food.goldfish }
    ]

    const cellWidth = this.width / foods.length
    const iconY = this.y + 23

    ctx.save()
    ctx.textBaseline = 'middle'

    foods.forEach((food, index) => {
      const cellCenterX = this.x + cellWidth * (index + 0.5)
      const countText = `×${food.count}`

      ctx.font = font(14)
      const countWidth = ctx.measureText(countText).width
      const iconWidth = 17
      const gap = 4
      const startX = cellCenterX - (iconWidth + gap + countWidth) / 2

      // 图标
      ctx.font = '17px Arial'
      ctx.textAlign = 'left'
      ctx.fillStyle = COLORS.navy
      ctx.fillText(food.icon, startX, iconY)

      // 数量
      ctx.font = font(14)
      ctx.fillStyle = COLORS.navySoft
      ctx.fillText(countText, startX + iconWidth + gap, iconY)
    })

    ctx.restore()
  }

  /**
   * 绘制奖励动画
   */
  renderRewardAnimation(ctx) {
    ctx.save()

    const centerX = viewport().width / 2
    // 奖励飘字原来固定在第 210 行，面板下移后跟着一起下移
    const centerY = 210 + (this.y - 6) - this.animationTimer * 0.5

    ctx.globalAlpha = this.rewardAlpha
    ctx.fillStyle = '#f1c40f'
    ctx.font = 'bold 20px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // 文字阴影：D7 改用一次偏移描边替代 shadowBlur（每帧一次模糊不划算）
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
    ctx.fillText(this.rewardText, centerX, centerY + 1.5)
    ctx.fillStyle = '#f1c40f'
    ctx.fillText(this.rewardText, centerX, centerY)

    ctx.restore()
  }
}
