import Background from './js/runtime/background'
import Penguin from './js/runtime/penguin'
import Stone from './js/runtime/stone'
import Target from './js/runtime/target'
import LevelManager from './js/levels/level-manager'
import { ObstacleFactory } from './js/runtime/obstacle'
import AudioManager from './js/utils/audio-manager'
import WechatService from './js/utils/wechat-service'
import FoodManager from './js/utils/food-manager'
import AchievementManager from './js/utils/achievement-manager'
import ReviveManager from './js/utils/revive-manager'
import SettlementManager from './js/utils/settlement-manager'

// UI组件
import SceneManager from './js/ui/scene-manager'
import MenuScene from './js/ui/menu-scene'
import PauseScene from './js/ui/pause-scene'
import ResultScene from './js/ui/result-scene'
import GameOverScene from './js/ui/gameover-scene'
import LoginScene from './js/ui/login-scene'
import RankScene from './js/ui/rank-scene'
import AchievementScene from './js/ui/achievement-scene'
import AchievementNotification from './js/ui/achievement-notification'
import ReviveScene from './js/ui/revive-scene'
import GameHUD from './js/ui/game-hud'
import FoodDisplay from './js/ui/food-display'
import GameScene from './js/ui/game-scene'

// 棋盘配置：7列×9行，每格50px，整体居中
const CELL_SIZE = 50
const GRID_COLS = 7
const GRID_ROWS = 9
const BOARD_OFFSET_X = Math.round((canvas.width - GRID_COLS * CELL_SIZE) / 2)
const BOARD_OFFSET_Y = Math.round((canvas.height - GRID_ROWS * CELL_SIZE) / 2)

// 滑动方向对应的一格位移
const DIRECTION_STEP = {
  up: { col: 0, row: -1 },
  down: { col: 0, row: 1 },
  left: { col: -1, row: 0 },
  right: { col: 1, row: 0 }
}

/**
 * 游戏主类
 * 控制游戏主循环和状态管理
 */
export default class Main {
  constructor() {
    this.aniId = 0
    this.ctx = canvas.getContext('2d')

    // 游戏对象
    this.background = null
    this.penguin = null
    this.stones = []
    this.target = null
    this.obstacles = []  // 障碍物数组
    this.levelManager = new LevelManager()

    // UI系统
    this.sceneManager = new SceneManager()
    this.pauseScene = null
    this.resultScene = null
    this.loginScene = null
    this.rankScene = null
    this.gameHUD = null

    // 音效系统
    this.audioManager = null

    // 微信服务
    this.wechatService = null

    // 食物系统
    this.foodManager = null
    this.foodDisplay = null

    // 成就系统
    this.achievementManager = null
    this.achievementScene = null
    this.achievementNotification = null

    // 复活系统
    this.reviveManager = null
    this.reviveScene = null

    // 结算系统
    this.settlementManager = null
    this.gameOverScene = null

    // 游戏状态
    this.gameState = 'menu'  // menu, playing, paused, win, fail
    this.currentLevel = 1
    this.moves = 0
    this.startTime = 0
    this.isPaused = false

    this.init()
  }

  /**
   * 初始化游戏
   */
  init() {
    this.initWechat()
    this.initAudio()
    this.initFood()
    this.initAchievement()
    this.initRevive()
    this.initSettlement()
    this.initUI()
    this.bindEvent()
    this.loop()

    // 进入主菜单
    this.sceneManager.switchTo('menu')

    // 播放背景音乐
    this.audioManager.playBGM()
  }

  /**
   * 初始化微信服务
   */
  initWechat() {
    this.wechatService = new WechatService()
    this.wechatService.init()
  }

  /**
   * 初始化音效系统
   */
  initAudio() {
    this.audioManager = new AudioManager()
  }

  /**
   * 初始化食物系统
   */
  initFood() {
    this.foodManager = new FoodManager()
    this.foodDisplay = new FoodDisplay(this.foodManager)
    // 顶部信息面板内，与关卡信息上下排列
    this.foodDisplay.setPosition(8, 6)
    this.foodDisplay.setSize(canvas.width - 16)
  }

  /**
   * 初始化成就系统
   */
  initAchievement() {
    this.achievementManager = new AchievementManager()
    this.achievementScene = new AchievementScene(this.achievementManager, () => {
      this.sceneManager.switchTo('menu')
    })
    this.achievementNotification = new AchievementNotification()

    // 设置分享奖励回调
    if (this.wechatService) {
      this.wechatService.setShareRewardCallback(() => {
        this.onShareReward()
      })
    }
  }

  /**
   * 初始化复活系统
   */
  initRevive() {
    this.reviveManager = new ReviveManager()
    this.reviveScene = new ReviveScene(this.reviveManager, this.foodManager, this.wechatService)
    this.reviveScene.onReviveSuccess = (result) => this.onReviveSuccess(result)
    this.reviveScene.onGiveUp = () => this.onReviveGiveUp()
  }

  /**
   * 初始化结算系统
   */
  initSettlement() {
    this.settlementManager = new SettlementManager()
    this.gameOverScene = new GameOverScene()
    this.gameOverScene.onRestart = () => this.onGameOverRestart()
    this.gameOverScene.onBackToMenu = () => this.onGameOverBackToMenu()
    this.gameOverScene.onWatchAd = () => this.onGameOverWatchAd()
  }

  /**
   * 初始化UI系统
   */
  initUI() {
    // 注册场景
    this.sceneManager.register('menu', new MenuScene(this.sceneManager))

    // 创建登录和排行榜场景
    this.loginScene = new LoginScene(this.sceneManager, this.wechatService)
    this.sceneManager.register('login', this.loginScene)

    this.rankScene = new RankScene(this.sceneManager, this.wechatService)
    this.sceneManager.register('rank', this.rankScene)

    // 注册成就场景
    this.sceneManager.register('achievement', this.achievementScene)

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
    this.gameHUD.onRestartClick = () => this.restartLevel()
    this.gameHUD.onBackClick = () => this.backToMenu()
    
    // 注册游戏主场景
    this.gameScene = new GameScene(this)
    this.sceneManager.register('game', this.gameScene)
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
   * 开始关卡（供GameScene调用）
   * @param {number} levelNum - 关卡编号
   */
  startLevel(levelNum) {
    console.log(`[Game] 开始关卡: ${levelNum}`)
    this.loadLevel(levelNum)
  }

  /**
   * 加载关卡
   * @param {number} levelNum - 关卡编号
   */
  async loadLevel(levelNum) {
    try {
      const levelData = await this.levelManager.loadLevel(levelNum)

      // 检查并消耗食物
      const difficulty = levelData.difficulty || 'easy'
      const cost = this.foodManager.getLevelCost(difficulty)

      if (cost > 0 && !this.foodManager.hasEnoughFood(cost)) {
        wx.showModal({
          title: '食物不足',
          content: `需要 ${cost}🐟 才能开始关卡，是否观看广告获取食物？`,
          confirmText: '看广告',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              // TODO: 显示广告
              wx.showToast({ title: '广告功能待实现', icon: 'none' })
            }
          }
        })
        // 无法开战时回到菜单，避免停留在空白的游戏场景
        this.sceneManager.switchTo('menu')
        return
      }

      // 消耗食物
      if (cost > 0) {
        this.foodManager.consumeFood(cost)
        console.log(`消耗食物: ${cost}🐟`)
      }

      this.currentLevel = levelNum
      this.levelManager.setCurrentLevel(levelNum)

      // 创建游戏对象（关卡坐标按格换算到居中的棋盘上）
      const grid = {
        cols: GRID_COLS,
        rows: GRID_ROWS,
        cellSize: CELL_SIZE,
        offsetX: BOARD_OFFSET_X,
        offsetY: BOARD_OFFSET_Y
      }
      this.background = new Background(this.ctx, grid)
      this.penguin = new Penguin({ ...this.toBoardPixel(levelData.penguin), size: CELL_SIZE })
      this.stones = levelData.stones.map(s => new Stone({ ...this.toBoardPixel(s), size: CELL_SIZE }))
      this.target = new Target({
        ...levelData.target,
        ...this.toBoardPixel(levelData.target),
        cellSize: CELL_SIZE
      })

      // 创建障碍物（同样偏移到棋盘位置）
      this.obstacles = ObstacleFactory.createFromLevelData(levelData.obstacles)
      this.obstacles.forEach(obstacle => {
        obstacle.x += BOARD_OFFSET_X
        obstacle.y += BOARD_OFFSET_Y
      })

      // 重置状态
      this.moves = 0
      this.startTime = Date.now()
      this.gameState = 'playing'
      this.isPaused = false

      // 更新HUD
      this.gameHUD.setLevelInfo(levelNum, levelData.par)
      this.gameHUD.setMoves(0)

      // 通知结算管理器开始关卡
      if (this.settlementManager) {
        this.settlementManager.startLevel(levelNum, levelData.difficulty || 'easy')
      }

      console.log(`关卡 ${levelNum} 加载成功: ${levelData.name}, 障碍物: ${this.obstacles.length}`)
    } catch (e) {
      console.error('加载关卡失败:', e)
    }
  }

  /**
   * 关卡坐标（50px对齐）换算为棋盘像素坐标
   * @param {Object} pos - 关卡坐标 {x, y}
   * @returns {Object} 棋盘坐标 {x, y}
   */
  toBoardPixel(pos) {
    return {
      x: BOARD_OFFSET_X + Math.round(pos.x / CELL_SIZE) * CELL_SIZE,
      y: BOARD_OFFSET_Y + Math.round(pos.y / CELL_SIZE) * CELL_SIZE
    }
  }

  /**
   * 格子坐标换算为棋盘像素坐标
   */
  cellToPixel(col, row) {
    return {
      x: BOARD_OFFSET_X + col * CELL_SIZE,
      y: BOARD_OFFSET_Y + row * CELL_SIZE
    }
  }

  /**
   * 获取对象所在格子
   */
  getCell(obj) {
    return {
      col: Math.round((obj.x - BOARD_OFFSET_X) / CELL_SIZE),
      row: Math.round((obj.y - BOARD_OFFSET_Y) / CELL_SIZE)
    }
  }

  /**
   * 判断格子是否在棋盘内
   */
  isCellInside(col, row) {
    return col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS
  }

  /**
   * 获取指定格子上的障碍物
   */
  getObstacleAt(col, row, type) {
    return this.obstacles.find(obstacle => {
      const cell = this.getCell(obstacle)
      return obstacle.type === type && cell.col === col && cell.row === row
    })
  }

  /**
   * 获取指定格子上的冰块
   */
  getStoneAt(col, row) {
    return this.stones.find(stone => {
      const cell = this.getCell(stone)
      return cell.col === col && cell.row === row
    })
  }

  /**
   * 获取移动补间时长（雪堆上减速）
   */
  getMoveDuration(fromCol, fromRow, toCol, toRow) {
    const onSnow = this.getObstacleAt(fromCol, fromRow, 'snow') ||
      this.getObstacleAt(toCol, toRow, 'snow')
    return onSnow ? 220 : 120
  }

  /**
   * 按格移动一格（推石、墙壁、冰窟窿、边界均按格判定）
   * @param {string} direction - up/down/left/right
   * @returns {boolean} 是否移动成功
   */
  tryMove(direction) {
    if (!this.penguin || this.penguin.isMoving || this.gameState !== 'playing') {
      return false
    }

    const step = DIRECTION_STEP[direction]
    if (!step) return false

    const current = this.getCell(this.penguin)
    const next = { col: current.col + step.col, row: current.row + step.row }

    // 边界或冰墙阻挡
    if (!this.isCellInside(next.col, next.row) || this.getObstacleAt(next.col, next.row, 'wall')) {
      this.audioManager.playCollisionSound()
      return false
    }

    const duration = this.getMoveDuration(current.col, current.row, next.col, next.row)
    const stone = this.getStoneAt(next.col, next.row)

    if (stone) {
      const stoneNext = { col: next.col + step.col, row: next.row + step.row }

      // 冰块前方是边界、冰墙、雪堆或另一块冰块，推不动
      const stoneBlocked = !this.isCellInside(stoneNext.col, stoneNext.row) ||
        this.getObstacleAt(stoneNext.col, stoneNext.row, 'wall') ||
        this.getObstacleAt(stoneNext.col, stoneNext.row, 'snow') ||
        this.getStoneAt(stoneNext.col, stoneNext.row)

      if (stoneBlocked) {
        this.audioManager.playCollisionSound()
        return false
      }

      if (this.getObstacleAt(stoneNext.col, stoneNext.row, 'hole')) {
        // 所有冰块都必须送入目标，掉进冰窟窿后关卡无法完成，直接失败
        this.gameState = 'fail'
        this.onFail('冰块掉入冰窟窿')
        return false
      }

      const stonePixel = this.cellToPixel(stoneNext.col, stoneNext.row)
      stone.moveTo(stonePixel.x, stonePixel.y, duration)

      const nextPixel = this.cellToPixel(next.col, next.row)
      this.penguin.moveTo(nextPixel.x, nextPixel.y, duration)
      this.audioManager.playPushSound()
    } else if (this.getObstacleAt(next.col, next.row, 'hole')) {
      // 企鹅掉入冰窟窿：停留在安全格（便于复活恢复），直接失败
      this.gameState = 'fail'
      this.onFail('掉入冰窟窿')
      return false
    } else {
      const nextPixel = this.cellToPixel(next.col, next.row)
      this.penguin.moveTo(nextPixel.x, nextPixel.y, duration)
    }

    if (typeof wx !== 'undefined') {
      wx.vibrateShort({ type: 'light' })
    }

    return true
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
    // 重置复活状态
    if (this.reviveManager) {
      this.reviveManager.resetLevelRevive()
    }
    this.loadLevel(this.currentLevel)
  }

  /**
   * 返回主菜单
   */
  backToMenu() {
    this.gameState = 'menu'
    this.isPaused = false
    this.penguin = null
    this.sceneManager.switchTo('menu')
  }

  /**
   * 进入下一关
   */
  nextLevel() {
    const nextLevel = this.levelManager.getNextLevel()
    if (nextLevel) {
      // 重置复活状态
      if (this.reviveManager) {
        this.reviveManager.resetLevelRevive()
      }
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

    // 优先处理游戏结束场景
    if (this.gameOverScene && this.gameOverScene.isVisible) {
      this.gameOverScene.onTouchStart(touch)
      return
    }

    // 优先处理复活场景
    if (this.reviveScene && this.reviveScene.isVisible) {
      this.reviveScene.onTouchStart(touch)
      return
    }

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

    // 优先处理游戏结束场景
    if (this.gameOverScene && this.gameOverScene.isVisible) {
      this.gameOverScene.onTouchMove(touch)
      return
    }

    // 优先处理复活场景
    if (this.reviveScene && this.reviveScene.isVisible) {
      this.reviveScene.onTouchMove(touch)
      return
    }

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

    // 优先处理游戏结束场景
    if (this.gameOverScene && this.gameOverScene.isVisible) {
      this.gameOverScene.onTouchEnd(touch)
      return
    }

    // 优先处理复活场景
    if (this.reviveScene && this.reviveScene.isVisible) {
      this.reviveScene.onTouchEnd(touch)
      return
    }

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
      const direction = this.penguin.handleTouchEnd()

      // 只有企鹅停止时才响应新的滑动
      if (direction && !this.penguin.isMoving) {
        const moved = this.tryMove(direction)

        // 撞墙、推不动、掉入冰窟窿都不计入步数
        if (moved) {
          this.moves++
          this.gameHUD.setMoves(this.moves)

          // 记录步数到结算管理器
          if (this.settlementManager) {
            this.settlementManager.recordMove()
          }

          // 播放滑动音效
          this.audioManager.playSlideSound()
        }
      }
    }
  }

  /**
   * 游戏更新
   */
  update() {
    // 更新当前场景
    this.sceneManager.update()

    // 更新成就通知
    if (this.achievementNotification) {
      this.achievementNotification.update()
    }

    // 更新游戏结束场景
    if (this.gameOverScene && this.gameOverScene.isVisible) {
      this.gameOverScene.update()
      return
    }

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
    this.obstacles.forEach(obstacle => obstacle.update())

    // 胜利检测
    this.checkWinCondition()

    // 更新HUD时间
    const currentTime = Math.floor((Date.now() - this.startTime) / 1000)
    this.gameHUD.setTime(currentTime)

    // 更新食物显示
    if (this.foodDisplay) {
      this.foodDisplay.update()
    }
  }

  /**
   * 游戏失败处理
   */
  onFail(reason) {
    console.log(`游戏失败: ${reason}`)
    wx.vibrateShort({ type: 'heavy' })

    // 播放失败音效
    this.audioManager.playFailSound()

    // 保存当前位置（用于复活恢复）
    this.reviveManager.savePosition(this.penguin, this.stones)

    // 检查是否可以复活
    const status = this.reviveManager.getStatus()
    const canRevive = !status.currentLevelRevived && (
      status.remaining.shareFriend > 0 ||
      status.remaining.shareGroup > 0 ||
      status.remaining.watchAd > 0 ||
      this.reviveManager.hasEnoughFood(this.foodManager)
    )

    if (canRevive) {
      // 显示复活选择界面
      this.reviveScene.show()
    } else {
      // 无法复活，显示游戏结束界面
      if (this.settlementManager) {
        this.settlementManager.failLevel()
      }
      this.gameOverScene.show()
    }
  }

  /**
   * 复活成功处理
   */
  onReviveSuccess(result) {
    console.log('复活成功:', result)

    // 恢复位置
    if (result.lastPosition) {
      this.penguin.x = result.lastPosition.x
      this.penguin.y = result.lastPosition.y
      this.penguin.isMoving = false
    }

    // 恢复冰块位置
    if (result.lastStones && this.stones.length === result.lastStones.length) {
      result.lastStones.forEach((stoneState, index) => {
        this.stones[index].x = stoneState.x
        this.stones[index].y = stoneState.y
        this.stones[index].isMoving = false
      })
    }

    // 增加步数惩罚
    this.moves += result.movePenalty
    this.gameHUD.setMoves(this.moves)

    // 恢复游戏状态
    this.gameState = 'playing'
  }

  /**
   * 放弃复活处理
   */
  onReviveGiveUp() {
    console.log('放弃复活')
    this.restartLevel()
  }

  /**
   * 游戏结束-重新开始
   */
  onGameOverRestart() {
    console.log('游戏结束-重新开始')
    this.gameOverScene.hide()
    this.restartLevel()
  }

  /**
   * 游戏结束-返回菜单
   */
  onGameOverBackToMenu() {
    console.log('游戏结束-返回菜单')
    this.gameOverScene.hide()
    this.sceneManager.switchTo('menu')
  }

  /**
   * 游戏结束-观看广告复活
   */
  onGameOverWatchAd() {
    console.log('游戏结束-观看广告')
    // 尝试通过观看广告复活
    const result = this.reviveManager.reviveByWatchAd()
    if (result.success) {
      this.gameOverScene.hide()
      this.onReviveSuccess(result)
      wx.showToast({ title: '复活成功！', icon: 'success' })
    } else {
      wx.showToast({ title: result.message || '今日广告次数已用完', icon: 'none' })
    }
  }

  /**
   * 胜利检测
   */
  checkWinCondition() {
    // 移动动画结束后再判定，避免冰块途经目标格时误判通关
    if (this.penguin.isMoving || this.stones.some(stone => stone.isMoving)) {
      return
    }

    if (this.stones.length === 0) {
      return
    }

    // 所有冰块都进入目标区域才算通关
    let allInTarget = true
    this.stones.forEach(stone => {
      stone.inTarget = this.target.contains(stone)
      if (!stone.inTarget) {
        allInTarget = false
      }
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

    // 播放通关音效
    this.audioManager.playWinSound()

    // 通知结算管理器完成关卡
    if (this.settlementManager) {
      const levelData = this.levelManager.getLevel(this.currentLevel)
      const par = levelData ? levelData.par : 3
      this.settlementManager.completeLevel(this.moves, time, par)
    }

    // 保存关卡进度
    this.saveLevelProgress()

    // 上报分数到排行榜
    this.reportScore()

    // 计算并发放食物奖励
    const levelData = this.levelManager.getLevel(this.currentLevel)
    const par = levelData ? levelData.par : 3
    const rewards = this.foodManager.calculateRewards(this.currentLevel, this.moves, par, time)
    this.foodManager.giveRewards(rewards)
    console.log('获得食物奖励:', rewards.details)

    // 显示奖励动画
    this.foodDisplay.showRewardAnimation(rewards)

    // 记录成就
    const stars = this.calculateStars()
    this.achievementManager.recordWin(this.currentLevel, stars, this.moves, par, time)
    this.achievementManager.recordStreak(this.foodManager.consecutiveWins)
    this.achievementManager.recordFoodCollection(this.foodManager.food)

    // 检查新解锁的成就
    const newAchievements = this.achievementManager.getNewUnlocked()
    newAchievements.forEach(achievement => {
      this.achievementNotification.add(achievement)
      // 发放成就奖励
      if (achievement.reward) {
        this.foodManager.giveRewards(achievement.reward)
      }
    })

    // 显示结算界面
    this.resultScene.setResult(this.currentLevel, this.moves, par, time)
    this.resultScene.setRewards(rewards)
    this.resultScene.show()
  }

  /**
   * 计算星级
   */
  calculateStars() {
    const levelData = this.levelManager.getLevel(this.currentLevel)
    const par = levelData ? levelData.par : 3

    if (this.moves <= par) return 3
    if (this.moves <= par * 1.5) return 2
    return 1
  }

  /**
   * 分享奖励处理
   */
  onShareReward() {
    console.log('分享奖励：获得5🐟')
    this.foodManager.addFish(5)
    this.achievementManager.recordShare()

    // 检查新解锁的成就
    const newAchievements = this.achievementManager.getNewUnlocked()
    newAchievements.forEach(achievement => {
      this.achievementNotification.add(achievement)
      if (achievement.reward) {
        this.foodManager.giveRewards(achievement.reward)
      }
    })

    wx.showToast({
      title: '分享成功 +5🐟',
      icon: 'none'
    })
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
   * 上报分数到排行榜
   */
  reportScore() {
    if (!this.wechatService || !this.wechatService.isLogin) {
      console.log('用户未登录，跳过分数上报')
      return
    }

    // 计算星级
    const levelData = this.levelManager.getLevel(this.currentLevel)
    const par = levelData ? levelData.par : 3
    let stars = 1
    if (this.moves <= par) stars = 3
    else if (this.moves <= par * 1.5) stars = 2

    // 上报分数
    this.wechatService.reportScore(this.currentLevel, this.moves, stars)
  }

  /**
   * 渲染游戏
   */
  render() {
    // 清屏
    this.ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 根据当前场景渲染
    const currentSceneName = this.sceneManager.getCurrentSceneName()
    const uiScenes = ['menu', 'login', 'rank', 'achievement']

    if (uiScenes.includes(currentSceneName)) {
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

    // 渲染复活场景（覆盖层）
    if (this.reviveScene && this.reviveScene.isVisible) {
      this.reviveScene.render(this.ctx)
    }

    // 渲染游戏结束场景（覆盖层）
    if (this.gameOverScene && this.gameOverScene.isVisible) {
      this.gameOverScene.render(this.ctx)
    }

    // 渲染成就通知（最上层）
    if (this.achievementNotification) {
      this.achievementNotification.render(this.ctx)
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

    // 渲染障碍物
    this.obstacles.forEach(obstacle => obstacle.render(this.ctx))

    // 渲染冰块
    this.stones.forEach(stone => stone.render(this.ctx))

    // 渲染企鹅
    if (this.penguin) {
      this.penguin.render(this.ctx)
    }

    // 渲染HUD
    if (this.gameState === 'playing' || this.gameState === 'win') {
      this.gameHUD.render(this.ctx)
    }

    // 渲染食物显示
    if (this.foodDisplay && (this.gameState === 'playing' || this.gameState === 'win')) {
      this.foodDisplay.render(this.ctx)
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
