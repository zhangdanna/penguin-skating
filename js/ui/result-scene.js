import Button from './button'
import {
  COLORS,
  drawCandyButton,
  drawGlassPanel,
  drawOverlay,
  drawPenguin,
  drawStar,
  drawStickerText,
  fillRoundRect,
  font,
  strokeRoundRect
} from './theme'
import { CENTER_X, DESIGN_WIDTH, stage } from './layout'
import { calcStars } from '../utils/score'
import {
  DEFAULT_MAINLINE_TOTAL,
  formatLevelTotal,
  getLevelProgress
} from '../utils/level-progress'

/**
 * 结算场景
 *
 * 版式分五段（全部设计稿坐标，自上而下）：
 *   1. 丝带标题 + 关卡徽章
 *   2. 星级
 *   3. 状态卡 —— 步数/用时 + 星级结论 + 一句建议
 *   4. 食物奖励 —— 这一局的实物收获，跟在状态卡下方
 *   5. 按钮（下一关 / 重玩 / 返回首页）+ 新解锁成就
 *
 * 信息优先级：星级 > 食物奖励 > 差几步 > 步数用时。奖励虽然排在状态卡之后，
 * 但 38 高的胶囊 + 描边让它在视觉上仍然重于卡片里的 12px 数据行。
 *
 * par 就是最优步数（见 score.js），三星线等于「一步不差」。
 *
 * 没有解锁成就时，整块内容会在面板里垂直居中（见 CONTENT_OFFSET_NO_ACH）——
 * 否则内容全挤在上半部、底部空一大片，看着头重脚轻。
 */

/** 面板：76 ~ 630，正好吃满 375×667 的竖向空间 */
const PANEL = { x: 30, y: 76, width: 315, height: 554 }
/** 丝带标题 */
const RIBBON = { y: 92, height: 46, width: 200 }
/** 关卡徽章 */
const BADGE_Y = 158
/** 星级 */
const STAR_Y = 214
const STAR_SIZE = 44
const STAR_SPACING = 14
/** 状态卡：三行（步数/用时 + 结论 + 建议） */
const CARD = { y: 254, height: 92 }
/** 食物奖励：跟在状态卡下方，靠放大和描边保证存在感 */
const REWARD_Y = 364
const REWARD_HEIGHT = 38
/**
 * 按钮：三个按钮统一高度和字号
 *
 * 主次由**宽度和配色**区分（通栏薄荷绿 vs 半宽蓝/紫），不靠高度和字号跳档 ——
 * 那样并排时底边不齐、字号也跳。
 */
const BTN = { height: 46, fontSize: 18 }
const PRIMARY = { y: 422, height: BTN.height, width: 265 }
const SECONDARY = { y: 476, height: BTN.height, width: 128, gap: 9 }
/** 新解锁成就（按钮下方，最多 3 行） */
const ACHIEVE = { top: 528, bottom: 620 }

/**
 * 没有成就时的内容下移量
 *
 * 有成就时内容从丝带顶（92）一直排到成就底（620）；没有成就时内容只到按钮底（502），
 * 面板底部会空出一大截。这里把整块内容在面板内垂直居中，让上下留白相等。
 */
const CONTENT_TOP = RIBBON.y
const CONTENT_BOTTOM = SECONDARY.y + SECONDARY.height
const CONTENT_OFFSET_NO_ACH = Math.round(
  PANEL.y + (PANEL.height - (CONTENT_BOTTOM - CONTENT_TOP)) / 2 - CONTENT_TOP
)

/** easeOutBack 回弹参数：标题与星星弹出时带一点过冲，比线性放大更"弹" */
const BACK_C1 = 1.70158
const BACK_C3 = BACK_C1 + 1

function easeOutBack(t) {
  const p = Math.max(0, Math.min(1, t))
  return 1 + BACK_C3 * Math.pow(p - 1, 3) + BACK_C1 * Math.pow(p - 1, 2)
}

export default class ResultScene {
  constructor(sceneManager) {
    this.sceneManager = sceneManager
    this.buttons = []
    this.isVisible = false

    // 结果数据
    this.level = 1
    this.moves = 0
    this.par = 3
    this.time = 0
    this.stars = 0

    // 主线总关数（由 game.js 用 LevelManager.getCampaignSize() 同步）
    this.totalLevels = DEFAULT_MAINLINE_TOTAL

    // 奖励数据
    this.rewards = null
    this.rewardMeta = {}

    /**
     * 个人对比（重玩时才有）
     * 由 game.js 在通关瞬间、saveLevelProgress 覆盖存档之前读出，再传进来 ——
     * 结算页自己读存档会读到「本次成绩」，对比永远等于零
     * @type {{isFirstClear:boolean, lastMoves:number, bestMoves:number}|null}
     */
    this.comparison = null

    // 本次通关新解锁的成就（画在按钮下方的空白区，不再叠浮层通知）
    this.achievements = []
    this.achievementOverflow = 0

    // 动画参数
    this.titleScale = 0
    this.starScales = [0, 0, 0]
    // 每颗星"亮起的那一帧"只回调一次，供音频层给一声叮
    this.starRevealed = [false, false, false]
    this.onStarReveal = null

    this.init()
  }

  init() {
    this.buttons = []
    // 内容整体下移量（没有成就时居中），按钮的点击判定也必须跟着走
    const offset = this.contentOffset()

    // 下一关：主按钮，通栏
    this.buttons.push(new Button({
      x: CENTER_X - PRIMARY.width / 2,
      y: PRIMARY.y + offset,
      width: PRIMARY.width,
      height: PRIMARY.height,
      text: '下一关',
      fontSize: BTN.fontSize,
      bgColor: COLORS.mint,
      hoverColor: COLORS.mintDeep,
      borderColor: '#17876C',
      onClick: () => {
        if (this.onNextLevel) {
          this.onNextLevel()
        }
      }
    }))

    // 重玩
    this.buttons.push(new Button({
      x: CENTER_X - SECONDARY.width - SECONDARY.gap / 2,
      y: SECONDARY.y + offset,
      width: SECONDARY.width,
      height: SECONDARY.height,
      text: '重玩',
      fontSize: BTN.fontSize,
      bgColor: COLORS.water,
      hoverColor: COLORS.waterDeep,
      borderColor: '#1F7FAE',
      onClick: () => {
        if (this.onReplay) {
          this.onReplay()
        }
      }
    }))

    // 返回首页：旧版只有「下一关 / 重玩」，想回首页得先退到对局再点暂停，
    // 玩家找不到，反馈里直接提了这条
    this.buttons.push(new Button({
      x: CENTER_X + SECONDARY.gap / 2,
      y: SECONDARY.y + offset,
      width: SECONDARY.width,
      height: SECONDARY.height,
      text: '返回首页',
      fontSize: BTN.fontSize,
      bgColor: COLORS.lavender,
      hoverColor: COLORS.lavenderDeep,
      borderColor: '#7255CC',
      onClick: () => {
        if (this.onBackToMenu) {
          this.onBackToMenu()
        }
      }
    }))
  }

  /**
   * 窗口尺寸变化后重建按钮（C1/C2）
   * 注意：这里不能重置回调，否则 resize 后按钮全失效
   */
  relayout() {
    const onNext = this.onNextLevel
    const onReplay = this.onReplay
    const onBack = this.onBackToMenu
    this.init()
    this.onNextLevel = onNext
    this.onReplay = onReplay
    this.onBackToMenu = onBack
  }

  /**
   * 内容整体下移量
   *
   * 没有成就时内容只排到按钮底，面板下半部会空出一大片；把整块内容在面板里
   * 垂直居中，上下留白相等，才不会头重脚轻。有成就时内容自然排到底部，不偏移。
   * @returns {number}
   */
  contentOffset() {
    return this.achievements && this.achievements.length > 0 ? 0 : CONTENT_OFFSET_NO_ACH
  }

  /**
   * 设置主线总关数（HUD / 首页 / 结算三处共用同一口径）
   * @param {number} total
   */
  setLevelTotal(total) {
    this.totalLevels = total
  }

  /**
   * 设置结果数据
   */
  setResult(level, moves, par, time) {
    this.level = level
    this.moves = moves
    this.par = par
    this.time = time
    this.stars = this.calculateStars()
  }

  /**
   * 设置奖励数据
   *
   * 注意：`rewards` 必须是**实际入账**的数量（FoodManager.giveRewards 的返回值），
   * 不是 calculateRewards 算出来的理论值。食物接近上限时两者会不一样，
   * 拿理论值渲染会出现"结算页写 +5🐟、HUD 只多了 1🐟"的对不上问题。
   *
   * @param {Object} rewards - 实际入账 { fish, shrimp, squid, goldfish }
   * @param {Object} [meta] - { firstClear, firstThreeStar, requested }
   *        requested 是理论奖励，用于判断是否有奖励因食物已满被丢弃
   */
  setRewards(rewards, meta = {}) {
    this.rewards = rewards
    this.rewardMeta = meta || {}
  }

  /**
   * 设置本次通关新解锁的成就
   *
   * 通关时不再往屏幕上叠成就浮层（3 条一起弹会糊住标题、底部还叠出多层阴影），
   * 改成画在结算面板按钮下方的空白区，玩家一眼看完，也不影响按钮点击。
   *
   * @param {Array} list - AchievementManager.getNewUnlocked() 的结果
   */
  setAchievements(list) {
    const source = Array.isArray(list) ? list : []
    this.achievements = source
    // 面板底部最多排 3 行。超过 3 个时改排「2 条具体 + 1 行汇总」，
    // 不再往第 4 行塞 —— 那会顶穿面板底边（见 design-preview/result-achievements-3.png）
    this.achievementOverflow = Math.max(0, source.length - 3)
    // 有无成就决定内容是否居中，按钮位置要跟着重算（relayout 会保留回调）
    this.relayout()
  }

  /**
   * 设置个人对比数据
   *
   * @param {{isFirstClear:boolean, lastMoves:number, bestMoves:number}} meta
   */
  setComparison(meta) {
    this.comparison = meta || null
  }

  /**
   * 状态卡第三行的个人对比句
   *
   * 只在**重玩**时出现：第一次见到这一关的玩家需要的是「怎么走」，
   * 重打的人需要的是「我这次是不是更好了」。所以这一行是「按时机切换」，
   * 不是把原来那句建议语删掉 —— 那行是上一轮改版专门恢复回来的。
   *
   * 优先级：刷新个人最佳 > 比上次少 > 比上次多 > 和上次一样。
   * 三星满星时不参与对比（都走到最短路径了，庆祝话术比数据更有价值）。
   *
   * @returns {string} 空串表示沿用原来的建议语
   */
  getComparisonLine() {
    const meta = this.comparison
    if (!meta || meta.isFirstClear) return ''
    if (this.stars >= 3) return ''

    const moves = this.moves
    const last = parseInt(meta.lastMoves, 10) || 0
    const best = parseInt(meta.bestMoves, 10) || 0

    if (best > 0 && moves < best) {
      return `新的个人最佳 · 比之前少 ${best - moves} 步`
    }
    if (last <= 0 || moves === last) return ''
    if (moves < last) return `${last} 步 → ${moves} 步，少走 ${last - moves} 步`
    return `上次 ${last} 步，这次慢了 ${moves - last} 步`
  }

  /**
   * 计算星级（口径见 js/utils/score.js，D2 统一）
   */
  calculateStars() {
    return calcStars(this.moves, this.par)
  }

  show() {
    this.isVisible = true
    this.titleScale = 0
    this.starScales = [0, 0, 0]
    this.starRevealed = [false, false, false]
  }

  hide() {
    this.isVisible = false
  }

  onEnter(data) {
    if (data) {
      this.setResult(data.level, data.moves, data.par, data.time)
    }
    this.show()
  }

  onExit() {
    this.isVisible = false
  }

  update() {
    if (!this.isVisible) return

    // 标题缩放动画
    if (this.titleScale < 1) {
      this.titleScale += 0.1
      if (this.titleScale > 1) this.titleScale = 1
    }

    // 星星依次出现动画
    for (let i = 0; i < 3; i++) {
      if (this.titleScale >= 1 && i < this.stars) {
        if (this.starScales[i] < 1) {
          this.starScales[i] += 0.15
          if (this.starScales[i] > 1) this.starScales[i] = 1

          // 亮起的那一帧回调一次（音频层据此给一声"叮"，音高逐颗升高）
          if (!this.starRevealed[i]) {
            this.starRevealed[i] = true
            if (this.onStarReveal) {
              try {
                this.onStarReveal(i)
              } catch (e) {
                console.warn('[Result] 星级音效回调失败:', e)
              }
            }
          }
        }
      }
    }
  }

  render(ctx) {
    if (!this.isVisible) return

    // 遮罩铺满真实屏幕
    drawOverlay(ctx, 0.6)

    // 面板与内容使用设计稿坐标
    const s = stage()
    ctx.save()
    s.apply(ctx)

    drawGlassPanel(ctx, PANEL.x, PANEL.y, PANEL.width, PANEL.height, 30, {
      fill: 'rgba(255, 249, 238, 0.97)'
    })

    // 内容整体下移（没有成就时居中），面板本身不动
    ctx.save()
    ctx.translate(0, this.contentOffset())

    this.renderRibbon(ctx)
    this.renderLevelBadge(ctx)
    this.renderStars(ctx)
    this.renderStatusCard(ctx)

    // 奖励跟在状态卡下方：靠 38 高的胶囊和描边保持存在感，
    // 不跟星级抢视线，但也不至于被步数数据淹没
    if (this.rewards) {
      this.renderRewards(ctx)
    }

    // 新解锁成就画在按钮下方
    this.renderAchievements(ctx)

    ctx.restore()

    // 按钮的 y 在 init() 里已经加过偏移（点击判定要用绝对坐标），
    // 所以必须在 translate 之外画，否则会偏移两次
    this.buttons.forEach(btn => btn.render(ctx))

    ctx.restore()
  }

  /**
   * 丝带标题：主体是糖果胶囊，左右各伸出一条折角丝带
   *
   * 折角画在主体**之前**（垫在下面），两端做成「折进去」的梯形，
   * 视觉上像一条真丝带绕到面板背后，比单纯一个胶囊更有庆祝感。
   */
  renderRibbon(ctx) {
    const { y, height, width } = RIBBON
    const halfW = width / 2
    const top = y
    const bottom = y + height
    const mid = y + height / 2
    const tailOut = 18

    ctx.save()
    ctx.fillStyle = COLORS.mintDeep

    // 左折角
    ctx.beginPath()
    ctx.moveTo(CENTER_X - halfW + 10, top + 8)
    ctx.lineTo(CENTER_X - halfW - tailOut, top + 2)
    ctx.lineTo(CENTER_X - halfW - tailOut + 6, mid)
    ctx.lineTo(CENTER_X - halfW - tailOut, bottom - 2)
    ctx.lineTo(CENTER_X - halfW + 10, bottom - 8)
    ctx.closePath()
    ctx.fill()

    // 右折角
    ctx.beginPath()
    ctx.moveTo(CENTER_X + halfW - 10, top + 8)
    ctx.lineTo(CENTER_X + halfW + tailOut, top + 2)
    ctx.lineTo(CENTER_X + halfW + tailOut - 6, mid)
    ctx.lineTo(CENTER_X + halfW + tailOut, bottom - 2)
    ctx.lineTo(CENTER_X + halfW - 10, bottom - 8)
    ctx.closePath()
    ctx.fill()
    ctx.restore()

    // 主体
    drawCandyButton(ctx, CENTER_X - halfW, top, width, height, {
      color: COLORS.mint,
      shadowColor: COLORS.mintDeep,
      radius: height / 2
    })

    const scale = easeOutBack(this.titleScale)
    ctx.save()
    ctx.translate(CENTER_X, mid)
    ctx.scale(scale, scale)
    drawStickerText(ctx, '通关成功', 0, 0, {
      size: 30,
      color: COLORS.white,
      stroke: COLORS.navyDeep,
      strokeWidth: 5
    })
    ctx.restore()
  }

  /**
   * 关卡徽章
   *
   * 玩家反馈「不知道一共有多少关」，所以这里必须出现分母：
   * 主线内写「第 12 关 · 共 200 关」，200 关之后写「无尽 · 第 3 关」。
   *
   * 这里曾经配过一条主线进度条，删掉了：第 12 关的进度只有 6%，
   * 一条几乎全空的细线读起来像渲染坏了，而且信息与徽章文字完全重复。
   * 「走到哪了」交给首页的「已通关 N 关 · 共 200 关」，那一处才有意义。
   */
  renderLevelBadge(ctx) {
    const progress = getLevelProgress(this.level, this.totalLevels)
    const text = progress.endless
      ? `无尽 · 第 ${progress.endlessLevel} 关`
      : `第 ${this.level} 关 · ${formatLevelTotal(this.level, this.totalLevels)}`

    ctx.font = font(13)
    const textWidth = ctx.measureText(text).width
    // 描边会向字形外扩 ~1.5px，左右各留 18 才不会被胶囊边切掉
    const badgeWidth = Math.max(140, Math.ceil(textWidth) + 36)

    drawCandyButton(ctx, CENTER_X - badgeWidth / 2, BADGE_Y, badgeWidth, 24, {
      color: COLORS.water,
      shadowColor: COLORS.waterDeep,
      radius: 12
    })
    drawStickerText(ctx, text, CENTER_X, BADGE_Y + 12, {
      size: 13,
      color: COLORS.white,
      strokeWidth: 2
    })
  }

  renderStars(ctx) {
    const totalWidth = 3 * STAR_SIZE + 2 * STAR_SPACING
    const startX = (DESIGN_WIDTH - totalWidth) / 2
    const time = Date.now() / 1000

    for (let i = 0; i < 3; i++) {
      const lit = i < this.stars
      const centerX = startX + i * (STAR_SIZE + STAR_SPACING) + STAR_SIZE / 2
      // 亮起的星轻微上下浮动，静止的灰星不动，一眼能分出"已得/未得"
      const bob = lit ? Math.sin(time * 2 + i * 0.9) * 2 : 0
      const centerY = STAR_Y + bob
      const scale = lit ? easeOutBack(this.starScales[i]) : 1

      ctx.save()
      ctx.translate(centerX, centerY)

      // 光晕：两层同心半透明圆代替 shadowBlur（源码禁止 shadowBlur）
      if (lit) {
        ctx.fillStyle = 'rgba(255, 201, 74, 0.13)'
        ctx.beginPath()
        ctx.arc(0, 0, STAR_SIZE / 2 + 7, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(255, 201, 74, 0.18)'
        ctx.beginPath()
        ctx.arc(0, 0, STAR_SIZE / 2 + 2, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.scale(scale, scale)
      drawStar(ctx, 0, 0, STAR_SIZE / 2, lit ? COLORS.yellow : 'rgba(31, 58, 95, 0.14)', {
        rotation: -Math.PI / 2 + (lit ? Math.sin(time * 1.4 + i) * 0.03 : 0),
        stroke: lit ? COLORS.white : 'rgba(255, 255, 255, 0.8)',
        lineWidth: lit ? 2.5 : 2
      })
      ctx.restore()
    }
  }

  /**
   * 状态卡：三行（步数/用时 + 星级结论 + 建议）
   *
   * 三星 = 走出最短路径，容错为 0。玩家看到 2 星会觉得"莫名其妙被扣星"，
   * 所以中间一行必须直接给出差距（差 N 步），最后一行给一句下次怎么做。
   *
   * 三档配色，语气逐档从"庆祝"降到"鼓励"，不用指责性措辞。
   */
  renderStatusCard(ctx) {
    const content = this.getStatusContent()
    const cardX = PANEL.x + 8
    const cardWidth = PANEL.width - 16

    fillRoundRect(ctx, cardX, CARD.y, cardWidth, CARD.height, 18, content.fill)
    strokeRoundRect(ctx, cardX, CARD.y, cardWidth, CARD.height, 18, content.border, 1.5)

    // 左侧小企鹅：三星欢呼，未满星站着，不画 sad（打击人）
    drawPenguin(ctx, cardX + 40, CARD.y + CARD.height / 2, 1.1, {
      pose: content.pose,
      mood: content.mood,
      angle: Math.sin(Date.now() / 600) * 0.04
    })

    const textX = cardX + 76
    const maxWidth = cardX + cardWidth - 14 - textX

    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'

    this.renderCardStats(ctx, textX, CARD.y + 22, maxWidth)
    this.drawFitText(ctx, content.title, textX, CARD.y + 48, maxWidth, 15, content.titleColor)
    this.drawFitText(ctx, content.tip, textX, CARD.y + 72, maxWidth, 12, COLORS.navySoft, 'normal')
  }

  /**
   * 卡片第一行的统计：「步数 3 · 最短 3 步 · 用时 00:03」
   *
   * 「标准」是内部术语，玩家读不出含义，所以写「最短」直接点明 par 就是
   * 这一关的最短路径，超了才会掉星。
   *
   * 三段分别上色（数字大一号、超标标红），但按总宽整体缩放到文字区宽度内，
   * 不做截断 —— 数字是玩家最需要看清的部分。
   */
  renderCardStats(ctx, x, y, maxWidth) {
    const parts = [
      { text: '步数 ', color: COLORS.navySoft, size: 12 },
      {
        text: `${this.moves}`,
        color: this.moves <= this.par ? COLORS.mintDeep : COLORS.coral,
        size: 16
      },
      {
        text: ` · 最短 ${this.par} 步 · 用时 ${this.formatTime(this.time)}`,
        color: COLORS.navySoft,
        size: 12
      }
    ]

    let total = 0
    parts.forEach(part => {
      ctx.font = font(part.size)
      total += ctx.measureText(part.text).width
    })
    const shrink = total > maxWidth ? maxWidth / total : 1

    let cursor = x
    parts.forEach(part => {
      ctx.font = font(Math.max(10, Math.round(part.size * shrink)))
      ctx.fillStyle = part.color
      ctx.fillText(part.text, cursor, y)
      cursor += ctx.measureText(part.text).width
    })
  }

  /**
   * 状态卡文案（按星级 + 超出步数选变体）
   *
   * 变体用 excess 取模挑选而不是随机：结算页每次重绘都要一致，
   * 随机会导致同一局反复刷新时文案乱跳。
   *
   * @returns {{title:string, tip:string, pose:string, mood:string,
   *            fill:string, border:string, titleColor:string}}
   */
  getStatusContent() {
    const excess = Math.max(0, Math.round(this.moves - this.par))

    // 重玩时第三行换成个人对比，没得比（首通 / 没有历史）就落回建议语
    const comparison = this.getComparisonLine()

    if (this.stars >= 3) {
      return {
        title: '完美通关 · 一步没浪费',
        tip: '这就是本关最短路径，企鹅为你鼓掌',
        pose: 'cheer',
        mood: 'happy',
        fill: 'rgba(255, 201, 74, 0.20)',
        border: 'rgba(229, 167, 43, 0.55)',
        titleColor: COLORS.yellowInk
      }
    }

    if (this.stars === 2) {
      const tips = [
        '先想好路线再滑，少绕一点就够了',
        '滑过头再折回来，步数就白费了',
        '从终点倒着推一遍，路线会更短'
      ]
      return {
        title: `差 ${excess} 步就是三星`,
        tip: comparison || tips[excess % tips.length],
        pose: 'wave',
        mood: 'idle',
        fill: 'rgba(91, 200, 245, 0.16)',
        border: 'rgba(44, 156, 214, 0.45)',
        titleColor: COLORS.waterDeep
      }
    }

    const tips = [
      '多试几次，路线会越走越短',
      '先看终点在哪，再决定第一步',
      '一次滑一格，想清楚再动手'
    ]
    return {
      title: `距离三星还差 ${excess} 步`,
      tip: comparison || tips[excess % tips.length],
      pose: 'stand',
      mood: 'idle',
      fill: 'rgba(167, 139, 250, 0.16)',
      border: 'rgba(139, 107, 232, 0.45)',
      titleColor: COLORS.lavenderDeep
    }
  }

  /**
   * 单行文字：超出宽度就自动缩字号，绝不截断成「…」
   * （提示语是玩家唯一能看到的解释，截断就白写了）
   */
  drawFitText(ctx, text, x, y, maxWidth, size, color, weight = 'bold') {
    let current = size
    ctx.font = font(current, weight)
    while (current > 10 && ctx.measureText(text).width > maxWidth) {
      current -= 1
      ctx.font = font(current, weight)
    }
    ctx.fillStyle = color
    ctx.fillText(text, x, y)
  }

  /**
   * 渲染本次通关新解锁的成就
   *
   * 位置在按钮下方那块空白（ACHIEVE.top ~ ACHIEVE.bottom），
   * 整组在区间里垂直居中：只有 1 条时不会顶在按钮下沿、下面空一大片。
   */
  renderAchievements(ctx) {
    if (!this.achievements || this.achievements.length === 0) return

    const width = 265
    const x = CENTER_X - width / 2
    const itemHeight = 25
    const gap = 4

    // 超过 3 个时只排前 2 条，第 3 行换成汇总文案，保证总行数不超过 3
    const hasOverflow = this.achievementOverflow > 0
    const items = hasOverflow ? this.achievements.slice(0, 2) : this.achievements
    const rows = items.length + (hasOverflow ? 1 : 0)

    const blockHeight = rows * itemHeight + (rows - 1) * gap
    const startY = Math.round(
      ACHIEVE.top + Math.max(0, (ACHIEVE.bottom - ACHIEVE.top - blockHeight) / 2)
    )

    items.forEach((achievement, index) => {
      const y = startY + index * (itemHeight + gap)

      // 浅黄胶囊底：浅色半透明底配深色字，对比度才够
      fillRoundRect(ctx, x, y, width, itemHeight, itemHeight / 2, 'rgba(255, 201, 74, 0.18)')

      // 图标
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.font = '13px Arial'
      ctx.fillStyle = COLORS.navy
      ctx.fillText(achievement.icon || '🏆', x + 12, y + itemHeight / 2)

      // 名称
      ctx.fillStyle = COLORS.navy
      ctx.font = font(12)
      ctx.fillText(`成就解锁 · ${achievement.name}`, x + 32, y + itemHeight / 2)

      // 奖励
      const rewardText = this.formatAchievementReward(achievement.reward)
      if (rewardText) {
        ctx.textAlign = 'right'
        ctx.fillStyle = COLORS.yellowInk
        ctx.font = font(11)
        ctx.fillText(rewardText, x + width - 12, y + itemHeight / 2)
      }
    })

    // 汇总行：告诉玩家还有几个，否则会以为只解锁了这两条
    if (hasOverflow) {
      const y = startY + items.length * (itemHeight + gap)
      const restCount = this.achievements.length - items.length
      fillRoundRect(ctx, x, y, width, itemHeight, itemHeight / 2, 'rgba(31, 58, 95, 0.06)')

      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = COLORS.navySoft
      ctx.font = font(12, 'normal')
      ctx.fillText(`另有 ${restCount} 个成就已解锁，可在成就页查看`, CENTER_X, y + itemHeight / 2)
    }
  }

  /**
   * 成就奖励文案，如「+3🐟」
   * @param {Object} reward
   * @returns {string}
   */
  formatAchievementReward(reward) {
    if (!reward) return ''
    const icons = { fish: '🐟', shrimp: '🦐', squid: '🦑', goldfish: '🐠' }
    return Object.keys(icons)
      .filter(key => reward[key] > 0)
      .map(key => `+${reward[key]}${icons[key]}`)
      .join(' ')
  }

  /**
   * 渲染奖励信息
   *
   * 食物是这一局最实在的收获，所以这块排在星级正下方、字号比状态卡正文还大，
   * 并且有描边和底色，是面板里除星级外最醒目的元素。
   *
   * 单行胶囊：左边实际入账的食物，右边竖线分隔后接一次性收益标签。
   * 标签字号按剩余宽度自动下调，宁可小一点也不能挤掉奖励数字。
   */
  renderRewards(ctx) {
    // 用「+3🐟」而不是「🐟×3」：没有「获得奖励」兜底时，
    // 单看「🐟×3」也能读成「消耗 3 条鱼」，加号才明确是增加
    const items = []
    if (this.rewards.fish > 0) items.push(`+${this.rewards.fish}🐟`)
    if (this.rewards.shrimp > 0) items.push(`+${this.rewards.shrimp}🦐`)
    if (this.rewards.squid > 0) items.push(`+${this.rewards.squid}🦑`)
    if (this.rewards.goldfish > 0) items.push(`+${this.rewards.goldfish}🐠`)

    // 这一局赚到的雪花钱（首通 / 首三星 / 成就 / 新手任务）。
    // 它和食物是两条线，但对玩家来说都是「这一局的收获」，放同一个胶囊里最好读。
    const coins = Math.max(0, parseInt(this.rewardMeta && this.rewardMeta.coins, 10) || 0)
    if (coins > 0) items.push(`+${coins}❄`)

    const midY = REWARD_Y + REWARD_HEIGHT / 2
    ctx.textBaseline = 'middle'

    // 一个都没进账：说明食物满了，只讲结论，不列「🐟×2 未入账」这类明细 ——
    // 那些本来就没进背包，写出来只是让人心疼
    if (items.length === 0) {
      ctx.font = font(14)
      ctx.fillStyle = COLORS.navySoft
      ctx.textAlign = 'center'
      ctx.fillText('食物已满', CENTER_X, midY)
      return
    }

    const tags = this.getRewardTags()
    const amount = items.join('  ')

    const padX = 16
    const sepGap = 11
    const sepWidth = 1
    const maxWidth = PANEL.width - 12

    // 胶囊里现在可能同时有鱼/虾/金币三种东西，先缩数字字号再排标签 ——
    // 数字被裁掉比字小一点更糟
    let amountSize = 16
    ctx.font = font(amountSize)
    let amountWidth = ctx.measureText(amount).width
    while (amountSize > 12 && amountWidth + padX * 2 + 78 > maxWidth) {
      amountSize -= 1
      ctx.font = font(amountSize)
      amountWidth = ctx.measureText(amount).width
    }

    const measureTag = size => {
      if (tags.length === 0) return 0
      ctx.font = font(size, 'normal')
      return ctx.measureText(tags.join(' · ')).width
    }

    // 先按标签 11px 试排，超宽就一路缩到 8px（手机上仍有 ~16 物理像素）
    let tagSize = 11
    let tagWidth = measureTag(tagSize)
    const tagBlock = () => (tags.length > 0 ? sepGap * 2 + sepWidth + tagWidth : 0)
    let contentWidth = amountWidth + tagBlock()
    let total = Math.max(170, contentWidth + padX * 2)

    while (total > maxWidth && tagSize > 8 && tags.length > 0) {
      tagSize -= 0.5
      tagWidth = measureTag(tagSize)
      contentWidth = amountWidth + tagBlock()
      total = Math.max(170, contentWidth + padX * 2)
    }

    const x = CENTER_X - total / 2
    fillRoundRect(ctx, x, REWARD_Y, total, REWARD_HEIGHT, REWARD_HEIGHT / 2, 'rgba(47, 191, 155, 0.22)')
    strokeRoundRect(ctx, x, REWARD_Y, total, REWARD_HEIGHT, REWARD_HEIGHT / 2, 'rgba(47, 191, 155, 0.45)', 1.5)

    // 内容整体居中于胶囊（胶囊有最小宽度，不能从左边距死排）
    ctx.textAlign = 'left'
    let cursor = CENTER_X - contentWidth / 2

    ctx.font = font(amountSize)
    ctx.fillStyle = COLORS.mintDeep
    ctx.fillText(amount, cursor, midY)
    cursor += amountWidth

    if (tags.length > 0) {
      cursor += sepGap
      // 竖分隔线：把「拿到什么」和「为什么额外给」分开，比换行省一整行
      ctx.fillStyle = 'rgba(47, 191, 155, 0.35)'
      ctx.fillRect(cursor, midY - 8, sepWidth, 16)
      cursor += sepWidth + sepGap

      ctx.font = font(tagSize, 'normal')
      ctx.fillStyle = COLORS.navySoft
      ctx.fillText(tags.join(' · '), cursor, midY)
    }
  }

  /**
   * 一次性收益标签：首次通关 / 首次三星 / 食物满溢未入账
   * @returns {string[]}
   */
  getRewardTags() {
    const meta = this.rewardMeta || {}
    const tags = []

    // 不再显示「首次通关」：主线推进时每一关都是首通，标签恒定等于噪音。
    // 首通奖励的 2🐟 已经算进上面的食物数字里，不需要额外点名。
    if (meta.firstThreeStar) tags.push('首次三星')

    // 食物满了只写结论，不列「🐟×2 未入账」—— 那些本来就没进背包
    if (this.getLostRewards().length > 0) tags.push('食物已满')

    return tags
  }

  /**
   * 计算因食物上限被丢弃的奖励（理论值 - 实际入账）
   * @returns {string[]} 形如 ['🐟×2']
   */
  getLostRewards() {
    const requested = this.rewardMeta && this.rewardMeta.requested
    if (!requested || !this.rewards) return []

    const lost = []
    const icons = { fish: '🐟', shrimp: '🦐', squid: '🦑', goldfish: '🐠' }
    Object.keys(icons).forEach(key => {
      const diff = (requested[key] || 0) - (this.rewards[key] || 0)
      if (diff > 0) lost.push(`${icons[key]}×${diff}`)
    })
    return lost
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  onTouchStart(touch) {
    if (!this.isVisible) return false

    const t = stage().unproject(touch)
    this.buttons.forEach(btn => btn.onTouchStart(t))
    return true
  }

  onTouchMove(touch) {
    if (!this.isVisible) return

    const t = stage().unproject(touch)
    this.buttons.forEach(btn => {
      btn.isHovered = btn.contains(t.clientX, t.clientY)
    })
  }

  onTouchEnd(touch) {
    if (!this.isVisible) return false

    const t = stage().unproject(touch)
    this.buttons.forEach(btn => btn.onTouchEnd(t))
    return true
  }
}
