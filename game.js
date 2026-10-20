import Background from './js/runtime/background'
import Penguin from './js/runtime/penguin'
import Stone from './js/runtime/stone'
import Target from './js/runtime/target'
import LevelManager from './js/levels/level-manager'
import { checkAABB } from './js/physics/collision'

/**
 * 游戏主类
 * 控制游戏主循环和状态管理
 */
export default class Main {
  aniId = 0
  ctx = canvas.getContext('2d')

  // 游戏对象
  background = null
  penguin = null
  stones = []
  target = null
  levelManager = new LevelManager()

  // 游戏状态
  gameState = 'playing'  // menu, playing, paused, win, fail
  currentLevel = 1
  moves = 0
  startTime = 0

  constructor() {
    this.init()
  }

  /**
   * 初始化游戏
   */
  init() {
    this.bindEvent()
    this.loadLevel(1)
    this.loop()
  }

  /**
   * 绑定触摸事件
   */
  bindEvent() {
    wx.onTouchStart(this.touchStartHandler.bind(this))
    wx.onTouchMove(this.touchMoveHandler.bind(this))
    wx.onTouchEnd(this.touchEndHandler.bind(this))
  }

  /**
   * 加载关卡
   * @param {number} levelNum - 关卡编号
   */
  async loadLevel(levelNum) {
    try {
      const levelData = await this.levelManager.loadLevel(levelNum)
      this.currentLevel = levelNum
      this.levelManager.setCurrentLevel(levelNum)

      // 创建游戏对象
      this.background = new Background(this.ctx)
      this.penguin = new Penguin(levelData.penguin)
      this.stones = levelData.stones.map(s => new Stone(s))
      this.target = new Target(levelData.target)

      // 重置状态
      this.moves = 0
      this.startTime = Date.now()
      this.gameState = 'playing'

      console.log(`关卡 ${levelNum} 加载成功: ${levelData.name}`)
    } catch (e) {
      console.error('加载关卡失败:', e)
    }
  }

  /**
   * 触摸开始处理
   */
  touchStartHandler(e) {
    if (this.gameState !== 'playing') return

    const touch = e.touches[0]
    this.penguin.handleTouchStart(touch)
  }

  /**
   * 触摸移动处理
   */
  touchMoveHandler(e) {
    if (this.gameState !== 'playing') return

    const touch = e.touches[0]
    this.penguin.handleTouchMove(touch)
  }

  /**
   * 触摸结束处理
   */
  touchEndHandler(e) {
    if (this.gameState !== 'playing') return

    // 只有企鹅停止时才记录步数
    if (!this.penguin.isMoving) {
      this.penguin.handleTouchEnd()
      this.moves++
    }
  }

  /**
   * 游戏更新
   */
  update() {
    if (this.gameState !== 'playing') return

    // 更新游戏对象
    this.penguin.update()
    this.stones.forEach(stone => stone.update())
    this.target.update()

    // 碰撞检测
    this.checkCollisions()

    // 胜利检测
    this.checkWinCondition()
  }

  /**
   * 碰撞检测
   */
  checkCollisions() {
    // 企鹅与石头碰撞
    this.stones.forEach(stone => {
      if (checkAABB(this.penguin, stone)) {
        this.penguin.pushStone(stone)
      }
    })

    // 石头与石头碰撞
    for (let i = 0; i < this.stones.length; i++) {
      for (let j = i + 1; j < this.stones.length; j++) {
        if (checkAABB(this.stones[i], this.stones[j])) {
          this.resolveStoneCollision(this.stones[i], this.stones[j])
        }
      }
    }
  }

  /**
   * 解决石头之间的碰撞
   */
  resolveStoneCollision(stoneA, stoneB) {
    // 计算重叠
    const overlapX = Math.min(
      stoneA.x + stoneA.width - stoneB.x,
      stoneB.x + stoneB.width - stoneA.x
    )
    const overlapY = Math.min(
      stoneA.y + stoneA.height - stoneB.y,
      stoneB.y + stoneB.height - stoneA.y
    )

    // 分离石头
    if (overlapX < overlapY) {
      if (stoneA.x < stoneB.x) {
        stoneA.x -= overlapX / 2
        stoneB.x += overlapX / 2
      } else {
        stoneA.x += overlapX / 2
        stoneB.x -= overlapX / 2
      }
      stoneA.vx = 0
      stoneB.vx = 0
    } else {
      if (stoneA.y < stoneB.y) {
        stoneA.y -= overlapY / 2
        stoneB.y += overlapY / 2
      } else {
        stoneA.y += overlapY / 2
        stoneB.y -= overlapY / 2
      }
      stoneA.vy = 0
      stoneB.vy = 0
    }
  }

  /**
   * 胜利检测
   */
  checkWinCondition() {
    // 检查所有石头是否都在目标位置
    const allInTarget = this.stones.every(stone => {
      const inTarget = this.target.contains(stone)
      stone.inTarget = inTarget
      return inTarget
    })

    if (allInTarget) {
      this.gameState = 'win'
      this.onWin()
    }
  }

  /**
   * 胜利处理
   */
  onWin() {
    const time = Math.floor((Date.now() - this.startTime) / 1000)
    console.log(`恭喜通关！关卡 ${this.currentLevel}，步数: ${this.moves}，时间: ${time}秒`)

    // 振动反馈
    wx.vibrateShort({ type: 'heavy' })

    // 3秒后进入下一关
    setTimeout(() => {
      const nextLevel = this.levelManager.getNextLevel()
      if (nextLevel) {
        this.loadLevel(nextLevel)
      } else {
        console.log('恭喜通关所有关卡！')
        this.loadLevel(1)  // 重新开始
      }
    }, 3000)
  }

  /**
   * 渲染游戏
   */
  render() {
    // 清屏
    this.ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 渲染背景
    this.background.render()

    // 渲染目标
    this.target.render(this.ctx)

    // 渲染石头
    this.stones.forEach(stone => stone.render(this.ctx))

    // 渲染企鹅
    this.penguin.render(this.ctx)

    // 渲染UI
    this.renderUI()
  }

  /**
   * 渲染UI
   */
  renderUI() {
    const ctx = this.ctx

    // 关卡信息
    ctx.fillStyle = '#2c3e50'
    ctx.font = '16px Arial'
    ctx.fillText(`关卡: ${this.currentLevel}`, 10, 25)
    ctx.fillText(`步数: ${this.moves}`, 10, 50)

    // 胜利提示
    if (this.gameState === 'win') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.fillStyle = '#27ae60'
      ctx.font = 'bold 32px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('通关成功！', canvas.width / 2, canvas.height / 2 - 20)

      ctx.fillStyle = '#ffffff'
      ctx.font = '18px Arial'
      ctx.fillText(`步数: ${this.moves}`, canvas.width / 2, canvas.height / 2 + 20)
      ctx.fillText('即将进入下一关...', canvas.width / 2, canvas.height / 2 + 50)
      ctx.textAlign = 'left'
    }
  }

  /**
   * 游戏主循环
   */
  loop() {
    this.aniId = requestAnimationFrame(() => {
      this.update()
      this.render()
      this.loop()
    })
  }
}

// 启动游戏
new Main()
