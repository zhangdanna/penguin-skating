/**
 * 食物管理器
 * 管理游戏中的食物（体力）系统
 */
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
    this.checkRecovery()
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
   * @param {string} type - 食物类型
   * @param {number} amount - 数量
   */
  addFood(type, amount) {
    if (!this.foodTypes[type]) {
      console.warn(`未知食物类型: ${type}`)
      return
    }

    this.food[type] += amount
    this.saveFood()
  }

  /**
   * 添加鱼
   * @param {number} amount - 数量
   */
  addFish(amount) {
    this.addFood('fish', amount)
  }

  /**
   * 添加虾
   * @param {number} amount - 数量
   */
  addShrimp(amount) {
    this.addFood('shrimp', amount)
  }

  /**
   * 添加鱿鱼
   * @param {number} amount - 数量
   */
  addSquid(amount) {
    this.addFood('squid', amount)
  }

  /**
   * 添加金鱼
   * @param {number} amount - 数量
   */
  addGoldfish(amount) {
    this.addFood('goldfish', amount)
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
   * 计算通关奖励
   * @param {number} level - 关卡编号
   * @param {number} moves - 步数
   * @param {number} par - 标准步数
   * @param {number} time - 用时（秒）
   * @returns {Object} 奖励内容
   */
  calculateRewards(level, moves, par, time) {
    const rewards = {
      fish: 0,
      shrimp: 0,
      squid: 0,
      goldfish: 0,
      total: 0,
      details: []
    }

    // 计算星级
    let stars = 1
    if (moves <= par) stars = 3
    else if (moves <= par * 1.5) stars = 2

    // 通关基础奖励
    const baseReward = stars
    rewards.fish += baseReward
    rewards.details.push(`通关奖励: ${baseReward}🐟`)

    // 连续通关奖励
    this.updateConsecutiveWins()
    const consecutiveBonus = this.getConsecutiveBonus()
    if (consecutiveBonus > 0) {
      if (consecutiveBonus >= 10) {
        rewards.squid += 1
        rewards.details.push(`连续通关${this.consecutiveWins}次: 1🦑`)
      } else if (consecutiveBonus >= 3) {
        rewards.shrimp += 1
        rewards.details.push(`连续通关${this.consecutiveWins}次: 1🦐`)
      } else {
        rewards.fish += consecutiveBonus
        rewards.details.push(`连续通关${this.consecutiveWins}次: ${consecutiveBonus}🐟`)
      }
    }

    // 时间挑战奖励（根据难度调整）
    const timeBonus = this.getTimeBonus(time, level)
    if (timeBonus > 0) {
      if (timeBonus >= 10) {
        rewards.squid += 1
        rewards.details.push(`时间奖励(${time}秒): 1🦑`)
      } else if (timeBonus >= 3) {
        rewards.shrimp += 1
        rewards.details.push(`时间奖励(${time}秒): 1🦐`)
      } else {
        rewards.fish += timeBonus
        rewards.details.push(`时间奖励(${time}秒): ${timeBonus}🐟`)
      }
    }

    // 计算总价值
    rewards.total = rewards.fish +
                    rewards.shrimp * this.foodTypes.shrimp.value +
                    rewards.squid * this.foodTypes.squid.value +
                    rewards.goldfish * this.foodTypes.goldfish.value

    return rewards
  }

  /**
   * 发放奖励
   * @param {Object} rewards - 奖励内容
   */
  giveRewards(rewards) {
    if (rewards.fish > 0) this.addFish(rewards.fish)
    if (rewards.shrimp > 0) this.addShrimp(rewards.shrimp)
    if (rewards.squid > 0) this.addSquid(rewards.squid)
    if (rewards.goldfish > 0) this.addGoldfish(rewards.goldfish)
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
   * @returns {number} 奖励价值
   */
  getConsecutiveBonus() {
    if (this.consecutiveWins >= 50) return 50  // 金鱼
    if (this.consecutiveWins >= 10) return 10  // 鱿鱼
    if (this.consecutiveWins >= 5) return 3    // 虾
    if (this.consecutiveWins >= 3) return 1    // 鱼
    return 0
  }

  /**
   * 获取时间奖励（根据关卡难度调整）
   * @param {number} time - 用时（秒）
   * @param {number} level - 关卡编号
   * @returns {number} 奖励价值
   */
  getTimeBonus(time, level) {
    // 根据关卡编号计算难度系数（关卡越高越难）
    const difficultyMultiplier = 1 + (level - 1) * 0.3

    // 根据难度调整时间阈值
    // 简单关卡（1-3）：标准时间
    // 中等关卡（4-6）：1.3倍时间
    // 困难关卡（7+）：1.6倍时间
    let timeMultiplier = 1
    if (level >= 7) {
      timeMultiplier = 1.6
    } else if (level >= 4) {
      timeMultiplier = 1.3
    }

    // 计算调整后的时间阈值
    const goldfishTime = 5 * timeMultiplier * difficultyMultiplier
    const squidTime = 10 * timeMultiplier * difficultyMultiplier
    const fishTime = 30 * timeMultiplier * difficultyMultiplier

    if (time <= goldfishTime) return 50   // 金鱼
    if (time <= squidTime) return 10      // 鱿鱼
    if (time <= fishTime) return 1        // 鱼
    return 0
  }

  /**
   * 检查自然恢复
   */
  checkRecovery() {
    const now = Date.now()
    const timeSinceLastRecovery = now - this.lastRecoveryTime

    if (timeSinceLastRecovery >= this.recoveryInterval * 60 * 1000) {
      // 计算可恢复次数
      const recoveries = Math.floor(timeSinceLastRecovery / (this.recoveryInterval * 60 * 1000))
      const maxRecoveries = Math.floor((this.maxFood - this.getTotalFood()) / this.recoveryRate)
      const actualRecoveries = Math.min(recoveries, maxRecoveries)

      if (actualRecoveries > 0) {
        this.addFish(actualRecoveries * this.recoveryRate)
        this.lastRecoveryTime = now
        console.log(`自然恢复: +${actualRecoveries * this.recoveryRate}🐟`)
      }
    }
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
   */
  loadRecoveryTime() {
    try {
      const saved = wx.getStorageSync('lastRecoveryTime')
      this.lastRecoveryTime = saved || Date.now()
    } catch (e) {
      console.error('加载恢复时间失败:', e)
      this.lastRecoveryTime = Date.now()
    }
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
