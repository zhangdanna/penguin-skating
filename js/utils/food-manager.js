/**
 * 食物管理器
 * 管理游戏中的食物（体力）系统
 */
import { calcStars } from './score'

/** 速度奖励线：用时 ≤ par × 该系数（F1） */
const SPEED_BONUS_PAR_RATIO = 2.2

/** 单次恢复最多补几条（防止长时间挂机 / 后台一次性补满） */
const MAX_RECOVERY_BURST = 3

export default class FoodManager {
  constructor() {
    // 食物类型及价值
    this.foodTypes = {
      fish: { name: '鱼', value: 1, icon: '🐟' },
      shrimp: { name: '虾', value: 3, icon: '🦐' },
      squid: { name: '鱿鱼', value: 10, icon: '🦑' },
      goldfish: { name: '金鱼', value: 50, icon: '🐠' }
    }

    // 关卡消耗配置
    this.levelCost = {
      tutorial: 0,  // 教程关卡免费
      easy: 1,      // 简单关卡
      medium: 2,    // 中等关卡
      hard: 3,      // 困难关卡
      expert: 5     // 专家关卡
    }

    // 通关基础奖励（F1：按难度给固定鱼数，约为入场费的一半）
    // 目的：单次重复通关 ≈ 回本，不再出现"刷一关赚 16 倍"
    this.baseReward = {
      tutorial: 0,
      easy: 1,
      medium: 1,
      hard: 2,
      expert: 3
    }

    // 首通 / 三星首通 / 速度奖励的固定额度
    this.firstClearBonus = 2      // 首次通过该关额外 2🐟
    this.firstThreeStarBonus = 3  // 首次 3 星通过该关额外 3（= 1🦐）
    this.speedBonus = 1           // 用时达标额外 1🐟

    // 当前食物数量
    this.food = {
      fish: 0,
      shrimp: 0,
      squid: 0,
      goldfish: 0
    }

    // 恢复设置
    this.recoveryRate = 1        // 每次恢复数量
    this.recoveryInterval = 5    // 恢复间隔（分钟）
    this.maxFood = 30            // 最大食物数量（仅计算鱼）
    this.lastRecoveryTime = 0    // 上次恢复时间

    // 免费补给（广告不可用时的兜底，避免食物耗尽后彻底玩不了）
    // 只在「食物不够开这一关」且「激励视频不可用」时触发，每天 1 次。
    this.freeRefillPerDay = 1
    this.freeRefill = { date: this.getTodayDate(), used: 0 }

    // 连续通关记录
    this.consecutiveWins = 0
    this.lastWinTime = 0

    // 初始化
    this.init()
  }

  /**
   * 初始化
   */
  init() {
    this.loadFood()
    this.loadRecoveryTime()
    this.loadFreeRefill()
    this.checkRecovery()
  }

  /**
   * 今天的日期字符串（用于每日限额的跨天重置）
   * @returns {string}
   */
  getTodayDate() {
    const now = new Date()
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
  }

  /**
   * 读取免费补给记录，跨天自动清零
   */
  loadFreeRefill() {
    try {
      const saved = wx.getStorageSync('freeRefill')
      if (saved && saved.date === this.getTodayDate()) {
        this.freeRefill = {
          date: saved.date,
          used: Number(saved.used) || 0
        }
      } else {
        this.freeRefill = { date: this.getTodayDate(), used: 0 }
      }
    } catch (e) {
      this.freeRefill = { date: this.getTodayDate(), used: 0 }
    }
  }

  /**
   * 保存免费补给记录
   */
  saveFreeRefill() {
    try {
      wx.setStorageSync('freeRefill', this.freeRefill)
    } catch (e) {
      console.error('保存免费补给记录失败:', e)
    }
  }

  /**
   * 今日还剩几次免费补给
   * @returns {number}
   */
  getFreeRefillLeft() {
    this.loadFreeRefill()
    return Math.max(0, this.freeRefillPerDay - this.freeRefill.used)
  }

  /**
   * 领取一次免费补给
   *
   * 用途：广告位没开通 / 拉取失败时，玩家食物耗尽就再也开不了局。
   * 这里给一条有上限的免费路径，既不让玩家卡死，也不至于让体力系统完全失效。
   *
   * @param {number} amount - 想要补给的鱼数量
   * @returns {number} 实际入账数量
   */
  grantFreeRefill(amount) {
    const left = this.getFreeRefillLeft()
    if (left <= 0) return 0

    const actual = this.addFish(amount)
    if (actual > 0) {
      this.freeRefill.used++
      this.saveFreeRefill()
    }
    return actual
  }

  /**
   * 获取总食物值（以鱼为单位）
   */
  getTotalFood() {
    return this.food.fish +
           this.food.shrimp * this.foodTypes.shrimp.value +
           this.food.squid * this.foodTypes.squid.value +
           this.food.goldfish * this.foodTypes.goldfish.value
  }

  /**
   * 检查是否有足够食物
   * @param {number} cost - 消耗数量
   * @returns {boolean}
   */
  hasEnoughFood(cost) {
    return this.getTotalFood() >= cost
  }

  /**
   * 消耗食物
   * @param {number} cost - 消耗数量
   * @returns {boolean} 是否成功
   */
  consumeFood(cost) {
    if (!this.hasEnoughFood(cost)) {
      return false
    }

    let remaining = cost

    // 优先消耗鱼
    if (this.food.fish >= remaining) {
      this.food.fish -= remaining
      remaining = 0
    } else {
      remaining -= this.food.fish
      this.food.fish = 0
    }

    // 消耗虾
    if (remaining > 0 && this.food.shrimp > 0) {
      const shrimpNeeded = Math.ceil(remaining / this.foodTypes.shrimp.value)
      const shrimpUsed = Math.min(shrimpNeeded, this.food.shrimp)
      remaining -= shrimpUsed * this.foodTypes.shrimp.value
      this.food.shrimp -= shrimpUsed

      // 如果虾的价值超出，补回鱼
      if (remaining < 0) {
        this.food.fish += Math.abs(remaining)
        remaining = 0
      }
    }

    // 消耗鱿鱼
    if (remaining > 0 && this.food.squid > 0) {
      const squidNeeded = Math.ceil(remaining / this.foodTypes.squid.value)
      const squidUsed = Math.min(squidNeeded, this.food.squid)
      remaining -= squidUsed * this.foodTypes.squid.value
      this.food.squid -= squidUsed

      if (remaining < 0) {
        this.food.fish += Math.abs(remaining)
        remaining = 0
      }
    }

    // 消耗金鱼
    if (remaining > 0 && this.food.goldfish > 0) {
      const goldfishNeeded = Math.ceil(remaining / this.foodTypes.goldfish.value)
      const goldfishUsed = Math.min(goldfishNeeded, this.food.goldfish)
      remaining -= goldfishUsed * this.foodTypes.goldfish.value
      this.food.goldfish -= goldfishUsed

      if (remaining < 0) {
        this.food.fish += Math.abs(remaining)
        remaining = 0
      }
    }

    this.saveFood()
    return true
  }

  /**
   * 添加食物
   *
   * F1：加上限判定。原来 `maxFood` 只在自然恢复里用，`addFood` 完全不管，
   * 金鱼会无限堆积（体力系统形同虚设）。
   *
   * 2026-10-26 修正：原实现用 `Math.max(1, floor(room / value))` 兜底，
   * 当剩余容量只有 1 而奖励是 1 只金鱼（价值 50）时，会硬塞进去把总数顶到 51，
   * 于是结算页显示 +1🐠、HUD 却多出 50 点，两边对不上。现在严格按容量截断。
   *
   * @param {string} type - 食物类型
   * @param {number} amount - 数量
   * @returns {number} 实际入账数量
   */
  addFood(type, amount) {
    if (!this.foodTypes[type]) {
      console.warn(`未知食物类型: ${type}`)
      return 0
    }
    if (!(amount > 0)) return 0

    const value = this.foodTypes[type].value
    const room = this.maxFood - this.getTotalFood()

    if (room <= 0) {
      console.log(`食物已满（${this.getTotalFood()}/${this.maxFood}），丢弃 ${amount}${this.foodTypes[type].icon}`)
      return 0
    }

    const affordable = Math.floor(room / value)
    if (affordable <= 0) {
      console.log(
        `食物接近上限（${this.getTotalFood()}/${this.maxFood}），放不下 ${this.foodTypes[type].icon}`
      )
      return 0
    }

    const actual = Math.min(amount, affordable)

    this.food[type] += actual
    this.saveFood()
    return actual
  }

  /**
   * 添加鱼
   * @param {number} amount - 数量
   */
  addFish(amount) {
    return this.addFood('fish', amount)
  }

  /**
   * 添加虾
   * @param {number} amount - 数量
   */
  addShrimp(amount) {
    return this.addFood('shrimp', amount)
  }

  /**
   * 添加鱿鱼
   * @param {number} amount - 数量
   */
  addSquid(amount) {
    return this.addFood('squid', amount)
  }

  /**
   * 添加金鱼
   * @param {number} amount - 数量
   */
  addGoldfish(amount) {
    return this.addFood('goldfish', amount)
  }

  /**
   * 获取关卡消耗
   * @param {string} difficulty - 难度
   * @returns {number} 消耗数量
   */
  getLevelCost(difficulty) {
    const cost = this.levelCost[difficulty]
    // tutorial 等难度配置为 0，不能被 || 当成未配置
    return cost === undefined ? 1 : cost
  }

  /**
   * 通关基础奖励（F1）
   * @param {string} difficulty
   * @returns {number} 鱼数量
   */
  getBaseReward(difficulty) {
    const value = this.baseReward[difficulty]
    return value === undefined ? 1 : value
  }

  /**
   * 计算通关奖励（F1 重做）
   *
   * 旧实现的三个问题：
   *   1. 时间奖励按「关卡号」双重放大阈值（dm × tm），第 30 关金鱼线已到 77.6 秒，
   *      正常通关时间恰好落在这个区间 → 几乎每次必发 1 金鱼（价值 50），
   *      而关卡只消耗 3，单次净赚 16 倍。
   *   2. 连续通关的 50 连档同样发金鱼，但连击只要求 30 分钟内通关，刷第 1 关即可。
   *   3. 每次通关都发全额奖励，重刷不衰减，配合上面两条可以无限套利。
   *
   * 新口径：基础（按难度）+ 速度（par×2.2 秒内 +1🐟）+ 首通（+2🐟）
   *        + 三星首通（+3）+ 连击（3 连 +1🐟 / 10 连 +3）。
   * 单次重复通关 ≈ 回本，一次性收益才是主要来源。
   *
   * @param {number} level - 关卡编号
   * @param {number} moves - 步数
   * @param {number} par - 标准步数
   * @param {number} time - 用时（秒）
   * @param {Object} [options] - { difficulty, firstClear, firstThreeStar }
   * @returns {Object} 奖励内容
   */
  calculateRewards(level, moves, par, time, options = {}) {
    const {
      difficulty = 'hard',
      firstClear = false,
      firstThreeStar = false
    } = options || {}

    const rewards = {
      fish: 0,
      shrimp: 0,
      squid: 0,
      goldfish: 0,
      total: 0,
      stars: calcStars(moves, par),
      details: []
    }

    // ① 通关基础奖励（按难度，与星级解耦：星级体现在三星首通里）
    const base = this.getBaseReward(difficulty)
    if (base > 0) {
      rewards.fish += base
      rewards.details.push(`通关 +${base}🐟`)
    }

    // ② 速度奖励：用时 ≤ par × 2.2 秒
    if (this.getTimeBonus(time, par) > 0) {
      rewards.fish += this.speedBonus
      rewards.details.push(`速度 +${this.speedBonus}🐟`)
    }

    // ③ 首通奖励（每关只发一次）
    if (firstClear && this.firstClearBonus > 0) {
      rewards.fish += this.firstClearBonus
      rewards.details.push(`首通 +${this.firstClearBonus}🐟`)
    }

    // ④ 三星首通（每关只发一次）
    if (firstThreeStar && rewards.stars === 3) {
      this.applyBonus(rewards, this.firstThreeStarBonus, '三星首通')
    }

    // ⑤ 连击奖励（3 连 / 10 连，上限压到 1🦐）
    this.updateConsecutiveWins()
    this.applyBonus(rewards, this.getConsecutiveBonus(), `连击${this.consecutiveWins}`)

    // 计算总价值
    rewards.total = this.calcValue(rewards)

    return rewards
  }

  /**
   * 把一组食物折算成"鱼"为单位的总价值
   * @param {Object} food - { fish, shrimp, squid, goldfish }
   * @returns {number}
   */
  calcValue(food) {
    return (food.fish || 0) +
      (food.shrimp || 0) * this.foodTypes.shrimp.value +
      (food.squid || 0) * this.foodTypes.squid.value +
      (food.goldfish || 0) * this.foodTypes.goldfish.value
  }

  /**
   * 把"奖励价值"换算成具体食物并累加
   *
   * C3：原实现把 50（金鱼档）也判进了 `>= 10` 分支，导致
   * `getTimeBonus` / `getConsecutiveBonus` 返回 50 时只发 1 只鱿鱼，
   * 金鱼分支永远不可达。这里按 50 → 金鱼、10 → 鱿鱼、3 → 虾、1 → 鱼 统一换算。
   *
   * @param {Object} rewards - 奖励累加器
   * @param {number} value - 奖励价值
   * @param {string} label - 明细文案前缀
   */
  applyBonus(rewards, value, label) {
    if (!(value > 0)) return

    if (value >= 50) {
      rewards.goldfish += 1
      rewards.details.push(`${label}: 1🐠`)
    } else if (value >= 10) {
      rewards.squid += 1
      rewards.details.push(`${label}: 1🦑`)
    } else if (value >= 3) {
      rewards.shrimp += 1
      rewards.details.push(`${label}: 1🦐`)
    } else {
      rewards.fish += value
      rewards.details.push(`${label}: ${value}🐟`)
    }
  }

  /**
   * 发放奖励
   * @param {Object} rewards - 奖励内容
   * @returns {Object} 实际入账的食物
   */
  giveRewards(rewards) {
    const given = { fish: 0, shrimp: 0, squid: 0, goldfish: 0 }
    if (rewards.fish > 0) given.fish = this.addFish(rewards.fish)
    if (rewards.shrimp > 0) given.shrimp = this.addShrimp(rewards.shrimp)
    if (rewards.squid > 0) given.squid = this.addSquid(rewards.squid)
    if (rewards.goldfish > 0) given.goldfish = this.addGoldfish(rewards.goldfish)
    return given
  }

  /**
   * 更新连续通关记录
   */
  updateConsecutiveWins() {
    const now = Date.now()
    const timeSinceLastWin = now - this.lastWinTime

    // 30分钟内算连续
    if (timeSinceLastWin < 30 * 60 * 1000) {
      this.consecutiveWins++
    } else {
      this.consecutiveWins = 1
    }

    this.lastWinTime = now
  }

  /**
   * 获取连续通关奖励
   * F1：删掉 10 连（鱿鱼）与 50 连（金鱼）档 —— 连击只看 30 分钟内是否通关，
   * 刷第 1 关也算连击，高档位等于白送金鱼。上限压到 1🦐。
   * @returns {number} 奖励价值
   */
  getConsecutiveBonus() {
    if (this.consecutiveWins >= 10) return 3    // 虾
    if (this.consecutiveWins >= 3) return 1     // 鱼
    return 0
  }

  /**
   * 速度奖励：用时 ≤ par × 2.2 秒给 1🐟
   *
   * 旧实现按「关卡号」放大阈值（dm = 1+(lv-1)*0.3、tm = 1/1.3/1.6），
   * 第 30 关的金鱼线是 77.6 秒，而该关 par = 47 步，正常通关就要 70~85 秒，
   * 等于每次必发金鱼。新口径只跟本关步数挂钩，不再随关卡号膨胀。
   *
   * @param {number} time - 用时（秒）
   * @param {number} par - 标准步数
   * @returns {number} 奖励价值（0 或 1）
   */
  getTimeBonus(time, par) {
    const safePar = Number.isFinite(par) && par > 0 ? par : 1
    const safeTime = Number.isFinite(time) ? time : Infinity
    return safeTime <= safePar * SPEED_BONUS_PAR_RATIO ? 1 : 0
  }

  /**
   * 检查自然恢复
   *
   * 恢复口径（2026-10-26 收紧）：
   *   - 只有游戏**真正在前台运行**的时间才累计，切后台 / 息屏 / 退出都不算
   *     （见 skipRecoveryTime() 与 loadRecoveryTime()）
   *   - 单次最多补 MAX_RECOVERY_BURST 条，防止长时间挂机一次性补满
   *   - 总量仍受 maxFood 上限约束
   */
  checkRecovery() {
    const now = Date.now()
    const intervalMs = this.recoveryInterval * 60 * 1000
    const elapsed = now - this.lastRecoveryTime

    if (elapsed < intervalMs) return 0

    const capacity = Math.max(0, this.maxFood - this.getTotalFood())
    const affordable = Math.floor(capacity / this.recoveryRate)
    if (affordable <= 0) {
      // 体力已满：把计时基准推到当前，等消耗后再重新累计，避免"欠着"一堆周期
      this.lastRecoveryTime = now
      this.saveRecoveryTime()
      return 0
    }

    // 超出单次上限的周期直接丢弃（把计时基准推到 now），
    // 否则每一帧都会再触发一次补发，等于变相无限恢复
    const cycles = Math.floor(elapsed / intervalMs)
    const pending = Math.min(cycles, MAX_RECOVERY_BURST)
    const actual = Math.min(pending, affordable)

    this.addFish(actual * this.recoveryRate)

    if (cycles > MAX_RECOVERY_BURST) {
      this.lastRecoveryTime = now
    } else {
      // 只前进已消费的整周期，余数保留
      this.lastRecoveryTime += actual * intervalMs
    }
    this.saveRecoveryTime()

    console.log(`自然恢复: +${actual * this.recoveryRate}🐟`)
    return actual * this.recoveryRate
  }

  /**
   * 跳过一段不该计入恢复的时间
   *
   * 小游戏切后台、手机息屏、被系统挂起时，Date.now() 照样在走，
   * 原来这段时间会被算成"恢复了 N 条"——玩家睡一觉回来体力就满了。
   * 这里把计时基准往后平移，等于告诉计时器「这段时间不算」。
   *
   * @param {number} ms - 要跳过的毫秒数
   */
  skipRecoveryTime(ms) {
    if (!(ms > 0)) return
    this.lastRecoveryTime += ms
    this.saveRecoveryTime()
    console.log(`[Food] 跳过 ${Math.round(ms / 1000)}s 非前台时间，不计入恢复`)
  }

  /**
   * 获取下次恢复时间
   * @returns {number} 剩余时间（秒）
   */
  getNextRecoveryTime() {
    const now = Date.now()
    const timeSinceLastRecovery = now - this.lastRecoveryTime
    const remaining = this.recoveryInterval * 60 * 1000 - timeSinceLastRecovery
    return Math.max(0, Math.floor(remaining / 1000))
  }

  /**
   * 保存食物数据
   */
  saveFood() {
    try {
      wx.setStorageSync('playerFood', this.food)
    } catch (e) {
      console.error('保存食物数据失败:', e)
    }
  }

  /**
   * 加载食物数据
   */
  loadFood() {
    try {
      const saved = wx.getStorageSync('playerFood')
      if (saved) {
        this.food = { ...this.food, ...saved }
      } else {
        // 初始赠送一些食物
        this.food.fish = 10
        this.saveFood()
      }
    } catch (e) {
      console.error('加载食物数据失败:', e)
    }
  }

  /**
   * 保存恢复时间
   */
  saveRecoveryTime() {
    try {
      wx.setStorageSync('lastRecoveryTime', this.lastRecoveryTime)
    } catch (e) {
      console.error('保存恢复时间失败:', e)
    }
  }

  /**
   * 加载恢复时间
   *
   * 2026-10-26 收紧：**离线时间一律不计入恢复**。
   * 原实现把 lastRecoveryTime 持久化，玩家关掉游戏一整天再打开，
   * elapsed 会算出 288 个周期，一次把体力补满 —— 等于靠"不在游戏里"的时间
   * 白拿食物，而且理论上无上限（只要攒够时间）。
   * 现在每次启动都把计时基准重置为当前时刻，只有游戏真正在前台运行时
   * 才累计（切后台的时间由 skipRecoveryTime 剔除）。
   */
  loadRecoveryTime() {
    this.lastRecoveryTime = Date.now()
    this.saveRecoveryTime()
  }

  /**
   * 获取当前食物状态
   * @returns {Object}
   */
  getFoodStatus() {
    return {
      food: { ...this.food },
      total: this.getTotalFood(),
      max: this.maxFood,
      nextRecovery: this.getNextRecoveryTime(),
      consecutiveWins: this.consecutiveWins
    }
  }

  /**
   * 重置食物（调试用）
   */
  resetFood() {
    this.food = {
      fish: 10,
      shrimp: 0,
      squid: 0,
      goldfish: 0
    }
    this.consecutiveWins = 0
    this.saveFood()
  }
}
