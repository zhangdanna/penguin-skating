/**
 * 关卡管理器
 * 负责加载和管理关卡数据
 *
 * 关卡设计原则：
 * 1. 前 7 关为手工关卡，难度按“最优步数”递增：13 → 17 → 23 → 27 → 29 → 31 → 39
 * 2. 第 8 关起使用经过求解器验证的模板 + 镜像/平移生成，保证可解且障碍有效
 * 3. 所有关卡都要求“所有冰块进入目标区域”才算通关
 */

const GRID_COLS = 7
const GRID_ROWS = 9
const CELL_SIZE = 50
// 前 7 关为手工关卡，之后使用模板生成（无限关卡）
const FIRST_GENERATED_LEVEL = 8

/**
 * 手工关卡数据
 * 坐标单位为像素，与 levels/*.json 保持一致
 */
const HANDCRAFTED_LEVELS = {
  1: {
    id: 1,
    name: '初学滑冰',
    grid: { width: GRID_COLS, height: GRID_ROWS, cellSize: CELL_SIZE },
    penguin: { x: 50, y: 50 },
    stones: [{ x: 200, y: 150, size: 40 }],
    target: { x: 300, y: 400, width: 50, height: 50 },
    obstacles: [],
    par: 13,
    difficulty: 'tutorial'
  },
  2: {
    id: 2,
    name: '双石挑战',
    grid: { width: GRID_COLS, height: GRID_ROWS, cellSize: CELL_SIZE },
    penguin: { x: 50, y: 50 },
    stones: [
      { x: 250, y: 250, size: 40 },
      { x: 300, y: 250, size: 40 }
    ],
    target: { x: 250, y: 400, width: 100, height: 50 },
    obstacles: [],
    par: 17,
    difficulty: 'easy'
  },
  3: {
    id: 3,
    name: '精准推送',
    grid: { width: GRID_COLS, height: GRID_ROWS, cellSize: CELL_SIZE },
    penguin: { x: 50, y: 50 },
    stones: [
      { x: 200, y: 200, size: 40 },
      { x: 300, y: 200, size: 40 }
    ],
    target: { x: 200, y: 400, width: 150, height: 50 },
    obstacles: [
      { type: 'wall', x: 250, y: 150, size: 50 },
      { type: 'wall', x: 250, y: 100, size: 50 }
    ],
    par: 23,
    difficulty: 'easy'
  },
  4: {
    id: 4,
    name: '冰墙迷宫',
    grid: { width: GRID_COLS, height: GRID_ROWS, cellSize: CELL_SIZE },
    penguin: { x: 50, y: 50 },
    stones: [
      { x: 200, y: 200, size: 40 },
      { x: 300, y: 200, size: 40 }
    ],
    target: { x: 200, y: 400, width: 150, height: 50 },
    obstacles: [
      { type: 'wall', x: 200, y: 150, size: 50 },
      { type: 'wall', x: 200, y: 100, size: 50 }
    ],
    par: 27,
    difficulty: 'medium'
  },
  5: {
    id: 5,
    name: '危险冰窟',
    grid: { width: GRID_COLS, height: GRID_ROWS, cellSize: CELL_SIZE },
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
    ],
    par: 29,
    difficulty: 'medium'
  },
  6: {
    id: 6,
    name: '雪地减速',
    grid: { width: GRID_COLS, height: GRID_ROWS, cellSize: CELL_SIZE },
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
    ],
    par: 31,
    difficulty: 'hard'
  },
  7: {
    id: 7,
    name: '综合挑战',
    grid: { width: GRID_COLS, height: GRID_ROWS, cellSize: CELL_SIZE },
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
    ],
    par: 39,
    difficulty: 'hard'
  }
}

/**
 * 生成关卡模板（格子坐标）
 * 这些模板均已用 BFS 求解器验证可解，且障碍均会改变最优解
 */
const GENERATED_TEMPLATES = {
  // 3 块冰 + 冰墙/冰窟窿/雪堆各一，最优 39 步
  hardA: {
    penguin: { col: 1, row: 1 },
    stones: [
      { col: 4, row: 4 },
      { col: 5, row: 4 },
      { col: 6, row: 4 }
    ],
    target: { col: 4, row: 8, w: 3, h: 1 },
    obstacles: [
      { type: 'wall', col: 5, row: 5 },
      { type: 'hole', col: 5, row: 3 },
      { type: 'snow', col: 3, row: 4 }
    ]
  },
  // 3 块冰 + 冰墙 1 + 冰窟窿 2，最优 38-42 步
  hardB: {
    penguin: { col: 1, row: 1 },
    stones: [
      { col: 4, row: 4 },
      { col: 5, row: 4 },
      { col: 6, row: 4 }
    ],
    target: { col: 4, row: 8, w: 3, h: 1 },
    obstacles: [
      { type: 'wall', col: 5, row: 5 },
      { type: 'hole', col: 5, row: 3 },
      { type: 'hole', col: 4, row: 2 }
    ]
  },
  // 3 块冰 + 冰墙 1 + 雪堆 1，最优 43-45 步
  hardC: {
    penguin: { col: 1, row: 1 },
    stones: [
      { col: 4, row: 4 },
      { col: 5, row: 4 },
      { col: 6, row: 4 }
    ],
    target: { col: 4, row: 8, w: 3, h: 1 },
    obstacles: [
      { type: 'wall', col: 5, row: 5 },
      { type: 'snow', col: 4, row: 6 }
    ]
  }
}

/**
 * 模板的镜像/平移变体及对应最优步数
 * par 由离线 BFS 求解器逐一变体验证得到
 */
const TEMPLATE_VARIANTS = {
  hardA: [
    { mx: 0, my: 0, dx: -1, par: 39 },
    { mx: 0, my: 0, dx: 0, par: 39 },
    { mx: 0, my: 1, dx: -1, par: 39 },
    { mx: 0, my: 1, dx: 0, par: 39 },
    { mx: 1, my: 0, dx: 0, par: 39 },
    { mx: 1, my: 0, dx: 1, par: 39 },
    { mx: 1, my: 1, dx: 0, par: 39 },
    { mx: 1, my: 1, dx: 1, par: 39 }
  ],
  hardB: [
    { mx: 0, my: 0, dx: -1, par: 38 },
    { mx: 0, my: 0, dx: 0, par: 42 },
    { mx: 0, my: 1, dx: -1, par: 38 },
    { mx: 0, my: 1, dx: 0, par: 42 },
    { mx: 1, my: 0, dx: 0, par: 42 },
    { mx: 1, my: 0, dx: 1, par: 38 },
    { mx: 1, my: 1, dx: 0, par: 42 },
    { mx: 1, my: 1, dx: 1, par: 38 }
  ],
  hardC: [
    { mx: 0, my: 0, dx: -1, par: 43 },
    { mx: 0, my: 0, dx: 0, par: 45 },
    { mx: 0, my: 1, dx: -1, par: 43 },
    { mx: 0, my: 1, dx: 0, par: 45 },
    { mx: 1, my: 0, dx: 0, par: 45 },
    { mx: 1, my: 0, dx: 1, par: 43 },
    { mx: 1, my: 1, dx: 0, par: 45 },
    { mx: 1, my: 1, dx: 1, par: 43 }
  ]
}

/**
 * 生成关卡的分段配置
 * 难度随关卡编号阶梯上升：39 → 38-42 → 43-45
 */
const GENERATED_BANDS = [
  { maxLevel: 19, startLevel: 8, template: 'hardA' },
  { maxLevel: 39, startLevel: 20, template: 'hardB' },
  { maxLevel: Infinity, startLevel: 40, template: 'hardC' }
]

const GENERATED_NAMES = {
  hardA: '冰墙回廊',
  hardB: '裂隙迷阵',
  hardC: '极寒试炼'
}

/**
 * 应用镜像/平移变换，并转换为运行时像素坐标
 */
function transformTemplate(template, variant) {
  const { mx, my, dx } = variant
  const tx = x => (mx ? GRID_COLS - 1 - x : x) + dx
  // 目标区域是矩形，镜像时需要按矩形整体翻转，避免宽度方向错位
  const txRect = (x, width) => (mx ? GRID_COLS - x - width : x) + dx
  const ty = y => (my ? GRID_ROWS - 1 - y : y)
  const toPixel = (col, row) => ({ x: col * CELL_SIZE, y: row * CELL_SIZE })

  const targetCol = txRect(template.target.col, template.target.w)
  const targetRow = ty(template.target.row)

  return {
    penguin: toPixel(tx(template.penguin.col), ty(template.penguin.row)),
    stones: template.stones.map(stone => ({
      ...toPixel(tx(stone.col), ty(stone.row)),
      size: 40
    })),
    target: {
      ...toPixel(targetCol, targetRow),
      width: template.target.w * CELL_SIZE,
      height: template.target.h * CELL_SIZE
    },
    obstacles: template.obstacles.map(obstacle => ({
      type: obstacle.type,
      ...toPixel(tx(obstacle.col), ty(obstacle.row)),
      size: CELL_SIZE
    }))
  }
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

    // 无限关卡：第 8 关起使用模板生成
    if (levelNum >= FIRST_GENERATED_LEVEL) {
      const levelData = this.generateLevel(levelNum)
      this.levels[levelNum] = levelData
      return levelData
    }

    return new Promise((resolve, reject) => {
      const fs = wx.getFileSystemManager()
      const filePath = `${wx.env.USER_DATA_PATH}/levels/level${levelNum}.json`

      // 尝试从本地加载（本地预览会走这里）
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
    const levelData = HANDCRAFTED_LEVELS[levelNum]
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
   * 生成无限关卡
   * 采用“已验证模板 + 镜像/平移”的方式，保证关卡可解、障碍有效、步数可控
   * @param {number} levelNum - 关卡编号
   * @returns {Object} 关卡数据
   */
  generateLevel(levelNum) {
    const band = GENERATED_BANDS.find(item => levelNum <= item.maxLevel)
    const variants = TEMPLATE_VARIANTS[band.template]
    const variant = variants[(levelNum - band.startLevel) % variants.length]
    const level = transformTemplate(GENERATED_TEMPLATES[band.template], variant)

    return {
      id: levelNum,
      name: `${GENERATED_NAMES[band.template]} ${levelNum}`,
      grid: { width: GRID_COLS, height: GRID_ROWS, cellSize: CELL_SIZE },
      penguin: level.penguin,
      stones: level.stones,
      target: level.target,
      obstacles: level.obstacles,
      par: variant.par,
      difficulty: levelNum <= 39 ? 'hard' : 'expert'
    }
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
