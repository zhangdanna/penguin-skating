/**
 * 成就管理器
 * 管理游戏中的成就系统
 */
import { calcStars } from './score'

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
        reward: { fish: 5 },
        condition: (stats) => stats.totalWins >= 1
      },
      {
        id: 'win_10',
        name: '小有所成',
        description: '通关10个关卡',
        icon: '🎖️',
        reward: { shrimp: 3 },
        condition: (stats) => stats.totalWins >= 10
      },
      {
        id: 'win_50',
        name: '滑冰达人',
        description: '通关50个关卡',
        icon: '🥇',
        reward: { squid: 2 },
        condition: (stats) => stats.totalWins >= 50
      },
      {
        id: 'win_100',
        name: '滑冰大师',
        description: '通关100个关卡',
        icon: '👑',
        reward: { goldfish: 1 },
        condition: (stats) => stats.totalWins >= 100
      },

      // 星级相关成就
      {
        id: 'star_10',
        name: '星光初现',
        description: '获得10颗星星',
        icon: '⭐',
        reward: { fish: 10 },
        condition: (stats) => stats.totalStars >= 10
      },
      {
        id: 'star_50',
        name: '星光璀璨',
        description: '获得50颗星星',
        icon: '🌟',
        reward: { shrimp: 5 },
        condition: (stats) => stats.totalStars >= 50
      },
      {
        id: 'star_100',
        name: '星河满天',
        description: '获得100颗星星',
        icon: '✨',
        reward: { squid: 3 },
        condition: (stats) => stats.totalStars >= 100
      },
      {
        id: 'all_3star',
        name: '完美主义',
        description: '所有关卡获得3星',
        icon: '💫',
        reward: { goldfish: 2 },
        condition: (stats) => stats.allThreeStars
      },

      // 步数相关成就
      {
        id: 'perfect_moves',
        name: '精准操作',
        description: '在任意关卡以标准步数通关',
        icon: '🎯',
        reward: { fish: 8 },
        condition: (stats) => stats.perfectMoves >= 1
      },
      {
        id: 'perfect_moves_10',
        name: '操作大师',
        description: '10次以标准步数通关',
        icon: '🎪',
        reward: { shrimp: 3 },
        condition: (stats) => stats.perfectMoves >= 10
      },

      // 时间相关成就
      {
        id: 'speed_demon',
        name: '闪电企鹅',
        description: '在10秒内通关任意关卡',
        icon: '⚡',
        reward: { fish: 10 },
        condition: (stats) => stats.fastestTime <= 10 && stats.fastestTime > 0
      },
      {
        id: 'speed_master',
        name: '光速传说',
        description: '在5秒内通关任意关卡',
        icon: '💨',
        reward: { squid: 1 },
        condition: (stats) => stats.fastestTime <= 5 && stats.fastestTime > 0
      },

      // 连续通关成就
      {
        id: 'streak_3',
        name: '连胜新星',
        description: '连续通关3次',
        icon: '🔥',
        reward: { fish: 5 },
        condition: (stats) => stats.maxStreak >= 3
      },
      {
        id: 'streak_10',
        name: '连胜达人',
        description: '连续通关10次',
        icon: '💥',
        reward: { shrimp: 5 },
        condition: (stats) => stats.maxStreak >= 10
      },
      {
        id: 'streak_50',
        name: '连胜传奇',
        description: '连续通关50次',
        icon: '🌋',
        reward: { goldfish: 1 },
        condition: (stats) => stats.maxStreak >= 50
      },

      // 复活相关成就
      // 原 first_share / share_10 依赖"分享次数"，分享奖励下线后已无法达成，
      // 改为由复活次数驱动（复活可通过消耗食物无限次触发，稳定可达成）
      {
        id: 'revive_first',
        name: '重整旗鼓',
        description: '首次使用复活继续游戏',
        icon: '📢',
        reward: { fish: 5 },
        condition: (stats) => stats.revives >= 1
      },
      {
        id: 'revive_10',
        name: '不死企鹅',
        description: '累计复活10次',
        icon: '📣',
        reward: { shrimp: 3 },
        condition: (stats) => stats.revives >= 10
      },

      // 特殊成就
      {
        id: 'collector',
        name: '收藏家',
        description: '收集所有类型的食物',
        icon: '🎁',
        reward: { squid: 2 },
        condition: (stats) => stats.hasAllFoodTypes
      },
      {
        id: 'persistent',
        name: '坚持不懈',
        description: '累计游戏时间超过1小时',
        icon: '⏰',
        reward: { shrimp: 5 },
        condition: (stats) => stats.totalPlayTime >= 3600
      }
    ]

    // 已解锁的成就
    this.unlockedAchievements = []

    // 统计数据
    this.stats = {
      totalWins: 0,
      totalStars: 0,
      perfectMoves: 0,
      fastestTime: 0,
      maxStreak: 0,
      revives: 0,
      totalPlayTime: 0,
      allThreeStars: false,
      hasAllFoodTypes: false
    }

    // 新解锁的成就（用于动画显示）
    this.newUnlocked = []

    this.init()
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
   * 记录通关
   */
  recordWin(level, stars, moves, par, time) {
    this.stats.totalWins++
    this.stats.totalStars += stars

    // 「精准操作」按统一星级口径判定（D2），不再单独维护一套步数比较
    if (calcStars(moves, par) === 3) {
      this.stats.perfectMoves++
    }

    if (this.stats.fastestTime === 0 || time < this.stats.fastestTime) {
      this.stats.fastestTime = time
    }

    this.saveStats()
    this.checkAchievements()
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
   * 记录游戏时间
   */
  recordPlayTime(seconds) {
    this.stats.totalPlayTime += seconds
    this.saveStats()
    this.checkAchievements()
  }

  /**
   * 记录食物收集
   */
  recordFoodCollection(foodTypes) {
    this.stats.hasAllFoodTypes = foodTypes.fish > 0 &&
                                  foodTypes.shrimp > 0 &&
                                  foodTypes.squid > 0 &&
                                  foodTypes.goldfish > 0
    this.saveStats()
    this.checkAchievements()
  }

  /**
   * 记录全三星
   */
  recordAllThreeStars(allThreeStars) {
    this.stats.allThreeStars = allThreeStars
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
   */
  getAllAchievements() {
    return this.achievements.map(a => ({
      ...a,
      unlocked: this.unlockedAchievements.includes(a.id)
    }))
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
   */
  loadStats() {
    try {
      const saved = wx.getStorageSync('achievementStats')
      if (saved) {
        this.stats = { ...this.stats, ...saved }
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
    this.stats = {
      totalWins: 0,
      totalStars: 0,
      perfectMoves: 0,
      fastestTime: 0,
      maxStreak: 0,
      revives: 0,
      totalPlayTime: 0,
      allThreeStars: false,
      hasAllFoodTypes: false
    }
    this.saveAchievements()
    this.saveStats()
  }
}
