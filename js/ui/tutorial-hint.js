import { COLORS, font, roundRectPath } from './theme'
import { getTutorialHint } from '../levels/tutorial-levels'

/**
 * 新手引导气泡（对局内，前 3 关）
 *
 * 只在第 1~3 关、且该关还没看过引导时出现。
 *
 * 为什么是「气泡 + 高亮圈」而不是「教程弹窗」：
 *   推箱子的理解成本在「这块东西是干嘛的」，不在「规则文字」。
 *   弹窗会挡住盘面，玩家关掉弹窗时已经把刚读的规则忘了。
 *   气泡浮在盘面上、旁边就是被圈出来的那个东西，看到即对上。
 *
 * 位置策略：气泡永远放在**离锚点远的那一侧**（锚点在下半屏就放顶部，
 * 反之放底部），并且不压住锚点本身 —— 压住就等于把要讲的东西盖上了。
 */

/** 单条提示的停留时长 */
const HOLD_MS = 7000
const FADE_IN_MS = 180
const FADE_OUT_MS = 240

const BUBBLE_MAX_WIDTH = 300
const BUBBLE_MIN_HEIGHT = 46
const BUBBLE_PAD_X = 13
const BUBBLE_PAD_Y = 11
/** 气泡与棋盘边缘的距离 */
const BUBBLE_MARGIN = 6

export default class TutorialHint {
  constructor() {
    /** 当前关卡（0 = 不在引导范围） */
    this.levelNum = 0
    /** 本关是否允许显示（首次进入才允许） */
    this.enabled = false

    /** 当前这条提示 */
    this.hint = null
    this.text = ''
    /** 停留计时 */
    this.elapsed = 0
    /** 当前这条提示出现时的步数 */
    this.shownAtMoves = 0
    /** 0~1 透明度 */
    this.alpha = 0
    /** 是否已经主动收起（本关不再出现） */
    this.dismissed = false
    /** 动画相位 */
    this.pulse = 0
  }

  /**
   * 进入某一关
   * @param {number} levelNum
   * @param {boolean} enabled - 该关是否还没看过引导
   */
  setLevel(levelNum, enabled) {
    this.levelNum = levelNum
    this.enabled = !!enabled
    this.dismissed = false
    this.elapsed = 0
    this.alpha = 0
    this.hint = null
    this.text = ''
  }

  /** 是否正在显示（有内容且没被收起） */
  get isActive() {
    return this.enabled && !this.dismissed && !!this.text
  }

  /**
   * 主动收起（玩家走了两步、或点了气泡）
   */
  dismiss() {
    this.dismissed = true
  }

  /**
   * 每帧更新
   * @param {number} moves - 当前步数，用来切换引导条目
   * @param {number} dt - 距上一帧的毫秒数
   */
  update(moves, dt) {
    this.pulse = (this.pulse + (dt || 16) * 0.004) % (Math.PI * 2)

    if (!this.enabled || this.dismissed) {
      this.alpha = Math.max(0, this.alpha - (dt || 16) / FADE_OUT_MS)
      return
    }

    // 步数推进后换下一条；换条不重置停留计时（否则玩家每走一步都重置）
    const next = getTutorialHint(this.levelNum, moves)
    if (!next) {
      this.dismissed = true
      return
    }

    if (next.text !== this.text) {
      this.text = next.text
      this.hint = next
      this.elapsed = 0
      // 记下这条提示出现时的步数：判断「玩家已经会了」要用相对步数，
      // 用绝对步数会让第 1 关的第二条提示（moves=1 才出现）刚出现就被收掉
      this.shownAtMoves = moves
    }

    this.elapsed += dt || 16

    // 停留超时、或这条提示出现后又走了 2 步（说明玩家已经会了）就淡出
    const movesSinceShown = moves - (this.shownAtMoves || 0)
    if (this.elapsed > HOLD_MS || movesSinceShown >= 2) {
      this.alpha = Math.max(0, this.alpha - (dt || 16) / FADE_OUT_MS)
      if (this.alpha <= 0) this.dismissed = true
      return
    }

    this.alpha = Math.min(1, this.alpha + (dt || 16) / FADE_IN_MS)
  }

  /**
   * 渲染
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} board
   * @param {{x:number,y:number,width:number,height:number}} board.anchor - 锚点矩形（棋盘像素坐标）
   * @param {number} board.x - 棋盘左边缘
   * @param {number} board.y - 棋盘上边缘
   * @param {number} board.width - 棋盘宽度
   * @param {number} board.height - 棋盘高度
   */
  render(ctx, board) {
    if (this.alpha <= 0.01 || !this.text || !board || !board.anchor) return

    const anchor = board.anchor
    const bubble = this.layoutBubble(ctx, board, anchor)

    ctx.save()
    ctx.globalAlpha = this.alpha

    this.renderAnchorRing(ctx, anchor)
    this.renderBubble(ctx, bubble, anchor)

    ctx.restore()
  }

  /**
   * 高亮圈：圈住要讲的那个东西
   */
  renderAnchorRing(ctx, anchor) {
    const pad = 3
    const pulse = (Math.sin(this.pulse) + 1) / 2
    const radius = 12

    ctx.save()
    ctx.setLineDash([7, 5])
    ctx.lineDashOffset = -this.pulse * 6
    roundRectPath(ctx, anchor.x - pad, anchor.y - pad, anchor.width + pad * 2, anchor.height + pad * 2, radius)
    ctx.strokeStyle = `rgba(255, 122, 107, ${0.55 + pulse * 0.4})`
    ctx.lineWidth = 2.6
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }

  /**
   * 气泡位置：放在锚点对面那一侧，且不压住锚点
   */
  layoutBubble(ctx, board, anchor) {
    const maxWidth = Math.min(board.width - BUBBLE_MARGIN * 2, BUBBLE_MAX_WIDTH)
    ctx.font = font(12.5, 'bold')
    const lines = wrapText(ctx, this.text, maxWidth - BUBBLE_PAD_X * 2)

    const lineHeight = 17
    const height = Math.max(
      BUBBLE_MIN_HEIGHT,
      lines.length * lineHeight + BUBBLE_PAD_Y * 2
    )
    const width = Math.min(
      maxWidth,
      Math.max(...lines.map(line => ctx.measureText(line).width)) + BUBBLE_PAD_X * 2
    )

    const anchorMidY = anchor.y + anchor.height / 2
    const boardMidY = board.y + board.height / 2
    // 锚点在下半屏 → 气泡放顶部；反之放底部
    let y = anchorMidY > boardMidY
      ? board.y + BUBBLE_MARGIN
      : board.y + board.height - height - BUBBLE_MARGIN

    // 万一还是压住锚点（盘面很挤时），翻到另一侧
    const overlaps = y < anchor.y + anchor.height && y + height > anchor.y
    if (overlaps) {
      const flipped = y < anchorMidY
        ? board.y + board.height - height - BUBBLE_MARGIN
        : board.y + BUBBLE_MARGIN
      if (!(flipped < anchor.y + anchor.height && flipped + height > anchor.y)) y = flipped
    }

    const x = Math.round(board.x + (board.width - width) / 2)

    return { x, y, width, height, lines, lineHeight, below: y > anchorMidY }
  }

  /**
   * 气泡本体：奶油底 + 珊瑚描边 + 指向锚点的小三角
   */
  renderBubble(ctx, bubble, anchor) {
    const { x, y, width, height, lines, lineHeight, below } = bubble

    // 指向锚点的三角
    const anchorCx = Math.min(Math.max(anchor.x + anchor.width / 2, x + 16), x + width - 16)
    const tipY = below ? y - 7 : y + height + 7
    const baseY = below ? y : y + height

    ctx.beginPath()
    ctx.moveTo(anchorCx, tipY)
    ctx.lineTo(anchorCx - 7, baseY)
    ctx.lineTo(anchorCx + 7, baseY)
    ctx.closePath()
    ctx.fillStyle = 'rgba(255, 249, 238, 0.97)'
    ctx.fill()
    ctx.strokeStyle = COLORS.coral
    ctx.lineWidth = 2
    ctx.stroke()

    // 卡片：单层柔光（多层阴影会露硬边，见成就卡片的教训）
    roundRectPath(ctx, x, y, width, height, 14)
    ctx.fillStyle = 'rgba(255, 249, 238, 0.97)'
    ctx.fill()
    ctx.strokeStyle = COLORS.coral
    ctx.lineWidth = 2
    ctx.stroke()

    // 文字
    ctx.fillStyle = COLORS.navy
    ctx.font = font(12.5, 'bold')
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'

    const textTop = y + BUBBLE_PAD_Y + lineHeight / 2
    lines.forEach((line, index) => {
      ctx.fillText(line, x + BUBBLE_PAD_X, textTop + index * lineHeight)
    })
  }
}

/**
 * 按像素宽度折行（Canvas 没有自动折行）
 */
function wrapText(ctx, text, maxWidth) {
  const chars = String(text || '').split('')
  const lines = []
  let current = ''

  chars.forEach(char => {
    const next = current + char
    if (current && ctx.measureText(next).width > maxWidth) {
      lines.push(current)
      current = char
    } else {
      current = next
    }
  })

  if (current) lines.push(current)
  return lines.length ? lines : ['']
}
