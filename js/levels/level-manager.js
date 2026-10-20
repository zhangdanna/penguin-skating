/**
 * 关卡管理器
 * 负责加载和管理关卡数据
 */
export default class LevelManager {
  constructor() {
    this.levels = {}
    this.currentLevel = 1
    this.maxLevel = 7
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

    throw new Error(`关卡 ${levelNum} 不存在`)
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
   * 获取下一关编号
   * @returns {number|null} 下一关编号，如果已是最后一关则返回null
   */
  getNextLevel() {
    if (this.currentLevel < this.maxLevel) {
      return this.currentLevel + 1
    }
    return null
  }

  /**
   * 获取最大关卡数
   * @returns {number}
   */
  getMaxLevel() {
    return this.maxLevel
  }
}
