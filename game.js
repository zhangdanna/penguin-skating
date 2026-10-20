import Background from './js/runtime/background'
import Penguin from './js/runtime/penguin'
import Stone from './js/runtime/stone'
import Target from './js/runtime/target'
import LevelManager from './js/levels/level-manager'
import { checkAABB } from './js/physics/collision'
import { ObstacleFactory } from './js/runtime/obstacle'
import AudioManager from './js/utils/audio-manager'
import WechatService from './js/utils/wechat-service'
import FoodManager from './js/utils/food-manager'
import AchievementManager from './js/utils/achievement-manager'
import ReviveManager from './js/utils/revive-manager'

// UI组件
import SceneManager from './js/ui/scene-manager'
import MenuScene from './js/ui/menu-scene'
import LevelSelectScene from './js/ui/level-select-scene'
import PauseScene from './js/ui/pause-scene'
import ResultScene from './js/ui/result-scene'
import LoginScene from './js/ui/login-scene'
import RankScene from './js/ui/rank-scene'
import AchievementScene from './js/ui/achievement-scene'
import AchievementNotification from './js/ui/achievement-notification'
import ReviveScene from './js/ui/revive-scene'
import GameHUD from './js/ui/game-hud'
import FoodDisplay from './js/ui/food-display'

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
  obstacles = []  // 障碍物数组
  levelManager = new LevelManager()

  // UI系统
  sceneManager = new SceneManager()
  pauseScene = null
  resultScene = null
  loginScene = null
  rankScene = null
  gameHUD = null

  // 音效系统
  audioManager = null

  // 微信服务
  wechatService = null

  // 食物系统
  foodManager = null
  foodDisplay = null

  // 成就系统
  achievementManager = null
  achievementScene = null
  achievementNotification = null

  // 复活系统
  reviveManager = null
  reviveScene = null

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
    this.initWechat()
    this.initAudio()
    this.initFood()
    this.initAchievement()
    this.initRevive()
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
   * 初始化UI系统
   */
  initUI() {
    // 注册场景
    this.sceneManager.register('menu', new MenuScene(this.sceneManager))
    this.sceneManager.register('levelSelect', new LevelSelectScene(this.sceneManager))

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
        return
      }

      // 消耗食物
      if (cost > 0) {
        this.foodManager.consumeFood(cost)
        console.log(`消耗食物: ${cost}🐟`)
      }

      this.currentLevel = levelNum
      this.levelManager.setCurrentLevel(levelNum)

      // 创建游戏对象
      this.background = new Background(this.ctx)
      this.penguin = new Penguin(levelData.penguin)
      this.stones = levelData.stones.map(s => new Stone(s))
      this.target = new Target(levelData.target)

      // 创建障碍物
      this.obstacles = ObstacleFactory.createFromLevelData(levelData.obstacles)

      // 重置状态
      this.moves = 0
      this.startTime = Date.now()
      this.gameState = 'playing'
      this.isPaused = false

      // 更新HUD
      this.gameHUD.setLevelInfo(levelNum, levelData.par)
      this.gameHUD.setMoves(0)

      console.log(`关卡 ${levelNum} 加载成功: ${levelData.name}, 障碍物: ${this.obstacles.length}`)
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
    // 重置复活状态
    if (this.reviveManager) {
      this.reviveManager.resetLevelRevive()
    }
    this.loadLevel(this.currentLevel)
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
      // 只有企鹅停止时才记录步数
      if (!this.penguin.isMoving) {
        this.penguin.handleTouchEnd()
        this.moves++
        this.gameHUD.setMoves(this.moves)

        // 播放滑动音效
        this.audioManager.playSlideSound()
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

    // 碰撞检测
    this.checkCollisions()

    // 障碍物碰撞检测
    this.checkObstacleCollisions()

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
   * 碰撞检测
   */
  checkCollisions() {
    // 企鹅与石头碰撞
    this.stones.forEach(stone => {
      if (checkAABB(this.penguin, stone)) {
        this.penguin.pushStone(stone)
        // 播放推动音效
        this.audioManager.playPushSound()
      }
    })

    // 石头与石头碰撞
    for (let i = 0; i < this.stones.length; i++) {
      for (let j = i + 1; j < this.stones.length; j++) {
        if (checkAABB(this.stones[i], this.stones[j])) {
          this.resolveStoneCollision(this.stones[i], this.stones[j])
          // 播放碰撞音效
          this.audioManager.playCollisionSound()
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
   * 障碍物碰撞检测
   */
  checkObstacleCollisions() {
    if (this.obstacles.length === 0) return

    // 企鹅与障碍物碰撞
    this.obstacles.forEach(obstacle => {
      if (checkAABB(this.penguin, obstacle)) {
        const result = obstacle.onPenguinCollide(this.penguin)
        this.handlePenguinObstacleResult(result, obstacle)
      }
    })

    // 石头与障碍物碰撞
    this.stones.forEach(stone => {
      this.obstacles.forEach(obstacle => {
        if (checkAABB(stone, obstacle)) {
          const result = obstacle.onStoneCollide(stone)
          this.handleStoneObstacleResult(result, stone, obstacle)
        }
      })
    })
  }

  /**
   * 处理企鹅与障碍物碰撞结果
   */
  handlePenguinObstacleResult(result, obstacle) {
    switch (result.action) {
      case 'stop':
        // 碰到冰墙，停止
        this.penguin.vx = result.vx
        this.penguin.vy = result.vy
        this.penguin.isMoving = false
        // 分离企鹅和障碍物
        this.separateObjects(this.penguin, obstacle)
        break

      case 'fail':
        // 掉入冰窟窿，游戏失败
        this.gameState = 'fail'
        this.onFail(result.reason)
        break

      case 'slow':
        // 经过雪堆，减速
        this.penguin.vx *= result.speedMultiplier
        this.penguin.vy *= result.speedMultiplier
        break
    }
  }

  /**
   * 处理石头与障碍物碰撞结果
   */
  handleStoneObstacleResult(result, stone, obstacle) {
    switch (result.action) {
      case 'stop':
        // 碰到冰墙，停止
        stone.vx = result.vx
        stone.vy = result.vy
        stone.isMoving = false
        this.separateObjects(stone, obstacle)
        break

      case 'destroy':
        // 掉入冰窟窿，移除石头
        const index = this.stones.indexOf(stone)
        if (index > -1) {
          this.stones.splice(index, 1)
        }
        break

      case 'stuck':
        // 卡在雪堆里，停止
        stone.vx = result.vx
        stone.vy = result.vy
        stone.isMoving = false
        break
    }
  }

  /**
   * 分离两个碰撞的对象
   */
  separateObjects(objA, objB) {
    const overlapX = Math.min(
      objA.x + objA.width - objB.x,
      objB.x + objB.width - objA.x
    )
    const overlapY = Math.min(
      objA.y + objA.height - objB.y,
      objB.y + objB.height - objA.y
    )

    if (overlapX < overlapY) {
      if (objA.x < objB.x) {
        objA.x -= overlapX
      } else {
        objA.x += overlapX
      }
    } else {
      if (objA.y < objB.y) {
        objA.y -= overlapY
      } else {
        objA.y += overlapY
      }
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
      // 无法复活，2秒后重新开始
      setTimeout(() => {
        this.restartLevel()
      }, 2000)
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
      this.penguin.vx = 0
      this.penguin.vy = 0
      this.penguin.isMoving = false
    }

    // 恢复石头位置
    if (result.lastStones && this.stones.length === result.lastStones.length) {
      result.lastStones.forEach((stoneState, index) => {
        this.stones[index].x = stoneState.x
        this.stones[index].y = stoneState.y
        this.stones[index].vx = 0
        this.stones[index].vy = 0
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

    // 播放通关音效
    this.audioManager.playWinSound()

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
    this.resultScene.setResult(this.currentLevel, this.moves, 3, time)
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

    // 渲染复活场景（覆盖层）
    if (this.reviveScene && this.reviveScene.isVisible) {
      this.reviveScene.render(this.ctx)
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

    // 渲染食物显示
    if (this.foodDisplay && (this.gameState === 'playing' || this.gameState === 'win')) {
      this.foodDisplay.render(this.ctx)
    }

    // 渲染失败提示
    if (this.gameState === 'fail') {
      this.renderFailMessage()
    }
  }

  /**
   * 渲染失败提示
   */
  renderFailMessage() {
    const ctx = this.ctx

    // 半透明遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // 失败文字
    ctx.fillStyle = '#e74c3c'
    ctx.font = 'bold 36px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('游戏失败', canvas.width / 2, canvas.height / 2 - 20)

    ctx.fillStyle = '#ffffff'
    ctx.font = '18px Arial'
    ctx.fillText('即将重新开始...', canvas.width / 2, canvas.height / 2 + 20)
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
