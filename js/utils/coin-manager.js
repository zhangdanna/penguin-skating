/**
 * 雪花钱（❄）
 *
 * 唯一的「外观货币」：**只能买样子，永远不能换鱼 / 复活 / 提示券**。
 *
 * 为什么必须是第二条独立货币，而不是复用 🐟：
 *   鱼是入场费，也是失败后复活的硬通货。一旦「币 ↔ 鱼」互通，玩家在
 *   「买皮肤」和「再玩一局」之间就要做取舍 —— 休闲游戏里这种取舍的结果
 *   通常是关掉游戏，而不是多玩一局。所以两条线在代码层就物理隔离：
 *   CoinManager 不认识 FoodManager，商城也不接受鱼。
 *
 * 存档：`snowCoins`（单个数字）。
 */

const STORAGE_KEY = 'snowCoins'

/** 单次发放的上限，防止某处把「20」写成「200000」直接把经济打穿 */
const MAX_GRANT = 500

/**
 * 雪花钱产出表（唯一数据源，调数值只改这里）
 *
 * 定价口径：商城单件 60~120，一周活跃（首通 + 三星 + 成就 + 满签）大约能攒 200~400，
 * 也就是 **3~5 天能添一件**。这是「收集」这条线不断气的最小节奏。
 *
 * `starter` 那 60 是刻意给「首日」准备的：D1 光靠首通 3 关只有 6~9❄，
 * 够不到 60 的门槛，收集线在建立起来之前就断了。给到 60 之后，
 * 「首通 3 关」当天就能买下第一件外观，这才是收集循环的起点。
 */
export const COIN_REWARD = {
  /** 首通一关（一次性，重刷不给） */
  firstClear: 2,
  /** 首通拿到三星（一次性） */
  firstThreeStar: 3,
  /** 解锁一个成就 */
  achievement: 20,
  /** 新手任务：累计首通 N 关 */
  starter: 60,
  starterWins: 3
}

export default class CoinManager {
  constructor() {
    this.coins = 0
    /** 本次会话累计到手（结算页要用「这一局赚了多少」，不是余额） */
    this.lastGain = 0
    this.load()
  }

  /**
   * 余额
   * @returns {number}
   */
  get() {
    return Math.max(0, Math.floor(this.coins))
  }

  /**
   * 发放
   *
   * @param {number} amount - 正数，非数字 / 非正数直接忽略（不发、不报错）
   * @param {string} [reason] - 仅用于调试日志
   * @returns {number} 实际到账
   */
  add(amount, reason = '') {
    const gain = Math.min(MAX_GRANT, Math.floor(Number(amount) || 0))
    if (gain <= 0) return 0

    this.coins = this.get() + gain
    this.lastGain = gain
    this.save()

    if (reason) console.log(`[Coin] +${gain}❄ (${reason}) → ${this.coins}`)
    return gain
  }

  /**
   * 扣款
   *
   * 余额不足返回 false 且**不改动任何东西** —— 调用方据此提示，别先扣再回滚。
   * @param {number} amount
   * @returns {boolean}
   */
  spend(amount) {
    const cost = Math.floor(Number(amount) || 0)
    if (cost <= 0) return false
    if (this.get() < cost) return false

    this.coins = this.get() - cost
    this.save()
    return true
  }

  /**
   * 本次会话最近一次发放的数量（结算页飘字用）
   * @returns {number}
   */
  getLastGain() {
    return this.lastGain
  }

  /**
   * 清空最近一次发放记录（切场景时清，避免重复展示）
   */
  clearLastGain() {
    this.lastGain = 0
  }

  save() {
    try {
      wx.setStorageSync(STORAGE_KEY, this.coins)
    } catch (e) {
      console.error('保存雪花钱失败:', e)
    }
  }

  load() {
    try {
      const saved = wx.getStorageSync(STORAGE_KEY)
      const value = parseInt(saved, 10)
      this.coins = Number.isFinite(value) && value > 0 ? value : 0
    } catch (e) {
      this.coins = 0
    }
  }

  /**
   * 调试用
   */
  reset() {
    this.coins = 0
    this.lastGain = 0
    this.save()
  }
}
