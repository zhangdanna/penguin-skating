/**
 * 每日签到（7 日节奏）
 *
 * 职责：
 *   - 记录「连续第几天」，决定今天发哪一档
 *   - 发奖（鱼走 FoodManager 的 overflow 通道，虾同理）
 *   - 给 UI 提供「今天领第几天 / 已领几天 / 距下次还有多久」
 *
 * 不负责：
 *   - 记录「今天领没领」—— 那是 FoodManager 的 `dailyGift` 键，只有一个口径，
 *     这里只读 `canClaimDailyGift()`，**不另存一份日期**，否则两个键一定会漂。
 *   - 红点 / 倒计时文案 —— 由场景层取 `getState()` 自己拼。
 *
 * 为什么要有连续天数：
 *   原来的签到是「。每次首进自动发 5🐟 + 一个模态框」，玩家没有「领取」这个动作，
 *   也没有「明天」这个概念。7 日卡把「每天回来」变成一个**肉眼可见的进度条**，
 *   第 7 天的奖励是唯一让人惦记的东西。
 *
 * 断签规则：已领的绝不收回，但下一次从第 1 天重新开始。不做补签 ——
 * 付费补签会劝退休闲玩家，还多一个合规审查面。
 */

/** 一个周期几天 */
export const CHECKIN_CYCLE = 7

/**
 * 7 日奖励表（唯一数据源，改数值只改这里）
 *
 * 口径：一周合计 40🐟 + 2🦐 + 1🦑（≈ 53 价值）。原来的自动签到是 7×5 = 35🐟，
 * **只增不减**，老玩家不会觉得改版即降薪。D1 刻意保持 5🐟 不变。
 *
 * 第 7 天必须是全周最贵的一档，否则「满签」在数值上不成立：
 *   按价值算（鱼 1 / 虾 3 / 鱿鱼 10），第 6 天 8🐟 = 8，第 7 天 5🐟+1🦑 = 15。
 *   早先第 7 天发的是 5🐟+1🦐 = 8，和第 6 天打平，玩家签到第七天会觉得「就这」。
 *
 * 雪花钱（`coins`）与外观（`skin`）也走这张表：`claim()` 按字段发放，
 * 场景层按表渲染文案 —— 调奖励只改这里，不用动 UI。
 */
export const CHECKIN_REWARDS = [
  { day: 1, fish: 5 },
  { day: 2, fish: 5, ticket: 1 },
  { day: 3, fish: 6 },
  { day: 4, fish: 5, coins: 20 },
  { day: 5, fish: 6 },
  { day: 6, fish: 8 },
  // 第 7 天 = 满签：食物最贵（5🐟+1🦑=15）+ 一大笔雪花钱 + 首次满签送限定外观
  { day: 7, fish: 5, squid: 1, coins: 60, skin: 'hat_santa', big: true }
]

const STORAGE_KEY = 'checkin'

/** `2026-11-20` → Date（本地时区 0 点），只用于算天数差 */
function parseDate(text) {
  const parts = String(text || '').split('-').map(n => parseInt(n, 10))
  if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return null
  return new Date(parts[0], parts[1] - 1, parts[2])
}

/**
 * 两个日期字符串相差几天（b - a）
 * 用「本地 0 点」做差再取整，避免夏令时/时区偏移带来的 23h/25h 误差
 */
export function daysBetween(a, b) {
  const from = parseDate(a)
  const to = parseDate(b)
  if (!from || !to) return NaN
  return Math.round((to.getTime() - from.getTime()) / 86400000)
}

export default class CheckinManager {
  /**
   * @param {Object} foodManager - 必须提供 getTodayDate() / canClaimDailyGift() / claimDailyGift()
   * @param {Object} [coinManager] - 有就发雪花钱（没有则只发食物，老测试/预览不至于崩）
   * @param {Object} [skinManager] - 有就发外观（满签礼）
   * @param {Object} [hintManager] - 有就发提示券（第 2 天给 1 张）
   */
  constructor(foodManager, coinManager = null, skinManager = null, hintManager = null) {
    this.foodManager = foodManager
    this.coinManager = coinManager
    this.skinManager = skinManager
    this.hintManager = hintManager

    // { lastDate: '2026-11-20', day: 4, totalDays: 12 }
    // day 是「最近一次领取的档位」（1~7，管的是**本周期**），
    // 中间断过一次的话 day 会被重置成 1，所以它不能当「连签了多少天」用。
    // totalDays 是**累计**签到天数，只增不减 —— 断签不清零。
    this.record = { lastDate: '', day: 0, totalDays: 0 }

    this.load()
  }

  /**
   * 今天（与 FoodManager 用同一套字符串格式，避免两个 key 的日期口径不一致）
   * @returns {string}
   */
  getToday() {
    if (this.foodManager && typeof this.foodManager.getTodayDate === 'function') {
      return this.foodManager.getTodayDate()
    }
    const now = new Date(Date.now())
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
  }

  /**
   * 昨天是否领过（决定连续天数要不要续上）
   * @returns {boolean}
   */
  isConsecutiveToToday() {
    if (!this.record.lastDate) return false
    return daysBetween(this.record.lastDate, this.getToday()) === 1
  }

  /**
   * 今天还能不能领
   * @returns {boolean}
   */
  canClaim() {
    if (!this.foodManager || typeof this.foodManager.canClaimDailyGift !== 'function') return false
    return this.foodManager.canClaimDailyGift()
  }

  /**
   * 今天领的是第几天（1~7）
   *
   * 已经领过 → 返回今天那一档（UI 用来点亮「今天已领」）
   * 还没领   → 连续就 +1，断了或没记录就从第 1 天开始
   *
   * @returns {number}
   */
  getTodayDay() {
    const last = this.record.day

    if (!this.canClaim()) {
      return last >= 1 && last <= CHECKIN_CYCLE ? last : 1
    }

    if (this.isConsecutiveToToday() && last >= 1) {
      return (last % CHECKIN_CYCLE) + 1
    }

    return 1
  }

  /**
   * 本周期已经领到第几天（UI 用来画 ✓）
   *
   * 定义是「**本周期**已领几档」，不是 `record.day` 直接照抄：
   *
   *   昨天领的是第 7 天 → 今天开启新一周，已领必须是 0，
   *   否则 7 个格子全打勾、第 7 天大卡写「已拿到」，而按钮又是「领取第 1 天」，
   *   三处互相打架。
   *
   * 同理，今天还没领时不能返回「上次领到第几档」的原始值 ——
   * 那会让「今天第 4 天」配着「已领 4 天」一起出现，等于今天白送了一天。
   *
   * @returns {number}
   */
  getClaimedDay() {
    if (this.canClaim()) {
      // 今天还没领：已领数 = 今天这一档 - 1（断签时 getTodayDay() 已经是 1）
      return Math.max(0, this.getTodayDay() - 1)
    }

    // 今天已领。老存档（改版前只有 `dailyGift`、没有 `checkin`）里 record.day 是 0，
    // 但今天的鱼确实已经发过了 —— 按「已领第 1 天」显示，
    // 否则升级当天会出现「按钮说已领取、格子一个勾都没有、大卡还写再签 7 天」。
    return this.record.day > 0 ? this.record.day : this.getTodayDay()
  }

  /**
   * 今天这一档的奖励
   * @returns {{day:number, fish:number, shrimp?:number, big?:boolean}}
   */
  getTodayReward() {
    const day = Math.min(Math.max(1, this.getTodayDay()), CHECKIN_CYCLE)
    return CHECKIN_REWARDS[day - 1]
  }

  /**
   * 领取今天的奖励
   *
   * 顺序很重要：先让 FoodManager 把鱼发出去（它会顺带写 `dailyGift` 日期），
   * 发成功了再推进连续天数 —— 发不出去（容量异常）就不消耗今天的次数。
   *
   * @returns {{claimed:boolean, reason?:string, day?:number, reward?:Object, fish?:number, shrimp?:number}}
   */
  claim() {
    if (!this.canClaim()) {
      return { claimed: false, reason: 'claimed-today' }
    }

    const day = this.getTodayDay()
    const reward = CHECKIN_REWARDS[day - 1]

    const fishResult = this.foodManager.claimDailyGift(reward.fish)
    if (!fishResult || !fishResult.claimed) {
      return { claimed: false, reason: 'food-failed' }
    }

    // 虾 / 鱿鱼走同一个溢出通道：这是签到，属于「承诺奖励不该被上限吃掉」的唯一例外
    const shrimp = reward.shrimp > 0
      ? this.foodManager.addFood('shrimp', reward.shrimp, { overflow: reward.shrimp })
      : 0
    const squid = reward.squid > 0
      ? this.foodManager.addFood('squid', reward.squid, { overflow: reward.squid })
      : 0

    // 雪花钱：签到是「不花钱玩家」攒外观的主要来源之一
    const coins = reward.coins > 0 && this.coinManager
      ? this.coinManager.add(reward.coins, `签到第 ${day} 天`)
      : 0

    // 提示券：第 2 天给 1 张，让玩家在真正卡住之前就持有它
    // （第 20~40 关难度开始爬坡，D2 发券正好赶在卡关之前）
    const ticket = reward.ticket > 0 && this.hintManager
      ? this.hintManager.add(reward.ticket, `签到第 ${day} 天`)
      : 0

    // 满签礼的外观只送一次：第二周满签不再重复发（已拥有时 grant 返回 false）
    let skin = null
    if (reward.skin && this.skinManager && this.skinManager.grant(reward.skin)) {
      skin = reward.skin
    }

    // 累计只增：断签不清零，老存档没这个字段时从 0 起算
    const totalDays = Math.max(0, parseInt(this.record.totalDays, 10) || 0) + 1
    this.record = { lastDate: this.getToday(), day, totalDays }
    this.save()

    return {
      claimed: true,
      day,
      totalDays,
      reward,
      fish: fishResult.actual,
      shrimp,
      squid,
      coins,
      skin,
      ticket
    }
  }

  /**
   * 今天这一档会不会送外观（且还没拥有）
   *
   * UI 用：只有「今天满签、且首次」时才在卡片上写「送圣诞帽」，
   * 否则每周都挂着这句话，第二周就不成立了。
   *
   * @returns {string|null} 外观 id
   */
  getPendingSkin() {
    if (!this.canClaim()) return null

    const reward = this.getTodayReward()
    if (!reward || !reward.skin) return null
    if (!this.skinManager) return null
    return this.skinManager.owns(reward.skin) ? null : reward.skin
  }

  /**
   * 距下一次签到还有多少毫秒（本地明天 0 点）
   * @returns {number}
   */
  getNextResetMs() {
    const now = new Date(Date.now())
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0)
    return Math.max(0, next.getTime() - now.getTime())
  }

  /**
   * 倒计时文案 `03:12:44`
   * @param {number} [ms]
   * @returns {string}
   */
  formatCountdown(ms) {
    const total = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : this.getNextResetMs()) / 1000))
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  /**
   * 累计签到天数（只增不减，断签不清零）
   *
   * 老存档没有 `totalDays` 字段时用本周档位兜底：差一点历史值，
   * 但绝不会显示成 0（那看起来像「我签的钱被吞了」）。
   * @returns {number}
   */
  getTotalDays() {
    const total = parseInt(this.record.totalDays, 10)
    if (Number.isFinite(total) && total > 0) return total

    const day = parseInt(this.record.day, 10)
    return Number.isFinite(day) && day > 0 ? day : 0
  }

  /**
   * 场景层要的一整包状态
   * @returns {Object}
   */
  getState() {
    return {
      canClaim: this.canClaim(),
      todayDay: this.getTodayDay(),
      claimedDay: this.getClaimedDay(),
      totalDays: this.getTotalDays(),
      reward: this.getTodayReward(),
      cycle: CHECKIN_CYCLE,
      nextInMs: this.getNextResetMs(),
      countdown: this.formatCountdown()
    }
  }

  /**
   * 首页浮标要的最小状态（红点 / 角标）
   *
   * `weekDay` 是**本周期**已签几档（角标写 `3/7`），`totalDays` 只给弹窗用 ——
   * 浮标只有 15 高的角标，塞不下「累计 30 天」，而玩家站在首页最想知道的是
   * 「还差几天拿大礼」。
   *
   * @returns {{claimable:boolean, weekDay:number, totalDays:number, cycle:number}}
   */
  getBadge() {
    return {
      claimable: this.canClaim(),
      weekDay: this.getClaimedDay(),
      totalDays: this.getTotalDays(),
      cycle: CHECKIN_CYCLE
    }
  }

  /**
   * 保存
   */
  save() {
    try {
      wx.setStorageSync(STORAGE_KEY, this.record)
    } catch (e) {
      console.error('保存签到记录失败:', e)
    }
  }

  /**
   * 加载
   *
   * 老存档没有 `checkin` 键（只有 `dailyGift`），此时 record 保持空，
   * 下一次领取会从第 1 天开始 —— 只是重置一次连续天数，不会重复发奖。
   */
  load() {
    try {
      const saved = wx.getStorageSync(STORAGE_KEY)
      if (!saved || typeof saved !== 'object') return

      const day = parseInt(saved.day, 10)
      const total = parseInt(saved.totalDays, 10)

      this.record = {
        lastDate: typeof saved.lastDate === 'string' ? saved.lastDate : '',
        day: Number.isFinite(day) && day >= 1 && day <= CHECKIN_CYCLE ? day : 0,
        // 老存档（只有 lastDate/day）没有累计字段：从「本周已领档位」兜底，
        // 差一点历史值，但绝不会让累计数小于本周进度（那看起来像 bug）
        totalDays: Number.isFinite(total) && total > 0
          ? total
          : (Number.isFinite(day) && day >= 1 ? day : 0)
      }
    } catch (e) {
      console.error('加载签到记录失败:', e)
    }
  }

  /**
   * 调试用：清空
   */
  reset() {
    this.record = { lastDate: '', day: 0, totalDays: 0 }
    this.save()
  }
}
