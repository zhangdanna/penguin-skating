/**
 * 成就管理器
 * 管理游戏中的成就系统
 */
import { calcStars } from './score'

/**
 * 里程碑关数：成就口径里的「全部关卡」
 *
 * G1 之后关卡无上限（1~200 烘焙 + 之后运行时生成），所以这里不再等于
 * 关卡总数，只是一个成就阈值 —— 「首通全部关卡」实际指首通前 60 关。
 */
export const CAMPAIGN_SIZE = 60

/** 速度成就的判定口径：用时 / par 的比值 */
const SPEED_RATIO_FAST = 1.5
const SPEED_RATIO_BLUR = 1.0

/**
 * 成就管理器
 *
 * F3 重做要点（成就弹窗刷屏）：
 *  - 新增 `minWins` 前置门槛：首通关卡数不足时**不允许解锁**，只是条件满足也不行。
 *    原来第 1 关 par=16、玩家 8 秒通关 → bestSpeedRatio=0.5，一次同时命中
 *    first_win / speed_demon / speed_master，结算页上叠了 3 张通知卡，糊住标题。
 *    现在 speed 类成就要求先首通若干关，第 1 关只会解锁「初出茅庐」。
 *  - 门槛也顺带修了另一个隐性问题：`bestSpeedRatio` 取的是历史最优值，
 *    只要在某个简单关卡刷出 0.5 就永久满足，「光速传说」会毫无预兆地弹出来。
 *
 * F2 重做要点：
 *  - `totalWins` 统计的是"通关次数"，重刷第 1 关也会涨，导致"通关 50 关"类成就可被农场化。
 *    改为 `uniqueWins`（首通关卡数）。G1 之后关卡无上限，这个计数也不再封顶。
 *  - `totalStars` 每次通关都累加，重玩同一关会重复计星。改为"各关历史最高星之和"。
 *  - 「精准操作」原来按 3 星判定（步数 ≤ par），而 par = 最优步数 × 1.2，几乎每次三星都算。
 *    改为"步数 == par"精确命中。G1 之后 par 就等于最优步数，这个成就正式变成
 *    「走出最优解」，是货真价实的硬核成就。
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
        pose: 'cheer',
        prop: 'trophy',
        quote: '第一块冰，稳稳落进洞里啦！',
        reward: { fish: 3 },
        condition: (stats) => stats.uniqueWins >= 1,
        progress: (stats) => ({ current: Math.min(stats.uniqueWins, 1), target: 1 })
      },
      {
        id: 'win_10',
        name: '小有所成',
        description: '首通 10 个关卡',
        icon: '🎖️',
        pose: 'wave',
        prop: 'medal',
        quote: '十关打卡，这枚勋章归我。',
        reward: { shrimp: 2 },
        condition: (stats) => stats.uniqueWins >= 10,
        progress: (stats) => ({ current: Math.min(stats.uniqueWins, 10), target: 10 })
      },
      {
        id: 'win_50',
        name: '滑冰达人',
        description: '首通 30 个关卡',
        icon: '🥇',
        pose: 'slide',
        prop: 'snowflake',
        quote: '冰面就是我的跑道。',
        reward: { squid: 2 },
        condition: (stats) => stats.uniqueWins >= 30,
        progress: (stats) => ({ current: Math.min(stats.uniqueWins, 30), target: 30 })
      },
      {
        id: 'win_100',
        name: '滑冰大师',
        description: '首通全部 60 个关卡',
        icon: '👑',
        pose: 'cheer',
        prop: 'crown',
        quote: '六十关全通，王冠有点沉。',
        reward: { goldfish: 1 },
        condition: (stats) => stats.uniqueWins >= CAMPAIGN_SIZE,
        progress: (stats) => ({ current: Math.min(stats.uniqueWins, CAMPAIGN_SIZE), target: CAMPAIGN_SIZE })
      },

      // 步数相关成就（精确命中 par，而不是"3 星"）
      {
        id: 'perfect_moves',
        name: '精准操作',
        description: '以标准步数（正好等于 par）通关一次',
        icon: '🎯',
        pose: 'hold',
        prop: 'target',
        quote: '一步不多，一步不少。',
        reward: { fish: 5 },
        // 第 1 关只留「初出茅庐」一个成就，避免开局就叠好几张卡片
        minWins: 2,
        condition: (stats) => stats.perfectMoves >= 1,
        progress: (stats) => ({ current: Math.min(stats.perfectMoves, 1), target: 1 })
      },
      {
        id: 'perfect_moves_10',
        name: '操作大师',
        description: '10 次以标准步数通关',
        icon: '🎪',
        pose: 'hold',
        prop: 'star',
        quote: '十次满分，手比脑子快。',
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
        pose: 'slide',
        prop: 'lightning',
        quote: '还没看清，我已经到了。',
        reward: { fish: 5 },
        minWins: 3,
        condition: (stats) => stats.bestSpeedRatio > 0 && stats.bestSpeedRatio <= SPEED_RATIO_FAST
      },
      {
        id: 'speed_master',
        name: '光速传说',
        description: '用时不超过 par 的 1.0 倍通关',
        icon: '💨',
        pose: 'wave',
        prop: 'lightning',
        quote: '光都追不上这一趟。',
        reward: { squid: 1 },
        // 与「闪电企鹅」错开档位：否则简单关卡一局就能把两个一起点亮
        minWins: 8,
        condition: (stats) => stats.bestSpeedRatio > 0 && stats.bestSpeedRatio <= SPEED_RATIO_BLUR
      },

      // 连续通关成就
      {
        id: 'streak_3',
        name: '连胜新星',
        description: '连续通关 3 次',
        icon: '🔥',
        pose: 'cheer',
        prop: 'star',
        quote: '连赢三把，手感来了。',
        reward: { fish: 2 },
        condition: (stats) => stats.maxStreak >= 3,
        progress: (stats) => ({ current: Math.min(stats.maxStreak, 3), target: 3 })
      },
      {
        id: 'streak_10',
        name: '连胜达人',
        description: '连续通关 10 次',
        icon: '💥',
        pose: 'hold',
        prop: 'heart',
        quote: '十连胜，心跳比冰面还稳。',
        reward: { shrimp: 2 },
        condition: (stats) => stats.maxStreak >= 10,
        progress: (stats) => ({ current: Math.min(stats.maxStreak, 10), target: 10 })
      },
      {
        id: 'streak_50',
        name: '连胜传奇',
        description: '连续通关 20 次',
        icon: '🌋',
        pose: 'cheer',
        prop: 'confetti',
        quote: '二十连胜，撒花庆祝。',
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
        pose: 'peek',
        prop: null,
        quote: '掉下去一次，爬上来更稳。',
        reward: { fish: 3 },
        condition: (stats) => stats.revives >= 1,
        progress: (stats) => ({ current: Math.min(stats.revives, 1), target: 1 })
      },
      {
        id: 'revive_10',
        name: '不死企鹅',
        description: '累计复活 10 次',
        icon: '📣',
        pose: 'wave',
        prop: 'bubbles',
        quote: '十次落水，十次浮上来。',
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
        pose: 'hold',
        prop: 'fish',
        quote: '四种口粮，一样都不能少。',
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
        pose: 'sleep',
        prop: 'zzz',
        quote: '两小时了，让我眯一会儿。',
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
      uniqueWins: 0,        // 首通关卡数（关卡无上限，不封顶）
      totalWins: 0,         // 通关次数（仅展示用，不参与成就判定）
      totalStars: 0,        // 各关历史最高星之和
      threeStarLevels: 0,   // 3 星的关卡数
      perfectMoves: 0,      // 步数 == par 的次数
      bestSpeedRatio: 0,    // 最快一次的 用时/par 比值，0 表示暂无记录
      maxStreak: 0,
      revives: 0,
      totalPlayTime: 0,
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

    // 首通关卡数（重刷不重复计数）。关卡无上限，这里不再截断到 CAMPAIGN_SIZE，
    // 否则玩家玩到 200 关后计数还停在 60，成就进度条会看起来卡住
    if (firstClear && level > 0) {
      this.stats.uniqueWins += 1
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
   * 成就的前置门槛是否已满足
   *
   * `minWins` 是「至少首通 N 个关卡」的门槛，只拦解锁、不改判定条件本身。
   * 用首通数而不是通关次数，是为了避免重刷第 1 关把门槛刷过去。
   *
   * @param {Object} achievement
   * @returns {boolean}
   */
  meetsPrerequisite(achievement) {
    const need = achievement.minWins || 0
    return need <= 0 || this.stats.uniqueWins >= need
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
        if (!this.meetsPrerequisite(achievement)) return
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
   * 附带 progressText（如「12/30」），未解锁时显示离目标还有多远。
   * 被 `minWins` 门槛挡住时改为显示门槛，否则会出现「5/5 却没解锁」的困惑。
   */
  getAllAchievements() {
    return this.achievements.map(a => {
      const unlocked = this.unlockedAchievements.includes(a.id)
      let progressText = ''
      if (!unlocked) {
        if (!this.meetsPrerequisite(a)) {
          progressText = `首通 ${a.minWins} 关后开启`
        } else if (typeof a.progress === 'function') {
          try {
            const p = a.progress(this.stats)
            if (p && Number.isFinite(p.current) && Number.isFinite(p.target)) {
              progressText = `${Math.min(p.current, p.target)}/${p.target}`
            }
          } catch (e) {
            progressText = ''
          }
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
    // 必须按「现存成就」计数：老存档里可能残留已下线成就的 id
    // （star_10 / star_50 / star_100 / all_3star），直接数数组长度会算出 19/15 这种假进度
    const total = this.achievements.length
    const unlocked = this.getUnlockedAchievements().length
    return {
      unlocked,
      total,
      percentage: total > 0 ? (unlocked / total) * 100 : 0
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
      if (Array.isArray(saved)) {
        // 过滤掉已下线的成就 id，否则老玩家会看到「已解锁数 > 总数」
        const validIds = this.achievements.map(item => item.id)
        this.unlockedAchievements = saved.filter(id => validIds.indexOf(id) !== -1)
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
