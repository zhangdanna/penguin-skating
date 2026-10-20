/**
 * 游戏结束场景
 * 显示游戏失败界面（无复活选项时）
 */
import Button from './button'

export default class GameOverScene {
  constructor() {
    this.isVisible = false

    // 回调
    this.onRestart = null
    this.onBackToMenu = null
    this.onWatchAd = null

    // 动画参数
    this.penguinAngle = 0
    this.teardropY = 0

    this.buttons = []
    this.init()
  }

  init() {
    const centerX = canvas.width / 2
    const buttonWidth = 200
    const buttonHeight = 50
    const buttonSpacing = 20
    const startY = 420

    // 重玩按钮
    this.buttons.push(new Button({
      x: centerX - buttonWidth / 2,
      y: startY,
      width: buttonWidth,
      height: buttonHeight,
      text: '🔄 重新挑战',
      fontSize: 20,
      bgColor: '#27ae60',
      hoverColor: '#229954',
      borderColor: '#1e8449',
      onClick: () => {
        if (this.onRestart) this.onRestart()
      }
    }))

    // 看广告复活按钮
    this.buttons.push(new Button({
      x: centerX - buttonWidth / 2,
      y: startY + buttonHeight + buttonSpacing,
      width: buttonWidth,
      height: buttonHeight,
      text: '📺 看广告复活',
      fontSize: 20,
      bgColor: '#f39c12',
      hoverColor: '#d68910',
      borderColor: '#b9770e',
      onClick: () => {
        if (this.onWatchAd) this.onWatchAd()
      }
    }))

    // 返回菜单按钮
    this.buttons.push(new Button({
      x: centerX - buttonWidth / 2,
      y: startY + (buttonHeight + buttonSpacing) * 2,
      width: buttonWidth,
      height: buttonHeight,
      text: '🏠 返回菜单',
      fontSize: 20,
      bgColor: '#95a5a6',
      hoverColor: '#7f8c8d',
      borderColor: '#707b7c',
      onClick: () => {
        if (this.onBackToMenu) this.onBackToMenu()
      }
    }))
  }

  /**
   * 显示
   */
  show() {
    this.isVisible = true
    this.penguinAngle = 0
    this.teardropY = 0
  }

  /**
   * 隐藏
   */
  hide() {
    this.isVisible = false
  }

  /**
   * 更新
   */
  update() {
    if (!this.isVisible) return

    // 企鹅摇晃动画
    this.penguinAngle = Math.sin(Date.now() * 0.005) * 0.1

    // 眼泪下落动画
    this.teardropY += 2
    if (this.teardropY > 50) {
      this.teardropY = 0
    }
  }

  /**
   * 渲染
   */
  render(ctx) {
    if (!this.isVisible) return

    // 半透明背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // 渲染内容
    this.renderContent(ctx)

    // 渲染按钮
    this.buttons.forEach(btn => btn.render(ctx))
  }

  /**
   * 渲染内容
   */
  renderContent(ctx) {
    const centerX = canvas.width / 2

    ctx.save()

    // 企鹅动画
    this.renderPenguin(ctx, centerX, 180)

    // 标题
    ctx.fillStyle = '#e74c3c'
    ctx.font = 'bold 32px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('游戏结束', centerX, 280)

    // 提示文字
    ctx.fillStyle = '#bdc3c7'
    ctx.font = '16px Arial'
    ctx.fillText('企鹅掉入冰窟窿了...', centerX, 320)
    ctx.fillText('别灰心，再试一次吧！', centerX, 350)

    // 提示广告
    ctx.fillStyle = '#f39c12'
    ctx.font = '14px Arial'
    ctx.fillText('看广告可以复活哦~', centerX, 390)

    ctx.restore()
  }

  /**
   * 渲染企鹅
   */
  renderPenguin(ctx, x, y) {
    ctx.save()

    ctx.translate(x, y)
    ctx.rotate(this.penguinAngle)

    // 身体（倒下）
    ctx.fillStyle = '#2c3e50'
    ctx.beginPath()
    ctx.ellipse(0, 10, 35, 25, 0.3, 0, Math.PI * 2)
    ctx.fill()

    // 肚子
    ctx.fillStyle = '#ecf0f1'
    ctx.beginPath()
    ctx.ellipse(0, 15, 25, 18, 0.3, 0, Math.PI * 2)
    ctx.fill()

    // 头部
    ctx.fillStyle = '#2c3e50'
    ctx.beginPath()
    ctx.arc(-15, -10, 20, 0, Math.PI * 2)
    ctx.fill()

    // 眼睛（X_X）
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    // 左眼 X
    ctx.beginPath()
    ctx.moveTo(-22, -15)
    ctx.lineTo(-18, -11)
    ctx.moveTo(-18, -15)
    ctx.lineTo(-22, -11)
    ctx.stroke()
    // 右眼 X
    ctx.beginPath()
    ctx.moveTo(-12, -15)
    ctx.lineTo(-8, -11)
    ctx.moveTo(-8, -15)
    ctx.lineTo(-12, -11)
    ctx.stroke()

    // 眼泪
    ctx.fillStyle = '#3498db'
    ctx.beginPath()
    ctx.arc(-20, -5 + this.teardropY * 0.3, 3, 0, Math.PI * 2)
    ctx.fill()

    // 嘴巴（难过）
    ctx.strokeStyle = '#e67e22'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(-15, 0, 5, 0.2 * Math.PI, 0.8 * Math.PI, true)
    ctx.stroke()

    ctx.restore()
  }

  /**
   * 触摸开始
   */
  onTouchStart(touch) {
    if (!this.isVisible) return
    this.buttons.forEach(btn => btn.onTouchStart(touch))
  }

  /**
   * 触摸移动
   */
  onTouchMove(touch) {
    if (!this.isVisible) return
    this.buttons.forEach(btn => {
      btn.isHovered = btn.contains(touch.clientX, touch.clientY)
    })
  }

  /**
   * 触摸结束
   */
  onTouchEnd(touch) {
    if (!this.isVisible) return
    this.buttons.forEach(btn => btn.onTouchEnd(touch))
  }

  /**
   * 检查是否包含某点
   */
  contains(x, y) {
    return this.isVisible
  }
}
