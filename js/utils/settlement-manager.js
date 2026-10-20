/**
 * 结算数据管理器
 * 管理游戏结算数据和统计
 */
export default class SettlementManager {
  constructor() {
    // 当前关卡结算数据
    this.currentSettlement = null

    // 累计统计
    this.totalStats = {
      totalGames: 0,        // 总游戏次数
      totalWins: 0,         // 总通关次数
      totalMoves: 0,        // 总步数
      totalTime: 0,         // 总用时（秒）
      totalStars: 0,        // 总星星数
      perfectGames: 0,      // 完美通关次数（3星）
      revives: 0,           // 复活次数
      shares: 0             // 分享次数
    }

    // 最佳记录
    this.bestRecords = {
      fastestTime: 0,       // 最快通关时间
      fewestMoves: 0,       // 最少步数
      longestStreak: 0      // 最长连胜
    }

    this.init()
  }

  /**
   * 初始化
   */
  init() {
    this.loadTotalStats()
    this.loadBestRecords()
  }

  /**
   * 开始关卡
   */
  startLevel(level, difficulty) {
    this.currentSettlement = {
      level: level,
      difficulty: difficulty,
      startTime: Date.now(),
      moves: 0,
      stars: 0,
      time: 0,
      won: false,
      revived: false,
      par: 0
    }
  }

  /**
   * 记录步数
   */
  recordMove() {
    if (this.currentSettlement) {
      this.currentSettlement.moves++
    }
  }

  /**
   * 记录复活
   */
  recordRevive() {
    if (this.currentSettlement) {
      this.currentSettlement.revived = true
    }
    this.totalStats.revives++
    this.saveTotalStats()
  }

  /**
   * 完成关卡（胜利）
   */
  completeLevel(stars, par) {
    if (!this.currentSettlement) return null

    const time = Math.floor((Date.now() - this.currentSettlement.startTime) / 1000)

    this.currentSettlement.won = true
    this.currentSettlement.stars = stars
    this.currentSettlement.time = time
    this.currentSettlement.par = par

    // 更新累计统计
    this.totalStats.totalGames++
    this.totalStats.totalWins++
    this.totalStats.totalMoves += this.currentSettlement.moves
    this.totalStats.totalTime += time
    this.totalStats.totalStars += stars

    if (stars === 3) {
      this.totalStats.perfectGames++
    }

    // 更新最佳记录
    if (this.bestRecords.fastestTime === 0 || time < this.bestRecords.fastestTime) {
      this.bestRecords.fastestTime = time
    }

    if (this.bestRecords.fewestMoves === 0 || this.currentSettlement.moves < this.bestRecords.fewestMoves) {
      this.bestRecords.fewestMoves = this.currentSettlement.moves
    }

    this.saveTotalStats()
    this.saveBestRecords()

    return this.getSettlementSummary()
  }

  /**
   * 失败关卡
   */
  failLevel() {
    if (!this.currentSettlement) return null

    const time = Math.floor((Date.now() - this.currentSettlement.startTime) / 1000)

    this.currentSettlement.won = false
    this.currentSettlement.time = time

    // 更新累计统计
    this.totalStats.totalGames++
    this.totalStats.totalMoves += this.currentSettlement.moves
    this.totalStats.totalTime += time

    this.saveTotalStats()

    return this.getSettlementSummary()
  }

  /**
   * 记录分享
   */
  recordShare() {
    this.totalStats.shares++
    this.saveTotalStats()
  }

  /**
   * 获取结算摘要
   */
  getSettlementSummary() {
    if (!this.currentSettlement) return null

    const efficiency = this.currentSettlement.par > 0
      ? Math.floor((this.currentSettlement.par / this.currentSettlement.moves) * 100)
      : 0

    return {
      level: this.currentSettlement.level,
      difficulty: this.currentSettlement.difficulty,
      won: this.currentSettlement.won,
      moves: this.currentSettlement.moves,
      par: this.currentSettlement.par,
      stars: this.currentSettlement.stars,
      time: this.currentSettlement.time,
      revived: this.currentSettlement.revived,
      efficiency: efficiency,
      isNewRecord: this.checkNewRecord()
    }
  }

  /**
   * 检查是否新纪录
   */
  checkNewRecord() {
    if (!this.currentSettlement || !this.currentSettlement.won) return false

    return this.currentSettlement.time === this.bestRecords.fastestTime ||
           this.currentSettlement.moves === this.bestRecords.fewestMoves
  }

  /**
   * 获取累计统计
   */
  getTotalStats() {
    return {
      ...this.totalStats,
      winRate: this.totalStats.totalGames > 0
        ? Math.floor((this.totalStats.totalWins / this.totalStats.totalGames) * 100)
        : 0,
      avgMoves: this.totalStats.totalWins > 0
        ? Math.floor(this.totalStats.totalMoves / this.totalStats.totalWins)
        : 0,
      avgTime: this.totalStats.totalWins > 0
        ? Math.floor(this.totalStats.totalTime / this.totalStats.totalWins)
        : 0
    }
  }

  /**
   * 获取最佳记录
   */
  getBestRecords() {
    return { ...this.bestRecords }
  }

  /**
   * 格式化时间
   */
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  /**
   * 保存累计统计
   */
  saveTotalStats() {
    try {
      wx.setStorageSync('totalStats', this.totalStats)
    } catch (e) {
      console.error('保存统计数据失败:', e)
    }
  }

  /**
   * 加载累计统计
   */
  loadTotalStats() {
    try {
      const saved = wx.getStorageSync('totalStats')
      if (saved) {
        this.totalStats = { ...this.totalStats, ...saved }
      }
    } catch (e) {
      console.error('加载统计数据失败:', e)
    }
  }

  /**
   * 保存最佳记录
   */
  saveBestRecords() {
    try {
      wx.setStorageSync('bestRecords', this.bestRecords)
    } catch (e) {
      console.error('保存最佳记录失败:', e)
    }
  }

  /**
   * 加载最佳记录
   */
  loadBestRecords() {
    try {
      const saved = wx.getStorageSync('bestRecords')
      if (saved) {
        this.bestRecords = { ...this.bestRecords, ...saved }
      }
    } catch (e) {
      console.error('加载最佳记录失败:', e)
    }
  }

  /**
   * 重置数据（调试用）
   */
  resetData() {
    this.totalStats = {
      totalGames: 0,
      totalWins: 0,
      totalMoves: 0,
      totalTime: 0,
      totalStars: 0,
      perfectGames: 0,
      revives: 0,
      shares: 0
    }

    this.bestRecords = {
      fastestTime: 0,
      fewestMoves: 0,
      longestStreak: 0
    }

    this.saveTotalStats()
    this.saveBestRecords()
  }
}
