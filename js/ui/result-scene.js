import Button from './button'
import {
  COLORS,
  drawCandyButton,
  drawGlassPanel,
  drawOverlay,
  drawStar,
  drawStickerText,
  fillRoundRect,
  font
} from './theme'
import { CENTER_X, DESIGN_WIDTH, stage } from './layout'
import { calcStars } from '../utils/score'

/**
 * 结算场景
 * 显示通关结果和星级评价
 */
export default class ResultScene {
  constructor(sceneManager) {
    this.sceneManager = sceneManager
    this.buttons = []
    this.isVisible = false

    // 结果数据
    this.level = 1
    this.moves = 0
    this.par = 3
    this.time = 0
    this.stars = 0

    // 奖励数据
    this.rewards = null
    this.rewardMeta = {}

    // 本次通关新解锁的成就（画在按钮下方的空白区，不再叠浮层通知）
    this.achievements = []
    this.achievementOverflow = 0

    // 动画参数
    this.titleScale = 0
    this.starScales = [0, 0, 0]
    // 每颗星"亮起的那一帧"只回调一次，供音频层给一声叮
    this.starRevealed = [false, false, false]
    this.onStarReveal = null

    this.init()
  }

  init() {
    this.buttons = []
    const centerX = CENTER_X
    const buttonWidth = 138
    const buttonHeight = 50
    const startY = 452

    // 下一关按钮
    this.buttons.push(new Button({
      x: centerX - buttonWidth - 8,
      y: startY,
      width: buttonWidth,
      height: buttonHeight,
      text: '下一关',
      fontSize: 20,
      bgColor: COLORS.mint,
      hoverColor: COLORS.mintDeep,
      borderColor: '#17876C',
      onClick: () => {
        if (this.onNextLevel) {
          this.onNextLevel()
        }
      }
    }))

    // 重玩按钮
    this.buttons.push(new Button({
      x: centerX + 8,
      y: startY,
      width: buttonWidth,
      height: buttonHeight,
      text: '重玩',
      fontSize: 20,
      bgColor: COLORS.water,
      hoverColor: COLORS.waterDeep,
      borderColor: '#1F7FAE',
      onClick: () => {
        if (this.onReplay) {
          this.onReplay()
        }
      }
    }))

  }

  /**
   * 窗口尺寸变化后重建按钮（C1/C2）
   * 注意：这里不能重置回调，否则 resize 后"下一关/重玩"会失效
   */
  relayout() {
    const onNext = this.onNextLevel
    const onReplay = this.onReplay
    this.init()
    this.onNextLevel = onNext
    this.onReplay = onReplay
  }

  /**
   * 设置结果数据
   */
  setResult(level, moves, par, time) {
    this.level = level
    this.moves = moves
    this.par = par
    this.time = time
    this.stars = this.calculateStars()
  }

  /**
   * 设置奖励数据
   *
   * 注意：`rewards` 必须是**实际入账**的数量（FoodManager.giveRewards 的返回值），
   * 不是 calculateRewards 算出来的理论值。食物接近上限时两者会不一样，
   * 拿理论值渲染会出现"结算页写 +5🐟、HUD 只多了 1🐟"的对不上问题。
   *
   * @param {Object} rewards - 实际入账 { fish, shrimp, squid, goldfish }
   * @param {Object} [meta] - { firstClear, firstThreeStar, requested }
   *        requested 是理论奖励，用于判断是否有奖励因食物已满被丢弃
   */
  setRewards(rewards, meta = {}) {
    this.rewards = rewards
    this.rewardMeta = meta || {}
  }

  /**
   * 设置本次通关新解锁的成就
   *
   * 通关时不再往屏幕上叠成就浮层（3 条一起弹会糊住标题、底部还叠出多层阴影），
   * 改成画在结算面板按钮下方的空白区，玩家一眼看完，也不影响按钮点击。
   *
   * @param {Array} list - AchievementManager.getNewUnlocked() 的结果
   */
  setAchievements(list) {
    const source = Array.isArray(list) ? list : []
    this.achievements = source
    // 面板底部最多排 3 行。超过 3 个时改排「2 条具体 + 1 行汇总」，
    // 不再往第 4 行塞 —— 那会顶穿面板底边（见 design-preview/result-achievements-3.png）
    this.achievementOverflow = Math.max(0, source.length - 3)
  }

  /**
   * 计算星级（口径见 js/utils/score.js，D2 统一）
   */
  calculateStars() {
    return calcStars(this.moves, this.par)
  }

  show() {
    this.isVisible = true
    this.titleScale = 0
    this.starScales = [0, 0, 0]
    this.starRevealed = [false, false, false]
  }

  hide() {
    this.isVisible = false
  }

  onEnter(data) {
    if (data) {
      this.setResult(data.level, data.moves, data.par, data.time)
    }
    this.show()
  }

  onExit() {
    this.isVisible = false
  }

  update() {
    if (!this.isVisible) return

    // 标题缩放动画
    if (this.titleScale < 1) {
      this.titleScale += 0.1
      if (this.titleScale > 1) this.titleScale = 1
    }

    // 星星依次出现动画
    for (let i = 0; i < 3; i++) {
      const delay = 0.3 + i * 0.2
      if (this.titleScale >= 1 && i < this.stars) {
        if (this.starScales[i] < 1) {
          this.starScales[i] += 0.15
          if (this.starScales[i] > 1) this.starScales[i] = 1

          // 亮起的那一帧回调一次（音频层据此给一声"叮"，音高逐颗升高）
          if (!this.starRevealed[i]) {
            this.starRevealed[i] = true
            if (this.onStarReveal) {
              try {
                this.onStarReveal(i)
              } catch (e) {
                console.warn('[Result] 星级音效回调失败:', e)
              }
            }
          }
        }
      }
    }
  }

  render(ctx) {
    if (!this.isVisible) return

    // 遮罩铺满真实屏幕
    drawOverlay(ctx, 0.6)

    // 面板与内容使用设计稿坐标
    const s = stage()
    ctx.save()
    s.apply(ctx)

    const centerX = CENTER_X

    drawGlassPanel(ctx, 30, 88, 315, 540, 30, {
      fill: 'rgba(255, 249, 238, 0.97)'
    })

    // 通关标题
    ctx.save()
    ctx.translate(centerX, 150)
    ctx.scale(this.titleScale, this.titleScale)
    drawStickerText(ctx, '通关成功', 0, 0, {
      size: 38,
      color: COLORS.mint,
      stroke: COLORS.navyDeep,
      strokeWidth: 6
    })
    ctx.restore()

    // 关卡徽章
    drawCandyButton(ctx, centerX - 56, 184, 112, 26, {
      color: COLORS.water,
      shadowColor: COLORS.waterDeep,
      radius: 13
    })
    drawStickerText(ctx, `关卡 ${this.level}`, centerX, 197, {
      size: 13,
      color: COLORS.white,
      strokeWidth: 2.5
    })

    // 星星评价
    this.renderStars(ctx)

    // 统计信息
    ctx.font = font(16)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = COLORS.navy
    ctx.fillText(`步数 ${this.moves} / 标准 ${this.par}`, centerX, 332)

    ctx.font = font(14, 'normal')
    ctx.fillStyle = COLORS.navySoft
    ctx.fillText(`用时 ${this.formatTime(this.time)}`, centerX, 360)

    // 渲染奖励
    if (this.rewards) {
      this.renderRewards(ctx)
    }

    // 渲染新解锁成就（按钮下方）
    this.renderAchievements(ctx)

    // 绘制按钮
    this.buttons.forEach(btn => btn.render(ctx))

    ctx.restore()
  }

  /**
   * 渲染本次通关新解锁的成就
   *
   * 位置在「下一关 / 重玩」按钮下方那块空白（设计稿 y 502~628），
   * 之前这块一直是空的，现在正好把成就收进来，不用再飘一层浮层。
   * 整组在空白区里垂直居中：只有 1 条时不会顶在按钮下沿、下面空一大片。
   */
  renderAchievements(ctx) {
    if (!this.achievements || this.achievements.length === 0) return

    const centerX = CENTER_X
    const width = 265
    const x = centerX - width / 2
    const itemHeight = 30
    const gap = 6

    // 超过 3 个时只排前 2 条，第 3 行换成汇总文案，保证总行数不超过 3
    const hasOverflow = this.achievementOverflow > 0
    const items = hasOverflow ? this.achievements.slice(0, 2) : this.achievements
    const rows = items.length + (hasOverflow ? 1 : 0)

    // 可用纵向区间：按钮底 502 往下留 4px，面板底 628 往上留 6px
    const areaTop = 506
    const areaBottom = 622
    const blockHeight = rows * itemHeight + (rows - 1) * gap
    const startY = Math.round(areaTop + Math.max(0, (areaBottom - areaTop - blockHeight) / 2))

    items.forEach((achievement, index) => {
      const y = startY + index * (itemHeight + gap)

      // 浅黄胶囊底：浅色半透明底配深色字，对比度才够
      fillRoundRect(ctx, x, y, width, itemHeight, itemHeight / 2, 'rgba(255, 201, 74, 0.18)')

      // 图标
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.font = '14px Arial'
      ctx.fillStyle = COLORS.navy
      ctx.fillText(achievement.icon || '🏆', x + 12, y + itemHeight / 2)

      // 名称
      ctx.fillStyle = COLORS.navy
      ctx.font = font(13)
      ctx.fillText(`成就解锁 · ${achievement.name}`, x + 34, y + itemHeight / 2)

      // 奖励
      const rewardText = this.formatAchievementReward(achievement.reward)
      if (rewardText) {
        ctx.textAlign = 'right'
        ctx.fillStyle = COLORS.yellowInk
        ctx.font = font(11)
        ctx.fillText(rewardText, x + width - 12, y + itemHeight / 2)
      }
    })

    // 汇总行：告诉玩家还有几个，否则会以为只解锁了这两条
    if (hasOverflow) {
      const y = startY + items.length * (itemHeight + gap)
      const restCount = this.achievements.length - items.length
      fillRoundRect(ctx, x, y, width, itemHeight, itemHeight / 2, 'rgba(31, 58, 95, 0.06)')

      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = COLORS.navySoft
      ctx.font = font(12, 'normal')
      ctx.fillText(`另有 ${restCount} 个成就已解锁，可在成就页查看`, centerX, y + itemHeight / 2)
    }
  }

  /**
   * 成就奖励文案，如「+3🐟」
   * @param {Object} reward
   * @returns {string}
   */
  formatAchievementReward(reward) {
    if (!reward) return ''
    const icons = { fish: '🐟', shrimp: '🦐', squid: '🦑', goldfish: '🐠' }
    return Object.keys(icons)
      .filter(key => reward[key] > 0)
      .map(key => `+${reward[key]}${icons[key]}`)
      .join(' ')
  }

  /**
   * 渲染奖励信息
   */
  renderRewards(ctx) {
    const centerX = CENTER_X
    const labelY = 392
    const pillY = 416

    const items = []
    if (this.rewards.fish > 0) items.push(`🐟×${this.rewards.fish}`)
    if (this.rewards.shrimp > 0) items.push(`🦐×${this.rewards.shrimp}`)
    if (this.rewards.squid > 0) items.push(`🦑×${this.rewards.squid}`)
    if (this.rewards.goldfish > 0) items.push(`🐠×${this.rewards.goldfish}`)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    if (items.length === 0) {
      ctx.font = font(13)
      ctx.fillStyle = COLORS.navySoft
      ctx.fillText('食物已满，本次奖励未入账', centerX, pillY)
      return
    }

    ctx.font = font(13)
    ctx.fillStyle = COLORS.yellowDeep
    ctx.fillText('获得奖励', centerX, labelY)

    const text = items.join('   ')
    ctx.font = font(15)
    const textWidth = ctx.measureText(text).width
    fillRoundRect(ctx, centerX - textWidth / 2 - 16, pillY - 14, textWidth + 32, 28, 14, 'rgba(47, 191, 155, 0.16)')
    ctx.fillStyle = COLORS.mintDeep
    ctx.fillText(text, centerX, pillY)

    // 首通 / 三星首通是一次性收益，单独标出来，避免玩家以为每次都能拿
    const meta = this.rewardMeta || {}
    const tags = []
    if (meta.firstClear) tags.push('首次通关')
    if (meta.firstThreeStar) tags.push('首次三星')

    // 食物接近上限时，奖励会被截断，必须明说，否则玩家会以为少给了
    const lost = this.getLostRewards()
    if (lost.length > 0) {
      tags.push(`食物已满，${lost.join('')} 未入账`)
    }

    if (tags.length === 0) return

    ctx.font = font(11)
    ctx.fillStyle = COLORS.navySoft
    ctx.fillText(tags.join(' · '), centerX, 440)
  }

  /**
   * 计算因食物上限被丢弃的奖励（理论值 - 实际入账）
   * @returns {string[]} 形如 ['🐟×2']
   */
  getLostRewards() {
    const requested = this.rewardMeta && this.rewardMeta.requested
    if (!requested || !this.rewards) return []

    const lost = []
    const icons = { fish: '🐟', shrimp: '🦐', squid: '🦑', goldfish: '🐠' }
    Object.keys(icons).forEach(key => {
      const diff = (requested[key] || 0) - (this.rewards[key] || 0)
      if (diff > 0) lost.push(`${icons[key]}×${diff}`)
    })
    return lost
  }

  renderStars(ctx) {
    const starSize = 36
    const spacing = 18
    const totalWidth = 3 * starSize + 2 * spacing
    const startX = (DESIGN_WIDTH - totalWidth) / 2
    const y = 264

    for (let i = 0; i < 3; i++) {
      const x = startX + i * (starSize + spacing) + starSize / 2

      ctx.save()
      ctx.translate(x, y)
      ctx.scale(this.starScales[i], this.starScales[i])

      if (i < this.stars) {
        drawStar(ctx, 0, 0, starSize / 2, COLORS.yellow, {
          stroke: COLORS.white,
          lineWidth: 2.5
        })
      } else {
        drawStar(ctx, 0, 0, starSize / 2, 'rgba(31, 58, 95, 0.14)', {
          stroke: 'rgba(255, 255, 255, 0.8)',
          lineWidth: 2
        })
      }

      ctx.restore()
    }
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  onTouchStart(touch) {
    if (!this.isVisible) return false

    const t = stage().unproject(touch)
    this.buttons.forEach(btn => btn.onTouchStart(t))
    return true
  }

  onTouchMove(touch) {
    if (!this.isVisible) return

    const t = stage().unproject(touch)
    this.buttons.forEach(btn => {
      btn.isHovered = btn.contains(t.clientX, t.clientY)
    })
  }

  onTouchEnd(touch) {
    if (!this.isVisible) return false

    const t = stage().unproject(touch)
    this.buttons.forEach(btn => btn.onTouchEnd(t))
    return true
  }
}
