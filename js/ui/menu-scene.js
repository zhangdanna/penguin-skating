import Button from './button'

/**
 * 主菜单场景
 */
export default class MenuScene {
  constructor(sceneManager) {
    this.sceneManager = sceneManager
    this.buttons = []

    // 动画参数
    this.titleY = 0
    this.titleTargetY = 0
    this.penguinAngle = 0

    this.init()
  }

  init() {
    const centerX = canvas.width / 2
    const buttonWidth = 200
    const buttonHeight = 60
    const buttonSpacing = 20

    // 开始游戏按钮
    this.buttons.push(new Button({
      x: centerX - buttonWidth / 2,
      y: 350,
      width: buttonWidth,
      height: buttonHeight,
      text: '开始游戏',
      fontSize: 24,
      bgColor: '#27ae60',
      hoverColor: '#229954',
      borderColor: '#1e8449',
      onClick: () => {
        this.sceneManager.switchTo('levelSelect')
      }
    }))

    // 继续游戏按钮
    this.buttons.push(new Button({
      x: centerX - buttonWidth / 2,
      y: 350 + buttonHeight + buttonSpacing,
      width: buttonWidth,
      height: buttonHeight,
      text: '继续游戏',
      fontSize: 24,
      bgColor: '#3498db',
      hoverColor: '#2980b9',
      borderColor: '#2471a3',
      onClick: () => {
        // 读取存档，继续游戏
        const savedLevel = this.getSavedLevel()
        this.sceneManager.switchTo('game', { level: savedLevel, continue: true })
      }
    }))

    // 设置按钮
    this.buttons.push(new Button({
      x: centerX - buttonWidth / 2,
      y: 350 + (buttonHeight + buttonSpacing) * 2,
      width: buttonWidth,
      height: buttonHeight,
      text: '设置',
      fontSize: 24,
      bgColor: '#95a5a6',
      hoverColor: '#7f8c8d',
      borderColor: '#707b7c',
      onClick: () => {
        // TODO: 打开设置界面
        console.log('打开设置')
      }
    }))
  }

  /**
   * 获取存档关卡
   */
  getSavedLevel() {
    try {
      const data = wx.getStorageSync('gameProgress')
      return data ? data.currentLevel || 1 : 1
    } catch (e) {
      return 1
    }
  }

  onEnter() {
    this.titleY = -100
    this.titleTargetY = 150
  }

  onExit() {
    // 清理
  }

  update() {
    // 标题下落动画
    if (this.titleY < this.titleTargetY) {
      this.titleY += (this.titleTargetY - this.titleY) * 0.1
    }

    // 企鹅摇摆动画
    this.penguinAngle = Math.sin(Date.now() * 0.003) * 0.1
  }

  render(ctx) {
    // 绘制背景
    this.renderBackground(ctx)

    // 绘制标题
    this.renderTitle(ctx)

    // 绘制企鹅
    this.renderPenguin(ctx)

    // 绘制按钮
    this.buttons.forEach(btn => btn.render(ctx))
  }

  renderBackground(ctx) {
    // 渐变背景
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
    gradient.addColorStop(0, '#1a5276')
    gradient.addColorStop(0.5, '#2874a6')
    gradient.addColorStop(1, '#3498db')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // 雪花效果
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    const time = Date.now() * 0.001
    for (let i = 0; i < 20; i++) {
      const x = (Math.sin(time + i * 0.5) * 0.5 + 0.5) * canvas.width
      const y = ((time * 0.1 + i * 0.05) % 1) * canvas.height
      ctx.beginPath()
      ctx.arc(x, y, 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  renderTitle(ctx) {
    ctx.save()

    // 标题文字
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 48px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // 文字阴影
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
    ctx.shadowBlur = 10
    ctx.shadowOffsetX = 2
    ctx.shadowOffsetY = 2

    ctx.fillText('企鹅滑冰', canvas.width / 2, this.titleY)

    // 副标题
    ctx.font = '20px Arial'
    ctx.shadowBlur = 5
    ctx.fillText('Penguin Skating', canvas.width / 2, this.titleY + 50)

    ctx.restore()
  }

  renderPenguin(ctx) {
    ctx.save()

    const centerX = canvas.width / 2
    const centerY = 250

    ctx.translate(centerX, centerY)
    ctx.rotate(this.penguinAngle)

    // 绘制简化的企鹅
    // 身体
    ctx.fillStyle = '#2c3e50'
    ctx.beginPath()
    ctx.ellipse(0, 10, 30, 40, 0, 0, Math.PI * 2)
    ctx.fill()

    // 肚子
    ctx.fillStyle = '#ecf0f1'
    ctx.beginPath()
    ctx.ellipse(0, 15, 20, 30, 0, 0, Math.PI * 2)
    ctx.fill()

    // 头部
    ctx.fillStyle = '#2c3e50'
    ctx.beginPath()
    ctx.arc(0, -25, 25, 0, Math.PI * 2)
    ctx.fill()

    // 眼睛
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(-8, -30, 6, 0, Math.PI * 2)
    ctx.arc(8, -30, 6, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#000000'
    ctx.beginPath()
    ctx.arc(-6, -30, 3, 0, Math.PI * 2)
    ctx.arc(6, -30, 3, 0, Math.PI * 2)
    ctx.fill()

    // 嘴巴
    ctx.fillStyle = '#e67e22'
    ctx.beginPath()
    ctx.moveTo(0, -20)
    ctx.lineTo(-6, -15)
    ctx.lineTo(6, -15)
    ctx.closePath()
    ctx.fill()

    // 围巾
    ctx.fillStyle = '#e74c3c'
    ctx.fillRect(-25, -5, 50, 10)
    ctx.fillRect(15, -5, 10, 25)

    ctx.restore()
  }

  onTouchStart(touch) {
    this.buttons.forEach(btn => btn.onTouchStart(touch))
  }

  onTouchMove(touch) {
    this.buttons.forEach(btn => {
      btn.isHovered = btn.contains(touch.clientX, touch.clientY)
    })
  }

  onTouchEnd(touch) {
    this.buttons.forEach(btn => btn.onTouchEnd(touch))
  }
}
