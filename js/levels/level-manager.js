/**
 * 关卡管理器
 *
 * 设计原则（G1 难度重做）：
 * 1. 标准步数 par **等于**最优步数 optimal —— 3 星必须走出最优解，
 *    不再有 20% 的容错。奖励公式不变，只是 par 这个输入变严了。
 * 2. 关卡无上限：1~BAKED_SIZE 由 tools/gen-levels.mjs 烘焙进
 *    generated-levels.js；之后的关卡在运行时按 levelNum 确定性生成，
 *    同一关永远同一个盘面（seed 只由关卡号派生）。
 * 3. 难度严格单调：烘焙时按 optimal 全局排序，运行时按难度档递进，
 *    不再出现「第 61 关镜像回第 1 关」这种循环。
 *
 * 生成器的实现在 js/levels/level-generator.js，离线烘焙与运行时共用同一份。
 */

import { GENERATED_LEVELS } from './generated-levels'
import {
  COLS,
  ROWS,
  CELL_SIZE,
  generateLevelBoard,
  boardToLevelData,
  levelDataSignature,
  getBandForLevel
} from './level-generator'

const GRID_COLS = COLS
const GRID_ROWS = ROWS

/** 预烘焙的关卡数量（= generated-levels.js 里的条目数），之后的关卡运行时生成 */
const BAKED_SIZE = Object.keys(GENERATED_LEVELS).length

/**
 * 标准步数
 *
 * G1 之前是 ceil(optimal × 1.2)：3 星只要"接近最优"，随手走也能拿三星，
 * 关卡设计得再难也没有意义。现在直接取最优步数。
 */
function calcPar(optimal) {
  return Math.max(1, Math.round(optimal) || 1)
}

/**
 * 目标区兜底纠正：格数必须等于冰块数
 *
 * 数据来源有三条（烘焙产物 / 运行时生成 / 早期版本的旧包），任何一条
 * 出现「目标格比冰块多」，玩家都会当成 bug —— 多出来的空格永远填不满，
 * 场上却只有这么多块冰。烘焙器已经用 fitTargetSize 保证过了，这里再兜
 * 一道：万一跑到旧数据，也不会把坏盘面摆到玩家面前。
 *
 * 纠正时保持原有朝向（竖排继续竖排），并把矩形夹回棋盘内。
 *
 * @param {Object} target - { x, y, width, height }
 * @param {number} stoneCount
 * @returns {Object}
 */
export function fitTargetRect(target, stoneCount) {
  const cols = Math.max(1, Math.round(target.width / CELL_SIZE))
  const rows = Math.max(1, Math.round(target.height / CELL_SIZE))
  if (cols * rows === stoneCount) return { ...target }

  const nextCols = rows > cols ? 1 : stoneCount
  const nextRows = rows > cols ? stoneCount : 1
  const width = nextCols * CELL_SIZE
  const height = nextRows * CELL_SIZE

  return {
    ...target,
    width,
    height,
    x: Math.min(Math.max(0, target.x), GRID_COLS * CELL_SIZE - width),
    y: Math.min(Math.max(0, target.y), GRID_ROWS * CELL_SIZE - height)
  }
}

/**
 * 补全一个关卡的公共字段
 */
function normalize(raw, levelNum) {
  const optimal = Math.max(1, Math.round(raw.optimal) || 1)
  const stones = raw.stones.map(s => ({ ...s }))
  return {
    id: levelNum,
    name: raw.name || `关卡 ${levelNum}`,
    difficulty: raw.difficulty || getBandForLevel(levelNum).difficulty,
    optimal,
    par: calcPar(optimal),
    grid: { width: GRID_COLS, height: GRID_ROWS, cellSize: CELL_SIZE },
    penguin: { ...raw.penguin },
    stones,
    target: fitTargetRect(raw.target, stones.length),
    obstacles: (raw.obstacles || []).map(o => ({ ...o }))
  }
}

/**
 * 烘焙关卡（已按 optimal 升序编号）
 */
const CAMPAIGN = Object.keys(GENERATED_LEVELS)
  .map(Number)
  .sort((a, b) => a - b)
  .map(id => normalize(GENERATED_LEVELS[id], id))

/** 烘焙关卡里的最高最优步数，作为无尽关卡的难度起点 */
const BAKED_MAX_OPTIMAL = CAMPAIGN.length > 0
  ? CAMPAIGN[CAMPAIGN.length - 1].optimal
  : 20

/**
 * 生成彻底失败时的兜底盘面
 *
 * 三步就能通关，但至少让玩家能玩、能过，绝不允许卡在空关卡上。
 * 正常流程里不应该走到这里 —— generateLevelBoard 内部会试十几个候选。
 */
function buildFallbackLevel(levelNum) {
  return normalize({
    name: '冰面尽头',
    difficulty: getBandForLevel(levelNum).difficulty,
    optimal: 3,
    penguin: { x: 150, y: 400 },
    stones: [{ x: 150, y: 300, size: 40 }],
    target: { x: 150, y: 200, width: 50, height: 50 },
    obstacles: []
  }, levelNum)
}

export default class LevelManager {
  constructor() {
    this.levels = {}
    this.currentLevel = 1
    this.maxLevel = Infinity

    /** 运行时已生成的盘面签名，用于跨关卡去重 */
    this.generatedSignatures = new Set()
    /** 烘焙关卡的签名（首次需要时才算，200 关也就几毫秒） */
    this.bakedSignatures = null

    CAMPAIGN.forEach(level => {
      this.levels[level.id] = level
    })
  }

  /**
   * 加载关卡数据
   * 关卡表已在内存里，保留 async 签名以兼容调用方
   * @param {number} levelNum
   * @returns {Promise<Object>}
   */
  async loadLevel(levelNum) {
    return this.getLevel(levelNum)
  }

  /**
   * 获取关卡数据（同步）
   * @param {number} levelNum
   * @returns {Object}
   */
  getLevel(levelNum) {
    if (this.levels[levelNum]) return this.levels[levelNum]

    const level = this.generateLevel(levelNum)
    this.levels[levelNum] = level
    return level
  }

  /**
   * 第 BAKED_SIZE+1 关起：运行时确定性生成
   *
   * seed 只由 levelNum 派生，所以玩家重玩、换设备看到的都是同一张图；
   * 生成结果同时写进 this.levels 缓存，同一关只算一次。
   *
   * @param {number} levelNum
   * @returns {Object}
   */
  generateLevel(levelNum) {
    const seen = this.getSeenSignatures()
    const floor = this.getOptimalFloor(levelNum)

    // 多试几个派生 seed：单次生成最多 14 个候选，撞不到下界时换个 seed
    // 再来，比单纯加大 maxAttempts 更容易命中高步数盘面。
    let best = null
    for (let round = 0; round < 3; round++) {
      const board = generateLevelBoard(levelNum, {
        seen,
        minOptimal: floor,
        seedSalt: round
      })
      if (!board) continue
      if (!best || board.optimal > best.optimal) best = board
      if (best.optimal >= floor) break
    }

    if (!best) {
      console.warn(`第 ${levelNum} 关生成失败，使用兜底盘面`)
      return buildFallbackLevel(levelNum)
    }

    this.generatedSignatures.add(best.signature || levelDataSignature(best))
    return normalize(boardToLevelData(best, levelNum, getBandForLevel(levelNum)), levelNum)
  }

  /**
   * 最优步数下界：后面的关不允许比前面简单
   *
   * 7×9 棋盘的最优步数天花板在 50 附近，难度档递进到后期会撞到上限。
   * 下界**不能**简单地取「前一关 - 2」：某一关生成失败会把下界拉低，
   * 后面几十关跟着一路往下掉（实测 201~230 从 31 掉到 20）。
   * 所以用一个固定地板（烘焙末关 - 8），只在明显超出时才跟着抬。
   *
   * @param {number} levelNum
   * @returns {number}
   */
  getOptimalFloor(levelNum) {
    if (levelNum <= BAKED_SIZE) return 0
    const floor = Math.max(1, BAKED_MAX_OPTIMAL - 8)
    const prev = this.levels[levelNum - 1]
    if (!prev) return floor
    return Math.max(floor, prev.optimal - 2)
  }

  /**
   * 已知盘面签名：烘焙关 + 本次运行已生成的
   * @returns {Set<string>}
   */
  getSeenSignatures() {
    if (!this.bakedSignatures) {
      this.bakedSignatures = new Set()
      CAMPAIGN.forEach(level => {
        this.bakedSignatures.add(levelDataSignature(level))
      })
    }

    if (this.generatedSignatures.size === 0) return this.bakedSignatures

    const merged = new Set(this.bakedSignatures)
    this.generatedSignatures.forEach(sig => merged.add(sig))
    return merged
  }

  /**
   * 设置当前关卡
   * @param {number} levelNum
   */
  setCurrentLevel(levelNum) {
    this.currentLevel = levelNum
  }

  /**
   * 获取下一关编号（关卡无限）
   * @returns {number}
   */
  getNextLevel() {
    return this.currentLevel + 1
  }

  /**
   * 获取最大关卡数（Infinity = 无上限）
   * @returns {number}
   */
  getMaxLevel() {
    return this.maxLevel
  }

  /**
   * 预烘焙的关卡数量
   * @returns {number}
   */
  getCampaignSize() {
    return CAMPAIGN.length
  }
}
