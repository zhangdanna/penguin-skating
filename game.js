import Background from './js/runtime/background'
import Penguin from './js/runtime/penguin'
import Stone from './js/runtime/stone'
import Target from './js/runtime/target'
import LevelManager from './js/levels/level-manager'
import { checkAABB } from './js/physics/collision'

// UI组件
import SceneManager from './js/ui/scene-manager'
import MenuScene from './js/ui/menu-scene'
import LevelSelectScene from './js/ui/level-select-scene'
import PauseScene from './js/ui/pause-scene'
import ResultScene from './js/ui/result-scene'
import GameHUD from './js/ui/game-hud'

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

  // UI系统
  sceneManager = new SceneManager()
  pauseScene = null
  resultScene = null
  gameHUD = null

  // 游戏状态
  gameState = 'menu'  // menu, levelSelect, playing, paused, win, fail
  currentLevel = 1
  moves = 0
  startTime = 0
  isPaused = false

  constructor() {
    this.init()
  }

  /**
   * 初始化游戏
   */
  init() {
    this.initUI()
    this.bindEvent()
    this.loop()

    // 进入主菜单
    this.sceneManager.switchTo('menu')
  }

  /**
   * 初始化UI系统
   */
  initUI() {
    // 注册场景
    this.sceneManager.register('menu', new MenuScene(this.sceneManager))
    this.sceneManager.register('levelSelect', new LevelSelectScene(this.sceneManager))

    // 创建暂停和结算场景（覆盖层）
    this.pauseScene = new PauseScene(this.sceneManager)
    this.pauseScene.onResume = () => this.resumeGame()
    this.pauseScene.onRestart = () => this.restartLevel()

    this.resultScene = new ResultScene(this.sceneManager)
    this.resultScene.onNextLevel = () => this.nextLevel()
    this.resultScene.onReplay = () => this.restartLevel()

    // 创建游戏HUD
    this.gameHUD = new GameHUD()
    this.gameHUD.onPauseClick = () => this.pauseGame()
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
      this.isPaused = false

      // 更新HUD
      this.gameHUD.setLevelInfo(levelNum, levelData.par)
      this.gameHUD.setMoves(0)

      console.log(`关卡 ${levelNum} 加载成功: ${levelData.name}`)
    } catch (e) {
      console.error('加载关卡失败:', e)
    }
  }

  /**
   * 暂停游戏
   */
  pauseGame() {
    if (this.gameState !== 'playing') return
    this.gameState = 'paused'
    this.isPaused = true
    this.pauseScene.show()
  }

  /**
   * 恢复游戏
   */
  resumeGame() {
    this.gameState = 'playing'
    this.isPaused = false
    this.pauseScene.hide()
  }

  /**
   * 重新开始关卡
   */
  restartLevel() {
    this.loadLevel(this.currentLevel)
  }

  /**
   * 进入下一关
   */
  nextLevel() {
    const nextLevel = this.levelManager.getNextLevel()
    if (nextLevel) {
      this.loadLevel(nextLevel)
    } else {
      console.log('恭喜通关所有关卡！')
      this.sceneManager.switchTo('menu')
    }
  }

  /**
   * 触摸开始处理
   */
  touchStartHandler(e) {
    const touch = e.touches[0]

    // 优先处理暂停场景
    if (this.isPaused) {
      this.pauseScene.onTouchStart(touch)
      return
    }

    // 处理结算场景
    if (this.gameState === 'win') {
      this.resultScene.onTouchStart(touch)
      return
    }

    // 处理HUD（暂停按钮）
    if (this.gameState === 'playing') {
      if (this.gameHUD.onTouchStart(touch)) {
        return
      }
    }

    // 处理当前场景
    this.sceneManager.onTouchStart(touch)

    // 处理游戏操作
    if (this.gameState === 'playing' && this.penguin) {
      this.penguin.handleTouchStart(touch)
    }
  }

  /**
   * 触摸移动处理
   */
  touchMoveHandler(e) {
    const touch = e.touches[0]

    // 优先处理暂停场景
    if (this.isPaused) {
      this.pauseScene.onTouchMove(touch)
      return
    }

    // 处理结算场景
    if (this.gameState === 'win') {
      this.resultScene.onTouchMove(touch)
      return
    }

    // 处理当前场景
    this.sceneManager.onTouchMove(touch)

    // 处理游戏操作
    if (this.gameState === 'playing' && this.penguin) {
      this.penguin.handleTouchMove(touch)
    }
  }

  /**
   * 触摸结束处理
   */
  touchEndHandler(e) {
    const touch = e.changedTouches[0]

    // 优先处理暂停场景
    if (this.isPaused) {
      this.pauseScene.onTouchEnd(touch)
      return
    }

    // 处理结算场景
    if (this.gameState === 'win') {
      this.resultScene.onTouchEnd(touch)
      return
    }

    // 处理HUD（暂停按钮）
    if (this.gameState === 'playing') {
      if (this.gameHUD.onTouchEnd(touch)) {
        return
      }
    }

    // 处理当前场景
    this.sceneManager.onTouchEnd(touch)

    // 处理游戏操作
    if (this.gameState === 'playing' && this.penguin) {
      // 只有企鹅停止时才记录步数
      if (!this.penguin.isMoving) {
        this.penguin.handleTouchEnd()
        this.moves++
        this.gameHUD.setMoves(this.moves)
      }
    }
  }

  /**
   * 游戏更新
   */
  update() {
    // 更新当前场景
    this.sceneManager.update()

    // 更新暂停场景
    if (this.isPaused) {
      this.pauseScene.update()
      return
    }

    // 更新结算场景
    if (this.gameState === 'win') {
      this.resultScene.update()
      return
    }

    // 更新游戏逻辑
    if (this.gameState !== 'playing') return

    // 更新游戏对象
    this.penguin.update()
    this.stones.forEach(stone => stone.update())
    this.target.update()

    // 碰撞检测
    this.checkCollisions()

    // 胜利检测
    this.checkWinCondition()

    // 更新HUD时间
    const currentTime = Math.floor((Date.now() - this.startTime) / 1000)
    this.gameHUD.setTime(currentTime)
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
    const overlapX = Math.min(
      stoneA.x + stoneA.width - stoneB.x,
      stoneB.x + stoneB.width - stoneA.x
    )
    const overlapY = Math.min(
      stoneA.y + stoneA.height - stoneB.y,
      stoneB.y + stoneB.height - stoneA.y
    )

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

    // 保存关卡进度
    this.saveLevelProgress()

    // 显示结算界面
    this.resultScene.setResult(this.currentLevel, this.moves, 3, time)
    this.resultScene.show()
  }

  /**
   * 保存关卡进度
   */
  saveLevelProgress() {
    try {
      // 计算星级
      const levelData = this.levelManager.getLevel(this.currentLevel)
      const par = levelData ? levelData.par : 3
      let stars = 1
      if (this.moves <= par) stars = 3
      else if (this.moves <= par * 1.5) stars = 2

      // 保存当前关卡星级
      wx.setStorageSync(`level_${this.currentLevel}`, {
        stars: stars,
        moves: this.moves,
        timestamp: Date.now()
      })

      // 更新解锁关卡
      const progress = wx.getStorageSync('gameProgress') || { unlockedLevel: 1, currentLevel: 1 }
      if (this.currentLevel >= progress.unlockedLevel) {
        progress.unlockedLevel = this.currentLevel + 1
      }
      progress.currentLevel = this.currentLevel
      wx.setStorageSync('gameProgress', progress)

    } catch (e) {
      console.error('保存进度失败:', e)
    }
  }

  /**
   * 渲染游戏
   */
  render() {
    // 清屏
    this.ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 根据当前场景渲染
    const currentSceneName = this.sceneManager.getCurrentSceneName()

    if (currentSceneName === 'menu' || currentSceneName === 'levelSelect') {
      // 渲染UI场景
      this.sceneManager.render(this.ctx)
    } else {
      // 渲染游戏场景
      this.renderGame()
    }

    // 渲染暂停场景（覆盖层）
    if (this.isPaused) {
      this.pauseScene.render(this.ctx)
    }

    // 渲染结算场景（覆盖层）
    if (this.gameState === 'win') {
      this.resultScene.render(this.ctx)
    }
  }

  /**
   * 渲染游戏场景
   */
  renderGame() {
    // 渲染背景
    if (this.background) {
      this.background.render()
    }

    // 渲染目标
    if (this.target) {
      this.target.render(this.ctx)
    }

    // 渲染石头
    this.stones.forEach(stone => stone.render(this.ctx))

    // 渲染企鹅
    if (this.penguin) {
      this.penguin.render(this.ctx)
    }

    // 渲染HUD
    if (this.gameState === 'playing' || this.gameState === 'win') {
      this.gameHUD.render(this.ctx)
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
