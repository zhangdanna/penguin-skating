/**
 * 复活管理器
 * 管理游戏中的复活机制
 */
export default class ReviveManager {
  constructor() {
    // 每日复活次数限制
    // 注：分享类复活属于"分享后获得游戏内收益"，违反微信诱导分享规范，已下线（B1）
    this.dailyLimits = {
      watchAd: 5,       // 看广告
      useFood: Infinity // 消耗食物（无限制）
    }

    // 食物消耗
    this.foodCost = 10

    // 复活惩罚
    this.movePenalty = 5

    // 当前复活记录
    this.dailyRevive = this.createDailyRevive()

    // 当前关卡是否已复活
    this.currentLevelRevived = false

    // 上次位置（用于复活后恢复）
    this.lastPosition = null
    this.lastStones = null

    this.init()
  }

  /**
   * 初始化
   */
  init() {
    this.loadDailyRevive()
    this.checkDateReset()
  }

  /**
   * 生成一份全新的每日复活记录
   */
  createDailyRevive() {
    return {
      date: this.getTodayDate(),
      watchAd: 0,
      useFood: 0
    }
  }

  /**
   * 获取今天日期字符串
   */
  getTodayDate() {
    const now = new Date()
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
  }

  /**
   * 检查日期重置
   */
  checkDateReset() {
    const today = this.getTodayDate()
    if (this.dailyRevive.date !== today) {
      this.dailyRevive = this.createDailyRevive()
      this.saveDailyRevive()
    }
  }

  /**
   * 检查是否可以复活
   */
  canRevive(type) {
    // 当前关卡已复活过
    if (this.currentLevelRevived) {
      return false
    }

    // 检查每日次数
    const remaining = this.getRemainingCount(type)
    return remaining > 0
  }

  /**
   * 获取剩余次数
   */
  getRemainingCount(type) {
    if (type === 'useFood') {
      return Infinity
    }
    const limit = this.dailyLimits[type]
    const used = this.dailyRevive[type]
    return Math.max(0, limit - used)
  }

  /**
   * 检查是否有足够食物
   */
  hasEnoughFood(foodManager) {
    return foodManager.getTotalFood() >= this.foodCost
  }

  /**
   * 执行复活
   * @param {string} type - 复活类型
   * @param {Object} foodManager - 食物管理器（用于消耗食物）
   * @returns {Object} 复活结果
   */
  revive(type, foodManager = null) {
    if (!this.canRevive(type)) {
      return { success: false, reason: '已达今日上限' }
    }

    // 消耗食物
    if (type === 'useFood') {
      if (!foodManager || !this.hasEnoughFood(foodManager)) {
        return { success: false, reason: '食物不足' }
      }
      foodManager.consumeFood(this.foodCost)
      this.dailyRevive.useFood++
    } else {
      this.dailyRevive[type]++
    }

    // 标记已复活
    this.currentLevelRevived = true

    // 保存数据
    this.saveDailyRevive()

    return {
      success: true,
      movePenalty: this.movePenalty,
      lastPosition: this.lastPosition,
      lastStones: this.lastStones
    }
  }

  /**
   * 保存位置（用于复活恢复）
   */
  savePosition(penguin, stones) {
    this.lastPosition = {
      x: penguin.x,
      y: penguin.y,
      vx: 0,
      vy: 0,
      isMoving: false
    }

    this.lastStones = stones.map(stone => ({
      x: stone.x,
      y: stone.y,
      vx: 0,
      vy: 0,
      isMoving: false
    }))
  }

  /**
   * 重置关卡复活状态
   */
  resetLevelRevive() {
    this.currentLevelRevived = false
  }

  /**
   * 获取复活状态
   */
  getStatus() {
    this.checkDateReset()
    return {
      dailyRevive: { ...this.dailyRevive },
      currentLevelRevived: this.currentLevelRevived,
      limits: { ...this.dailyLimits },
      foodCost: this.foodCost,
      movePenalty: this.movePenalty,
      remaining: {
        watchAd: this.getRemainingCount('watchAd'),
        useFood: this.getRemainingCount('useFood')
      }
    }
  }

  /**
   * 保存每日复活数据
   */
  saveDailyRevive() {
    try {
      wx.setStorageSync('dailyRevive', this.dailyRevive)
    } catch (e) {
      console.error('保存复活数据失败:', e)
    }
  }

  /**
   * 加载每日复活数据
   * 只取回当前仍然存在的复活方式，旧存档里的 shareFriend / shareGroup 会被丢弃
   */
  loadDailyRevive() {
    try {
      const saved = wx.getStorageSync('dailyRevive')
      if (!saved) return

      const fresh = this.createDailyRevive()
      fresh.date = saved.date || fresh.date
      Object.keys(this.dailyLimits).forEach(key => {
        if (Number.isFinite(saved[key])) fresh[key] = saved[key]
      })
      this.dailyRevive = fresh
    } catch (e) {
      console.error('加载复活数据失败:', e)
    }
  }

  /**
   * 重置数据（调试用）
   */
  resetData() {
    this.dailyRevive = this.createDailyRevive()
    this.currentLevelRevived = false
    this.saveDailyRevive()
  }
}
