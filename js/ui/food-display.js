/**
 * 食物显示组件
 * 在界面上显示当前食物数量和恢复时间
 */
export default class FoodDisplay {
  constructor(foodManager) {
    this.foodManager = foodManager
    this.isVisible = true
    this.x = 10
    this.y = 10
    this.width = 150
    this.height = 60

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

    // 绘制背景
    this.renderBackground(ctx)

    // 绘制食物图标和数量
    this.renderFoodIcons(ctx, status)

    // 绘制恢复时间
    this.renderRecoveryTime(ctx, status)

    // 绘制奖励动画
    if (this.showReward) {
      this.renderRewardAnimation(ctx)
    }
  }

  /**
   * 绘制背景
   */
  renderBackground(ctx) {
    ctx.save()

    // 半透明背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.beginPath()
    ctx.roundRect(this.x, this.y, this.width, this.height, 10)
    ctx.fill()

    // 边框
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.restore()
  }

  /**
   * 绘制食物图标和数量
   */
  renderFoodIcons(ctx, status) {
    ctx.save()

    const iconY = this.y + 20
    let iconX = this.x + 15

    // 绘制各种食物
    const foods = [
      { type: 'fish', icon: '🐟', count: status.food.fish },
      { type: 'shrimp', icon: '🦐', count: status.food.shrimp },
      { type: 'squid', icon: '🦑', count: status.food.squid },
      { type: 'goldfish', icon: '🐠', count: status.food.goldfish }
    ]

    foods.forEach(food => {
      if (food.count > 0) {
        // 绘制图标
        ctx.font = '16px Arial'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(food.icon, iconX, iconY)

        // 绘制数量
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 12px Arial'
        ctx.fillText(`×${food.count}`, iconX + 20, iconY)

        iconX += 50
      }
    })

    // 绘制总价值
    ctx.fillStyle = '#f1c40f'
    ctx.font = 'bold 14px Arial'
    ctx.textAlign = 'left'
    ctx.fillText(`总计: ${status.total}`, this.x + 15, this.y + 45)

    ctx.restore()
  }

  /**
   * 绘制恢复时间
   */
  renderRecoveryTime(ctx, status) {
    if (status.total >= status.max) return

    ctx.save()

    const seconds = status.nextRecovery
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    const timeText = `${minutes}:${secs.toString().padStart(2, '0')}`

    ctx.fillStyle = '#2ecc71'
    ctx.font = '12px Arial'
    ctx.textAlign = 'right'
    ctx.fillText(`+1🐟 ${timeText}`, this.x + this.width - 10, this.y + 45)

    ctx.restore()
  }

  /**
   * 绘制奖励动画
   */
  renderRewardAnimation(ctx) {
    ctx.save()

    const centerX = this.x + this.width / 2
    const centerY = this.y - 30 - this.animationTimer * 0.5

    ctx.globalAlpha = this.rewardAlpha
    ctx.fillStyle = '#f1c40f'
    ctx.font = 'bold 20px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // 文字阴影
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
    ctx.shadowBlur = 5
    ctx.fillText(this.rewardText, centerX, centerY)

    ctx.restore()
  }

  /**
   * 检查是否包含某点
   */
  contains(x, y) {
    return x >= this.x && x <= this.x + this.width &&
           y >= this.y && y <= this.y + this.height
  }
}
