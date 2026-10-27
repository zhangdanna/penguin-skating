/**
 * 成就展示场景
 * 显示所有成就和解锁状态
 *
 * 背景与首页 / 排行榜一致（同一套海洋 + 海草画面），不再铺一整块奶油白面板。
 *
 * 交互：
 *   - 点「已解锁」卡片 → 中央弹出详情卡（大企鹅造型 + 一句话 + 奖励）
 *   - 点「未解锁」卡片 → 左右抖两下，不弹层
 *   - 位移超过 TAP_SLOP 判定为滚动，不触发点击
 */
import Button from './button'
import {
  COLORS,
  drawGlassPanel,
  drawOceanCached,
  drawOceanMotion,
  drawOverlay,
  drawPenguin,
  drawStickerText,
  fillRoundRect,
  font,
  roundRectPath
} from './theme'
import { viewport } from '../env'
import { computeBoardLayout } from './layout'

/** 点击 / 滚动的分界位移（px） */
const TAP_SLOP = 8
/** 未解锁卡片抖动时长（ms） */
const SHAKE_DURATION = 420
/** 详情卡入场动画时长（ms） */
const POPUP_ANIM = 220

/** 顶部标题胶囊（与排行榜同款，切换页面时顶部元素不跳动） */
const TITLE = {
  width: 140,
  height: 46
}
/** 标题胶囊 ↔ 进度条 */
const GAP_TITLE_BAR = 12
/** 进度条 ↔ 成就列表 */
const GAP_BAR_LIST = 46

/**
 * 详情卡尺寸全部按设计稿比例推导（设计稿 322×441）。
 * 只改下面这几个比例，整张卡会等比缩放，不要再往 renderPopup 里写魔法数字。
 */
const POPUP = {
  maxWidth: 320,      // 上限宽，窄屏用 vp.width - 40
  aspect: 1.366,      // 高 / 宽
  radius: 27,         // 圆角（设计稿实测 26~28）
  bandRatio: 0.266,   // 顶部色带高 / 宽
  titleY: 35,         // 图标 + 名称所在行的中线（相对卡片顶）
  subY: 63,           // 副标题中线
  penguinY: 239,      // 企鹅中心
  penguinScale: 3.5,  // 设计稿里企鹅高约 180
  quoteY: 362,        // 一句话中线
  chipY: 402,         // 标签中线
  chipHeight: 30,
  chipPadX: 13,       // 标签左右内边距
  chipGap: 12,        // 两个标签的间距
  closeSize: 30,      // 右上角 ✕ 的圆直径
  closeInset: 9       // ✕ 距卡片右边 / 上边的距离
}

/**
 * drawPenguin 的纵向包围盒（单位：身体中心为原点，见 theme.js）
 *
 * 多数姿态就是「身体 + 脚底」的 -25.5 ~ 22，但有两个例外必须单独记：
 *   - peek ：整体 drop +15，所以头顶从 -25.5 抬到 -10.5；冰堆 `fillRoundRect(-25, 10, 50, 15)`
 *            画到 y=25，加上 drop 后底边到 y=40 —— 比常规姿态低 18 单位
 *   - slide：以脚底 (0,22) 为支点旋转 -0.72rad，头顶被转下来、脚趾被转上去，
 *            实测包围盒变成 -9.5 ~ 22.5
 */
const PENGUIN_BOX = {
  default: { top: -25.5, bottom: 22 },
  peek: { top: -10.5, bottom: 40 },
  slide: { top: -9.5, bottom: 22.5 }
}

/**
 * 姿态在卡片里的纵向修正
 *
 * `penguinScale 3.5` 对常规姿态刚好：企鹅占 149.75 ~ 316.75，上下都有余量。
 * 但 peek 的冰台会落到 `penguinY + 40×3.5 = 379`，而一句话的中线在 362 ——
 * 冰台直接把「掉下去一次，爬上来更稳。」盖掉一半（用户报的「企鹅遮住下面的字」）。
 *
 * 这里按姿态给「中心偏移 + 缩放」，让每个造型的视觉包围盒都落在
 * 色带底部（85）到一句话（362）之间。**不去改 drawPenguin** ——
 * 那是全局造型口径，菜单和对局里的同一个姿态不该跟着变。
 */
const POSE_FIT = {
  peek: { offsetY: -36, scale: 3.1 }
}

export default class AchievementScene {
  constructor(achievementManager, onClose) {
    this.achievementManager = achievementManager
    this.onClose = onClose
    this.isVisible = false

    // 分页
    this.currentPage = 0
    this.itemsPerPage = 6
    this.totalPages = 0

    // 滚动
    this.scrollY = 0
    this.maxScroll = 0

    // 卡片点击 / 详情弹层
    this.cardRects = []       // render 时重建，用于命中判定
    this.listRect = null      // 列表可视区域，防止点到被裁掉的卡片
    this.expandedId = null    // 当前展开的成就 id
    this.popupRect = null
    this.popupOpenedAt = 0
    this.shakeId = null
    this.shakeStartedAt = 0

    // 手势起点
    this.touchStartX = 0
    this.touchStartY = 0
    // 手势的**最初**落点：onTouchMove 会改写 touchStartY（滚动要用），
    // 所以点击判定必须另存一份，否则滚完一段再抬手会被当成点击
    this.gestureStartX = 0
    this.gestureStartY = 0

    // 纵向布局（标题胶囊 / 进度条 / 列表起点），在 buildLayout 里算
    this.titlePanel = null
    this.barY = 0
    this.listTop = 0

    this.init()
  }

  /**
   * 窗口尺寸变化后重排（标题、进度条、列表起点、关闭按钮）
   *
   * 顶部留白取对局界面的 HUD y（computeBoardLayout().hudPanelY），
   * 和排行榜同一口径 —— 两个二级页面切来切去时顶部元素不会上下跳。
   */
  relayout() {
    this.buildLayout()
  }

  buildLayout() {
    const vp = viewport()
    const { hudPanelY } = computeBoardLayout(vp)

    this.titlePanel = {
      x: Math.round((vp.width - TITLE.width) / 2),
      y: hudPanelY,
      width: TITLE.width,
      height: TITLE.height
    }
    this.barY = hudPanelY + TITLE.height + GAP_TITLE_BAR
    this.listTop = this.barY + GAP_BAR_LIST

    if (this.closeButton) {
      this.closeButton.x = vp.width - 60
      // 和标题胶囊同一水平线居中（胶囊高 46，按钮高 40）
      this.closeButton.y = hudPanelY + Math.round((TITLE.height - 40) / 2)
    }
  }

  init() {
    // 计算总页数
    const allAchievements = this.achievementManager.getAllAchievements()
    this.totalPages = Math.ceil(allAchievements.length / this.itemsPerPage)

    // 关闭按钮
    this.closeButton = new Button({
      x: viewport().width - 60,
      y: 20,
      width: 40,
      height: 40,
      text: '✕',
      fontSize: 16,
      bgColor: COLORS.coral,
      hoverColor: '#E85F4F',
      borderColor: '#C94A3C',
      onClick: () => this.hide()
    })

    this.buildLayout()
  }

  /**
   * 显示
   */
  show() {
    this.isVisible = true
    this.currentPage = 0
    this.scrollY = 0
    this.expandedId = null
  }

  /**
   * 隐藏
   */
  hide() {
    this.isVisible = false
    this.expandedId = null
    if (this.onClose) {
      this.onClose()
    }
  }

  /**
   * 场景进入
   */
  onEnter() {
    this.show()
  }

  /**
   * 场景退出
   */
  onExit() {
    this.isVisible = false
    this.expandedId = null
  }

  /**
   * 触摸开始
   */
  onTouchStart(e) {
    if (!this.isVisible) return

    // 这个场景的 render() **没有**调用 stage().apply()，所有绘制都在原始逻辑坐标里，
    // 所以触摸坐标也不能反算 —— 一旦 unproject，非 375×667 的屏幕（iPhone X 这类
    // 高屏会多出 offsetY ≈ 75）就会整体偏上，点第 3 项弹的是第 2 项。
    // 两个坐标系必须成对：要么 render 和 touch 都走 stage()，要么都不走。
    const touch = e.touches ? e.touches[0] : e
    this.touchStartX = touch.clientX
    this.touchStartY = touch.clientY
    this.gestureStartX = touch.clientX
    this.gestureStartY = touch.clientY

    // 详情弹层打开时，列表不响应任何手势
    if (this.expandedId) return

    this.closeButton.onTouchStart(touch)
  }

  /**
   * 触摸移动（滚动）
   */
  onTouchMove(e) {
    if (!this.isVisible) return
    if (this.expandedId) return

    const touch = e.touches ? e.touches[0] : e
    const deltaY = this.touchStartY - touch.clientY
    this.touchStartY = touch.clientY

    this.scrollY += deltaY
    this.scrollY = Math.max(0, Math.min(this.scrollY, this.maxScroll))
  }

  /**
   * 触摸结束：区分点击与滚动
   */
  onTouchEnd(e) {
    if (!this.isVisible) return

    const touch = e.changedTouches ? e.changedTouches[0] : e
    // 用最初落点判定，不能用 touchStartY —— 它已经被 onTouchMove 改成最后一帧的位置了
    const moved = Math.abs(touch.clientY - this.gestureStartY) > TAP_SLOP ||
      Math.abs(touch.clientX - this.gestureStartX) > TAP_SLOP

    // 详情弹层：点外面或点 ✕ 收起
    if (this.expandedId) {
      if (!moved) this.handlePopupTap(touch)
      return
    }

    this.closeButton.onTouchEnd(touch)
    if (moved) return

    this.handleCardTap(touch)
  }

  /**
   * 命中列表卡片
   * @returns {Object|null} 被点中的成就
   */
  getCardAt(x, y) {
    if (!this.listRect) return null
    const list = this.listRect
    if (y < list.y || y > list.y + list.height) return null

    for (let i = 0; i < this.cardRects.length; i++) {
      const rect = this.cardRects[i]
      if (x >= rect.x && x <= rect.x + rect.width &&
          y >= rect.y && y <= rect.y + rect.height) {
        return rect.achievement
      }
    }
    return null
  }

  /**
   * 点击卡片
   */
  handleCardTap(touch) {
    const achievement = this.getCardAt(touch.clientX, touch.clientY)
    if (!achievement) return

    if (achievement.unlocked) {
      this.expandedId = achievement.id
      this.popupOpenedAt = Date.now()
      return
    }

    // 未解锁：抖一下，不弹层
    this.shakeId = achievement.id
    this.shakeStartedAt = Date.now()
  }

  /**
   * 右上角 ✕ 的圆心
   * 渲染和命中判定共用这一份计算，避免两边各算一遍导致点不中。
   */
  getCloseCenter(rect) {
    return {
      x: rect.x + rect.width - POPUP.closeInset - POPUP.closeSize / 2,
      y: rect.y + POPUP.closeInset + POPUP.closeSize / 2,
      radius: POPUP.closeSize / 2
    }
  }

  /**
   * 点击详情弹层
   *
   * 关闭有两条路：点右上角 ✕，或者点卡片外面。
   * 卡片本身吃掉点击，避免误关。
   */
  handlePopupTap(touch) {
    const rect = this.popupRect
    if (!rect) {
      this.expandedId = null
      return
    }

    const close = this.getCloseCenter(rect)
    // 判定区比视觉圆大 6px —— 30px 的圆对指尖来说太小
    const hitRadius = close.radius + 6
    const inClose = Math.hypot(touch.clientX - close.x, touch.clientY - close.y) <= hitRadius

    const inCard = touch.clientX >= rect.x && touch.clientX <= rect.x + rect.width &&
      touch.clientY >= rect.y && touch.clientY <= rect.y + rect.height

    if (inClose || !inCard) {
      this.expandedId = null
    }
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

    // 背景与首页 / 排行榜完全一致：海洋 + 海草（静态层走共享离屏缓存）
    drawOceanCached(ctx)
    drawOceanMotion(ctx, Date.now() / 1000)

    // 详情卡打开时，背后只压一层很轻的遮罩让卡片浮起来 ——
    // 背景仍然是海草画面，不再铺一整块奶油白底
    if (this.expandedId) {
      drawOverlay(ctx, 0.2)
      this.renderPopup(ctx)
      return
    }

    // 标题
    this.renderTitle(ctx)

    // 进度
    this.renderProgress(ctx)

    // 成就列表
    this.renderAchievements(ctx)

    // 关闭按钮
    this.closeButton.render(ctx)
  }

  /**
   * 渲染标题：白色胶囊 + 深色字
   *
   * 不能再用「白字 + 白描边」的贴纸体 —— 底下一片海面，白字会糊掉。
   */
  renderTitle(ctx) {
    const { x, y, width, height } = this.titlePanel

    drawGlassPanel(ctx, x, y, width, height, 23, {
      fill: 'rgba(255, 255, 255, 0.86)'
    })
    drawStickerText(ctx, '成就', x + width / 2, y + height / 2, {
      size: 22,
      color: COLORS.navy,
      strokeWidth: 0
    })
  }

  /**
   * 渲染进度
   */
  renderProgress(ctx) {
    const progress = this.achievementManager.getProgress()

    // 进度条背景
    const barX = 30
    const barY = this.barY
    const barWidth = viewport().width - 60
    const barHeight = 18

    fillRoundRect(ctx, barX, barY, barWidth, barHeight, 9, 'rgba(31, 58, 95, 0.28)')

    // 进度条
    const progressWidth = (barWidth * progress.percentage) / 100
    if (progressWidth > 0) {
      fillRoundRect(ctx, barX, barY, Math.max(progressWidth, 12), barHeight, 9, COLORS.mint)
    }

    // 进度文字：海面上直接写深色字会看不清，用贴纸体描一圈深蓝
    drawStickerText(
      ctx,
      `${progress.unlocked} / ${progress.total} (${Math.floor(progress.percentage)}%)`,
      viewport().width / 2,
      barY + 34,
      { size: 13, color: COLORS.white, stroke: COLORS.navyDeep, strokeWidth: 3.5 }
    )
  }

  /**
   * 渲染成就列表
   */
  renderAchievements(ctx) {
    const allAchievements = this.achievementManager.getAllAchievements()
    const startY = this.listTop
    const itemHeight = 90
    const vp = viewport()

    // 计算最大滚动
    this.maxScroll = Math.max(0, allAchievements.length * itemHeight - (vp.height - startY - 50))

    // 每帧重建命中区域
    this.cardRects = []
    this.listRect = { x: 0, y: startY, width: vp.width, height: vp.height - startY - 24 }

    ctx.save()

    // 裁剪区域
    ctx.beginPath()
    ctx.rect(0, startY, vp.width, vp.height - startY - 24)
    ctx.clip()

    allAchievements.forEach((achievement, index) => {
      const y = startY + index * itemHeight - this.scrollY

      // 只渲染可见区域
      if (y + itemHeight < startY || y > vp.height - 24) return

      this.renderAchievementItem(ctx, achievement, 26, y, vp.width - 52, itemHeight - 10)
    })

    ctx.restore()
  }

  /**
   * 渲染单个成就项
   */
  renderAchievementItem(ctx, achievement, x, y, width, height) {
    // 未解锁的抖动
    let offsetX = 0
    if (this.shakeId === achievement.id) {
      const elapsed = Date.now() - this.shakeStartedAt
      if (elapsed < SHAKE_DURATION) {
        offsetX = Math.sin(elapsed / 26) * 5 * (1 - elapsed / SHAKE_DURATION)
      } else {
        this.shakeId = null
      }
    }
    const left = x + offsetX

    // 卡片
    // 背景换成了海面，未解锁卡片不能再压到 0.55 —— 海水的蓝会透上来，
    // 白色文字底变成一块脏灰。0.78 既保留「未解锁」的弱化感，又保证字读得清。
    fillRoundRect(
      ctx,
      left,
      y,
      width,
      height,
      achievement.unlocked ? 16 : 14,
      achievement.unlocked ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.78)'
    )

    // 边框
    roundRectPath(ctx, left, y, width, height, achievement.unlocked ? 16 : 14)
    ctx.strokeStyle = achievement.unlocked ? COLORS.mint : 'rgba(31, 58, 95, 0.12)'
    ctx.lineWidth = achievement.unlocked ? 2 : 1.5
    ctx.stroke()

    // 命中区域跟着抖动一起偏移，手指和视觉才一致
    this.cardRects.push({ x: left, y, width, height, achievement })

    // 图标
    ctx.font = '30px Arial'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(achievement.icon, left + 14, y + height / 2)

    // 名称
    ctx.fillStyle = achievement.unlocked ? COLORS.navy : COLORS.navySoft
    ctx.font = font(15)
    ctx.fillText(achievement.name, left + 58, y + 24)

    // 描述
    ctx.fillStyle = COLORS.navySoft
    ctx.font = font(12, 'normal')
    ctx.fillText(achievement.description, left + 58, y + 46)

    // 奖励
    const rewardText = this.formatReward(achievement.reward)
    ctx.fillStyle = COLORS.yellowDeep
    ctx.font = font(12)
    ctx.fillText(`奖励: ${rewardText}`, left + 58, y + 67)

    // 解锁状态
    if (achievement.unlocked) {
      ctx.fillStyle = COLORS.mintDeep
      ctx.font = font(13)
      ctx.textAlign = 'right'
      ctx.fillText('✓ 已解锁', left + width - 14, y + height / 2 - 8)

      // 提示可点开
      ctx.fillStyle = COLORS.lavenderDeep
      ctx.font = font(11, 'normal')
      ctx.fillText('点击查看 ›', left + width - 14, y + height / 2 + 12)
    } else {
      ctx.fillStyle = 'rgba(31, 58, 95, 0.35)'
      ctx.font = '14px Arial'
      ctx.textAlign = 'right'
      ctx.fillText('🔒', left + width - 14, y + height / 2)
    }

    // 进度（F2：让玩家看得到离解锁还有多远）
    // 放在「奖励」同一行右侧：左边是「奖励: 3🐟」，右边是「12/30」或
    // 「首通 3 关后开启」（minWins 门槛文案），两者水平区间不重叠。
    // 原来写的是 height/2 + 20 = y+60，和奖励行 y+67 差 7px，长文案会视觉上粘在一起
    if (!achievement.unlocked && achievement.progressText) {
      ctx.fillStyle = COLORS.waterDeep
      ctx.font = font(12)
      ctx.textAlign = 'right'
      ctx.fillText(achievement.progressText, left + width - 14, y + 67)
    }
  }

  /**
   * 渲染成就详情弹层
   *
   * 严格按设计稿：顶部色带里「图标 + 名称」同一行、副标题（解锁条件）也留在色带里；
   * 中间一只大企鹅；下面一句话；最底两个浅色标签。
   */
  renderPopup(ctx) {
    const achievement = this.achievementManager
      .getAllAchievements()
      .find(item => item.id === this.expandedId)

    if (!achievement) {
      this.expandedId = null
      return
    }

    const vp = viewport()
    const width = Math.min(POPUP.maxWidth, vp.width - 40)
    const height = Math.round(width * POPUP.aspect)
    const x = (vp.width - width) / 2
    const y = (vp.height - height) / 2
    const bandHeight = Math.round(width * POPUP.bandRatio)

    this.popupRect = { x, y, width, height }

    // 入场动画：0.9 → 1，带一点点回弹
    const raw = Math.min(1, (Date.now() - this.popupOpenedAt) / POPUP_ANIM)
    const scale = 0.9 + 0.1 * raw + Math.sin(raw * Math.PI) * 0.03

    ctx.save()
    ctx.translate(x + width / 2, y + height / 2)
    ctx.scale(scale, scale)
    ctx.translate(-(x + width / 2), -(y + height / 2))

    // 投影：多层递进放大的半透明圆角矩形（源码禁 shadowBlur）。
    // 每层 alpha 必须压得很低，否则会看出「叠了三张灰卡片」的硬边。
    ctx.save()
    ctx.globalAlpha = 0.16
    for (let i = 8; i >= 1; i--) {
      const spread = i * 2.2
      fillRoundRect(
        ctx,
        x - spread / 2, y + 6 + spread / 2,
        width + spread, height + spread,
        POPUP.radius + spread / 2,
        'rgba(31, 58, 95, 0.14)'
      )
    }
    ctx.restore()

    // 卡片底
    fillRoundRect(ctx, x, y, width, height, POPUP.radius, COLORS.white)

    // 顶部色带（横向渐变，只在上半段）
    ctx.save()
    roundRectPath(ctx, x, y, width, height, POPUP.radius)
    ctx.clip()
    const band = ctx.createLinearGradient(x, y, x + width, y)
    band.addColorStop(0, COLORS.lavender)
    band.addColorStop(1, COLORS.lavenderDeep)
    ctx.fillStyle = band
    ctx.fillRect(x, y, width, bandHeight)
    ctx.restore()

    // 图标 + 名称：同一行，整体水平居中
    const titleY = y + POPUP.titleY
    ctx.textBaseline = 'middle'
    ctx.font = '24px Arial'
    const iconWidth = ctx.measureText(achievement.icon).width
    ctx.font = font(21)
    const nameWidth = ctx.measureText(achievement.name).width
    const rowGap = 10
    const rowWidth = iconWidth + rowGap + nameWidth
    const rowX = x + (width - rowWidth) / 2

    ctx.textAlign = 'left'
    ctx.font = '24px Arial'
    ctx.fillText(achievement.icon, rowX, titleY)

    ctx.fillStyle = COLORS.white
    ctx.font = font(21)
    ctx.fillText(achievement.name, rowX + iconWidth + rowGap, titleY)

    // 副标题：解锁条件，留在色带里
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)'
    ctx.font = font(12.5, 'normal')
    ctx.fillText(achievement.description, x + width / 2, y + POPUP.subY)

    // 企鹅造型（peek / slide 这类延伸较大的姿态按 POSE_FIT 上移并微缩）
    const pose = achievement.pose || 'stand'
    const mood = pose === 'sleep' ? 'idle' : 'happy'
    const fit = POSE_FIT[pose] || { offsetY: 0, scale: POPUP.penguinScale }
    drawPenguin(ctx, x + width / 2, y + POPUP.penguinY + fit.offsetY, fit.scale, {
      pose,
      prop: achievement.prop || null,
      mood
    })

    // 一句话（设计稿带书名号）
    ctx.textAlign = 'center'
    ctx.fillStyle = COLORS.navy
    ctx.font = font(14)
    ctx.fillText(
      `「${achievement.quote || achievement.description}」`,
      x + width / 2,
      y + POPUP.quoteY
    )

    // 底部两个浅色标签：先量宽，再整体居中
    const chipY = y + POPUP.chipY
    const chipTexts = [
      { text: '✓ 已解锁', bg: 'rgba(47, 191, 155, 0.14)', color: COLORS.mintDeep },
      {
        text: `奖励 ${this.formatReward(achievement.reward)}`,
        bg: 'rgba(255, 201, 74, 0.22)',
        color: COLORS.yellowInk
      }
    ]

    ctx.font = font(13)
    const chipWidths = chipTexts.map(item => ctx.measureText(item.text).width + POPUP.chipPadX * 2)
    const chipsWidth = chipWidths[0] + chipWidths[1] + POPUP.chipGap
    let chipLeft = x + (width - chipsWidth) / 2

    chipTexts.forEach((item, index) => {
      this.renderChip(ctx, chipLeft, chipY, chipWidths[index], item.text, item.bg, item.color)
      chipLeft += chipWidths[index] + POPUP.chipGap
    })

    // ✕：白色半透明圆底 + 紫色叉。
    // 底色不能太透（0.28 那种叠在紫底上会发灰），要够白才像按钮；
    // 叉用深紫而不是白色 —— 白底白叉等于没画。
    const close = this.getCloseCenter({ x, y, width, height })

    ctx.beginPath()
    ctx.arc(close.x, close.y, close.radius, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.fill()

    ctx.strokeStyle = COLORS.lavenderDeep
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(close.x - 5, close.y - 5)
    ctx.lineTo(close.x + 5, close.y + 5)
    ctx.moveTo(close.x + 5, close.y - 5)
    ctx.lineTo(close.x - 5, close.y + 5)
    ctx.stroke()

    ctx.restore()
  }

  /**
   * 某个姿态在卡片里的视觉纵向范围（相对卡片顶）
   *
   * 给回归测试用：断言每个造型的企鹅都不会压到顶部色带或底部那句话。
   * 卡片实际绘制时还会叠加 y 偏移，这里只算「相对卡片顶」的值。
   *
   * @param {string} pose
   * @returns {{top:number, bottom:number}}
   */
  getPenguinSpan(pose) {
    const box = PENGUIN_BOX[pose] || PENGUIN_BOX.default
    const fit = POSE_FIT[pose] || { offsetY: 0, scale: POPUP.penguinScale }
    const centerY = POPUP.penguinY + fit.offsetY
    return {
      top: centerY + box.top * fit.scale,
      bottom: centerY + box.bottom * fit.scale
    }
  }

  /**
   * 小标签：浅色底 + 同色系深字
   *
   * 底色一定要是「浅色半透明」而不是色板里的实色 —— 实色底配同色系深字，
   * 对比度只有 2:1 左右，看上去就是一块发灰的色块，字几乎读不出来。
   *
   * @param {number} x 标签左边缘
   * @param {number} cy 标签中线
   * @param {number} width 标签宽
   */
  renderChip(ctx, x, cy, width, text, bgColor, textColor) {
    fillRoundRect(
      ctx, x, cy - POPUP.chipHeight / 2, width, POPUP.chipHeight,
      POPUP.chipHeight / 2, bgColor
    )
    ctx.fillStyle = textColor
    ctx.font = font(13)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, x + width / 2, cy)
  }

  /**
   * 格式化奖励
   */
  formatReward(reward) {
    const parts = []
    if (reward.fish) parts.push(`${reward.fish}🐟`)
    if (reward.shrimp) parts.push(`${reward.shrimp}🦐`)
    if (reward.squid) parts.push(`${reward.squid}🦑`)
    if (reward.goldfish) parts.push(`${reward.goldfish}🐠`)
    return parts.join(' ')
  }

  /**
   * 检查是否包含某点
   */
  contains(x, y) {
    return this.isVisible
  }
}
