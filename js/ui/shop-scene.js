import {
  COLORS,
  drawGlassPanel,
  drawOceanCached,
  drawOceanMotion,
  drawOverlay,
  drawPenguin,
  font,
  fillRoundRect,
  roundRectPath,
  strokeRoundRect
} from './theme'
import { CENTER_X, stage } from './layout'
import { SKIN_ITEMS, TRAY_PALETTES, BG_PALETTES } from '../utils/skin-manager'
import { drawBackgroundSwatch, drawTrayTexture, drawCoinIcon } from './skin-art'

/**
 * 商城（原「外观商城」，界面上简称商城）
 *
 * 版式（375×667 设计稿坐标）：
 *   面板 16~644
 *     ├ 标题「商城」96 + 右侧雪花币余额
 *     ├ 分类胶囊（企鹅 / 展台 / 背景）126~158
 *     ├ 商品网格 172~512（2 列 × 2 行，卡片 148×164）
 *     ├ 「更多外观」占位 528~570
 *     └ 底部说明 602 / 617
 *
 * 三条产品约束（写在这里，改版时别越线）：
 *   1. **只卖外观**，不卖鱼、不卖复活、不卖提示券 —— 商城不出现任何影响难度的商品
 *   2. **不做限时倒计时**：没有后端校时，本地时间可以被改，倒计时会变成假紧迫
 *   3. 分类页签固定三个（企鹅 / 展台 / 背景），不按商品数量动态增减
 */

const PANEL = { x: 16, y: 64, width: 343, height: 580 }

const TITLE_Y = 96
const TABS = { x: 34, y: 126, width: 307, height: 32, gap: 8 }
const TAB_LABELS = [
  { key: 'penguin', label: '企鹅', active: '#C8EAFF', dot: '#5BC8F5', ink: '#2C7FA8' },
  { key: 'stage', label: '展台', active: '#FFDDBA', dot: '#FFA75C', ink: '#B96A22' },
  { key: 'bg', label: '背景', active: '#D9E7FB', dot: '#8BAFE8', ink: '#4A6EA8' }
]

const GRID = { x: 34, y: 172, cellW: 148, cellH: 164, gapX: 11, gapY: 12 }
const PLACEHOLDER = { x: 34, y: 528, width: 307, height: 42 }
const FOOT_Y = 602

/** 关闭圆：与成就/签到弹层同一套口径（判定半径比视觉大 6px） */
const CLOSE = { size: 28, inset: 10, reserve: 50 }

/** 卡片预览区底色：每类一个明确色系，不再用「浅色→白」的几乎看不出差别 */
const CARD_TINT = {
  penguin: ['#CDEEFF', '#EAF8FF'],
  stage: ['#FFE0BC', '#FFF1DE'],
  bg: ['#DFE9FB', '#EFF4FF']
}

/** 四角小星光：商城卡片的轻装饰，纯矢量（emoji 在低端机上会变方块） */
function drawSparkle(ctx, x, y, r, color) {
  ctx.save()
  ctx.translate(x, y)
  ctx.beginPath()
  ctx.moveTo(0, -r)
  ctx.quadraticCurveTo(r * 0.18, -r * 0.18, r, 0)
  ctx.quadraticCurveTo(r * 0.18, r * 0.18, 0, r)
  ctx.quadraticCurveTo(-r * 0.18, r * 0.18, -r, 0)
  ctx.quadraticCurveTo(-r * 0.18, -r * 0.18, 0, -r)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ctx.restore()
}

/** 卡片里的小鱼：展台是「小鱼展台」，预览就该放鱼，不是冰块 */
function drawPreviewFish(ctx, cx, cy, s = 1) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(s, s)
  ctx.lineJoin = 'round'

  // 尾巴
  ctx.beginPath()
  ctx.moveTo(-7, 0)
  ctx.quadraticCurveTo(-13, -6, -14, -5)
  ctx.quadraticCurveTo(-11.5, 0, -14, 5)
  ctx.quadraticCurveTo(-13, 6, -7, 0)
  ctx.closePath()
  ctx.fillStyle = '#F08B3C'
  ctx.fill()
  ctx.strokeStyle = 'rgba(170, 72, 30, 0.95)'
  ctx.lineWidth = 1.3
  ctx.stroke()

  // 身体
  ctx.beginPath()
  ctx.ellipse(0, 0, 9.2, 6.2, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#FFB067'
  ctx.fill()
  ctx.strokeStyle = 'rgba(170, 72, 30, 0.95)'
  ctx.lineWidth = 1.4
  ctx.stroke()

  // 背鳍
  ctx.beginPath()
  ctx.moveTo(-1, -5.4)
  ctx.quadraticCurveTo(1.6, -9.8, 4.6, -5.8)
  ctx.closePath()
  ctx.fillStyle = '#F08B3C'
  ctx.fill()
  ctx.stroke()

  // 肚皮 + 眼睛
  ctx.beginPath()
  ctx.ellipse(0.4, 2.2, 5.4, 2.4, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.68)'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(4.6, -1.6, 1.6, 0, Math.PI * 2)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(5, -1.6, 0.85, 0, Math.PI * 2)
  ctx.fillStyle = '#152A45'
  ctx.fill()
  ctx.restore()
}

const TOAST_MS = 1400

export default class ShopScene {
  /**
   * @param {Object} sceneManager
   * @param {Object} skinManager
   * @param {Object} coinManager
   * @param {Object} [adManager] - 有就显示「看广告 +10」，没有就整块隐藏
   */
  constructor(sceneManager, skinManager, coinManager, adManager = null) {
    this.sceneManager = sceneManager
    this.skinManager = skinManager
    this.coinManager = coinManager
    this.adManager = adManager

    this.isVisible = false
    this.activeTab = 'penguin'

    /** 飘字提示：{ text, start, tone } */
    this.toast = null

    // 由 game.js 注入
    this.onClose = null
    this.onBuy = null
    this.onEquip = null
    this.onWatchAd = null

  }

  /**
   * 版式全部是设计稿坐标（由 stage() 统一缩放），没有需要重建的按钮
   */
  relayout() {}

  onEnter() {
    this.isVisible = true
    this.toast = null
    this.activeTab = 'penguin'
  }

  onExit() {
    this.isVisible = false
  }

  close() {
    if (this.onClose) {
      this.onClose()
      return
    }
    if (this.sceneManager) this.sceneManager.switchTo('menu')
  }

  /**
   * 当前页签的商品
   * @returns {Array}
   */
  getVisibleItems() {
    return SKIN_ITEMS.filter(item => item.category === this.activeTab)
  }

  /**
   * 第 index 个商品卡片的矩形
   * @param {number} index
   * @returns {{x:number,y:number,w:number,h:number}}
   */
  getCardRect(index) {
    const col = index % 2
    const row = Math.floor(index / 2)
    return {
      x: GRID.x + col * (GRID.cellW + GRID.gapX),
      y: GRID.y + row * (GRID.cellH + GRID.gapY),
      w: GRID.cellW,
      h: GRID.cellH
    }
  }

  /**
   * 卡片当前该显示什么按钮
   * @param {Object} item
   * @returns {{text:string, kind:'equipped'|'owned'|'buy'|'limited'|'poor'}}
   */
  getCardState(item) {
    if (item.limited && !this.skinManager.owns(item.id)) {
      return { text: '满签获得', kind: 'limited' }
    }
    if (this.skinManager.isEquipped(item.id)) {
      // 按钮直接说「恢复默认」，玩家不用猜「已穿戴」再点一下会发生什么
      return { text: '恢复默认', kind: 'equipped' }
    }
    if (this.skinManager.owns(item.id)) {
      return { text: '穿戴', kind: 'owned' }
    }
    if (this.coinManager.get() < item.price) {
      return { text: `❄ ${item.price}`, kind: 'poor' }
    }
    return { text: `❄ ${item.price}`, kind: 'buy' }
  }

  /**
   * 卡片左上角的小标签：给同页商品一点性格，别四张卡像同一个模板复制
   */
  getItemTag(item) {
    if (item.limited) return { text: '限定', bg: 'rgba(167,139,250,0.20)', fg: COLORS.lavenderDeep }
    if (item.price >= 120) return { text: '臻选', bg: 'rgba(255,255,255,0.72)', fg: COLORS.orangeDeep }
    if (item.price >= 90) return { text: '人气', bg: 'rgba(255,201,74,0.28)', fg: COLORS.yellowInk }
    return { text: '新品', bg: 'rgba(47,191,155,0.18)', fg: COLORS.mintDeep }
  }

  /**
   * 点一个商品
   * @param {Object} item
   */
  handleItemTap(item) {
    if (item.limited && !this.skinManager.owns(item.id)) {
      this.showToast('满签 7 天才送，商城不卖', 'warn')
      return
    }

    // 已穿戴 → 卸下，回到默认外观（按钮上写的是「恢复默认」）
    //
    // 成功路径**不弹飘字**：卡片边框变绿消失、按钮从「恢复默认」变「穿戴」、
    // 企鹅身上的配件当场消失 —— 三个信号已经足够，再盖一条浮层只会挡住卡片。
    // 飘字留给失败（钱不够 / 限定不可买），那是玩家真的需要解释的时刻。
    if (this.skinManager.isEquipped(item.id)) {
      this.skinManager.unequip(item.category)
      if (this.onEquip) this.onEquip(item)
      return
    }

    // 已拥有 → 穿戴
    if (this.skinManager.owns(item.id)) {
      this.skinManager.equip(item.id)
      if (this.onEquip) this.onEquip(item)
      return
    }

    // 购买
    const result = this.skinManager.buy(item.id)
    if (result.ok) {
      if (this.onBuy) this.onBuy(item)
      return
    }

    if (result.reason === 'poor') {
      this.showToast(`雪花币不够（还差 ${item.price - this.coinManager.get()}）`, 'warn')
      return
    }
    if (result.reason === 'limited') {
      this.showToast('限定外观只能靠满签获得', 'warn')
    }
  }

  showToast(text, tone = 'ok') {
    this.toast = { text, start: Date.now(), tone }
  }

  update() {
    if (!this.isVisible) return
    if (this.toast && Date.now() - this.toast.start > TOAST_MS) this.toast = null
  }

  render(ctx) {
    if (!this.isVisible) return

    const time = Date.now() / 1000

    // 与首页同一套海洋背景 —— 玩家看到的是「首页上盖了一层」，不是换了个 App
    drawOceanCached(ctx)
    drawOceanMotion(ctx, time)
    drawOverlay(ctx, 0.34)

    const s = stage()
    ctx.save()
    s.apply(ctx)

    drawGlassPanel(ctx, PANEL.x, PANEL.y, PANEL.width, PANEL.height, 30)

    this.renderHeader(ctx)
    this.renderTabs(ctx)
    this.renderGrid(ctx, time)
    this.renderEarnHint(ctx)
    this.renderFoot(ctx)

    this.renderClose(ctx)
    this.renderToast(ctx)

    ctx.restore()
  }

  /**
   * 标题 + 余额
   *
   * 余额必须在标题这一行：玩家进商城第一件事是看「我有多少」和「这东西多少」，
   * 两者不在同一屏高会让人来回扫。
   */
  renderHeader(ctx) {
    // 标题底衬：一条浅色圆角带，把「商城」和余额收进同一个视觉组
    fillRoundRect(ctx, PANEL.x + 12, TITLE_Y - 19, PANEL.width - 24, 38, 14, 'rgba(91, 200, 245, 0.10)')

    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = COLORS.navy
    ctx.font = font(20)
    ctx.fillText('商城', PANEL.x + 28, TITLE_Y)

    const coins = this.coinManager.get()
    const label = `${coins}`
    ctx.font = font(15)
    const textWidth = ctx.measureText(label).width
    const pillWidth = textWidth + 42
    // 右边留 50 给关闭圆：余额胶囊与 ✕ 的**判定圈**（视觉半径 +6）也要分开，
    // 否则两个都能点到的缝隙里，玩家会误触关掉商城
    const pillX = PANEL.x + PANEL.width - CLOSE.reserve - pillWidth
    const pillY = TITLE_Y - 13

    fillRoundRect(ctx, pillX, pillY, pillWidth, 26, 13, 'rgba(91, 200, 245, 0.18)')
    strokeRoundRect(ctx, pillX, pillY, pillWidth, 26, 13, 'rgba(44, 156, 214, 0.38)', 1.4)
    drawCoinIcon(ctx, pillX + 15, TITLE_Y, 6.4)

    ctx.fillStyle = COLORS.waterDeep
    ctx.font = font(15)
    ctx.fillText(label, pillX + 28, TITLE_Y + 1)
  }

  renderTabs(ctx) {
    const width = (TABS.width - TABS.gap * (TAB_LABELS.length - 1)) / TAB_LABELS.length

    TAB_LABELS.forEach((tab, index) => {
      const x = TABS.x + index * (width + TABS.gap)
      const active = tab.key === this.activeTab

      // 每个页签用自己的浅色：和下面对应的卡片预览同色系，
      // 深海军蓝的选中态在浅色卡片里太重（用户反馈「不协调」）
      fillRoundRect(
        ctx,
        x,
        TABS.y,
        width,
        TABS.height,
        TABS.height / 2,
        active ? tab.active : 'rgba(255, 255, 255, 0.72)'
      )
      strokeRoundRect(
        ctx,
        x,
        TABS.y,
        width,
        TABS.height,
        TABS.height / 2,
        active ? tab.dot : 'rgba(31, 58, 95, 0.10)',
        active ? 1.4 : 1
      )

      // 左侧小圆点：未选中时也能看出三个页签各自的品类色
      ctx.beginPath()
      ctx.arc(x + 13, TABS.y + TABS.height / 2, 3, 0, Math.PI * 2)
      ctx.fillStyle = tab.dot
      ctx.fill()

      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = font(12.5)
      ctx.fillStyle = active ? tab.ink : COLORS.navySoft
      ctx.fillText(tab.label, x + width / 2 + 4, TABS.y + TABS.height / 2 + 0.5)
    })
  }

  renderGrid(ctx, time) {
    const items = this.getVisibleItems()

    items.forEach((item, index) => {
      const rect = this.getCardRect(index)
      this.renderCard(ctx, item, rect, time)
    })
  }

  /**
   * 单张商品卡
   *
   * 视觉重点在**预览**：外观商品说服力全在「穿上是什么样」，
   * 所以预览区占掉一半高度，名字和按钮都往下压。
   */
  renderCard(ctx, item, rect, time) {
    const owned = this.skinManager.owns(item.id)
    const equipped = this.skinManager.isEquipped(item.id)
    const state = this.getCardState(item)

    // 卡片本体：一层错位浅投影 + 极淡的暖白渐变，避免白底叠白底糊成一片
    fillRoundRect(ctx, rect.x, rect.y + 3, rect.w, rect.h, 18, 'rgba(31, 58, 95, 0.10)')
    const body = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h)
    body.addColorStop(0, COLORS.white)
    body.addColorStop(1, '#FFFAF1')
    fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 18, body)
    strokeRoundRect(
      ctx,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      18,
      equipped ? COLORS.mint : 'rgba(31, 58, 95, 0.10)',
      equipped ? 2 : 1.5
    )

    // 预览舞台：每类一个底色，卡与卡之间先靠颜色分出层次
    const pv = { x: rect.x + 8, y: rect.y + 8, w: rect.w - 16, h: 86 }
    const tint = ctx.createLinearGradient(pv.x, pv.y, pv.x, pv.y + pv.h)
    const colors = CARD_TINT[item.category] || CARD_TINT.penguin
    tint.addColorStop(0, colors[0])
    tint.addColorStop(1, colors[1])
    fillRoundRect(ctx, pv.x, pv.y, pv.w, pv.h, 14, tint)
    strokeRoundRect(ctx, pv.x, pv.y, pv.w, pv.h, 14, 'rgba(255, 255, 255, 0.92)', 1.2)
    drawSparkle(ctx, pv.x + pv.w - 15, pv.y + 18, 4.2, 'rgba(255,255,255,0.95)')
    drawSparkle(ctx, pv.x + 14, pv.y + pv.h - 14, 2.8, 'rgba(255,255,255,0.85)')

    this.renderPreview(ctx, item, pv, time, owned)

    // 品类小标签
    const tag = this.getItemTag(item)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = font(9.5)
    const tagW = ctx.measureText(tag.text).width + 14
    const tagX = pv.x + 7
    fillRoundRect(ctx, tagX, pv.y + 6, tagW, 17, 8.5, tag.bg)
    ctx.fillStyle = tag.fg
    ctx.fillText(tag.text, tagX + tagW / 2, pv.y + 15)

    // 名字：未拥有的限定品压暗一点，和可购买的区分开
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = font(12.5)
    ctx.fillStyle = item.limited && !owned ? COLORS.navySoft : COLORS.navy
    ctx.fillText(item.name, rect.x + rect.w / 2, rect.y + 108)

    // 按钮：底层深色假投影 + 顶部高光，价格用矢量雪花而不是文字 ❄
    const btn = { x: rect.x + 12, y: rect.y + rect.h - 38, w: rect.w - 24, h: 30 }
    const palette = {
      // 浅色按钮统一按「满签获得」那档明度做：淡底 + 中等饱和的字，
      // 不用深绿/深蓝大色块，四张卡摆在一起不会一块一块压眼睛
      equipped: { bg: '#D8F5EA', shadow: '#AFE3D1', text: '#1FA383' },
      owned: { bg: '#D8F5EA', shadow: '#AFE3D1', text: '#1FA383' },
      buy: { bg: '#CFEBFF', shadow: '#A9D8F5', text: COLORS.waterDeep },
      // 钱不够：比可购买再淡一档，仍是「不可买」的低调感
      poor: { bg: '#E6F4FF', shadow: '#CDE7F7', text: '#6C9FC0' },
      limited: { bg: 'rgba(167, 139, 250, 0.26)', shadow: 'rgba(167, 139, 250, 0.16)', text: COLORS.lavenderDeep }
    }[state.kind]

    fillRoundRect(ctx, btn.x, btn.y + 3, btn.w, btn.h, 15, palette.shadow)
    fillRoundRect(ctx, btn.x, btn.y, btn.w, btn.h, 15, palette.bg)
    fillRoundRect(ctx, btn.x + 4, btn.y + 2.5, btn.w - 8, 10, 5, 'rgba(255,255,255,0.18)')

    ctx.fillStyle = palette.text
    ctx.font = font(12.5)
    const withPrice = state.kind === 'buy' || state.kind === 'poor'
    if (withPrice) {
      const priceText = `${item.price}`
      const tw = ctx.measureText(priceText).width
      drawCoinIcon(
        ctx,
        btn.x + btn.w / 2 - tw / 2 - 10,
        btn.y + btn.h / 2,
        6,
        state.kind === 'poor' ? '#6C9FC0'
          : (state.kind === 'equipped' || state.kind === 'owned' ? '#1FA383' : COLORS.waterDeep)
      )
      ctx.fillText(priceText, btn.x + btn.w / 2 + 5, btn.y + btn.h / 2 + 0.5)
    } else {
      ctx.fillText(state.text, btn.x + btn.w / 2, btn.y + btn.h / 2 + 0.5)
    }

    // 已穿戴：右下角小勾角标（原来在预览区右上角，会压住星光）
    if (equipped) {
      const bx = rect.x + rect.w - 32
      const by = rect.y + rect.h - 51
      fillRoundRect(ctx, bx, by, 22, 17, 8.5, '#AFE3D1')
      ctx.fillStyle = '#1FA383'
      ctx.font = font(11)
      ctx.fillText('✓', bx + 11, by + 9)
    }
  }

  /**
   * 预览区：企鹅 / 展台 / 背景色卡
   *
   * 企鹅类必须显式传 `accessory: item.id`（而不是靠全局穿戴），
   * 否则一件都没买的时候，四张卡长得一模一样。
   */
  renderPreview(ctx, item, rect, time, owned) {
    const cx = rect.x + rect.w / 2
    const cy = rect.y + rect.h / 2

    if (item.category === 'penguin') {
      const bob = Math.sin(time * 1.6 + rect.x) * 1.2
      drawPenguin(ctx, cx, cy + bob, 1.2, {
        accessory: item.id,
        pose: 'stand',
        mood: 'idle'
      })
      return
    }

    if (item.category === 'stage') {
      // 迷你展台：复用真实托盘的配色与纹理，比例缩到卡片里
      const w = 104
      const h = 46
      const x = cx - w / 2
      const y = cy - h / 2 + 2
      // 预览配色直接读皮肤表 —— 之前写死的旧色和新配色对不上，
      // 玩家在商城看到的和实际游戏里穿上的不是同一种颜色
      const palette = TRAY_PALETTES[item.id] || {
        top: '#FFF6E6', bottom: '#F7DFB4', edge: 'rgba(201, 146, 58, 0.88)'
      }

      const grad = ctx.createLinearGradient(0, y, 0, y + h)
      grad.addColorStop(0, palette.top)
      grad.addColorStop(1, palette.bottom)
      roundRectPath(ctx, x, y, w, h, 12)
      ctx.fillStyle = grad
      ctx.fill()

      drawTrayTexture(ctx, item.id, x, y, w, h, 1)

      ctx.setLineDash([5, 3.6])
      roundRectPath(ctx, x, y, w, h, 12)
      ctx.strokeStyle = palette.edge
      ctx.lineWidth = 1.8
      ctx.stroke()
      ctx.setLineDash([])

      // 小鱼才是对的预览物：展台是「小鱼展台」，蓝色菱形冰块会让人以为
      // 这是另一种可推的方块，还把珊瑚/贝壳的纹理遮掉一半
      drawPreviewFish(ctx, cx, y + h / 2 + 1, 1.25)
      return
    }

    // 背景
    const w = 108
    const h = 62
    const palette = BG_PALETTES[item.id]
    drawBackgroundSwatch(ctx, cx - w / 2, cy - h / 2, w, h, palette, 12)

    // 三个小气泡，一眼看出是「水」
    ;[[-26, -12, 4], [10, -2, 3], [-8, 14, 2.4]].forEach(([dx, dy, r]) => {
      ctx.beginPath()
      ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
      ctx.fill()
    })

    if (!owned) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)'
      ctx.lineWidth = 1.4
      roundRectPath(ctx, cx - w / 2, cy - h / 2, w, h, 12)
      ctx.stroke()
    }
  }

  /**
   * 商品网格下方的「怎么赚雪花币」
   *
   * 用户反馈「怎么赚雪花币呢」——原来只有一行 10.5px 小字，藏在页脚上方，
   * 根本看不见。改成固定位置的引导卡：
   *   - 位置固定 y=528（不再跟网格行数飘）：玩家翻页签时引导不会跳来跳去
   *   - 六条产出分两行列全，带雪花图标和具体数字
   *   - 企鹅页 2 行商品正好到 512，卡片贴着网格；展台/背景页 1 行商品下方
   *     会空一段，但引导固定在 528 反而更像「每页都有的说明」
   */
  renderEarnHint(ctx) {
    const y = 522
    const h = 62

    fillRoundRect(ctx, PLACEHOLDER.x, y, PLACEHOLDER.width, h, 16, 'rgba(255, 255, 255, 0.62)')
    ctx.setLineDash([6, 4])
    strokeRoundRect(
      ctx,
      PLACEHOLDER.x,
      y,
      PLACEHOLDER.width,
      h,
      16,
      'rgba(47, 191, 155, 0.36)',
      1.6
    )
    ctx.setLineDash([])

    // 标题 + 雪花图标
    drawCoinIcon(ctx, PLACEHOLDER.x + 20, y + 18, 6.6)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = COLORS.navy
    ctx.font = font(12.5)
    ctx.fillText('怎么赚雪花币', PLACEHOLDER.x + 32, y + 18)

    ctx.fillStyle = 'rgba(31, 58, 95, 0.62)'
    ctx.font = font(10.5, 'normal')
    ctx.fillText('首通 +2　·　首通三星 +3　·　解锁成就 +20', PLACEHOLDER.x + 18, y + 38)
    ctx.fillText('签到 D4 +20　·　满签 D7 +60　·　新手礼 +60', PLACEHOLDER.x + 18, y + 54)
  }

  renderFoot(ctx) {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(31, 58, 95, 0.42)'
    ctx.font = font(10.5, 'normal')
    ctx.fillText('外观只改样子，不影响关卡判定', CENTER_X, FOOT_Y)
    ctx.fillText('企鹅的围巾、冰块、目标区底色不会变', CENTER_X, FOOT_Y + 15)
  }

  renderToast(ctx) {
    if (!this.toast) return

    const t = (Date.now() - this.toast.start) / TOAST_MS
    if (t < 0 || t > 1) return

    const warn = this.toast.tone === 'warn'
    // 面板中部：底部每条缝隙都被网格 / 提示块 / 说明文字占满了，
    // 只有中心是空的，而且飘字本来就是浮在最上层的一次性反馈
    const y = PANEL.y + PANEL.height / 2 - 20

    ctx.save()
    ctx.globalAlpha = 1 - Math.max(0, (t - 0.7) / 0.3)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = font(13)

    const width = ctx.measureText(this.toast.text).width + 26
    fillRoundRect(ctx, CENTER_X - width / 2, y - 13, width, 26, 13, 'rgba(255, 249, 238, 0.98)')
    strokeRoundRect(
      ctx,
      CENTER_X - width / 2,
      y - 13,
      width,
      26,
      13,
      warn ? 'rgba(255, 122, 107, 0.55)' : 'rgba(47, 191, 155, 0.5)',
      1.5
    )
    ctx.fillStyle = warn ? COLORS.coral : COLORS.mintDeep
    ctx.fillText(this.toast.text, CENTER_X, y)
    ctx.restore()
  }

  /**
   * 右上角 ✕（白圆底 + 深紫叉，与签到 / 成就弹层一致）
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
   * 关闭圆圆心（只由面板矩形算）
   */
  getCloseCenter() {
    return {
      x: PANEL.x + PANEL.width - CLOSE.inset - CLOSE.size / 2,
      y: PANEL.y + CLOSE.inset + CLOSE.size / 2
    }
  }

  /**
   * 命中测试
   * @param {{clientX:number, clientY:number}} t
   * @returns {Object|null} { type:'tab'|'item'|'close'|'outside', ... }
   */
  hitTest(t) {
    const close = this.getCloseCenter()
    if (Math.hypot(t.clientX - close.x, t.clientY - close.y) <= CLOSE.size / 2 + 6) {
      return { type: 'close' }
    }

    const tabWidth = (TABS.width - TABS.gap * (TAB_LABELS.length - 1)) / TAB_LABELS.length
    for (let i = 0; i < TAB_LABELS.length; i++) {
      const x = TABS.x + i * (tabWidth + TABS.gap)
      if (t.clientX >= x && t.clientX <= x + tabWidth &&
          t.clientY >= TABS.y && t.clientY <= TABS.y + TABS.height) {
        return { type: 'tab', key: TAB_LABELS[i].key }
      }
    }

    const items = this.getVisibleItems()
    for (let i = 0; i < items.length; i++) {
      const rect = this.getCardRect(i)
      if (t.clientX >= rect.x && t.clientX <= rect.x + rect.w &&
          t.clientY >= rect.y && t.clientY <= rect.y + rect.h) {
        return { type: 'item', item: items[i] }
      }
    }

    const inPanel = t.clientX >= PANEL.x && t.clientX <= PANEL.x + PANEL.width &&
      t.clientY >= PANEL.y && t.clientY <= PANEL.y + PANEL.height
    return inPanel ? null : { type: 'outside' }
  }

  onTouchStart(touch) {
    if (!this.isVisible) return false
    // 命中判定全部在 onTouchEnd 做：商城没有拖拽，按下态不值得单独维护
    return true
  }

  onTouchMove(touch) {
    if (!this.isVisible) return
  }

  onTouchEnd(touch) {
    if (!this.isVisible) return false

    const t = stage().unproject(touch)
    const hit = this.hitTest(t)
    if (!hit) return true

    if (hit.type === 'outside') {
      this.close()
      return true
    }
    if (hit.type === 'close') {
      this.close()
      return true
    }
    if (hit.type === 'tab') {
      this.activeTab = hit.key
      this.toast = null
      return true
    }
    if (hit.type === 'item') {
      this.handleItemTap(hit.item)
      return true
    }

    return true
  }
}
