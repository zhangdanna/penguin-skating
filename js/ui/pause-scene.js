import Button from './button'
import {
  COLORS,
  drawGlassPanel,
  drawOverlay,
  drawStickerText,
  font
} from './theme'

/**
 * 暂停场景
 */
export default class PauseScene {
  constructor(sceneManager) {
    this.sceneManager = sceneManager
    this.buttons = []
    this.isVisible = false

    this.init()
  }

  init() {
    const centerX = canvas.width / 2
    const buttonWidth = 180
    const buttonHeight = 50
    const buttonSpacing = 15
    const startY = 252

    // 继续游戏按钮
    this.buttons.push(new Button({
      x: centerX - buttonWidth / 2,
      y: startY,
      width: buttonWidth,
      height: buttonHeight,
      text: '继续游戏',
      fontSize: 20,
      bgColor: COLORS.mint,
      hoverColor: COLORS.mintDeep,
      borderColor: '#17876C',
      onClick: () => {
        if (this.onResume) {
          this.onResume()
        }
      }
    }))

    // 重新开始按钮
    this.buttons.push(new Button({
      x: centerX - buttonWidth / 2,
      y: startY + buttonHeight + buttonSpacing,
      width: buttonWidth,
      height: buttonHeight,
      text: '重新开始',
      fontSize: 20,
      bgColor: COLORS.orange,
      hoverColor: COLORS.orangeDeep,
      borderColor: '#C1651F',
      onClick: () => {
        this.hide()
        if (this.onRestart) {
          this.onRestart()
        }
      }
    }))

    // 返回菜单按钮
    this.buttons.push(new Button({
      x: centerX - buttonWidth / 2,
      y: startY + (buttonHeight + buttonSpacing) * 2,
      width: buttonWidth,
      height: buttonHeight,
      text: '返回菜单',
      fontSize: 20,
      bgColor: COLORS.lavender,
      hoverColor: COLORS.lavenderDeep,
      borderColor: '#7255CC',
      onClick: () => {
        this.hide()
        this.sceneManager.switchTo('menu')
      }
    }))

    // 回调
    this.onResume = null
    this.onRestart = null
  }

  show() {
    this.isVisible = true
  }

  hide() {
    this.isVisible = false
  }

  onEnter() {
    this.isVisible = true
  }

  onExit() {
    this.isVisible = false
  }

  update() {
    // 暂停时不需要更新
  }

  render(ctx) {
    if (!this.isVisible) return

    // 深蓝遮罩
    drawOverlay(ctx, 0.5)

    // 居中面板
    drawGlassPanel(ctx, 57, 150, 261, 330, 28, {
      fill: 'rgba(255, 249, 238, 0.97)'
    })

    // 标题
    drawStickerText(ctx, '游戏暂停', canvas.width / 2, 202, {
      size: 30,
      color: COLORS.navy,
      strokeWidth: 0
    })

    // 副标题
    ctx.font = font(12, 'normal')
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = COLORS.navySoft
    ctx.fillText('PAUSED', canvas.width / 2, 226)

    // 绘制按钮
    this.buttons.forEach(btn => btn.render(ctx))
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
