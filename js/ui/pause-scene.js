import Button from './button'
import {
  COLORS,
  drawGlassPanel,
  drawOverlay,
  drawStickerText,
  font
} from './theme'
import { CENTER_X, stage } from './layout'

/**
 * 暂停场景
 */
export default class PauseScene {
  constructor(sceneManager) {
    this.sceneManager = sceneManager
    this.buttons = []
    this.isVisible = false

    // 回调（放在构造函数里，避免 relayout 重建按钮时被清空）
    this.onResume = null
    this.onRestart = null
    this.onBackToMenu = null

    this.init()
  }

  init() {
    this.buttons = []
    const centerX = CENTER_X
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
        // 必须由外部统一复位 isPaused / gameState，否则主菜单会被输入拦截卡死
        if (this.onBackToMenu) {
          this.onBackToMenu()
        } else {
          this.hide()
          this.sceneManager.switchTo('menu')
        }
      }
    }))
  }

  /**
   * 窗口尺寸变化后重建按钮（C1/C2）
   */
  relayout() {
    this.init()
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

    // 深蓝遮罩（真实像素铺满）
    drawOverlay(ctx, 0.5)

    const s = stage()
    ctx.save()
    s.apply(ctx)

    // 居中面板
    drawGlassPanel(ctx, 57, 150, 261, 330, 28, {
      fill: 'rgba(255, 249, 238, 0.97)'
    })

    // 标题
    drawStickerText(ctx, '游戏暂停', CENTER_X, 202, {
      size: 30,
      color: COLORS.navy,
      strokeWidth: 0
    })

    // 副标题
    ctx.font = font(12, 'normal')
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = COLORS.navySoft
    ctx.fillText('PAUSED', CENTER_X, 226)

    // 绘制按钮
    this.buttons.forEach(btn => btn.render(ctx))

    ctx.restore()
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
