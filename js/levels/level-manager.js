/**
 * 关卡管理器
 * 负责加载和管理关卡数据
 */

const GRID_COLS = 7
const GRID_ROWS = 9
const CELL_SIZE = 50
// 前 7 关为手工关卡，之后按关卡编号程序化生成（无限关卡）
const FIRST_GENERATED_LEVEL = 8

/**
 * 固定种子的伪随机数生成器，保证同一关每次生成的布局一致
 */
function createRng(seed) {
  let state = seed >>> 0
  return function () {
    state += 0x6D2B79F5
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function cellKey(col, row) {
  return `${col},${row}`
}

export default class LevelManager {
  constructor() {
    this.levels = {}
    this.currentLevel = 1
    this.maxLevel = Infinity
  }

  /**
   * 加载关卡数据
   * @param {number} levelNum - 关卡编号
   * @returns {Promise<Object>} 关卡数据
   */
  async loadLevel(levelNum) {
    if (this.levels[levelNum]) {
      return this.levels[levelNum]
    }

    // 无限关卡：第 8 关起程序化生成
    if (levelNum >= FIRST_GENERATED_LEVEL) {
      const levelData = this.generateLevel(levelNum)
      this.levels[levelNum] = levelData
      return levelData
    }

    return new Promise((resolve, reject) => {
      const fs = wx.getFileSystemManager()
      const filePath = `${wx.env.USER_DATA_PATH}/levels/level${levelNum}.json`

      // 尝试从本地加载
      fs.readFile({
        filePath: filePath,
        encoding: 'utf8',
        success: (res) => {
          const levelData = JSON.parse(res.data)
          this.levels[levelNum] = levelData
          resolve(levelData)
        },
        fail: () => {
          // 本地加载失败，使用内置关卡
          this.loadBuiltinLevel(levelNum).then(resolve).catch(reject)
        }
      })
    })
  }

  /**
   * 加载内置关卡
   * @param {number} levelNum - 关卡编号
   * @returns {Promise<Object>} 关卡数据
   */
  async loadBuiltinLevel(levelNum) {
    // 内置关卡数据（简化版，实际应该从文件加载）
    const builtinLevels = {
      1: {
        id: 1,
        name: '初学滑冰',
        penguin: { x: 50, y: 50 },
        stones: [{ x: 200, y: 150, size: 40 }],
        target: { x: 300, y: 400, width: 50, height: 50 },
        obstacles: [],
        par: 3
      },
      2: {
        id: 2,
        name: '双石挑战',
        penguin: { x: 50, y: 50 },
        stones: [
          { x: 150, y: 200, size: 40 },
          { x: 250, y: 250, size: 40 }
        ],
        target: { x: 300, y: 400, width: 50, height: 50 },
        obstacles: [],
        par: 5
      },
      3: {
        id: 3,
        name: '精准推送',
        penguin: { x: 50, y: 50 },
        stones: [
          { x: 200, y: 100, size: 40 },
          { x: 100, y: 250, size: 40 },
          { x: 300, y: 200, size: 40 }
        ],
        target: { x: 300, y: 400, width: 50, height: 50 },
        obstacles: [],
        par: 8
      },
      4: {
        id: 4,
        name: '冰墙迷宫',
        penguin: { x: 50, y: 50 },
        stones: [{ x: 200, y: 150, size: 40 }],
        target: { x: 300, y: 400, width: 50, height: 50 },
        obstacles: [
          { type: 'wall', x: 100, y: 100, size: 50 },
          { type: 'wall', x: 150, y: 100, size: 50 },
          { type: 'wall', x: 200, y: 100, size: 50 },
          { type: 'wall', x: 100, y: 200, size: 50 },
          { type: 'wall', x: 250, y: 250, size: 50 },
          { type: 'wall', x: 300, y: 250, size: 50 }
        ],
        par: 5
      },
      5: {
        id: 5,
        name: '危险冰窟',
        penguin: { x: 50, y: 50 },
        stones: [
          { x: 150, y: 150, size: 40 },
          { x: 250, y: 200, size: 40 }
        ],
        target: { x: 300, y: 400, width: 50, height: 50 },
        obstacles: [
          { type: 'hole', x: 150, y: 250, size: 50 },
          { type: 'hole', x: 250, y: 300, size: 50 },
          { type: 'hole', x: 100, y: 350, size: 50 }
        ],
        par: 6
      },
      6: {
        id: 6,
        name: '雪地减速',
        penguin: { x: 50, y: 50 },
        stones: [
          { x: 200, y: 150, size: 40 },
          { x: 150, y: 250, size: 40 }
        ],
        target: { x: 300, y: 400, width: 50, height: 50 },
        obstacles: [
          { type: 'snow', x: 100, y: 150, size: 50 },
          { type: 'snow', x: 150, y: 150, size: 50 },
          { type: 'snow', x: 200, y: 300, size: 50 },
          { type: 'snow', x: 250, y: 300, size: 50 },
          { type: 'snow', x: 300, y: 300, size: 50 }
        ],
        par: 7
      },
      7: {
        id: 7,
        name: '综合挑战',
        penguin: { x: 50, y: 50 },
        stones: [
          { x: 150, y: 100, size: 40 },
          { x: 250, y: 150, size: 40 },
          { x: 100, y: 250, size: 40 }
        ],
        target: { x: 300, y: 400, width: 50, height: 50 },
        obstacles: [
          { type: 'wall', x: 200, y: 200, size: 50 },
          { type: 'wall', x: 250, y: 200, size: 50 },
          { type: 'hole', x: 150, y: 300, size: 50 },
          { type: 'hole', x: 200, y: 350, size: 50 },
          { type: 'snow', x: 100, y: 150, size: 50 },
          { type: 'snow', x: 300, y: 250, size: 50 }
        ],
        par: 10
      }
    }

    const levelData = builtinLevels[levelNum]
    if (levelData) {
      this.levels[levelNum] = levelData
      return levelData
    }

    // 超出内置关卡范围时自动生成
    const generated = this.generateLevel(levelNum)
    this.levels[levelNum] = generated
    return generated
  }

  /**
   * 程序化生成无限关卡
   * 采用"从目标反向预留竖直推箱通道"的构造方式，保证每关一定可解
   * @param {number} levelNum - 关卡编号
   * @returns {Object} 关卡数据
   */
  generateLevel(levelNum) {
    const rng = createRng(levelNum * 7919 + 17)
    const tier = Math.min(5, Math.floor((levelNum - FIRST_GENERATED_LEVEL) / 4))

    for (let attempt = 0; attempt < 60; attempt++) {
      // 目标位于下半区
      const targetCol = 1 + Math.floor(rng() * (GRID_COLS - 2))
      const targetRow = 6 + Math.floor(rng() * (GRID_ROWS - 6))

      // 石头在目标同列上方，推动距离随难度增加
      const maxPush = Math.min(4, 1 + tier)
      const pushDistance = 1 + Math.floor(rng() * maxPush)
      const stoneRow = targetRow - pushDistance
      if (stoneRow < 1) continue

      // 解法通道：推位 -> 石头 -> 目标，通道内不放障碍
      const corridor = new Set()
      for (let row = stoneRow - 1; row <= targetRow; row++) {
        corridor.add(cellKey(targetCol, row))
      }
      const stoneKey = cellKey(targetCol, stoneRow)
      corridor.add(stoneKey)

      // 随机障碍，避开解法通道
      const obstacleCount = Math.min(12, 2 + Math.floor((levelNum - FIRST_GENERATED_LEVEL) * 0.6) + tier)
      const obstacles = []
      const occupied = new Set(corridor)
      let guard = 0

      while (obstacles.length < obstacleCount && guard < 300) {
        guard++
        const col = Math.floor(rng() * GRID_COLS)
        const row = Math.floor(rng() * GRID_ROWS)
        const key = cellKey(col, row)
        if (occupied.has(key)) continue
        occupied.add(key)

        const roll = rng()
        const type = roll < 0.55 ? 'wall' : roll < 0.85 ? 'hole' : 'snow'
        obstacles.push({
          type,
          x: col * CELL_SIZE,
          y: row * CELL_SIZE,
          size: CELL_SIZE
        })
      }

      // 企鹅行走时不可穿墙、不可踩洞；石头所在格也视为占用
      const walkBlocked = new Set([stoneKey])
      obstacles.forEach(obstacle => {
        if (obstacle.type === 'wall' || obstacle.type === 'hole') {
          walkBlocked.add(cellKey(obstacle.x / CELL_SIZE, obstacle.y / CELL_SIZE))
        }
      })

      const pushCol = targetCol
      const pushRow = stoneRow - 1
      if (walkBlocked.has(cellKey(pushCol, pushRow))) continue

      const start = this.findReachableStart(pushCol, pushRow, walkBlocked, 2, rng)
      if (!start) continue

      return {
        id: levelNum,
        name: `冰原挑战 ${levelNum}`,
        grid: { width: GRID_COLS, height: GRID_ROWS, cellSize: CELL_SIZE },
        penguin: { x: start.col * CELL_SIZE, y: start.row * CELL_SIZE },
        stones: [{ x: targetCol * CELL_SIZE, y: stoneRow * CELL_SIZE, size: 40 }],
        target: { x: targetCol * CELL_SIZE, y: targetRow * CELL_SIZE, width: CELL_SIZE, height: CELL_SIZE },
        obstacles,
        par: start.distance + pushDistance,
        difficulty: 'easy'
      }
    }

    // 保底关卡：直线推一块冰，确保任何情况下都能继续
    return {
      id: levelNum,
      name: `冰原挑战 ${levelNum}`,
      grid: { width: GRID_COLS, height: GRID_ROWS, cellSize: CELL_SIZE },
      penguin: { x: 0, y: 0 },
      stones: [{ x: 3 * CELL_SIZE, y: 7 * CELL_SIZE, size: 40 }],
      target: { x: 3 * CELL_SIZE, y: 8 * CELL_SIZE, width: CELL_SIZE, height: CELL_SIZE },
      obstacles: [],
      par: 10,
      difficulty: 'easy'
    }
  }

  /**
   * 从推位出发做 BFS，随机选一个可达且不太近的企鹅起点
   * @returns {Object|null} {col, row, distance}
   */
  findReachableStart(startCol, startRow, blocked, minDistance, rng) {
    const distances = Array.from({ length: GRID_ROWS }, () => new Array(GRID_COLS).fill(-1))
    const queue = [[startCol, startRow]]
    distances[startRow][startCol] = 0
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]]

    while (queue.length > 0) {
      const [col, row] = queue.shift()
      const distance = distances[row][col]

      for (const [dc, dr] of directions) {
        const nextCol = col + dc
        const nextRow = row + dr
        if (nextCol < 0 || nextCol >= GRID_COLS || nextRow < 0 || nextRow >= GRID_ROWS) continue
        if (distances[nextRow][nextCol] !== -1) continue
        if (blocked.has(cellKey(nextCol, nextRow))) continue

        distances[nextRow][nextCol] = distance + 1
        queue.push([nextCol, nextRow])
      }
    }

    const candidates = []
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (distances[row][col] >= minDistance) {
          candidates.push({ col, row, distance: distances[row][col] })
        }
      }
    }

    if (candidates.length === 0) return null
    return candidates[Math.floor(rng() * candidates.length)]
  }

  /**
   * 获取关卡数据（同步）
   * @param {number} levelNum - 关卡编号
   * @returns {Object} 关卡数据
   */
  getLevel(levelNum) {
    return this.levels[levelNum]
  }

  /**
   * 设置当前关卡
   * @param {number} levelNum - 关卡编号
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
}
