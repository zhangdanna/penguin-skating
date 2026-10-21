import Button from './button'
import {
  COLORS,
  drawOceanBackdrop,
  drawStickerText,
  drawStar,
  drawGlassPanel,
  font
} from './theme'

/**
 * 关卡选择场景（浮冰徽章）
 */
export default class LevelSelectScene {
  constructor(sceneManager) {
    this.sceneManager = sceneManager
    this.buttons = []
    this.levels = []
    this.scrollY = 0
    this.maxScroll = 0

    this.init()
  }

  init() {
    // 返回按钮
    this.buttons.push(new Button({
      x: 18,
      y: 22,
      width: 76,
      height: 36,
      text: '返回',
      fontSize: 15,
      bgColor: COLORS.lavender,
      hoverColor: COLORS.lavenderDeep,
      borderColor: '#7255CC',
      onClick: () => {
        this.sceneManager.switchTo('menu')
      }
    }))

    // 加载关卡数据
    this.loadLevels()
  }

  loadLevels() {
    const maxLevel = 7  // 与 LevelManager 中的关卡总数保持一致
    const cols = 4
    const buttonSize = 60
    const padding = 20
    const startX = (canvas.width - (cols * buttonSize + (cols - 1) * padding)) / 2
    const startY = 100

    // 获取已解锁关卡
    const unlockedLevel = this.getUnlockedLevel()

    for (let i = 1; i <= maxLevel; i++) {
      const row = Math.floor((i - 1) / cols)
      const col = (i - 1) % cols
      const x = startX + col * (buttonSize + padding)
      const y = startY + row * (buttonSize + padding)

      const isUnlocked = i <= unlockedLevel
      const stars = this.getLevelStars(i)

      this.levels.push({
        id: i,
        x, y,
        width: buttonSize,
        height: buttonSize,
        isUnlocked,
        stars,
        isHovered: false
      })
    }

    // 计算最大滚动距离
    const totalRows = Math.ceil(maxLevel / cols)
    this.maxScroll = Math.max(0, totalRows * (buttonSize + padding) + startY - canvas.height + 50)
  }

  getUnlockedLevel() {
    try {
      const data = wx.getStorageSync('gameProgress')
      return data ? data.unlockedLevel || 1 : 1
    } catch (e) {
      return 1
    }
  }

  getLevelStars(levelId) {
    try {
      const data = wx.getStorageSync(`level_${levelId}`)
      return data ? data.stars || 0 : 0
    } catch (e) {
      return 0
    }
  }

  onEnter() {
    this.scrollY = 0
  }

  onExit() {
    // 清理
  }

  update() {
    // 可以在这里添加动画效果
  }

  render(ctx) {
    // 海洋馆背景
    drawOceanBackdrop(ctx, Date.now() / 1000)

    // 标题
    this.renderTitle(ctx)

    // 返回按钮
    this.buttons[0].render(ctx)

    // 关卡浮冰徽章
    ctx.save()
    ctx.translate(0, -this.scrollY)

    this.levels.forEach(level => {
      this.renderLevel(ctx, level)
    })

    ctx.restore()
  }

  renderTitle(ctx) {
    drawGlassPanel(ctx, 97, 22, 180, 46, 23, {
      fill: 'rgba(255, 255, 255, 0.86)'
    })
    drawStickerText(ctx, '选择关卡', canvas.width / 2, 46, {
      size: 22,
      color: COLORS.navy,
      strokeWidth: 0
    })
  }

  renderLevel(ctx, level) {
    const { x, y, width, isUnlocked, stars, isHovered } = level
    const centerX = x + width / 2
    const centerY = y + 24
    const radius = 22

    ctx.save()

    // 徽章投影
    ctx.fillStyle = 'rgba(31, 58, 95, 0.16)'
    ctx.beginPath()
    ctx.ellipse(centerX, y + 47, 20, 5, 0, 0, Math.PI * 2)
    ctx.fill()

    // 浮冰徽章
    if (isUnlocked) {
      const ice = ctx.createLinearGradient(centerX, centerY - radius, centerX, centerY + radius)
      ice.addColorStop(0, '#F2FDFF')
      ice.addColorStop(0.5, '#BEEBFF')
      ice.addColorStop(1, COLORS.iceDeep)
      ctx.fillStyle = ice
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.38)'
    }
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    ctx.fill()

    // 冰面高光
    if (isUnlocked) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius - 4, Math.PI * 1.1, Math.PI * 1.85)
      ctx.stroke()
    }

    // 边框（悬停高亮）
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    ctx.strokeStyle = isHovered ? COLORS.yellow : 'rgba(255, 255, 255, 0.9)'
    ctx.lineWidth = isHovered ? 3 : 2.5
    ctx.stroke()

    // 关卡编号 / 锁
    if (isUnlocked) {
      drawStickerText(ctx, level.id.toString(), centerX, centerY + 1, {
        size: 22,
        color: COLORS.navy,
        strokeWidth: 0
      })
    } else {
      ctx.font = font(18)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(31, 58, 95, 0.45)'
      ctx.fillText('🔒', centerX, centerY)
    }

    // 星级
    if (isUnlocked && stars > 0) {
      this.renderStars(ctx, x, y + 53, stars)
    }

    ctx.restore()
  }

  renderStars(ctx, x, y, count) {
    const starSize = 9
    const spacing = 3
    const totalWidth = count * starSize + (count - 1) * spacing
    const startX = x + (60 - totalWidth) / 2

    for (let i = 0; i < count; i++) {
      const starX = startX + i * (starSize + spacing)
      drawStar(ctx, starX + starSize / 2, y, starSize / 2, COLORS.yellow, {
        stroke: COLORS.white,
        lineWidth: 1.2
      })
    }
  }

  onTouchStart(touch) {
    // 返回按钮
    if (this.buttons[0].onTouchStart(touch)) {
      return
    }

    // 检查关卡按钮
    const adjustedY = touch.clientY + this.scrollY

    this.levels.forEach(level => {
      if (level.isUnlocked &&
          touch.clientX >= level.x &&
          touch.clientX <= level.x + level.width &&
          adjustedY >= level.y &&
          adjustedY <= level.y + level.height) {
        level.isHovered = true
      }
    })
  }

  onTouchMove(touch) {
    // 简单的滚动处理
    if (touch.clientY > 100) {
      // 可以在这里实现滚动逻辑
    }
  }

  onTouchEnd(touch) {
    // 返回按钮
    this.buttons[0].onTouchEnd(touch)

    // 检查关卡按钮点击
    const adjustedY = touch.clientY + this.scrollY

    this.levels.forEach(level => {
      if (level.isHovered && level.isUnlocked) {
        if (touch.clientX >= level.x &&
            touch.clientX <= level.x + level.width &&
            adjustedY >= level.y &&
            adjustedY <= level.y + level.height) {
          // 进入该关卡
          this.sceneManager.switchTo('game', { level: level.id })
        }
      }
      level.isHovered = false
    })
  }
}
