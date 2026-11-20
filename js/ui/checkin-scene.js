import Button from './button'
import {
  COLORS,
  drawCandyButton,
  drawGlassPanel,
  drawOceanCached,
  drawOceanMotion,
  drawOverlay,
  drawPenguin,
  font,
  fillRoundRect,
  strokeRoundRect
} from './theme'
import { CENTER_X, stage } from './layout'
import { CHECKIN_CYCLE, CHECKIN_REWARDS } from '../utils/checkin-manager'

/**
 * 每日签到弹层（7 日卡）
 *
 * 版式（375×667 设计稿坐标，自上而下）：
 *   面板 96~528
 *     ├ 标题「每日签到」126
 *     ├ 副标题 152（本周第几天 / 累计几天）
 *     ├ 3×2 小格（第 1~6 天）176~309
 *     ├ 第 7 天大卡 316~412
 *     ├ 领取按钮 / 已领胶囊 428~478
 *     └ 底部提示（满签倒计时 / 明日倒计时）500
 *
 * 为什么是整屏场景而不是 menu 里的一个面板：
 *   签到面板有 7 个格子 + 大卡 + 按钮，绘制量接近半个成就页，
 *   塞进 menu-scene（已经 300+ 行）会把它变成第二个 result-scene。
 *   场景化之后触摸路由直接复用 sceneManager，不用在 menu 里手写命中判定。
 *
 * 背景与首页完全一致（同一套海洋 + 海草），只在上面压一层 0.42 遮罩 ——
 * 玩家看到的是「首页上弹了个窗」，而不是「跳到了另一页」。
 */

const PANEL = { x: 30, y: 96, width: 315, height: 432 }

const TITLE_Y = 126
const SUB_Y = 152

const GRID = { x: 52, y: 176, width: 271, cellW: 84, cellH: 62, gapX: 9, gapY: 9 }
const BIG = { x: 52, y: 316, width: 271, height: 96 }
const BTN = { x: 74, y: 428, width: 227, height: 50 }
const FOOT_Y = 500

/** 关闭圆：与成就弹层同一套口径（判定半径比视觉大 6px） */
const CLOSE = { size: 30, inset: 10 }

/** 领取成功后的飘字时长 */
const FLASH_MS = 1000

export default class CheckinScene {
  /**
   * @param {Object} sceneManager
   * @param {Object} checkinManager
   */
  constructor(sceneManager, checkinManager) {
    this.sceneManager = sceneManager
    this.checkinManager = checkinManager

    this.isVisible = false
    this.state = null

    /** 领取飘字：{ text, start } */
    this.flash = null

    // 由 game.js 注入：领完给一声，别在场景里直接拿 audioManager
    this.onClaim = null
    this.onClose = null

    this.claimButton = null
    this.init()
  }

  init() {
    this.claimButton = new Button({
      x: BTN.x,
      y: BTN.y,
      width: BTN.width,
      height: BTN.height,
      text: '领取',
      fontSize: 17,
      bgColor: COLORS.mint,
      hoverColor: COLORS.mintDeep,
      borderColor: '#17876C',
      onClick: () => this.handleClaim()
    })
  }

  /**
   * 窗口尺寸变化后重建按钮
   * 版式本身用设计稿坐标（stage() 会整体缩放），只有 Button 需要重建
   */
  relayout() {
    const onClick = this.claimButton ? this.claimButton.onClick : null
    this.init()
    if (this.claimButton) this.claimButton.onClick = onClick || (() => this.handleClaim())
    this.refresh()
  }

  /**
   * 进入场景
   */
  onEnter() {
    this.isVisible = true
    this.flash = null
    this.refresh()
  }

  onExit() {
    this.isVisible = false
  }

  /**
   * 从 manager 重新取状态，同步按钮
   */
  refresh() {
    if (!this.checkinManager) return

    this.state = this.checkinManager.getState()
    if (!this.claimButton) return

    const rewardText = this.formatReward(this.state.reward)
    this.claimButton.setText(`领取 ${rewardText}`)
    this.claimButton.setVisible(this.state.canClaim)
  }

  /**
   * 奖励文案：`5🐟`、`5🐟 + 1🦐`、`5🐟 + 1🦑`
   * @param {Object} reward
   * @returns {string}
   */
  formatReward(reward) {
    if (!reward) return ''
    const parts = []
    if (reward.fish > 0) parts.push(`${reward.fish}🐟`)
    if (reward.shrimp > 0) parts.push(`${reward.shrimp}🦐`)
    if (reward.squid > 0) parts.push(`${reward.squid}🦑`)
    if (reward.coins > 0) parts.push(`${reward.coins}❄`)
    // 提示券写「提示」而不是 🎫：emoji 在低端机上会被画成方块。
    // 也不写「×1」—— 每档只发一张，格子里横向空间只有 72px，多两个字就要缩到 9px
    if (reward.ticket > 0) parts.push('提示')
    return parts.join(' + ')
  }

  /**
   * 领取
   */
  handleClaim() {
    if (!this.checkinManager) return

    const result = this.checkinManager.claim()
    if (!result.claimed) {
      // 领失败（今天已领 / 容量异常）：只刷新状态，不弹错误框
      this.refresh()
      return
    }

    this.flash = {
      text: `+${this.formatReward(result.reward)}`,
      start: Date.now()
    }

    if (this.onClaim) {
      try {
        this.onClaim(result)
      } catch (e) {
        console.warn('[Checkin] 领取回调失败:', e)
      }
    }

    this.refresh()
  }

  /**
   * 关闭
   */
  close() {
    if (this.onClose) {
      this.onClose()
      return
    }
    if (this.sceneManager) this.sceneManager.switchTo('menu')
  }

  update() {
    if (!this.isVisible) return

    // 倒计时每秒在变，状态里的 nextInMs 要跟着走
    if (this.state && !this.state.canClaim) {
      this.state.countdown = this.checkinManager.formatCountdown()
    }

    if (this.flash && Date.now() - this.flash.start > FLASH_MS) {
      this.flash = null
    }
  }

  render(ctx) {
    if (!this.isVisible) return

    const time = Date.now() / 1000

    // 与首页同一套背景：先画海洋，再压遮罩
    drawOceanCached(ctx)
    drawOceanMotion(ctx, time)
    drawOverlay(ctx, 0.42)

    const s = stage()
    ctx.save()
    s.apply(ctx)

    drawGlassPanel(ctx, PANEL.x, PANEL.y, PANEL.width, PANEL.height, 30)

    this.renderHeader(ctx)
    this.renderCells(ctx)
    this.renderBigCard(ctx, time)
    this.renderFooter(ctx)
    this.renderClose(ctx)
    this.renderFlash(ctx)

    // 按钮在 stage 坐标系里画（设计稿坐标）
    if (this.state && this.state.canClaim && this.claimButton) {
      this.claimButton.render(ctx)
    } else {
      this.renderDonePill(ctx)
    }

    ctx.restore()
  }

  /**
   * 标题 + 副标题
   */
  renderHeader(ctx) {
    const state = this.state
    if (!state) return

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = COLORS.navy
    ctx.font = font(22)
    ctx.fillText('每日签到', CENTER_X, TITLE_Y)

    ctx.fillStyle = COLORS.navySoft
    ctx.font = font(11.5, 'normal')
    ctx.fillText(this.getSubtitle(state), CENTER_X, SUB_Y)
  }

  /**
   * 副标题文案
   *
   * **不能把它写成「连续 N 天」**：签到是 7 天一循环，第 8 天会回到第 1 档，
   * 连签 30 天的玩家会在这里看到「连续 0 天 / 第 1 天」，像是进度被清了。
   * 所以口径拆成两条：
   *   - 「本周第 N 天」= 周期内进度（决定今天发哪一档）
   *   - 「累计 N 天」  = 只增不减，断签也不清零（玩家真正在意的那个数）
   *
   * @param {Object} [state] - checkinManager.getState()
   * @returns {string}
   */
  getSubtitle(state = this.state) {
    if (!state) return ''

    const total = Math.max(0, state.totalDays || 0)

    if (!state.canClaim) {
      // 今天已领：说清本周进度 + 明天再来
      return `本周已签 ${state.claimedDay}/${CHECKIN_CYCLE} · 明天再来`
    }
    if (state.todayDay === 1 && total > 0) {
      // 第 8 / 15 / 22 天：新一周开始，先把「累计」亮出来，别让人以为进度被清了
      return `新一周开始 · 累计签到 ${total} 天`
    }
    if (state.todayDay === 1) {
      return `第 1 天 · 连签 ${CHECKIN_CYCLE} 天领满签礼`
    }
    return `本周第 ${state.todayDay} 天 · 累计 ${total} 天`
  }

  /**
   * 第 1~6 天的小格
   */
  renderCells(ctx) {
    const state = this.state
    if (!state) return

    for (let day = 1; day <= 6; day++) {
      const col = (day - 1) % 3
      const row = Math.floor((day - 1) / 3)
      const x = GRID.x + col * (GRID.cellW + GRID.gapX)
      const y = GRID.y + row * (GRID.cellH + GRID.gapY)

      const done = day <= state.claimedDay
      const today = state.canClaim && day === state.todayDay

      let fill = 'rgba(255, 255, 255, 0.9)'
      let border = 'rgba(31, 58, 95, 0.10)'
      let valueColor = COLORS.navy

      if (done) {
        fill = 'rgba(47, 191, 155, 0.14)'
        border = 'rgba(47, 191, 155, 0.40)'
        valueColor = COLORS.mintDeep
      }
      if (today) {
        fill = 'rgba(255, 201, 74, 0.26)'
        border = COLORS.yellowDeep
        valueColor = COLORS.yellowInk
      }

      fillRoundRect(ctx, x, y, GRID.cellW, GRID.cellH, 14, fill)
      strokeRoundRect(ctx, x, y, GRID.cellW, GRID.cellH, 14, border, 1.5)

      // 「第 N 天」
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = done ? COLORS.mintDeep : COLORS.navySoft
      ctx.font = font(9.5)
      ctx.fillText(`第 ${day} 天`, x + GRID.cellW / 2, y + 18)

      // 奖励
      const reward = this.getRewardOf(day)
      this.drawFitText(
        ctx,
        this.formatReward(reward),
        x + GRID.cellW / 2,
        y + 40,
        GRID.cellW - 12,
        13,
        valueColor
      )

      // 已领 √ 压在右上角
      if (done) {
        ctx.textAlign = 'center'
        ctx.fillStyle = COLORS.mintDeep
        ctx.font = font(11)
        ctx.fillText('✓', x + GRID.cellW - 11, y + 12)
      }
    }
  }

  /**
   * 第 7 天：本周满签礼
   *
   * 唯一一块有企鹅的格子 —— 满签礼要有「东西在那儿等你」的实感，
   * 纯文字的一行奖励撑不起「再签 N 天」的期待。
   */
  renderBigCard(ctx, time) {
    const state = this.state
    if (!state) return

    const { x, y, width, height } = BIG
    const claimed = state.claimedDay >= CHECKIN_CYCLE
    const isToday = state.canClaim && state.todayDay === CHECKIN_CYCLE

    const grad = ctx.createLinearGradient(x, y, x + width, y + height)
    grad.addColorStop(0, claimed ? 'rgba(47, 191, 155, 0.18)' : 'rgba(167, 139, 250, 0.20)')
    grad.addColorStop(1, claimed ? 'rgba(47, 191, 155, 0.10)' : 'rgba(255, 127, 176, 0.18)')

    fillRoundRect(ctx, x, y, width, height, 16, grad)
    strokeRoundRect(
      ctx,
      x,
      y,
      width,
      height,
      16,
      isToday ? COLORS.yellowDeep : 'rgba(139, 107, 232, 0.35)',
      isToday ? 2 : 1.5
    )

    const reward = this.getRewardOf(CHECKIN_CYCLE)

    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'

    ctx.fillStyle = COLORS.lavenderDeep
    ctx.font = font(9.5)
    ctx.fillText(`第 ${CHECKIN_CYCLE} 天 · 本周满签礼`, x + 14, y + 22)

    ctx.fillStyle = COLORS.navy
    ctx.font = font(14)
    ctx.fillText(this.formatReward(reward), x + 14, y + 46)

    // 还差几天满签：这是整张卡里最重要的一句话
    // 首次满签会额外送限定外观：只在「今天就是第 7 天、且还没有」时点出来。
    // 每周都写「送圣诞帽」的话，第二周就不成立了。
    const pendingSkin = this.checkinManager && this.checkinManager.getPendingSkin
      ? this.checkinManager.getPendingSkin()
      : null

    let tip
    if (claimed) {
      tip = '已拿到 · 明天开启新一周'
    } else if (isToday && pendingSkin) {
      tip = '今天满签 · 首次送圣诞帽'
    } else if (isToday) {
      tip = '今天就能领走'
    } else {
      tip = `再签 ${this.getDaysToBigReward(state)} 天到手`
    }
    ctx.fillStyle = claimed ? COLORS.mintDeep : COLORS.lavenderDeep
    ctx.font = font(11)
    ctx.fillText(tip, x + 14, y + 68)

    // 企鹅站台：满签礼要有实体
    const bob = Math.sin(time * 2) * 1.6
    drawPenguin(ctx, x + width - 46, y + height / 2 + 4 + bob, 1.05, {
      pose: claimed ? 'cheer' : 'hold',
      mood: claimed ? 'happy' : 'idle',
      prop: claimed ? 'star' : 'trophy'
    })
  }

  /**
   * 距「满签」（第 7 天）还差几天（可以领的当天算 1 天）
   *
   * **大卡和底部那行必须共用这一个函数**：早先大卡用「已领天数」算、底部用
   * 「今天第几档」算，第 1 天会同时出现「再签 7 天到手」和「再签 6 天就能拿到」。
   * 口径统一成「今天这一档还差几步」之后，领完今天才推进一格。
   *
   * @param {Object} [state] - checkinManager.getState()；不传就用当前状态
   * @returns {number} 0 表示今天就是最后一天（或已经拿到）
   */
  getDaysToBigReward(state = this.state) {
    if (!state) return 0
    const from = state.canClaim ? state.todayDay : state.claimedDay
    return Math.max(0, CHECKIN_CYCLE - from)
  }

  /**
   * 底部一行：可领时提示还差几天，已领时给倒计时
   */
  renderFooter(ctx) {
    const state = this.state
    if (!state) return

    let text
    if (state.canClaim) {
      const left = this.getDaysToBigReward(state)
      text = left > 0 ? `再签 ${left} 天就能满签` : '今天是本周最后一档'
    } else {
      text = `明天见 · 距下次签到 ${state.countdown}`
    }

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = COLORS.navySoft
    ctx.font = font(11, 'normal')
    ctx.fillText(text, CENTER_X, FOOT_Y)
  }

  /**
   * 已领状态：按钮位置换成一颗灰薄荷胶囊
   * 不把 Button 画成禁用色 —— 它按下还有音效，会让人以为点得动
   */
  renderDonePill(ctx) {
    const state = this.state
    if (!state) return

    drawCandyButton(ctx, BTN.x, BTN.y, BTN.width, BTN.height, {
      color: 'rgba(47, 191, 155, 0.22)',
      shadowColor: 'rgba(47, 191, 155, 0.30)',
      radius: BTN.height / 2
    })

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = COLORS.mintDeep
    ctx.font = font(16)
    ctx.fillText('今天已领取', CENTER_X, BTN.y + BTN.height / 2)
  }

  /**
   * 右上角 ✕（白圆底 + 深紫叉）
   */
  renderClose(ctx) {
    const center = this.getCloseCenter()
    const r = CLOSE.size / 2

    ctx.beginPath()
    ctx.arc(center.x, center.y, r, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(139, 107, 232, 0.35)'
    ctx.lineWidth = 1.2
    ctx.stroke()

    ctx.strokeStyle = COLORS.lavenderDeep
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    const d = 4.6
    ctx.beginPath()
    ctx.moveTo(center.x - d, center.y - d)
    ctx.lineTo(center.x + d, center.y + d)
    ctx.moveTo(center.x + d, center.y - d)
    ctx.lineTo(center.x - d, center.y + d)
    ctx.stroke()
  }

  /**
   * 领取后的飘字：从按钮上方轻轻浮起再淡出
   *
   * 必须是「带底的胶囊」而不是裸文字：飘字正好路过第 7 天大卡的底边，
   * 裸文字压在半透明色块上会糊成一块，看不出是刚领到的奖励。
   */
  renderFlash(ctx) {
    if (!this.flash) return

    const t = (Date.now() - this.flash.start) / FLASH_MS
    if (t < 0 || t > 1) return

    const y = BTN.y - 20 - t * 18

    ctx.save()
    ctx.globalAlpha = 1 - Math.max(0, (t - 0.55) / 0.45)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = font(17)

    const width = ctx.measureText(this.flash.text).width + 30
    fillRoundRect(ctx, CENTER_X - width / 2, y - 15, width, 30, 15, 'rgba(255, 249, 238, 0.96)')
    strokeRoundRect(ctx, CENTER_X - width / 2, y - 15, width, 30, 15, 'rgba(47, 191, 155, 0.45)', 1.5)

    ctx.fillStyle = COLORS.mintDeep
    ctx.fillText(this.flash.text, CENTER_X, y)
    ctx.restore()
  }

  /**
   * 某一天的奖励
   *
   * 直接读模块里的奖励表：场景只负责画，数值口径只有 `checkin-manager.js` 一份。
   * 越界钳到首尾，避免读表时 undefined。
   * @param {number} day
   */
  getRewardOf(day) {
    const index = Math.min(Math.max(1, day), CHECKIN_REWARDS.length) - 1
    return CHECKIN_REWARDS[index]
  }

  /**
   * 关闭圆圆心（只由面板矩形算，别处不要手写坐标）
   */
  getCloseCenter() {
    return {
      x: PANEL.x + PANEL.width - CLOSE.inset - CLOSE.size / 2,
      y: PANEL.y + CLOSE.inset + CLOSE.size / 2,
      radius: CLOSE.size / 2
    }
  }

  /**
   * 单行文字：超出宽度就缩字号，不截断
   */
  drawFitText(ctx, text, centerX, y, maxWidth, size, color) {
    let current = size
    ctx.font = font(current)
    while (current > 8 && ctx.measureText(text).width > maxWidth) {
      current -= 0.5
      ctx.font = font(current)
    }
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = color
    ctx.fillText(text, centerX, y)
  }

  onTouchStart(touch) {
    if (!this.isVisible) return false

    const t = stage().unproject(touch)

    // 点关闭圆
    const close = this.getCloseCenter()
    if (Math.hypot(t.clientX - close.x, t.clientY - close.y) <= close.radius + 6) {
      this.close()
      return true
    }

    // 点面板外空白处也关闭（弹层惯例）
    const inPanel = t.clientX >= PANEL.x && t.clientX <= PANEL.x + PANEL.width &&
      t.clientY >= PANEL.y && t.clientY <= PANEL.y + PANEL.height
    if (!inPanel) {
      this.close()
      return true
    }

    if (this.state && this.state.canClaim && this.claimButton) {
      this.claimButton.onTouchStart(t)
    }
    return true
  }

  onTouchMove(touch) {
    if (!this.isVisible) return
    if (!this.state || !this.state.canClaim || !this.claimButton) return

    const t = stage().unproject(touch)
    this.claimButton.isHovered = this.claimButton.contains(t.clientX, t.clientY)
  }

  onTouchEnd(touch) {
    if (!this.isVisible) return false

    const t = stage().unproject(touch)
    if (this.state && this.state.canClaim && this.claimButton) {
      this.claimButton.onTouchEnd(t)
    }
    return true
  }
}
