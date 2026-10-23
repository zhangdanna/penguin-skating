/**
 * 隐私授权弹窗（B4）
 *
 * 微信自 2023-09 起要求：小游戏在调用涉及用户信息的接口
 * （wx.getUserInfo / wx.setUserCloudStorage / wx.getUserProfile 等）前，
 * 必须先完成《用户隐私保护指引》的授权。
 *
 * 触发链路：
 *   wx.onNeedPrivacyAuthorization((resolve, eventInfo) => { ... })
 *   → 本弹窗展示
 *   → 用户点"同意并继续" → resolve({ event: 'agree' })
 *   → 用户点"暂不使用"   → resolve({ event: 'disagree' })
 *
 * 注意：这里不做"首启强弹"。微信只会在真正调用隐私接口时回调，
 * 拒绝后核心玩法（推箱子）依然可以正常玩，只是排行榜/云存档不可用。
 */
import Button from './button'
import {
  COLORS,
  drawOverlay,
  fillRoundRect,
  font
} from './theme'
import { DESIGN_HEIGHT, DESIGN_WIDTH, stage } from './layout'

const PANEL_PADDING = 24
const LINE_HEIGHT = 21

export default class PrivacyScene {
  constructor() {
    this.isVisible = false

    // wx.onNeedPrivacyAuthorization 传入的 resolve
    this.resolve = null

    this.buttons = []
    this.init()
  }

  init() {
    const panel = this.getPanelRect()
    const centerX = panel.x + panel.width / 2
    const buttonWidth = Math.min(220, panel.width - 64)
    const buttonHeight = 46
    const agreeY = panel.y + panel.height - 128

    // 同意并继续
    this.buttons.push(new Button({
      x: centerX - buttonWidth / 2,
      y: agreeY,
      width: buttonWidth,
      height: buttonHeight,
      text: '同意并继续',
      fontSize: 17,
      bgColor: COLORS.mint,
      hoverColor: COLORS.mintDeep,
      borderColor: '#17876C',
      onClick: () => this.handleAgree()
    }))

    // 暂不使用
    this.buttons.push(new Button({
      x: centerX - buttonWidth / 2,
      y: agreeY + buttonHeight + 14,
      width: buttonWidth,
      height: buttonHeight,
      text: '暂不使用',
      fontSize: 17,
      bgColor: COLORS.lavender,
      hoverColor: COLORS.lavenderDeep,
      borderColor: '#7255CC',
      onClick: () => this.handleDisagree()
    }))

    this.agreeButton = this.buttons[0]
  }

  /**
   * 窗口尺寸变化后重排
   * 弹窗本身按设计稿居中（与画布尺寸无关），重排只为保持一致接口
   */
  relayout() {
    this.buttons = []
    this.init()
  }

  /**
   * 面板矩形（居中，随屏幕高度收缩）
   */
  getPanelRect() {
    const width = Math.min(DESIGN_WIDTH - 48, 340)
    const height = Math.min(DESIGN_HEIGHT - 120, 400)

    return {
      x: Math.round((DESIGN_WIDTH - width) / 2),
      y: Math.round((DESIGN_HEIGHT - height) / 2),
      width,
      height
    }
  }

  /**
   * 展示弹窗
   * @param {Function} resolve - wx.onNeedPrivacyAuthorization 给出的 resolve
   */
  show(resolve) {
    // 极端情况下同一时刻只保留最新一次请求
    if (this.resolve && this.resolve !== resolve) {
      this.resolve({ event: 'disagree' })
    }

    this.resolve = resolve || null
    this.isVisible = true
  }

  hide() {
    this.isVisible = false
  }

  /**
   * 用户同意
   */
  handleAgree() {
    const resolve = this.resolve
    this.resolve = null
    this.hide()

    if (resolve) resolve({ event: 'agree' })
  }

  /**
   * 用户拒绝
   */
  handleDisagree() {
    const resolve = this.resolve
    this.resolve = null
    this.hide()

    if (resolve) resolve({ event: 'disagree' })
  }

  /**
   * 打开《用户隐私保护指引》
   */
  openContract() {
    if (wx.openPrivacyContract) {
      wx.openPrivacyContract({
        fail: () => {
          wx.showToast({ title: '请稍后在小游戏资料页查看', icon: 'none' })
        }
      })
    } else {
      wx.showToast({ title: '请在小游戏资料页查看隐私指引', icon: 'none' })
    }
  }

  /**
   * 渲染
   */
  render(ctx) {
    if (!this.isVisible) return

    // 遮罩铺满真实屏幕
    drawOverlay(ctx, 0.66)

    const s = stage()
    ctx.save()
    s.apply(ctx)

    const panel = this.getPanelRect()

    // 面板
    fillRoundRect(ctx, panel.x, panel.y, panel.width, panel.height, 24, 'rgba(255, 249, 238, 0.98)')
    ctx.save()
    ctx.strokeStyle = 'rgba(31, 58, 95, 0.16)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect
      ? ctx.roundRect(panel.x, panel.y, panel.width, panel.height, 24)
      : ctx.rect(panel.x, panel.y, panel.width, panel.height)
    ctx.stroke()
    ctx.restore()

    this.renderTitle(ctx, panel)
    this.renderBody(ctx, panel)
    this.renderContractLink(ctx, panel)

    this.buttons.forEach(btn => btn.render(ctx))

    ctx.restore()
  }

  renderTitle(ctx, panel) {
    ctx.save()
    ctx.font = font(20, 'bold')
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = COLORS.navyDeep
    ctx.fillText('用户隐私保护指引', panel.x + panel.width / 2, panel.y + 40)
    ctx.restore()
  }

  renderBody(ctx, panel) {
    const text = '为了展示好友排行榜、保存游戏进度与成就，企鹅滑冰需要使用你的微信昵称、头像和游戏数据。我们不会收集与游戏无关的信息，也不会向第三方提供。'

    ctx.save()
    ctx.font = font(13, 'normal')
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillStyle = COLORS.navy

    const maxWidth = panel.width - PANEL_PADDING * 2
    const lines = this.wrapText(ctx, text, maxWidth)
    let y = panel.y + 74

    lines.forEach(line => {
      ctx.fillText(line, panel.x + PANEL_PADDING, y)
      y += LINE_HEIGHT
    })

    ctx.restore()
  }

  renderContractLink(ctx, panel) {
    const text = '查看《用户隐私保护指引》'

    ctx.save()
    ctx.font = font(12, 'normal')
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = COLORS.waterDeep

    const y = this.agreeButton.y - 26
    const centerX = panel.x + panel.width / 2
    ctx.fillText(text, centerX, y)

    // 下划线，暗示可点击
    const width = ctx.measureText(text).width
    ctx.strokeStyle = COLORS.waterDeep
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(centerX - width / 2, y + 9)
    ctx.lineTo(centerX + width / 2, y + 9)
    ctx.stroke()

    this.contractLinkRect = {
      x: centerX - width / 2 - 8,
      y: y - 12,
      width: width + 16,
      height: 24
    }
    ctx.restore()
  }

  /**
   * 按宽度折行（中文逐字测量）
   */
  wrapText(ctx, text, maxWidth) {
    const lines = []
    let line = ''

    for (const char of text) {
      const test = line + char
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line)
        line = char
      } else {
        line = test
      }
    }

    if (line) lines.push(line)
    return lines
  }

  /**
   * 触摸开始
   */
  onTouchStart(touch) {
    if (!this.isVisible) return
    const t = stage().unproject(touch)
    this.buttons.forEach(btn => btn.onTouchStart(t))
  }

  onTouchMove(touch) {
    if (!this.isVisible) return
    const t = stage().unproject(touch)
    this.buttons.forEach(btn => {
      btn.isHovered = btn.contains(t.clientX, t.clientY)
    })
  }

  onTouchEnd(touch) {
    if (!this.isVisible) return

    const t = stage().unproject(touch)

    // 先判断"查看指引"链接
    const rect = this.contractLinkRect
    if (rect &&
        t.clientX >= rect.x && t.clientX <= rect.x + rect.width &&
        t.clientY >= rect.y && t.clientY <= rect.y + rect.height) {
      this.openContract()
      return
    }

    this.buttons.forEach(btn => btn.onTouchEnd(t))
  }

  /**
   * 弹窗展示时吞掉所有输入
   */
  contains() {
    return this.isVisible
  }
}
