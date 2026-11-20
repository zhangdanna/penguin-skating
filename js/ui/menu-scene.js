import Button from './button'
import {
  COLORS,
  drawCandyButton,
  drawOceanCached,
  drawOceanMotion,
  drawPenguin,
  drawStickerText,
  fillRoundRect,
  font,
  strokeRoundRect
} from './theme'
import { CENTER_X, stage } from './layout'
import { DEFAULT_MAINLINE_TOTAL, formatLevelProgressText } from '../utils/level-progress'

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
    this.onCheckin = null
    this.soundEnabled = true

    // 签到浮标（左上角）。不占 2×2 按钮区 —— 那 4 个位置已经排满，
    // 塞第 5 个只能缩小或加行，两者都会让首页变挤。
    // 状态由 game.js 注入：() => { claimable, day }
    this.getCheckinState = null
    this.checkinRect = { x: 10, y: 10, size: 40 }
    this.checkinPressed = false

    // 商城浮标：放在签到正下方，两者同一条竖线（x=10）。
    //
    // 为什么不在右上角：微信胶囊占着右上角，标题 50px+7px 描边实际画到
    // x≈319，放右边不是被系统菜单挡住就是压在「乐」字上。
    // 原位置 (14,22)/(14,76) 右边缘 58 会压住标题首字左侧描边（用户反馈
    // 「遮住了首页的标题」）。现在整体抬到 y=10 / y=68，右边缘 50，
    // 中间留 18px —— 既不再盖标题，也不会两个圆黏在一起。
    this.onShop = null
    this.getCoinBalance = null
    this.shopRect = { x: 10, y: 68, size: 40 }
    this.shopPressed = false

    // 动画参数
    this.titleY = 0
    this.titleTargetY = 118
    this.penguinAngle = 0

    // 主线总关数（由 game.js 的 syncLevelTotal 下发）
    this.totalLevels = DEFAULT_MAINLINE_TOTAL

    this.init()
  }

  /**
   * 设置主线总关数
   * @param {number} total
   */
  setLevelTotal(total) {
    const n = Math.floor(Number(total))
    if (Number.isFinite(n) && n > 0) this.totalLevels = n
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

  onEnter(data) {
    // 从签到这类「盖在首页上的弹层」返回时不重播标题下落，
    // 否则关一次弹窗看起来像整页重载了一次
    if (!data || !data.keepAnim) {
      this.titleY = -100
      this.titleTargetY = 118
    }

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
    this.renderCheckinFloat(ctx, time)
    this.renderShopFloat(ctx, time)
    this.renderPenguin(ctx, time)
    this.buttons.forEach(btn => btn.render(ctx))
    this.renderLevelProgress(ctx)
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
   * 首页进度：主按钮下方一行小字
   *
   * 主按钮只写「第12关」，玩家看不出总共有多少关（玩家反馈）。
   * 这一行补上分母和已通关数，位置在「开始按钮」与次级按钮之间
   * （454~500 的空白），不额外占高度。
   */
  renderLevelProgress(ctx) {
    const level = this.getProgressLevel()
    const text = formatLevelProgressText(level, this.totalLevels)

    drawStickerText(ctx, text, CENTER_X, 476, {
      size: 12,
      color: COLORS.white,
      stroke: COLORS.navyDeep,
      strokeWidth: 3
    })
  }

  /**
   * 渲染操作说明
   *
   * 这句话是玩家进游戏前唯一看到的玩法介绍，必须点明「目标是谁」：
   * 旧文案只说「推到目标区域」，而目标区当时画得和冰块同色，玩家找不到。
   */
  renderInstructions(ctx) {
    drawStickerText(ctx, '滑动屏幕 · 用最短路径把冰块推到小鱼展台', CENTER_X, 634, {
      size: 13,
      color: COLORS.white,
      stroke: COLORS.navyDeep,
      strokeWidth: 3
    })
  }

  renderTitle(ctx) {
    const centerX = CENTER_X

    // 标题投影
    drawStickerText(ctx, '一企推推乐', centerX, this.titleY + 5, {
      size: 50,
      color: 'rgba(31, 58, 95, 0.22)',
      strokeWidth: 0
    })

    // 主标题
    drawStickerText(ctx, '一企推推乐', centerX, this.titleY, {
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

  /**
   * 两枚浮标共用的「糖果徽章」底：柔光圈 + 厚投影 + 彩色渐变环 + 白色内盘。
   * 之前只是白圆 + 小图标，在浅蓝水面上几乎没有存在感（用户反馈「不够好看」）。
   * 全部用叠加圆做层次，不用 shadowBlur（全项目禁用）。
   */
  drawFloatBadge(ctx, r, top, bottom, rim) {
    // 柔光：两圈很淡的白，让徽章像浮在水面前一层
    ctx.beginPath()
    ctx.arc(0, 0, r + 6, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(0, 0, r + 3, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.26)'
    ctx.fill()

    // 厚投影
    ctx.beginPath()
    ctx.arc(0, 4, r, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(31, 58, 95, 0.20)'
    ctx.fill()

    // 彩色外环
    const grad = ctx.createLinearGradient(0, -r, 0, r)
    grad.addColorStop(0, top)
    grad.addColorStop(1, bottom)
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()
    ctx.strokeStyle = rim
    ctx.lineWidth = 2.2
    ctx.stroke()

    // 白色内盘：图标放在这上面对比度最高
    ctx.beginPath()
    ctx.arc(0, -0.5, r - 4.6, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.94)'
    ctx.fill()

    // 顶部一道弧形高光，做出糖果壳的质感
    ctx.beginPath()
    ctx.arc(0, 0, r - 1.8, Math.PI * 1.12, Math.PI * 1.82)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
    ctx.lineWidth = 1.8
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  /**
   * 左上角签到浮标
   *
   * 为什么是浮标而不是第 5 个按钮：2×2 区已经排满，塞第 5 个只能缩小或加行。
   * 签到是「有红点就会点、没红点不会点」的低频入口，浮标最省面积也最显眼。
   *
   * 三种状态：
   *   可领 → 红点呼吸 + 天数角标，图标轻微缩放
   *   已领 → 整体 72% 透明，红点消失，角标保留（连续天数本身是成就）
   * 没有注入 getCheckinState 时（回归 / 早期预览）按「已领且 0 天」画。
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} time - 秒
   */
  renderCheckinFloat(ctx, time) {
    const rect = this.checkinRect
    const state = this.readCheckinState()
    const cx = rect.x + rect.size / 2
    const cy = rect.y + rect.size / 2
    const r = rect.size / 2

    // 呼吸只在「有东西可领」时出现，静止的图标不跟主按钮抢注意力
    const scale = state.claimable ? 1 + Math.sin(time * 3) * 0.03 : 1

    ctx.save()
    ctx.globalAlpha = state.claimable ? 1 : 0.72
    ctx.translate(cx, cy)
    ctx.scale(scale, scale)

    // 底部厚投影 / 彩色外环 / 白色内盘
    this.drawFloatBadge(ctx, r, '#FFE692', '#FFB951', '#FFF4D2')

    this.drawCalendarIcon(ctx, 0, 0, state.claimable)
    ctx.restore()

    // 红点：整个浮标唯一的「现在就要点」信号
    if (state.claimable) {
      const pulse = 1 + Math.sin(time * 4) * 0.12
      ctx.beginPath()
      ctx.arc(rect.x + rect.size - 5, rect.y + 5, 4.6 * pulse, 0, Math.PI * 2)
      ctx.fillStyle = COLORS.coral
      ctx.fill()
      ctx.strokeStyle = COLORS.paper
      ctx.lineWidth = 1.6
      ctx.stroke()
    }

    // 本周进度角标（右下角，与商城浮标的余额角标同一套语言）
    //
    // 写 `3/7` 而不是 `3天`：签到是 7 天一循环，写天数会让人以为是「连签了 3 天」，
    // 第 8 天变回 `0/7` 时就像进度被清了。分母直接说明这是个周期进度。
    if (state.weekDay > 0) {
      const label = `${state.weekDay}/${state.cycle}`
      ctx.font = font(9.5)
      const w = Math.max(24, ctx.measureText(label).width + 10)
      const bx = rect.x + rect.size - w + 6
      const by = rect.y + rect.size - 8

      fillRoundRect(ctx, bx, by, w, 15, 7.5, COLORS.paper)
      strokeRoundRect(ctx, bx, by, w, 15, 7.5, COLORS.orangeDeep, 1.4)
      ctx.fillStyle = COLORS.orangeDeep
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = font(9.5)
      ctx.fillText(label, bx + w / 2, by + 8)
    }
  }

  /**
   * 日历图标（矢量绘制，不用 emoji —— emoji 在低端机上会被渲染成方块）
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx - 圆心
   * @param {number} cy
   * @param {boolean} active - 今天可领
   */
  drawCalendarIcon(ctx, cx, cy, active) {
    const w = 20
    const h = 17
    const x = cx - w / 2
    const y = cy - h / 2 + 1
    const radius = 3.5

    // 纸面
    fillRoundRect(ctx, x, y, w, h, radius, COLORS.paper)
    strokeRoundRect(ctx, x, y, w, h, radius, active ? COLORS.mintDeep : 'rgba(31, 58, 95, 0.32)', 1.4)

    // 顶部色带：先用圆角矩形，再补一条直角把下沿压平
    const bandColor = active ? COLORS.mint : 'rgba(74, 107, 140, 0.55)'
    fillRoundRect(ctx, x + 1, y + 1, w - 2, 6, radius - 1, bandColor)
    ctx.fillStyle = bandColor
    ctx.fillRect(x + 1, y + 4, w - 2, 3)

    // 两个挂环
    ctx.fillStyle = COLORS.navySoft
    fillRoundRect(ctx, x + 4.6, y - 2, 1.8, 4.4, 0.9, COLORS.navySoft)
    fillRoundRect(ctx, x + 13.6, y - 2, 1.8, 4.4, 0.9, COLORS.navySoft)

    // 日期点
    ctx.fillStyle = active ? 'rgba(47, 191, 155, 0.75)' : 'rgba(31, 58, 95, 0.22)'
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        ctx.beginPath()
        ctx.arc(x + 5 + col * 5, y + 10 + row * 4, 1.25, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  /**
   * 读签到状态（由 game.js 注入）
   * @returns {{claimable:boolean, weekDay:number, totalDays:number, cycle:number}}
   */
  readCheckinState() {
    if (typeof this.getCheckinState === 'function') {
      try {
        const state = this.getCheckinState()
        if (state && typeof state === 'object') {
          return {
            claimable: !!state.claimable,
            weekDay: Math.max(0, parseInt(state.weekDay, 10) || 0),
            totalDays: Math.max(0, parseInt(state.totalDays, 10) || 0),
            cycle: Math.max(1, parseInt(state.cycle, 10) || 7)
          }
        }
      } catch (e) {
        console.warn('[Menu] 读取签到状态失败:', e)
      }
    }
    return { claimable: false, weekDay: 0, totalDays: 0, cycle: 7 }
  }

  /**
   * 左上角商城浮标（签到正下方）
   *
   * 与签到浮标同一套语言（白圆底 + 彩色图标 + 右下角小角标），
   * 区别是图标换成购物袋、角标换成雪花币余额 —— 让「钱要花掉」这件事一直可见。
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} time - 秒
   */
  renderShopFloat(ctx, time) {
    const rect = this.shopRect
    const cx = rect.x + rect.size / 2
    const cy = rect.y + rect.size / 2
    const r = rect.size / 2

    // 余额 > 0 才轻微呼吸：空钱包不该抢注意力
    const balance = this.readCoinBalance()
    const scale = balance > 0 ? 1 + Math.sin(time * 2.6 + 1.2) * 0.02 : 1

    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(scale, scale)

    // 与签到同一套糖果徽章，只换配色：薄荷绿 → 湖水蓝，读成「换装/商店」
    this.drawFloatBadge(ctx, r, '#C6F5DF', '#63CDBE', '#EEFFF8')

    this.drawShopIcon(ctx)
    ctx.restore()

    // 余额角标：深色胶囊压在薄荷底上才看得清
    const label = `${balance}`
    ctx.font = font(9.5)
    const w = Math.max(22, ctx.measureText(label).width + 10)
    const bx = rect.x + rect.size - w + 7
    const by = rect.y + rect.size - 9

    fillRoundRect(ctx, bx, by, w, 15, 7.5, COLORS.navy)
    strokeRoundRect(ctx, bx, by, w, 15, 7.5, COLORS.paper, 1.5)
    ctx.fillStyle = COLORS.white
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = font(9.5)
    ctx.fillText(label, bx + w / 2, by + 8)
  }

  /**
   * 购物袋图标（矢量，不用 emoji —— 低端机上 emoji 会被渲染成方块）
   * @param {CanvasRenderingContext2D} ctx
   */
  drawShopIcon(ctx) {
    // 提手
    ctx.beginPath()
    ctx.arc(0, -5.4, 4.6, Math.PI, Math.PI * 2)
    ctx.strokeStyle = COLORS.waterDeep
    ctx.lineWidth = 1.8
    ctx.stroke()

    // 袋身
    fillRoundRect(ctx, -8.6, -5.6, 17.2, 15.6, 3.6, COLORS.mint)
    strokeRoundRect(ctx, -8.6, -5.6, 17.2, 15.6, 3.6, COLORS.mintDeep, 1.4)

    // 袋身竖纹：两条浅色，让它读成「袋子」而不是一块色块
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(-3.2, -1.2)
    ctx.lineTo(-3.2, 7.2)
    ctx.moveTo(3.2, -1.2)
    ctx.lineTo(3.2, 7.2)
    ctx.stroke()
  }

  /**
   * 读雪花币余额（由 game.js 注入）
   * @returns {number}
   */
  readCoinBalance() {
    if (typeof this.getCoinBalance === 'function') {
      try {
        const value = parseInt(this.getCoinBalance(), 10)
        return Number.isFinite(value) && value > 0 ? value : 0
      } catch (e) {
        console.warn('[Menu] 读取雪花币失败:', e)
      }
    }
    return 0
  }

  /**
   * 命中商城浮标
   * @param {{clientX:number, clientY:number}} t
   * @returns {boolean}
   */
  hitShop(t) {
    const rect = this.shopRect
    const cx = rect.x + rect.size / 2
    const cy = rect.y + rect.size / 2
    return Math.hypot(t.clientX - cx, t.clientY - cy) <= rect.size / 2 + 6
  }

  /**
   * 命中签到浮标（判定半径比视觉大 6px，42 的圆对指尖偏小）
   * @param {{clientX:number, clientY:number}} t - 设计稿坐标
   * @returns {boolean}
   */
  hitCheckin(t) {
    const rect = this.checkinRect
    const cx = rect.x + rect.size / 2
    const cy = rect.y + rect.size / 2
    return Math.hypot(t.clientX - cx, t.clientY - cy) <= rect.size / 2 + 6
  }

  onTouchStart(touch) {
    const t = stage().unproject(touch)

    // 浮标优先：它在标题左边的空白里，不与任何按钮重叠，先判后判都一样，
    // 但按下时点亮态要立刻生效，所以放在按钮之前
    if (this.hitCheckin(t)) {
      this.checkinPressed = true
      return
    }
    this.checkinPressed = false

    if (this.hitShop(t)) {
      this.shopPressed = true
      return
    }
    this.shopPressed = false

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

    if (this.checkinPressed) {
      this.checkinPressed = false
      // 抬起时还在浮标上才算点击（按住滑走 = 取消，和按钮同一个手感）
      if (this.hitCheckin(t) && this.onCheckin) {
        this.onCheckin()
      }
      return
    }

    if (this.shopPressed) {
      this.shopPressed = false
      if (this.hitShop(t) && this.onShop) {
        this.onShop()
      }
      return
    }

    this.buttons.forEach(btn => btn.onTouchEnd(t))
  }
}
