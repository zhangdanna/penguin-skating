/**
 * 复活选择场景
 * 显示复活选项界面
 */
import Button from './button'
import {
  COLORS,
  drawGlassPanel,
  drawOverlay,
  drawPenguin,
  drawStickerText,
  fillRoundRect,
  font
} from './theme'

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
    const buttonWidth = 250
    const buttonHeight = 46
    const buttonSpacing = 24
    const startY = 226

    // 分享给好友按钮
    this.buttons.push(new Button({
      x: centerX - buttonWidth / 2,
      y: startY,
      width: buttonWidth,
      height: buttonHeight,
      text: '🎯 分享给好友',
      fontSize: 17,
      bgColor: COLORS.water,
      hoverColor: COLORS.waterDeep,
      borderColor: '#1F7FAE',
      onClick: () => this.handleRevive('shareFriend')
    }))

    // 分享到群按钮
    this.buttons.push(new Button({
      x: centerX - buttonWidth / 2,
      y: startY + (buttonHeight + buttonSpacing),
      width: buttonWidth,
      height: buttonHeight,
      text: '👥 分享到群聊',
      fontSize: 17,
      bgColor: COLORS.mint,
      hoverColor: COLORS.mintDeep,
      borderColor: '#17876C',
      onClick: () => this.handleRevive('shareGroup')
    }))

    // 看广告按钮
    this.buttons.push(new Button({
      x: centerX - buttonWidth / 2,
      y: startY + (buttonHeight + buttonSpacing) * 2,
      width: buttonWidth,
      height: buttonHeight,
      text: '📺 看视频复活',
      fontSize: 17,
      bgColor: COLORS.yellow,
      hoverColor: COLORS.yellowDeep,
      borderColor: '#B8861C',
      onClick: () => this.handleRevive('watchAd')
    }))

    // 消耗食物按钮
    this.buttons.push(new Button({
      x: centerX - buttonWidth / 2,
      y: startY + (buttonHeight + buttonSpacing) * 3,
      width: buttonWidth,
      height: buttonHeight,
      text: `🐟 ${this.reviveManager.foodCost}食物复活`,
      fontSize: 17,
      bgColor: COLORS.orange,
      hoverColor: COLORS.orangeDeep,
      borderColor: '#C1651F',
      onClick: () => this.handleRevive('useFood')
    }))

    // 放弃按钮
    this.buttons.push(new Button({
      x: centerX - buttonWidth / 2,
      y: startY + (buttonHeight + buttonSpacing) * 4 + 20,
      width: buttonWidth,
      height: buttonHeight,
      text: '放弃重玩',
      fontSize: 17,
      bgColor: COLORS.lavender,
      hoverColor: COLORS.lavenderDeep,
      borderColor: '#7255CC',
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

    // 深蓝遮罩 + 奶油面板
    drawOverlay(ctx, 0.62)
    drawGlassPanel(ctx, 24, 70, 327, 580, 30, {
      fill: 'rgba(255, 249, 238, 0.97)'
    })

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
    const centerX = canvas.width / 2

    // 落水企鹅
    drawPenguin(ctx, centerX, 118, 1.5, { sad: true })

    // 标题文字
    drawStickerText(ctx, '企鹅掉进冰洞！', centerX, 182, {
      size: 26,
      color: COLORS.coral,
      stroke: COLORS.navyDeep,
      strokeWidth: 4
    })

    // 副标题
    ctx.font = font(12, 'normal')
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = COLORS.navySoft
    ctx.fillText('选择一种方式复活', centerX, 208)
  }

  /**
   * 渲染状态信息
   */
  renderStatus(ctx) {
    const status = this.reviveManager.getStatus()
    const centerX = canvas.width / 2

    ctx.save()

    // 当前食物
    ctx.font = font(13)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = COLORS.yellowDeep
    ctx.fillText(`当前食物: ${this.foodManager.getTotalFood()}🐟`, centerX, 604)

    // 复活惩罚提示
    ctx.font = font(11, 'normal')
    ctx.fillStyle = COLORS.navySoft
    ctx.fillText(`复活后步数 +${status.movePenalty}`, centerX, 626)

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

      // 如果禁用，绘制遮罩
      if (disabled) {
        fillRoundRect(ctx, btn.x, btn.y, btn.width, btn.height, btn.height / 2, 'rgba(31, 58, 95, 0.45)')
      }

      // 渲染副标题
      if (subText) {
        ctx.save()
        ctx.fillStyle = disabled ? 'rgba(74, 107, 140, 0.6)' : COLORS.navySoft
        ctx.font = font(11, 'normal')
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(subText, btn.x + btn.width / 2, btn.y + btn.height + 11)
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
