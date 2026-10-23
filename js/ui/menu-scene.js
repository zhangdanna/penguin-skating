import Button from './button'
import {
  COLORS,
  drawCandyButton,
  drawOceanCached,
  drawOceanMotion,
  drawPenguin,
  drawStickerText
} from './theme'
import { CENTER_X, stage } from './layout'

/**
 * 主菜单场景（极地海洋馆）
 */
export default class MenuScene {
  constructor(sceneManager) {
    this.sceneManager = sceneManager
    this.buttons = []

    // 外部注入的回调（C8）
    this.onToggleSound = null
    this.onShare = null
    this.soundEnabled = true

    // 动画参数
    this.titleY = 0
    this.titleTargetY = 118
    this.penguinAngle = 0

    this.init()
  }

  init() {
    this.buttons = []
    const centerX = CENTER_X

    // 主按钮
    const mainWidth = 220
    const mainHeight = 62
    const mainX = centerX - mainWidth / 2

    // 开始游戏（直接从上次通关后的关卡继续）
    this.mainButton = new Button({
      x: mainX,
      y: 392,
      width: mainWidth,
      height: mainHeight,
      text: `第${this.getProgressLevel()}关`,
      fontSize: 20,
      bgColor: COLORS.mint,
      hoverColor: COLORS.mintDeep,
      borderColor: '#17876C',
      onClick: () => {
        this.sceneManager.switchTo('game', { level: this.getProgressLevel() })
      }
    })
    this.buttons.push(this.mainButton)

    // 次级按钮 2×2
    const subWidth = 104
    const subHeight = 46
    const gapX = 16
    const gapY = 12
    const subStartX = centerX - subWidth - gapX / 2
    const subStartY = 500

    // C8：登录体系采用"轻量方案"——去掉伪登录入口（无后端 code2session，
    // wx.getUserInfo 也已不返回真实资料）。原「个人中心」位改为纯分享。
    const subButtons = [
      {
        text: '音效 开',
        color: COLORS.lavender,
        hover: COLORS.lavenderDeep,
        border: '#7255CC',
        onClick: () => {
          if (this.onToggleSound) this.onToggleSound()
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
        text: '分享',
        color: COLORS.pink,
        hover: COLORS.pinkDeep,
        border: '#CE4D80',
        onClick: () => {
          if (this.onShare) this.onShare()
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

    // 音效开关按钮（第 0 个是主按钮，第 1 个是音效）
    this.soundButton = this.buttons[1]
    this.soundEnabled = true
  }

  /**
   * 刷新音效按钮文案（C8：原「设置」入口只是个 console.log，换成真实可用的开关）
   * @param {boolean} enabled
   */
  setSoundEnabled(enabled) {
    this.soundEnabled = !!enabled
    if (this.soundButton) {
      this.soundButton.setText(this.soundEnabled ? '音效 开' : '音效 关')
    }
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

    // 进度可能已更新，回到首页时刷新“下一关”关数
    if (this.mainButton) {
      this.mainButton.setText(`第${this.getProgressLevel()}关`)
    }
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

    // 海洋馆背景（真实像素铺满整屏，不参与缩放）
    // D7：静态层（水色 / 玻璃反光 / 沙底珊瑚）走共享离屏缓存，只重绘动态层
    drawOceanCached(ctx)
    drawOceanMotion(ctx, time)

    // 以下全部使用 375×667 设计稿坐标
    const s = stage()
    ctx.save()
    s.apply(ctx)

    this.renderTitle(ctx)
    this.renderPenguin(ctx, time)
    this.buttons.forEach(btn => btn.render(ctx))
    this.renderInstructions(ctx)

    ctx.restore()
  }

  /**
   * 窗口尺寸变化后重建按钮（C1/C2）
   */
  relayout() {
    this.init()
  }

  /**
   * 渲染操作说明
   */
  renderInstructions(ctx) {
    drawStickerText(ctx, '滑动屏幕控制企鹅 · 推动冰块到目标区域', CENTER_X, 634, {
      size: 13,
      color: COLORS.white,
      stroke: COLORS.navyDeep,
      strokeWidth: 3
    })
  }

  renderTitle(ctx) {
    const centerX = CENTER_X

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
    const centerX = CENTER_X
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
    const t = stage().unproject(touch)
    this.buttons.forEach(btn => btn.onTouchStart(t))
  }

  onTouchMove(touch) {
    const t = stage().unproject(touch)
    this.buttons.forEach(btn => {
      btn.isHovered = btn.contains(t.clientX, t.clientY)
    })
  }

  onTouchEnd(touch) {
    const t = stage().unproject(touch)
    this.buttons.forEach(btn => btn.onTouchEnd(t))
  }
}
