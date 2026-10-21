import Button from './button'
import {
  COLORS,
  drawGlassPanel,
  drawOceanBackdrop,
  drawStickerText,
  font
} from './theme'

/**
 * 登录场景
 * 显示用户登录状态和头像
 */
export default class LoginScene {
  constructor(sceneManager, wechatService) {
    this.sceneManager = sceneManager
    this.wechatService = wechatService
    this.buttons = []
    this.isVisible = false
    this.userInfo = null

    this.init()
  }

  init() {
    const centerX = canvas.width / 2

    // 返回按钮
    this.buttons.push(new Button({
      x: 18,
      y: 22,
      width: 76,
      height: 36,
      text: '返回',
      fontSize: 15,
      bgColor: COLORS.lavender,
      hoverColor: COLORS.lavenderDeep,
      borderColor: '#7255CC',
      onClick: () => {
        this.sceneManager.switchTo('menu')
      }
    }))

    // 登录按钮
    this.buttons.push(new Button({
      x: centerX - 100,
      y: 400,
      width: 200,
      height: 58,
      text: '微信登录',
      fontSize: 22,
      bgColor: COLORS.mint,
      hoverColor: COLORS.mintDeep,
      borderColor: '#17876C',
      onClick: () => {
        this.handleLogin()
      }
    }))

    // 分享按钮
    this.buttons.push(new Button({
      x: centerX - 100,
      y: 476,
      width: 200,
      height: 50,
      text: '分享给好友',
      fontSize: 18,
      bgColor: COLORS.water,
      hoverColor: COLORS.waterDeep,
      borderColor: '#1F7FAE',
      onClick: () => {
        this.wechatService.share()
      }
    }))
  }

  async handleLogin() {
    try {
      wx.showLoading({ title: '登录中...' })

      const result = await this.wechatService.login()

      wx.hideLoading()

      if (result.success) {
        this.userInfo = result.userInfo
        wx.showToast({
          title: '登录成功',
          icon: 'success'
        })
      } else {
        wx.showToast({
          title: '登录失败',
          icon: 'none'
        })
      }
    } catch (e) {
      wx.hideLoading()
      wx.showToast({
        title: '登录失败',
        icon: 'none'
      })
    }
  }

  show() {
    this.isVisible = true
    this.userInfo = this.wechatService.userInfo
  }

  hide() {
    this.isVisible = false
  }

  onEnter() {
    this.show()
  }

  onExit() {
    this.hide()
  }

  update() {
    // 更新用户信息
    this.userInfo = this.wechatService.userInfo
  }

  render(ctx) {
    if (!this.isVisible) return

    // 绘制背景
    this.renderBackground(ctx)

    // 绘制标题
    this.renderTitle(ctx)

    // 绘制用户信息
    this.renderUserInfo(ctx)

    // 绘制按钮
    this.buttons.forEach(btn => btn.render(ctx))
  }

  renderBackground(ctx) {
    drawOceanBackdrop(ctx, Date.now() / 1000)
  }

  renderTitle(ctx) {
    drawGlassPanel(ctx, 97, 22, 180, 46, 23, {
      fill: 'rgba(255, 255, 255, 0.86)'
    })
    drawStickerText(ctx, '个人中心', canvas.width / 2, 46, {
      size: 22,
      color: COLORS.navy,
      strokeWidth: 0
    })
  }

  renderUserInfo(ctx) {
    const centerX = canvas.width / 2
    const centerY = 220

    if (this.userInfo && this.wechatService.isLogin) {
      // 已登录状态：冰晶头像底座
      ctx.save()
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
      ctx.beginPath()
      ctx.arc(centerX, centerY, 54, 0, Math.PI * 2)
      ctx.fill()
      const ice = ctx.createLinearGradient(centerX, centerY - 50, centerX, centerY + 50)
      ice.addColorStop(0, COLORS.iceLight)
      ice.addColorStop(1, COLORS.iceDeep)
      ctx.fillStyle = ice
      ctx.beginPath()
      ctx.arc(centerX, centerY, 50, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      // 绘制头像（如果有）
      if (this.userInfo.avatarUrl) {
        // 微信小游戏中加载网络图片需要使用 wx.createImage
        const img = wx.createImage()
        img.src = this.userInfo.avatarUrl
        img.onload = () => {
          ctx.save()
          ctx.beginPath()
          ctx.arc(centerX, centerY, 45, 0, Math.PI * 2)
          ctx.clip()
          ctx.drawImage(img, centerX - 45, centerY - 45, 90, 90)
          ctx.restore()
        }
      } else {
        // 默认头像
        ctx.fillStyle = '#ffffff'
        ctx.font = '40px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('🐧', centerX, centerY)
      }

      // 昵称
      ctx.fillStyle = COLORS.white
      ctx.font = font(24)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.strokeStyle = COLORS.navyDeep
      ctx.lineWidth = 5
      ctx.lineJoin = 'round'
      ctx.strokeText(this.userInfo.nickName || '微信用户', centerX, centerY + 80)
      ctx.fillText(this.userInfo.nickName || '微信用户', centerX, centerY + 80)

      // 登录状态
      ctx.fillStyle = COLORS.mintDeep
      ctx.font = font(15)
      ctx.fillText('✓ 已登录', centerX, centerY + 112)

      // 隐藏登录按钮
      this.buttons[1].setVisible(false)
    } else {
      // 未登录状态
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
      ctx.beginPath()
      ctx.arc(centerX, centerY, 50, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.fillStyle = '#ffffff'
      ctx.font = '40px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('🐧', centerX, centerY)

      // 提示文字
      ctx.fillStyle = COLORS.white
      ctx.font = font(17)
      ctx.fillText('登录后可以参与排行榜', centerX, centerY + 80)
      ctx.fillText('与好友一较高下！', centerX, centerY + 112)

      // 显示登录按钮
      this.buttons[1].setVisible(true)
    }
  }

  onTouchStart(touch) {
    if (!this.isVisible) return

    this.buttons.forEach(btn => btn.onTouchStart(touch))
  }

  onTouchMove(touch) {
    if (!this.isVisible) return

    this.buttons.forEach(btn => {
      btn.isHovered = btn.contains(touch.clientX, touch.clientY)
    })
  }

  onTouchEnd(touch) {
    if (!this.isVisible) return

    this.buttons.forEach(btn => btn.onTouchEnd(touch))
  }
}
