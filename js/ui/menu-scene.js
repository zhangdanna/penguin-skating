import Button from './button'
import {
  COLORS,
  drawCandyButton,
  drawOceanBackdrop,
  drawPenguin,
  drawStickerText
} from './theme'

/**
 * 主菜单场景（极地海洋馆）
 */
export default class MenuScene {
  constructor(sceneManager) {
    this.sceneManager = sceneManager
    this.buttons = []

    // 动画参数
    this.titleY = 0
    this.titleTargetY = 118
    this.penguinAngle = 0

    this.init()
  }

  init() {
    const centerX = canvas.width / 2

    // 主按钮
    const mainWidth = 220
    const mainHeight = 62
    const mainX = centerX - mainWidth / 2

    // 开始游戏（直接从上次通关后的关卡继续）
    this.buttons.push(new Button({
      x: mainX,
      y: 392,
      width: mainWidth,
      height: mainHeight,
      text: '继续冒险',
      fontSize: 24,
      bgColor: COLORS.mint,
      hoverColor: COLORS.mintDeep,
      borderColor: '#17876C',
      onClick: () => {
        this.sceneManager.switchTo('game', { level: this.getProgressLevel() })
      }
    }))

    // 次级按钮 2×2
    const subWidth = 104
    const subHeight = 46
    const gapX = 16
    const gapY = 12
    const subStartX = centerX - subWidth - gapX / 2
    const subStartY = 556

    const subButtons = [
      {
        text: '设置',
        color: COLORS.lavender,
        hover: COLORS.lavenderDeep,
        border: '#7255CC',
        onClick: () => {
          // TODO: 打开设置界面
          console.log('打开设置')
        }
      },
      {
        text: '排行榜',
        color: COLORS.yellow,
        hover: COLORS.yellowDeep,
        border: '#B8861C',
        onClick: () => {
          this.sceneManager.switchTo('rank')
        }
      },
      {
        text: '成就',
        color: COLORS.orange,
        hover: COLORS.orangeDeep,
        border: '#C1651F',
        onClick: () => {
          this.sceneManager.switchTo('achievement')
        }
      },
      {
        text: '个人中心',
        color: COLORS.pink,
        hover: COLORS.pinkDeep,
        border: '#CE4D80',
        onClick: () => {
          this.sceneManager.switchTo('login')
        }
      }
    ]

    subButtons.forEach((config, index) => {
      const col = index % 2
      const row = Math.floor(index / 2)
      this.buttons.push(new Button({
        x: subStartX + col * (subWidth + gapX),
        y: subStartY + row * (subHeight + gapY),
        width: subWidth,
        height: subHeight,
        text: config.text,
        fontSize: 16,
        bgColor: config.color,
        hoverColor: config.hover,
        borderColor: config.border,
        onClick: config.onClick
      }))
    })
  }

  /**
   * 获取当前进度：上次通关后的下一关（无限关卡）
   */
  getProgressLevel() {
    try {
      const data = wx.getStorageSync('gameProgress')
      const level = data ? parseInt(data.unlockedLevel) : 1
      return Number.isFinite(level) && level >= 1 ? level : 1
    } catch (e) {
      return 1
    }
  }

  onEnter() {
    this.titleY = -100
    this.titleTargetY = 118
  }

  onExit() {
    // 清理
  }

  update() {
    // 标题下落动画
    if (this.titleY < this.titleTargetY) {
      this.titleY += (this.titleTargetY - this.titleY) * 0.12
      if (this.titleTargetY - this.titleY < 0.5) {
        this.titleY = this.titleTargetY
      }
    }

    // 企鹅摇摆动画
    this.penguinAngle = Math.sin(Date.now() * 0.003) * 0.06
  }

  render(ctx) {
    const time = Date.now() / 1000

    // 海洋馆背景
    drawOceanBackdrop(ctx, time)

    // 标题
    this.renderTitle(ctx)

    // 企鹅吉祥物
    this.renderPenguin(ctx, time)

    // 按钮
    this.buttons.forEach(btn => btn.render(ctx))
  }

  renderTitle(ctx) {
    const centerX = canvas.width / 2

    // 标题投影
    drawStickerText(ctx, '企鹅滑冰', centerX, this.titleY + 5, {
      size: 50,
      color: 'rgba(31, 58, 95, 0.22)',
      strokeWidth: 0
    })

    // 主标题
    drawStickerText(ctx, '企鹅滑冰', centerX, this.titleY, {
      size: 50,
      color: COLORS.white,
      stroke: COLORS.navyDeep,
      strokeWidth: 7
    })

    // 副标题胶囊
    drawCandyButton(ctx, centerX - 82, this.titleY + 34, 164, 24, {
      color: COLORS.water,
      shadowColor: COLORS.waterDeep,
      radius: 12
    })
    drawStickerText(ctx, 'POLAR AQUARIUM', centerX, this.titleY + 46, {
      size: 11,
      color: COLORS.white,
      strokeWidth: 2
    })
  }

  renderPenguin(ctx, time) {
    const centerX = canvas.width / 2
    const baseY = 280
    const centerY = baseY + Math.sin(time * 1.6) * 4

    // 企鹅脚下的浮冰
    ctx.save()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
    ctx.beginPath()
    ctx.ellipse(centerX, baseY + 72, 66, 14, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()

    drawPenguin(ctx, centerX, centerY, 2.5, {
      angle: this.penguinAngle,
      direction: 'down'
    })
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
