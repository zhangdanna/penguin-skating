/**
 * 复活选择场景
 *
 * 合规说明（B1）：
 * 微信《小程序运营规范》明确禁止"分享后才能继续游戏/获得奖励"的诱导分享行为。
 * 因此这里只保留两种复活方式：
 *   1. 看激励视频（需后台开通流量主并配置真实广告位）
 *   2. 消耗游戏内食物
 * 分享仅作为纯传播能力保留在菜单/登录页，不与任何奖励挂钩。
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
import { CENTER_X, DESIGN_HEIGHT, DESIGN_WIDTH, stage } from './layout'

// "放弃重玩"与复活方式之间留出更大间距，避免误触
const GIVE_UP_GAP = 20

export default class ReviveScene {
  constructor(reviveManager, foodManager, adManager = null) {
    this.reviveManager = reviveManager
    this.foodManager = foodManager
    this.adManager = adManager
    this.isVisible = false

    // 回调
    this.onReviveSuccess = null
    this.onReviveFail = null
    this.onGiveUp = null

    this.buttons = []
    this.init()
  }

  init() {
    this.buttons = []
    const centerX = CENTER_X
    const buttonWidth = 250
    const buttonHeight = 46
    const buttonSpacing = 24
    const startY = 226

    // 看广告按钮
    this.buttons.push(new Button({
      x: centerX - buttonWidth / 2,
      y: startY,
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
      y: startY + (buttonHeight + buttonSpacing),
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
      y: startY + (buttonHeight + buttonSpacing) * 2 + GIVE_UP_GAP,
      width: buttonWidth,
      height: buttonHeight,
      text: '放弃重玩',
      fontSize: 17,
      bgColor: COLORS.lavender,
      hoverColor: COLORS.lavenderDeep,
      borderColor: '#7255CC',
      onClick: () => this.handleGiveUp()
    }))

    // 按钮与复活方式的对应关系：按 key 隐藏/重排，避免依赖数组下标
    this.buttonKeys = ['watchAd', 'useFood', 'giveUp']
    this.buttonStartY = startY
    this.buttonHeight = buttonHeight
    this.buttonSpacing = buttonSpacing
    this.relayoutButtons()
  }

  /**
   * 显示/隐藏某个复活入口
   * @param {string} key - watchAd | useFood | giveUp
   * @param {boolean} visible
   */
  setOptionVisible(key, visible) {
    const index = this.buttonKeys ? this.buttonKeys.indexOf(key) : -1
    if (index < 0) return

    this.buttons[index].setVisible(!!visible)
    this.relayoutButtons()
  }

  /**
   * 按当前可见按钮重新排布纵向位置，隐藏后不留空档
   */
  relayoutButtons() {
    if (!this.buttonKeys) return

    const step = this.buttonHeight + this.buttonSpacing
    let slot = 0

    this.buttonKeys.forEach((key, index) => {
      const btn = this.buttons[index]
      if (!btn || !btn.isVisible) return
      const extra = key === 'giveUp' ? GIVE_UP_GAP : 0
      btn.y = Math.round(this.buttonStartY + slot * step + extra)
      slot++
    })
  }

  /**
   * 面板矩形：高度随可见按钮数量收缩，避免底部大片空白
   */
  getPanelRect() {
    const last = this.buttons[this.buttons.length - 1]
    const bottom = last ? last.y + last.height : this.buttonStartY + this.buttonHeight
    const height = Math.min(DESIGN_HEIGHT - 70 - 24, bottom + 96 - 70)

    return {
      x: 24,
      y: 70,
      width: DESIGN_WIDTH - 48,
      height
    }
  }

  /**
   * 窗口尺寸变化后重建按钮（C1/C2）
   */
  relayout() {
    this.init()
  }

  /**
   * 处理复活
   */
  handleRevive(type) {
    // 入口被隐藏时直接忽略（如广告位未接入）
    const index = this.buttonKeys ? this.buttonKeys.indexOf(type) : -1
    if (index >= 0 && !this.buttons[index].isVisible) {
      wx.showToast({ title: '该复活方式暂不可用', icon: 'none' })
      return
    }

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
        title: `复活成功！步数+${result.movePenalty}`,
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
   * 看广告复活
   * 只有完整观看（isEnded === true）才发放奖励，中途关闭一律不复活。
   */
  watchAd(callback) {
    if (!this.adManager || !this.adManager.isRewardedVideoAvailable()) {
      wx.showToast({ title: '广告暂不可用', icon: 'none' })
      return
    }

    this.adManager.showRewardedVideoAd().then((ended) => {
      if (ended) {
        callback && callback()
      } else {
        wx.showToast({ title: '未看完视频，无法复活', icon: 'none' })
      }
    }).catch(() => {
      wx.showToast({ title: '广告加载失败，请稍后再试', icon: 'none' })
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

    // 深蓝遮罩（真实像素铺满）
    drawOverlay(ctx, 0.62)

    const s = stage()
    ctx.save()
    s.apply(ctx)

    const panel = this.getPanelRect()

    drawGlassPanel(ctx, panel.x, panel.y, panel.width, panel.height, 30, {
      fill: 'rgba(255, 249, 238, 0.97)'
    })

    this.renderTitle(ctx)
    this.renderStatus(ctx, panel)
    this.renderButtons(ctx)

    ctx.restore()
  }

  /**
   * 渲染标题
   */
  renderTitle(ctx) {
    const centerX = CENTER_X

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
   * 渲染状态信息（贴在面板底部，随面板高度浮动）
   */
  renderStatus(ctx, panel) {
    const status = this.reviveManager.getStatus()
    const centerX = CENTER_X
    const baseY = panel.y + panel.height - 46

    ctx.save()

    // 当前食物
    ctx.font = font(13)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = COLORS.yellowDeep
    ctx.fillText(`当前食物: ${this.foodManager.getTotalFood()}🐟`, centerX, baseY)

    // 复活惩罚提示
    ctx.font = font(11, 'normal')
    ctx.fillStyle = COLORS.navySoft
    ctx.fillText(`复活后步数 +${status.movePenalty}`, centerX, baseY + 22)

    ctx.restore()
  }

  /**
   * 渲染按钮
   */
  renderButtons(ctx) {
    const status = this.reviveManager.getStatus()

    this.buttons.forEach((btn, index) => {
      if (!btn.isVisible) return

      const key = this.buttonKeys[index]
      let disabled = false
      let subText = ''

      if (key === 'watchAd') {
        disabled = status.remaining.watchAd <= 0
        subText = `(今日剩余${status.remaining.watchAd}次)`
      } else if (key === 'useFood') {
        disabled = !this.reviveManager.hasEnoughFood(this.foodManager)
        subText = `(当前: ${this.foodManager.getTotalFood()}🐟)`
      }

      // 本关已复活过：所有复活方式都不可用（"放弃重玩"除外）
      if (status.currentLevelRevived && key !== 'giveUp') {
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
    const t = stage().unproject(touch)
    this.buttons.forEach(btn => btn.onTouchStart(t))
  }

  /**
   * 触摸移动
   */
  onTouchMove(touch) {
    if (!this.isVisible) return
    this.buttons.forEach(btn => {
      const t = stage().unproject(touch)
      btn.isHovered = btn.contains(t.clientX, t.clientY)
    })
  }

  /**
   * 触摸结束
   */
  onTouchEnd(touch) {
    if (!this.isVisible) return
    const t = stage().unproject(touch)
    this.buttons.forEach(btn => btn.onTouchEnd(t))
  }

  /**
   * 检查是否包含某点
   */
  contains(x, y) {
    return this.isVisible
  }
}
