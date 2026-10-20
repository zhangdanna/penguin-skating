import Button from './button'

/**
 * 关卡选择场景
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
      x: 20,
      y: 20,
      width: 80,
      height: 40,
      text: '返回',
      fontSize: 16,
      bgColor: '#95a5a6',
      hoverColor: '#7f8c8d',
      borderColor: '#707b7c',
      onClick: () => {
        this.sceneManager.switchTo('menu')
      }
    }))

    // 加载关卡数据
    this.loadLevels()
  }

  loadLevels() {
    const maxLevel = 30  // 可配置的关卡总数
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
    // 绘制背景
    this.renderBackground(ctx)

    // 绘制标题
    this.renderTitle(ctx)

    // 绘制返回按钮
    this.buttons[0].render(ctx)

    // 绘制关卡网格
    ctx.save()
    ctx.translate(0, -this.scrollY)

    this.levels.forEach(level => {
      this.renderLevel(ctx, level)
    })

    ctx.restore()
  }

  renderBackground(ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
    gradient.addColorStop(0, '#2c3e50')
    gradient.addColorStop(1, '#34495e')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  renderTitle(ctx) {
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 32px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('选择关卡', canvas.width / 2, 50)
  }

  renderLevel(ctx, level) {
    const { x, y, width, height, isUnlocked, stars, isHovered } = level

    ctx.save()

    // 绘制关卡按钮背景
    if (!isUnlocked) {
      ctx.fillStyle = '#7f8c8d'
    } else if (isHovered) {
      ctx.fillStyle = '#3498db'
    } else {
      ctx.fillStyle = '#2980b9'
    }

    // 圆角矩形
    this.roundRect(ctx, x, y, width, height, 10)
    ctx.fill()

    // 边框
    ctx.strokeStyle = isUnlocked ? '#1a5276' : '#566573'
    ctx.lineWidth = 2
    this.roundRect(ctx, x, y, width, height, 10)
    ctx.stroke()

    // 关卡编号
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 24px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    if (isUnlocked) {
      ctx.fillText(level.id.toString(), x + width / 2, y + height / 2)
    } else {
      // 锁定图标
      ctx.fillText('🔒', x + width / 2, y + height / 2)
    }

    // 绘制星星
    if (isUnlocked && stars > 0) {
      this.renderStars(ctx, x, y + height - 15, stars)
    }

    ctx.restore()
  }

  renderStars(ctx, x, y, count) {
    const starSize = 12
    const spacing = 5
    const totalWidth = count * starSize + (count - 1) * spacing
    const startX = x + (60 - totalWidth) / 2

    for (let i = 0; i < count; i++) {
      const starX = startX + i * (starSize + spacing)
      this.drawStar(ctx, starX + starSize / 2, y, starSize / 2)
    }
  }

  drawStar(ctx, cx, cy, radius) {
    ctx.save()
    ctx.fillStyle = '#f1c40f'
    ctx.beginPath()

    for (let i = 0; i < 5; i++) {
      const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2
      const x = cx + Math.cos(angle) * radius
      const y = cy + Math.sin(angle) * radius

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }

    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + width - radius, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
    ctx.lineTo(x + width, y + height - radius)
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    ctx.lineTo(x + radius, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
    ctx.lineTo(x, y + radius)
    ctx.quadraticCurveTo(x, y, x + radius, y)
    ctx.closePath()
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
