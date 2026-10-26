/**
 * 成就管理器
 * 管理游戏中的成就系统
 */
import { calcStars } from './score'

/** 战役关卡总数（与 level-manager 的 CAMPAIGN_SIZE 保持一致） */
export const CAMPAIGN_SIZE = 60

/** 速度成就的判定口径：用时 / par 的比值 */
const SPEED_RATIO_FAST = 1.5
const SPEED_RATIO_BLUR = 1.0

/**
 * 成就管理器
 *
 * F2 重做要点：
 *  - `totalWins` 统计的是"通关次数"，重刷第 1 关也会涨，导致"通关 50 关"类成就可被农场化。
 *    改为 `uniqueWins`（首通关卡数），且上限就是 60 关。
 *  - `totalStars` 每次通关都累加，重玩同一关会重复计星。改为"各关历史最高星之和"。
 *  - 「完美主义」原来只要求"已通关的 3 关全 3 星"，通关前 3 关就能白拿 2 条金鱼（价值 100）。
 *    改为"全部 60 关 3 星"。
 *  - 「精准操作」原来按 3 星判定（步数 ≤ par），而 par = 最优步数 × 1.2，几乎每次三星都算。
 *    改为"步数 == par"精确命中。
 *  - 「10 秒内通关」「5 秒内通关」在 par 16~47 步的关卡上物理不可达（死成就）。
 *    改为按 `用时 / par` 的比值判定。
 *  - 「通关 100 次」在只有 60 关的前提下永远无法达成，改为"首通全部 60 关"。
 */
export default class AchievementManager {
  constructor() {
    // 成就定义
    this.achievements = [
      // 关卡相关成就
      {
        id: 'first_win',
        name: '初出茅庐',
        description: '首次通关任意关卡',
        icon: '🏆',
        reward: { fish: 3 },
        condition: (stats) => stats.uniqueWins >= 1,
        progress: (stats) => ({ current: Math.min(stats.uniqueWins, 1), target: 1 })
      },
      {
        id: 'win_10',
        name: '小有所成',
        description: '首通 10 个关卡',
        icon: '🎖️',
        reward: { shrimp: 2 },
        condition: (stats) => stats.uniqueWins >= 10,
        progress: (stats) => ({ current: Math.min(stats.uniqueWins, 10), target: 10 })
      },
      {
        id: 'win_50',
        name: '滑冰达人',
        description: '首通 30 个关卡',
        icon: '🥇',
        reward: { squid: 2 },
        condition: (stats) => stats.uniqueWins >= 30,
        progress: (stats) => ({ current: Math.min(stats.uniqueWins, 30), target: 30 })
      },
      {
        id: 'win_100',
        name: '滑冰大师',
        description: '首通全部 60 个关卡',
        icon: '👑',
        reward: { goldfish: 1 },
        condition: (stats) => stats.uniqueWins >= CAMPAIGN_SIZE,
        progress: (stats) => ({ current: Math.min(stats.uniqueWins, CAMPAIGN_SIZE), target: CAMPAIGN_SIZE })
      },

      // 星级相关成就（各关最高星之和，重玩不累加）
      {
        id: 'star_10',
        name: '星光初现',
        description: '累计获得 10 颗星星',
        icon: '⭐',
        reward: { fish: 5 },
        condition: (stats) => stats.totalStars >= 10,
        progress: (stats) => ({ current: Math.min(stats.totalStars, 10), target: 10 })
      },
      {
        id: 'star_50',
        name: '星光璀璨',
        description: '累计获得 50 颗星星',
        icon: '🌟',
        reward: { shrimp: 3 },
        condition: (stats) => stats.totalStars >= 50,
        progress: (stats) => ({ current: Math.min(stats.totalStars, 50), target: 50 })
      },
      {
        id: 'star_100',
        name: '星河满天',
        description: '累计获得 100 颗星星',
        icon: '✨',
        reward: { squid: 2 },
        condition: (stats) => stats.totalStars >= 100,
        progress: (stats) => ({ current: Math.min(stats.totalStars, 100), target: 100 })
      },
      {
        id: 'all_3star',
        name: '完美主义',
        description: '全部 60 关都拿到 3 星',
        icon: '💫',
        reward: { goldfish: 1 },
        condition: (stats) => stats.allThreeStars,
        progress: (stats) => ({ current: stats.threeStarLevels, target: CAMPAIGN_SIZE })
      },

      // 步数相关成就（精确命中 par，而不是"3 星"）
      {
        id: 'perfect_moves',
        name: '精准操作',
        description: '以标准步数（正好等于 par）通关一次',
        icon: '🎯',
        reward: { fish: 5 },
        condition: (stats) => stats.perfectMoves >= 1,
        progress: (stats) => ({ current: Math.min(stats.perfectMoves, 1), target: 1 })
      },
      {
        id: 'perfect_moves_10',
        name: '操作大师',
        description: '10 次以标准步数通关',
        icon: '🎪',
        reward: { shrimp: 2 },
        condition: (stats) => stats.perfectMoves >= 10,
        progress: (stats) => ({ current: Math.min(stats.perfectMoves, 10), target: 10 })
      },

      // 速度相关成就（用时 / par 的比值，不再用绝对秒数）
      {
        id: 'speed_demon',
        name: '闪电企鹅',
        description: '用时不超过 par 的 1.5 倍通关',
        icon: '⚡',
        reward: { fish: 5 },
        condition: (stats) => stats.bestSpeedRatio > 0 && stats.bestSpeedRatio <= SPEED_RATIO_FAST
      },
      {
        id: 'speed_master',
        name: '光速传说',
        description: '用时不超过 par 的 1.0 倍通关',
        icon: '💨',
        reward: { squid: 1 },
        condition: (stats) => stats.bestSpeedRatio > 0 && stats.bestSpeedRatio <= SPEED_RATIO_BLUR
      },

      // 连续通关成就
      {
        id: 'streak_3',
        name: '连胜新星',
        description: '连续通关 3 次',
        icon: '🔥',
        reward: { fish: 2 },
        condition: (stats) => stats.maxStreak >= 3,
        progress: (stats) => ({ current: Math.min(stats.maxStreak, 3), target: 3 })
      },
      {
        id: 'streak_10',
        name: '连胜达人',
        description: '连续通关 10 次',
        icon: '💥',
        reward: { shrimp: 2 },
        condition: (stats) => stats.maxStreak >= 10,
        progress: (stats) => ({ current: Math.min(stats.maxStreak, 10), target: 10 })
      },
      {
        id: 'streak_50',
        name: '连胜传奇',
        description: '连续通关 20 次',
        icon: '🌋',
        reward: { squid: 3 },
        condition: (stats) => stats.maxStreak >= 20,
        progress: (stats) => ({ current: Math.min(stats.maxStreak, 20), target: 20 })
      },

      // 复活相关成就
      {
        id: 'revive_first',
        name: '重整旗鼓',
        description: '首次使用复活继续游戏',
        icon: '📢',
        reward: { fish: 3 },
        condition: (stats) => stats.revives >= 1,
        progress: (stats) => ({ current: Math.min(stats.revives, 1), target: 1 })
      },
      {
        id: 'revive_10',
        name: '不死企鹅',
        description: '累计复活 10 次',
        icon: '📣',
        reward: { shrimp: 2 },
        condition: (stats) => stats.revives >= 10,
        progress: (stats) => ({ current: Math.min(stats.revives, 10), target: 10 })
      },

      // 特殊成就
      {
        id: 'collector',
        name: '收藏家',
        description: '4 种食物各累计获得 5 个',
        icon: '🎁',
        reward: { squid: 1 },
        condition: (stats) => Object.keys(stats.foodEarned).every(
          type => (stats.foodEarned[type] || 0) >= 5
        ),
        progress: (stats) => ({
          current: Math.min(...Object.keys(stats.foodEarned).map(t => stats.foodEarned[t] || 0), 5),
          target: 5
        })
      },
      {
        id: 'persistent',
        name: '坚持不懈',
        description: '累计游戏时间超过 2 小时',
        icon: '⏰',
        reward: { shrimp: 3 },
        condition: (stats) => stats.totalPlayTime >= 7200,
        progress: (stats) => ({ current: Math.floor(Math.min(stats.totalPlayTime, 7200) / 60), target: 120 })
      }
    ]

    // 已解锁的成就
    this.unlockedAchievements = []

    // 统计数据
    this.stats = this.createEmptyStats()

    // 新解锁的成就（用于动画显示）
    this.newUnlocked = []

    this.init()
  }

  /**
   * 一份全新的统计数据
   */
  createEmptyStats() {
    return {
      uniqueWins: 0,        // 首通关卡数（上限 60）
      totalWins: 0,         // 通关次数（仅展示用，不参与成就判定）
      totalStars: 0,        // 各关历史最高星之和
      threeStarLevels: 0,   // 3 星的关卡数
      perfectMoves: 0,      // 步数 == par 的次数
      bestSpeedRatio: 0,    // 最快一次的 用时/par 比值，0 表示暂无记录
      maxStreak: 0,
      revives: 0,
      totalPlayTime: 0,
      allThreeStars: false,
      foodEarned: { fish: 0, shrimp: 0, squid: 0, goldfish: 0 },
      levelStars: {}        // { 关卡号: 历史最高星 }
    }
  }


  /**
   * 初始化
   */
  init() {
    this.loadAchievements()
    this.loadStats()
  }

  /**
   * 更新统计数据
   */
  updateStats(newStats) {
    Object.assign(this.stats, newStats)
    this.saveStats()
    this.checkAchievements()
  }

  /**
   * 记录一次通关（F2：一次调用更新所有维度）
   *
   * 兼容旧的位置参数写法：recordWin(level, stars, moves, par, time)
   * 推荐用对象：recordWin({ level, stars, moves, par, time, firstClear })
   *
   * @param {number|Object} levelOrResult
   * @param {number} [stars]
   * @param {number} [moves]
   * @param {number} [par]
   * @param {number} [time]
   */
  recordWin(levelOrResult, stars, moves, par, time) {
    const result = typeof levelOrResult === 'object' && levelOrResult !== null
      ? levelOrResult
      : { level: levelOrResult, stars, moves, par, time }

    const level = Number(result.level) || 0
    const safePar = Number.isFinite(result.par) && result.par > 0 ? result.par : 1
    const safeMoves = Number.isFinite(result.moves) ? result.moves : 0
    const safeTime = Number.isFinite(result.time) ? result.time : 0
    const starCount = Number.isFinite(result.stars) ? result.stars : calcStars(safeMoves, safePar)
    const firstClear = !!result.firstClear

    this.stats.totalWins++

    // 首通关卡数（重刷不重复计数，上限就是战役总关数）
    if (firstClear && level > 0) {
      this.stats.uniqueWins = Math.min(this.stats.uniqueWins + 1, CAMPAIGN_SIZE)
    }

    // 各关历史最高星：重玩拿低星不会把记录打下来，也不会重复累加
    if (level > 0) {
      const prev = this.stats.levelStars[level] || 0
      if (starCount > prev) {
        this.stats.levelStars[level] = starCount
      }
    }
    this.refreshStarStats()

    // 精准操作：步数正好等于 par
    // 使用过「退一步」的关卡不计入 —— 否则等于用食物买成就
    if (!result.undoUsed && safeMoves > 0 && safeMoves === safePar) {
      this.stats.perfectMoves++
    }

    // 速度：记录最优的 用时/par 比值
    if (safeTime > 0) {
      const ratio = safeTime / safePar
      if (this.stats.bestSpeedRatio === 0 || ratio < this.stats.bestSpeedRatio) {
        this.stats.bestSpeedRatio = Math.round(ratio * 100) / 100
      }
    }

    // 累计游戏时间（按关卡用时累加，暂停时长已由 getElapsedSeconds 扣掉）
    this.stats.totalPlayTime += safeTime

    this.refreshAllThreeStars()

    this.saveStats()
    this.checkAchievements()
  }

  /**
   * 重算「星星总数」与「3 星关卡数」
   */
  refreshStarStats() {
    const levels = Object.keys(this.stats.levelStars)
    let total = 0
    let three = 0
    levels.forEach(key => {
      const value = this.stats.levelStars[key] || 0
      total += value
      if (value >= 3) three++
    })
    this.stats.totalStars = total
    this.stats.threeStarLevels = three
  }

  /**
   * 重算「全部关卡 3 星」
   * 必须真的首通全部 60 关，而不是"已通关的那几关都 3 星"
   */
  refreshAllThreeStars() {
    this.stats.allThreeStars =
      this.stats.uniqueWins >= CAMPAIGN_SIZE &&
      this.stats.threeStarLevels >= CAMPAIGN_SIZE
  }

  /**
   * 记录连续通关
   */
  recordStreak(streak) {
    if (streak > this.stats.maxStreak) {
      this.stats.maxStreak = streak
    }
    this.saveStats()
    this.checkAchievements()
  }

  /**
   * 记录复活
   * 原 recordShare 随分享奖励一起下线（B1）
   */
  recordRevive() {
    this.stats.revives++
    this.saveStats()
    this.checkAchievements()
  }

  /**
   * 记录游戏时间（recordWin 已内置累加，保留此方法供外部单独调用）
   */
  recordPlayTime(seconds) {
    if (!(seconds > 0)) return
    this.stats.totalPlayTime += seconds
    this.saveStats()
    this.checkAchievements()
  }

  /**
   * 记录食物收益（F2：改为"累计获得"，不再看当前库存）
   * @param {Object} food - 本次实际入账的食物 { fish, shrimp, squid, goldfish }
   */
  recordFoodEarned(food) {
    if (!food) return
    const earned = this.stats.foodEarned
    Object.keys(earned).forEach(type => {
      const amount = Number(food[type]) || 0
      if (amount > 0) earned[type] += amount
    })
    this.saveStats()
    this.checkAchievements()
  }

  /**
   * 记录全三星（外部强制写入时使用；正常流程由 refreshAllThreeStars 计算）
   */
  recordAllThreeStars(allThreeStars) {
    this.stats.allThreeStars = !!allThreeStars
    this.saveStats()
    this.checkAchievements()
  }

  /**
   * 检查成就解锁
   * 注意：这里只追加，不清空 newUnlocked。
   * 一次通关会连续触发 recordWin / recordStreak / recordFoodCollection / recordPlayTime 等多个记录，
   * 如果每次都清空，前面解锁的成就既不会弹通知也拿不到奖励。
   * @returns {Array} 当前累计的新解锁成就
   */
  checkAchievements() {
    this.achievements.forEach(achievement => {
      if (!this.unlockedAchievements.includes(achievement.id)) {
        if (achievement.condition(this.stats)) {
          this.unlockAchievement(achievement)
        }
      }
    })

    return this.newUnlocked
  }

  /**
   * 解锁成就
   */
  unlockAchievement(achievement) {
    this.unlockedAchievements.push(achievement.id)
    this.newUnlocked.push(achievement)
    this.saveAchievements()

    console.log(`解锁成就: ${achievement.name} - ${achievement.description}`)
  }

  /**
   * 取出（并清空）新解锁的成就
   * @returns {Array}
   */
  getNewUnlocked() {
    return this.flushNewUnlocked()
  }

  /**
   * 取出并清空新解锁成就列表
   * @returns {Array}
   */
  flushNewUnlocked() {
    const newOnes = [...this.newUnlocked]
    this.newUnlocked = []
    return newOnes
  }

  /**
   * 获取所有成就
   * 附带 progressText（如「12/30」），未解锁时显示离目标还有多远
   */
  getAllAchievements() {
    return this.achievements.map(a => {
      const unlocked = this.unlockedAchievements.includes(a.id)
      let progressText = ''
      if (!unlocked && typeof a.progress === 'function') {
        try {
          const p = a.progress(this.stats)
          if (p && Number.isFinite(p.current) && Number.isFinite(p.target)) {
            progressText = `${Math.min(p.current, p.target)}/${p.target}`
          }
        } catch (e) {
          progressText = ''
        }
      }
      return { ...a, unlocked, progressText }
    })
  }

  /**
   * 获取已解锁成就
   */
  getUnlockedAchievements() {
    return this.achievements.filter(a =>
      this.unlockedAchievements.includes(a.id)
    )
  }

  /**
   * 获取未解锁成就
   */
  getLockedAchievements() {
    return this.achievements.filter(a =>
      !this.unlockedAchievements.includes(a.id)
    )
  }

  /**
   * 获取成就进度
   */
  getProgress() {
    return {
      unlocked: this.unlockedAchievements.length,
      total: this.achievements.length,
      percentage: (this.unlockedAchievements.length / this.achievements.length) * 100
    }
  }

  /**
   * 获取统计数据
   */
  getStats() {
    return { ...this.stats }
  }

  /**
   * 保存成就数据
   */
  saveAchievements() {
    try {
      wx.setStorageSync('unlockedAchievements', this.unlockedAchievements)
    } catch (e) {
      console.error('保存成就数据失败:', e)
    }
  }

  /**
   * 加载成就数据
   */
  loadAchievements() {
    try {
      const saved = wx.getStorageSync('unlockedAchievements')
      if (saved) {
        this.unlockedAchievements = saved
      }
    } catch (e) {
      console.error('加载成就数据失败:', e)
    }
  }

  /**
   * 保存统计数据
   */
  saveStats() {
    try {
      wx.setStorageSync('achievementStats', this.stats)
    } catch (e) {
      console.error('保存统计数据失败:', e)
    }
  }

  /**
   * 加载统计数据
   * 旧存档里没有 foodEarned / levelStars / uniqueWins 等新字段，
   * 用空值兜底后再合并，避免条件函数读到 undefined。
   */
  loadStats() {
    try {
      const saved = wx.getStorageSync('achievementStats')
      if (saved) {
        const fresh = this.createEmptyStats()
        this.stats = {
          ...fresh,
          ...saved,
          foodEarned: { ...fresh.foodEarned, ...(saved.foodEarned || {}) },
          levelStars: { ...(saved.levelStars || {}) }
        }
        this.refreshStarStats()
        this.refreshAllThreeStars()
      }
    } catch (e) {
      console.error('加载统计数据失败:', e)
    }
  }

  /**
   * 重置数据（调试用）
   */
  resetData() {
    this.unlockedAchievements = []
    this.stats = this.createEmptyStats()
    this.saveAchievements()
    this.saveStats()
  }
}
