/**
 * 提示券
 *
 * 一张券 = 显示「下一步往哪走」一步，不自动执行。
 *
 * 为什么卡关要用提示、而不是多发几条命：
 *   掉进冰窟的玩家分两类 —— 手滑（知道怎么走）和真不会。后一类给十条命也会在
 *   同一步反复死。卡关的根因是**不确定解法**，不是缺一条命。
 *
 * 为什么不做「看广告换券」：
 *   券等价于降低难度，一旦能用注意力买，三星和「精准操作」就失去意义。
 *   所以券只从签到 / 首次卡关这类「玩家已经付出了耐心」的地方产出，且限量。
 *
 * 存档：`hintTickets`（余量）、`hintGiftLevels`（已经送过券的关卡，防止刷）。
 */

import { solveBoard } from '../levels/level-generator'

const KEY_TICKETS = 'hintTickets'
const KEY_GIFTED = 'hintGiftLevels'

/** 全局最多送多少张「卡关补偿」，防止靠反复掉洞刷券 */
const MAX_GIFT_TICKETS = 10

/** 同一关失败几次后送 1 张 */
const FAILS_PER_GIFT = 3

export default class HintManager {
  constructor() {
    this.count = 0
    /** @type {number[]} 已经领过「卡关补偿」的关卡 */
    this.giftLevels = []
    /** @type {Object<number, number>} 本次会话的失败次数（不持久化，重开游戏就清） */
    this.failCounts = {}

    this.load()
  }

  /**
   * 余量
   * @returns {number}
   */
  get() {
    return Math.max(0, Math.floor(this.count))
  }

  /**
   * 发放
   * @param {number} amount
   * @param {string} [reason]
   * @returns {number} 实际到账
   */
  add(amount, reason = '') {
    const gain = Math.floor(Number(amount) || 0)
    if (gain <= 0) return 0

    this.count = this.get() + gain
    this.save()
    if (reason) console.log(`[Hint] +${gain}🎫 (${reason}) → ${this.count}`)
    return gain
  }

  /**
   * 用掉一张
   * @returns {boolean} 余量为 0 时返回 false，调用方据此走「没有提示」的分支
   */
  use() {
    if (this.get() <= 0) return false

    this.count = this.get() - 1
    this.save()
    return true
  }

  /**
   * 记录一次失败，必要时补发一张
   *
   * 触发条件：同一关累计失败 3 次、该关还没领过补偿、全局没超过 10 张。
   * 计数只在本次会话内累计 —— 玩家关掉游戏再进来，耐心其实重置了，
   * 这时候不需要再补券。
   *
   * @param {number} level
   * @returns {boolean} 本次是否发了券
   */
  registerFail(level) {
    const id = parseInt(level, 10)
    if (!Number.isFinite(id) || id <= 0) return false
    if (this.giftLevels.indexOf(id) >= 0) return false
    if (this.giftLevels.length >= MAX_GIFT_TICKETS) return false

    const count = (this.failCounts[id] || 0) + 1
    this.failCounts[id] = count
    if (count < FAILS_PER_GIFT) return false

    this.giftLevels.push(id)
    this.add(1, `第 ${id} 关连败 ${FAILS_PER_GIFT} 次`)
    this.save()
    return true
  }

  save() {
    try {
      wx.setStorageSync(KEY_TICKETS, this.count)
      wx.setStorageSync(KEY_GIFTED, this.giftLevels)
    } catch (e) {
      console.error('保存提示券失败:', e)
    }
  }

  load() {
    try {
      const saved = parseInt(wx.getStorageSync(KEY_TICKETS), 10)
      this.count = Number.isFinite(saved) && saved > 0 ? saved : 0

      const gifted = wx.getStorageSync(KEY_GIFTED)
      if (Array.isArray(gifted)) {
        this.giftLevels = gifted
          .map(v => parseInt(v, 10))
          .filter(v => Number.isFinite(v) && v > 0)
      }
    } catch (e) {
      this.count = 0
      this.giftLevels = []
    }
  }

  reset() {
    this.count = 0
    this.giftLevels = []
    this.failCounts = {}
    this.save()
  }
}

/**
 * 关卡数据 → 求解器要的格子盘面
 *
 * 关卡数据里的坐标是像素（50px 一格），求解器要的是格子下标。
 * 只在提示时用一次，输入一定是初始盘面，所以可以放心四舍五入。
 *
 * @param {Object} levelData
 * @returns {Object}
 */
export function levelToBoard(levelData) {
  const toCell = (v) => Math.round(v / 50)
  return {
    penguin: { col: toCell(levelData.penguin.x), row: toCell(levelData.penguin.y) },
    stones: levelData.stones.map(s => ({ col: toCell(s.x), row: toCell(s.y) })),
    target: {
      col: toCell(levelData.target.x),
      row: toCell(levelData.target.y),
      w: Math.max(1, Math.round(levelData.target.width / 50)),
      h: Math.max(1, Math.round(levelData.target.height / 50))
    },
    obstacles: (levelData.obstacles || []).map(o => ({
      type: o.type,
      col: toCell(o.x),
      row: toCell(o.y)
    }))
  }
}

/**
 * 求「当前局面」的下一步
 *
 * 与 firstHintMove 的区别：那个吃关卡的初始数据，这个吃运行时盘面
 * （格子坐标）。局中提示必须用它 —— 玩家已经走了几步，第一步的最优解
 * 早就不适用了。硬币的另一面：调用方要保证传进来的盘面是「静止态」，
 * 移动动画中间格的坐标会被四舍五入到错误格子。
 *
 * @param {Object} board - {penguin,stones,target,obstacles}，格子坐标
 * @returns {'up'|'down'|'left'|'right'|null} 无解返回 null
 */
export function currentHintMove(board) {
  if (!board) return null

  try {
    const solved = solveBoard(board, { withSolution: true })
    if (!solved.solvable || !Array.isArray(solved.solution) || !solved.solution.length) {
      return null
    }
    return solved.solution[0]
  } catch (e) {
    console.warn('[Hint] 求解失败，本次不给提示:', e)
    return null
  }
}

/**
 * 求「这一关的第一步」（失败页重开时用；重开后当前盘面即初始盘面）
 *
 * @param {Object} levelData
 * @returns {'up'|'down'|'left'|'right'|null} 无解或已通关返回 null
 */
export function firstHintMove(levelData) {
  if (!levelData) return null
  return currentHintMove(levelToBoard(levelData))
}
