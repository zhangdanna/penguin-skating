import Button from './button'

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
    const startY = 300

    // 继续游戏按钮
    this.buttons.push(new Button({
      x: centerX - buttonWidth / 2,
      y: startY,
      width: buttonWidth,
      height: buttonHeight,
      text: '继续游戏',
      fontSize: 20,
      bgColor: '#27ae60',
      hoverColor: '#229954',
      borderColor: '#1e8449',
      onClick: () => {
        this.hide()
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
      bgColor: '#e67e22',
      hoverColor: '#d35400',
      borderColor: '#ba4a00',
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
      bgColor: '#95a5a6',
      hoverColor: '#7f8c8d',
      borderColor: '#707b7c',
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
    if (this.onResume) {
      this.onResume()
    }
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

    // 半透明遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // 暂停标题
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 36px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('游戏暂停', canvas.width / 2, 200)

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
