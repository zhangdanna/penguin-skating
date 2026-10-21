/**
 * 游戏结束场景
 * 显示游戏失败界面（无复活选项时）
 */
import Button from './button'
import {
  COLORS,
  drawGlassPanel,
  drawOverlay,
  drawPenguin,
  drawStickerText,
  font
} from './theme'

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
    const buttonSpacing = 16
    const startY = 436

    // 重玩按钮
    this.buttons.push(new Button({
      x: centerX - buttonWidth / 2,
      y: startY,
      width: buttonWidth,
      height: buttonHeight,
      text: '🔄 重新挑战',
      fontSize: 20,
      bgColor: COLORS.mint,
      hoverColor: COLORS.mintDeep,
      borderColor: '#17876C',
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
      bgColor: COLORS.yellow,
      hoverColor: COLORS.yellowDeep,
      borderColor: '#B8861C',
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
      bgColor: COLORS.lavender,
      hoverColor: COLORS.lavenderDeep,
      borderColor: '#7255CC',
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

    // 深蓝遮罩 + 奶油面板
    drawOverlay(ctx, 0.62)
    drawGlassPanel(ctx, 30, 76, 315, 560, 30, {
      fill: 'rgba(255, 249, 238, 0.97)'
    })

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

    // 难过企鹅
    this.renderPenguin(ctx, centerX, 172)

    // 标题
    drawStickerText(ctx, '游戏结束', centerX, 286, {
      size: 34,
      color: COLORS.coral,
      stroke: COLORS.navyDeep,
      strokeWidth: 5
    })

    // 提示文字
    ctx.font = font(15)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = COLORS.navy
    ctx.fillText('企鹅掉进冰冻的水洞了...', centerX, 328)

    ctx.font = font(14, 'normal')
    ctx.fillStyle = COLORS.navySoft
    ctx.fillText('别灰心，再试一次吧！', centerX, 354)

    // 提示广告
    ctx.font = font(13)
    ctx.fillStyle = COLORS.yellowDeep
    ctx.fillText('看广告可以复活哦~', centerX, 396)
  }

  /**
   * 渲染企鹅
   */
  renderPenguin(ctx, x, y) {
    drawPenguin(ctx, x, y, 2.2, {
      angle: this.penguinAngle,
      sad: true
    })

    // 眼泪
    ctx.save()
    ctx.fillStyle = 'rgba(91, 200, 245, 0.9)'
    ctx.beginPath()
    ctx.arc(x + 14, y - 16 + this.teardropY * 0.5, 3, 0, Math.PI * 2)
    ctx.fill()
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
