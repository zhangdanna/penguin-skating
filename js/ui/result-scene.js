import Button from './button'

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

    // 动画参数
    this.titleScale = 0
    this.starScales = [0, 0, 0]

    this.init()
  }

  init() {
    const centerX = canvas.width / 2
    const buttonWidth = 150
    const buttonHeight = 50
    const buttonSpacing = 20
    const startY = 450

    // 下一关按钮
    this.buttons.push(new Button({
      x: centerX - buttonWidth - 10,
      y: startY,
      width: buttonWidth,
      height: buttonHeight,
      text: '下一关',
      fontSize: 20,
      bgColor: '#27ae60',
      hoverColor: '#229954',
      borderColor: '#1e8449',
      onClick: () => {
        if (this.onNextLevel) {
          this.onNextLevel()
        }
      }
    }))

    // 重玩按钮
    this.buttons.push(new Button({
      x: centerX + 10,
      y: startY,
      width: buttonWidth,
      height: buttonHeight,
      text: '重玩',
      fontSize: 20,
      bgColor: '#3498db',
      hoverColor: '#2980b9',
      borderColor: '#2471a3',
      onClick: () => {
        if (this.onReplay) {
          this.onReplay()
        }
      }
    }))

    // 回调
    this.onNextLevel = null
    this.onReplay = null
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
   */
  setRewards(rewards) {
    this.rewards = rewards
  }

  /**
   * 计算星级
   */
  calculateStars() {
    if (this.moves <= this.par) {
      return 3
    } else if (this.moves <= this.par * 1.5) {
      return 2
    } else {
      return 1
    }
  }

  show() {
    this.isVisible = true
    this.titleScale = 0
    this.starScales = [0, 0, 0]
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
        }
      }
    }
  }

  render(ctx) {
    if (!this.isVisible) return

    // 半透明遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // 通关标题
    ctx.save()
    ctx.translate(canvas.width / 2, 150)
    ctx.scale(this.titleScale, this.titleScale)
    ctx.fillStyle = '#f1c40f'
    ctx.font = 'bold 48px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('通关成功！', 0, 0)
    ctx.restore()

    // 关卡信息
    ctx.fillStyle = '#ffffff'
    ctx.font = '20px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`关卡 ${this.level}`, canvas.width / 2, 220)

    // 星星评价
    this.renderStars(ctx)

    // 统计信息
    ctx.fillStyle = '#bdc3c7'
    ctx.font = '18px Arial'
    ctx.fillText(`步数: ${this.moves} / 标准: ${this.par}`, canvas.width / 2, 350)

    const timeStr = this.formatTime(this.time)
    ctx.fillText(`用时: ${timeStr}`, canvas.width / 2, 380)

    // 渲染奖励
    if (this.rewards) {
      this.renderRewards(ctx)
    }

    // 绘制按钮
    this.buttons.forEach(btn => btn.render(ctx))
  }

  /**
   * 渲染奖励信息
   */
  renderRewards(ctx) {
    const centerX = canvas.width / 2
    const startY = 410

    // 奖励标题
    ctx.fillStyle = '#f1c40f'
    ctx.font = 'bold 16px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('获得奖励', centerX, startY)

    // 奖励详情
    ctx.fillStyle = '#ffffff'
    ctx.font = '14px Arial'

    let y = startY + 25
    if (this.rewards.fish > 0) {
      ctx.fillText(`🐟 × ${this.rewards.fish}`, centerX, y)
      y += 20
    }
    if (this.rewards.shrimp > 0) {
      ctx.fillText(`🦐 × ${this.rewards.shrimp}`, centerX, y)
      y += 20
    }
    if (this.rewards.squid > 0) {
      ctx.fillText(`🦑 × ${this.rewards.squid}`, centerX, y)
      y += 20
    }
    if (this.rewards.goldfish > 0) {
      ctx.fillText(`🐠 × ${this.rewards.goldfish}`, centerX, y)
      y += 20
    }
  }

  renderStars(ctx) {
    const starSize = 40
    const spacing = 20
    const totalWidth = 3 * starSize + 2 * spacing
    const startX = (canvas.width - totalWidth) / 2
    const y = 280

    for (let i = 0; i < 3; i++) {
      const x = startX + i * (starSize + spacing) + starSize / 2

      ctx.save()
      ctx.translate(x, y)
      ctx.scale(this.starScales[i], this.starScales[i])

      if (i < this.stars) {
        // 金色星星
        this.drawStar(ctx, 0, 0, starSize / 2, '#f1c40f')
      } else {
        // 灰色星星
        this.drawStar(ctx, 0, 0, starSize / 2, '#7f8c8d')
      }

      ctx.restore()
    }
  }

  drawStar(ctx, cx, cy, radius, color) {
    ctx.save()
    ctx.fillStyle = color
    ctx.strokeStyle = '#f39c12'
    ctx.lineWidth = 2
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
    ctx.stroke()
    ctx.restore()
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  onTouchStart(touch) {
    if (!this.isVisible) return false

    this.buttons.forEach(btn => btn.onTouchStart(touch))
    return true
  }

  onTouchMove(touch) {
    if (!this.isVisible) return

    this.buttons.forEach(btn => {
      btn.isHovered = btn.contains(touch.clientX, touch.clientY)
    })
  }

  onTouchEnd(touch) {
    if (!this.isVisible) return false

    this.buttons.forEach(btn => btn.onTouchEnd(touch))
    return true
  }
}
