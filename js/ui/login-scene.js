import Button from './button'

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
      x: 20,
      y: 20,
      width: 80,
      height: 40,
      text: '返回',
      fontSize: 16,
      bgColor: '#95a5a6',
      hoverColor: '#7f8c8d',
      borderColor: '#707b7c',
      onClick: () => {
        this.sceneManager.switchTo('menu')
      }
    }))

    // 登录按钮
    this.buttons.push(new Button({
      x: centerX - 100,
      y: 400,
      width: 200,
      height: 60,
      text: '微信登录',
      fontSize: 22,
      bgColor: '#07c160',
      hoverColor: '#06ad56',
      borderColor: '#059a4c',
      onClick: () => {
        this.handleLogin()
      }
    }))

    // 分享按钮
    this.buttons.push(new Button({
      x: centerX - 100,
      y: 480,
      width: 200,
      height: 50,
      text: '分享给好友',
      fontSize: 18,
      bgColor: '#3498db',
      hoverColor: '#2980b9',
      borderColor: '#2471a3',
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
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
    gradient.addColorStop(0, '#2c3e50')
    gradient.addColorStop(1, '#34495e')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  renderTitle(ctx) {
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 32px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('个人中心', canvas.width / 2, 80)
  }

  renderUserInfo(ctx) {
    const centerX = canvas.width / 2
    const centerY = 220

    if (this.userInfo && this.wechatService.isLogin) {
      // 已登录状态
      // 绘制头像背景
      ctx.fillStyle = '#3498db'
      ctx.beginPath()
      ctx.arc(centerX, centerY, 50, 0, Math.PI * 2)
      ctx.fill()

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
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 24px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(this.userInfo.nickName || '微信用户', centerX, centerY + 80)

      // 登录状态
      ctx.fillStyle = '#2ecc71'
      ctx.font = '16px Arial'
      ctx.fillText('已登录', centerX, centerY + 110)

      // 隐藏登录按钮
      this.buttons[1].setVisible(false)
    } else {
      // 未登录状态
      // 绘制默认头像
      ctx.fillStyle = '#95a5a6'
      ctx.beginPath()
      ctx.arc(centerX, centerY, 50, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#ffffff'
      ctx.font = '40px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('🐧', centerX, centerY)

      // 提示文字
      ctx.fillStyle = '#bdc3c7'
      ctx.font = '18px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('登录后可以参与排行榜', centerX, centerY + 80)
      ctx.fillText('与好友一较高下！', centerX, centerY + 110)

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
