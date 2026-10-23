/**
 * 关卡管理器
 *
 * 关卡设计原则（C4 / C5 之后）：
 * 1. 共 60 关，全部唯一，全部经过 BFS 求解器验证可解；
 * 2. 每关都带 `optimal`（真实最优步数）与 `par = ceil(optimal × 1.2)`；
 * 3. 手工关与生成关统一按 optimal 升序重新编号，保证难度单调递增；
 * 4. 单一数据源：关卡数据只存在于本文件与 generated-levels.js，
 *    不再有"打包的 levels/*.json 从未被读取"这种双份维护。
 *
 * 手工关（1~7 的原始设计，optimal 13→39）见 HANDCRAFTED_LEVELS；
 * 生成关（第 8~60 位）由 tools/gen-levels.mjs 逆向构造 + 求解器校验后产出。
 */

import { GENERATED_LEVELS } from './generated-levels'

const GRID_COLS = 7
const GRID_ROWS = 9
const CELL_SIZE = 50

/** 总关卡数：1~60 为编排好的固定关卡，之后按镜像循环 */
const CAMPAIGN_SIZE = 60

/**
 * 手工关卡（按 originalId 索引，最终关卡号由编排决定）
 * optimal 由 tools/gen-levels.mjs 的 BFS 求解器实测得出
 */
const HANDCRAFTED_LEVELS = {
  1: {
    originalId: 1,
    name: '初学滑冰',
    difficulty: 'tutorial',
    optimal: 13,
    penguin: { x: 50, y: 50 },
    stones: [{ x: 200, y: 150, size: 40 }],
    target: { x: 300, y: 400, width: 50, height: 50 },
    obstacles: []
  },
  2: {
    originalId: 2,
    name: '双石挑战',
    difficulty: 'easy',
    optimal: 17,
    penguin: { x: 50, y: 50 },
    stones: [
      { x: 250, y: 250, size: 40 },
      { x: 300, y: 250, size: 40 }
    ],
    target: { x: 250, y: 400, width: 100, height: 50 },
    obstacles: []
  },
  3: {
    originalId: 3,
    name: '精准推送',
    difficulty: 'easy',
    optimal: 23,
    penguin: { x: 50, y: 50 },
    stones: [
      { x: 200, y: 200, size: 40 },
      { x: 300, y: 200, size: 40 }
    ],
    target: { x: 200, y: 400, width: 150, height: 50 },
    obstacles: [
      { type: 'wall', x: 250, y: 150, size: 50 },
      { type: 'wall', x: 250, y: 100, size: 50 }
    ]
  },
  4: {
    originalId: 4,
    name: '冰墙迷宫',
    difficulty: 'medium',
    optimal: 27,
    penguin: { x: 50, y: 50 },
    stones: [
      { x: 200, y: 200, size: 40 },
      { x: 300, y: 200, size: 40 }
    ],
    target: { x: 200, y: 400, width: 150, height: 50 },
    obstacles: [
      { type: 'wall', x: 200, y: 150, size: 50 },
      { type: 'wall', x: 200, y: 100, size: 50 }
    ]
  },
  5: {
    originalId: 5,
    name: '危险冰窟',
    difficulty: 'medium',
    optimal: 29,
    penguin: { x: 50, y: 50 },
    stones: [
      { x: 200, y: 200, size: 40 },
      { x: 300, y: 200, size: 40 }
    ],
    target: { x: 200, y: 400, width: 150, height: 50 },
    obstacles: [
      { type: 'hole', x: 200, y: 150, size: 50 },
      { type: 'hole', x: 200, y: 100, size: 50 },
      { type: 'hole', x: 250, y: 50, size: 50 }
    ]
  },
  6: {
    originalId: 6,
    name: '雪地减速',
    difficulty: 'hard',
    optimal: 31,
    penguin: { x: 50, y: 50 },
    stones: [
      { x: 200, y: 200, size: 40 },
      { x: 300, y: 200, size: 40 }
    ],
    target: { x: 200, y: 400, width: 150, height: 50 },
    obstacles: [
      { type: 'snow', x: 200, y: 250, size: 50 },
      { type: 'snow', x: 250, y: 200, size: 50 },
      { type: 'snow', x: 150, y: 200, size: 50 }
    ]
  },
  7: {
    originalId: 7,
    name: '综合挑战',
    difficulty: 'hard',
    optimal: 39,
    penguin: { x: 50, y: 50 },
    stones: [
      { x: 200, y: 200, size: 40 },
      { x: 250, y: 200, size: 40 },
      { x: 300, y: 200, size: 40 }
    ],
    target: { x: 200, y: 400, width: 150, height: 50 },
    obstacles: [
      { type: 'wall', x: 250, y: 250, size: 50 },
      { type: 'hole', x: 250, y: 150, size: 50 },
      { type: 'snow', x: 150, y: 200, size: 50 }
    ]
  }
}

/**
 * 标准步数：最优步数的 1.2 倍向上取整
 * 3 星不再要求"零失误"，而是"接近最优"
 * @param {number} optimal
 * @returns {number}
 */
function calcPar(optimal) {
  return Math.ceil(optimal * 1.2)
}

/**
 * 补全一个关卡的公共字段
 */
function normalize(raw, levelNum) {
  const optimal = Math.max(1, raw.optimal || 1)
  return {
    id: levelNum,
    name: raw.name || raw.baseName || `关卡 ${levelNum}`,
    difficulty: raw.difficulty || 'hard',
    optimal,
    par: raw.par || calcPar(optimal),
    grid: { width: GRID_COLS, height: GRID_ROWS, cellSize: CELL_SIZE },
    penguin: { ...raw.penguin },
    stones: raw.stones.map(s => ({ ...s })),
    target: { ...raw.target },
    obstacles: (raw.obstacles || []).map(o => ({ ...o }))
  }
}

/**
 * 编排：把手工关与生成关放在一起按 optimal 升序排列，再重新编号 1..60
 * 这样难度是单调递增的，不会出现"第 7 关 39 步、第 8 关 18 步"的断崖
 */
const CAMPAIGN = (() => {
  const pool = []

  Object.values(HANDCRAFTED_LEVELS).forEach(raw => {
    pool.push({ ...raw, _source: 'hand', _key: raw.originalId })
  })

  Object.values(GENERATED_LEVELS).forEach(raw => {
    pool.push({ ...raw, _source: 'gen', _key: raw.id })
  })

  pool.sort((a, b) => {
    if (a.optimal !== b.optimal) return a.optimal - b.optimal
    // 同分时手工关优先，其次按原始编号
    if (a._source !== b._source) return a._source === 'hand' ? -1 : 1
    return a._key - b._key
  })

  return pool.slice(0, CAMPAIGN_SIZE).map((raw, index) => {
    const levelNum = index + 1
    const name = raw._source === 'hand' ? raw.name : `${raw.baseName} ${levelNum}`
    return normalize({ ...raw, name }, levelNum)
  })
})()

export default class LevelManager {
  constructor() {
    this.levels = {}
    this.currentLevel = 1
    this.maxLevel = Infinity

    // 预填充前 60 关（纯内存查表，无 IO）
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
   * 第 61 关起：按 60 关循环，并做水平镜像制造变体
   * 说明：镜像后的盘面同样可解（推箱子的左右对称性），但难度与原关一致，
   * 不保证与原关不同名不同盘——超过 60 关属于"无尽模式"。
   * @param {number} levelNum
   * @returns {Object}
   */
  generateLevel(levelNum) {
    const baseIndex = (levelNum - 1) % CAMPAIGN.length
    const cycle = Math.floor((levelNum - 1) / CAMPAIGN.length)
    const base = CAMPAIGN[baseIndex]

    if (cycle === 0) return base

    const mirrored = cycle % 2 === 1
    return normalize({
      ...base,
      name: `${base.name}·${cycle + 1}`,
      penguin: mirrored ? mirrorPoint(base.penguin) : { ...base.penguin },
      stones: base.stones.map(s => (mirrored ? { ...s, ...mirrorPoint(s) } : { ...s })),
      target: mirrored ? mirrorRect(base.target) : { ...base.target },
      obstacles: base.obstacles.map(o => (mirrored ? { ...o, ...mirrorPoint(o) } : { ...o }))
    }, levelNum)
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
   * 获取最大关卡数
   * @returns {number}
   */
  getMaxLevel() {
    return this.maxLevel
  }

  /**
   * 已编排的固定关卡数量（60）
   * @returns {number}
   */
  getCampaignSize() {
    return CAMPAIGN.length
  }
}

/**
 * 水平镜像一个点（x 轴翻转）
 */
function mirrorPoint(point) {
  const width = GRID_COLS * CELL_SIZE
  return { x: width - point.x - CELL_SIZE, y: point.y }
}

/**
 * 水平镜像一个矩形（保持宽度）
 */
function mirrorRect(rect) {
  const width = GRID_COLS * CELL_SIZE
  return { ...rect, x: width - rect.x - rect.width }
}
