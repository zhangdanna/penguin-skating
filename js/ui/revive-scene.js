/**
 * 复活选择场景
 * 显示复活选项界面
 */
import Button from './button'

export default class ReviveScene {
  constructor(reviveManager, foodManager, wechatService) {
    this.reviveManager = reviveManager
    this.foodManager = foodManager
    this.wechatService = wechatService
    this.isVisible = false

    // 回调
    this.onReviveSuccess = null
    this.onReviveFail = null
    this.onGiveUp = null

    this.buttons = []
    this.init()
  }

  init() {
    const centerX = canvas.width / 2
    const buttonWidth = 240
    const buttonHeight = 50
    const buttonSpacing = 15
    const startY = 280

    // 分享给好友按钮
    this.buttons.push(new Button({
      x: centerX - buttonWidth / 2,
      y: startY,
      width: buttonWidth,
      height: buttonHeight,
      text: '🎯 分享给好友',
      fontSize: 18,
      bgColor: '#3498db',
      hoverColor: '#2980b9',
      borderColor: '#2471a3',
      onClick: () => this.handleRevive('shareFriend')
    }))

    // 分享到群按钮
    this.buttons.push(new Button({
      x: centerX - buttonWidth / 2,
      y: startY + (buttonHeight + buttonSpacing),
      width: buttonWidth,
      height: buttonHeight,
      text: '👥 分享到群聊',
      fontSize: 18,
      bgColor: '#27ae60',
      hoverColor: '#229954',
      borderColor: '#1e8449',
      onClick: () => this.handleRevive('shareGroup')
    }))

    // 看广告按钮
    this.buttons.push(new Button({
      x: centerX - buttonWidth / 2,
      y: startY + (buttonHeight + buttonSpacing) * 2,
      width: buttonWidth,
      height: buttonHeight,
      text: '📺 看视频复活',
      fontSize: 18,
      bgColor: '#f39c12',
      hoverColor: '#d68910',
      borderColor: '#b9770e',
      onClick: () => this.handleRevive('watchAd')
    }))

    // 消耗食物按钮
    this.buttons.push(new Button({
      x: centerX - buttonWidth / 2,
      y: startY + (buttonHeight + buttonSpacing) * 3,
      width: buttonWidth,
      height: buttonHeight,
      text: `🐟 ${this.reviveManager.foodCost}食物复活`,
      fontSize: 18,
      bgColor: '#e67e22',
      hoverColor: '#d35400',
      borderColor: '#ba4a00',
      onClick: () => this.handleRevive('useFood')
    }))

    // 放弃按钮
    this.buttons.push(new Button({
      x: centerX - buttonWidth / 2,
      y: startY + (buttonHeight + buttonSpacing) * 4 + 20,
      width: buttonWidth,
      height: buttonHeight,
      text: '放弃重玩',
      fontSize: 18,
      bgColor: '#95a5a6',
      hoverColor: '#7f8c8d',
      borderColor: '#707b7c',
      onClick: () => this.handleGiveUp()
    }))
  }

  /**
   * 处理复活
   */
  handleRevive(type) {
    // 检查是否可以复活
    if (!this.reviveManager.canRevive(type)) {
      wx.showToast({
        title: '今日次数已用完',
        icon: 'none'
      })
      return
    }

    // 根据类型执行不同操作
    switch (type) {
      case 'shareFriend':
        this.shareToFriend(() => this.doRevive(type))
        break
      case 'shareGroup':
        this.shareToGroup(() => this.doRevive(type))
        break
      case 'watchAd':
        this.watchAd(() => this.doRevive(type))
        break
      case 'useFood':
        if (!this.reviveManager.hasEnoughFood(this.foodManager)) {
          wx.showToast({
            title: '食物不足',
            icon: 'none'
          })
          return
        }
        this.doRevive(type)
        break
    }
  }

  /**
   * 执行复活
   */
  doRevive(type) {
    const result = this.reviveManager.revive(type, this.foodManager)

    if (result.success) {
      wx.showToast({
        title: '复活成功！步数+5',
        icon: 'none'
      })

      if (this.onReviveSuccess) {
        this.onReviveSuccess(result)
      }

      this.hide()
    } else {
      wx.showToast({
        title: result.reason || '复活失败',
        icon: 'none'
      })
    }
  }

  /**
   * 分享给好友
   */
  shareToFriend(callback) {
    if (this.wechatService) {
      this.wechatService.share()
      // 分享成功回调
      setTimeout(() => {
        callback && callback()
      }, 500)
    } else {
      // 模拟分享
      wx.showModal({
        title: '分享给好友',
        content: '模拟分享成功',
        showCancel: false,
        success: () => {
          callback && callback()
        }
      })
    }
  }

  /**
   * 分享到群
   */
  shareToGroup(callback) {
    wx.shareAppMessage({
      title: '快来挑战企鹅滑冰！',
      imageUrl: 'images/share-image.png',
      query: 'from=group',
      success: () => {
        callback && callback()
      }
    })
  }

  /**
   * 看广告
   */
  watchAd(callback) {
    // TODO: 接入真实的激励视频广告
    // 这里模拟广告观看
    wx.showModal({
      title: '观看视频',
      content: '模拟观看30秒视频广告',
      confirmText: '完成',
      success: (res) => {
        if (res.confirm) {
          callback && callback()
        }
      }
    })
  }

  /**
   * 放弃重玩
   */
  handleGiveUp() {
    if (this.onGiveUp) {
      this.onGiveUp()
    }
    this.hide()
  }

  /**
   * 显示
   */
  show() {
    this.isVisible = true
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
  }

  /**
   * 渲染
   */
  render(ctx) {
    if (!this.isVisible) return

    // 半透明背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // 标题
    this.renderTitle(ctx)

    // 状态信息
    this.renderStatus(ctx)

    // 按钮
    this.renderButtons(ctx)
  }

  /**
   * 渲染标题
   */
  renderTitle(ctx) {
    ctx.save()

    // 企鹅掉入冰窟窿图标
    ctx.font = '48px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('🐧💦', canvas.width / 2, 150)

    // 标题文字
    ctx.fillStyle = '#e74c3c'
    ctx.font = 'bold 28px Arial'
    ctx.fillText('企鹅掉入冰窟窿！', canvas.width / 2, 210)

    // 副标题
    ctx.fillStyle = '#bdc3c7'
    ctx.font = '16px Arial'
    ctx.fillText('选择一种方式复活', canvas.width / 2, 245)

    ctx.restore()
  }

  /**
   * 渲染状态信息
   */
  renderStatus(ctx) {
    const status = this.reviveManager.getStatus()

    ctx.save()

    // 当前食物
    ctx.fillStyle = '#f1c40f'
    ctx.font = '14px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`当前食物: ${this.foodManager.getTotalFood()}🐟`, canvas.width / 2, 580)

    // 复活惩罚提示
    ctx.fillStyle = '#e74c3c'
    ctx.font = '12px Arial'
    ctx.fillText(`复活后步数 +${status.movePenalty}`, canvas.width / 2, 605)

    ctx.restore()
  }

  /**
   * 渲染按钮
   */
  renderButtons(ctx) {
    const status = this.reviveManager.getStatus()

    this.buttons.forEach((btn, index) => {
      // 检查是否可用
      let disabled = false
      let subText = ''

      if (index === 0) {
        // 分享给好友
        disabled = status.remaining.shareFriend <= 0
        subText = `(今日剩余${status.remaining.shareFriend}次)`
      } else if (index === 1) {
        // 分享到群
        disabled = status.remaining.shareGroup <= 0
        subText = `(今日剩余${status.remaining.shareGroup}次)`
      } else if (index === 2) {
        // 看广告
        disabled = status.remaining.watchAd <= 0
        subText = `(今日剩余${status.remaining.watchAd}次)`
      } else if (index === 3) {
        // 消耗食物
        disabled = !this.reviveManager.hasEnoughFood(this.foodManager)
        subText = `(当前: ${this.foodManager.getTotalFood()}🐟)`
      }

      // 如果已复活，禁用所有复活按钮
      if (status.currentLevelRevived && index < 4) {
        disabled = true
        subText = '(本关已复活)'
      }

      // 渲染按钮
      btn.render(ctx)

      // 渲染副标题
      if (subText) {
        ctx.save()
        ctx.fillStyle = disabled ? '#7f8c8d' : '#bdc3c7'
        ctx.font = '11px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(subText, btn.x + btn.width / 2, btn.y + btn.height + 12)
        ctx.restore()
      }

      // 如果禁用，绘制遮罩
      if (disabled) {
        ctx.save()
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
        ctx.beginPath()
        ctx.roundRect(btn.x, btn.y, btn.width, btn.height, 10)
        ctx.fill()
        ctx.restore()
      }
    })
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
