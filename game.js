import Background from './js/runtime/background'
import Penguin from './js/runtime/penguin'
import Stone from './js/runtime/stone'
import Target from './js/runtime/target'
import LevelManager from './js/levels/level-manager'
import { ObstacleFactory } from './js/runtime/obstacle'
import AudioManager from './js/utils/audio-manager'
import WechatService from './js/utils/wechat-service'
import AdManager from './js/utils/ad-manager'
import FoodManager from './js/utils/food-manager'
import AchievementManager from './js/utils/achievement-manager'
import ReviveManager from './js/utils/revive-manager'
import SettlementManager from './js/utils/settlement-manager'
import { calcStars } from './js/utils/score'
import { AD_UNITS } from './js/config'

// UI组件
import SceneManager from './js/ui/scene-manager'
import MenuScene from './js/ui/menu-scene'
import PauseScene from './js/ui/pause-scene'
import ResultScene from './js/ui/result-scene'
import GameOverScene from './js/ui/gameover-scene'
import RankScene from './js/ui/rank-scene'
import AchievementScene from './js/ui/achievement-scene'
import AchievementNotification from './js/ui/achievement-notification'
import ReviveScene from './js/ui/revive-scene'
import PrivacyScene from './js/ui/privacy-scene'
import GameHUD from './js/ui/game-hud'
import FoodDisplay from './js/ui/food-display'
import GameScene from './js/ui/game-scene'

// 关卡数据使用的网格单位：levels/*.json 里的坐标按 50px 一格书写
const LEVEL_CELL = 50
const GRID_COLS = 7
const GRID_ROWS = 9

// 棋盘自适应参数：顶部 HUD 面板 + 底部操作条之间为可用区域
const LAYOUT_MARGIN_X = 10
const LAYOUT_TOP = 96
const LAYOUT_BOTTOM = 64
const MIN_CELL_SIZE = 28
const MAX_CELL_SIZE = 56

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
    this.rankScene = null
    this.gameHUD = null

    // 音效系统
    this.audioManager = null

    // 微信服务
    this.wechatService = null

    // 广告（B2：只有配置了真实广告位才启用，否则整条链路关闭）
    this.adManager = null
    this.adAvailable = false

    // 隐私授权弹窗（B4）
    this.privacyScene = null

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

    // 计时补偿（C2）：切后台、手动暂停都不应计入关卡用时
    this.pausedAccum = 0        // 已累计的暂停时长（毫秒）
    this.pauseStartedAt = 0     // 本次暂停开始的时间戳，0 表示当前未暂停计时
    this.hiddenAt = 0           // 切到后台的时间戳，0 表示在前台

    // 画布像素 / 窗口逻辑像素的比值，resize 时据此保持原有清晰度
    this.canvasRatio = this.getCanvasRatio()

    // 全局异常自动复位只允许触发一次（见 initErrorHandler）
    this.errorRecovered = false

    // 棋盘布局（由 computeLayout 按画布尺寸计算，见 A5）
    this.cellSize = LEVEL_CELL
    this.boardWidth = GRID_COLS * LEVEL_CELL
    this.boardHeight = GRID_ROWS * LEVEL_CELL
    this.boardOffsetX = 0
    this.boardOffsetY = 0

    // 激励视频广告是否可用（由 js/config.js 的广告位配置决定）
    this.adAvailable = false

    this.gameScene = null

    this.init()
  }

  /**
   * 计算棋盘布局：在顶部 HUD 与底部操作条之间的安全区里取最大可用格子
   */
  computeLayout() {
    const availWidth = canvas.width - LAYOUT_MARGIN_X * 2
    const availHeight = canvas.height - LAYOUT_TOP - LAYOUT_BOTTOM

    const byWidth = Math.floor(availWidth / GRID_COLS)
    const byHeight = Math.floor(availHeight / GRID_ROWS)
    const cell = Math.max(MIN_CELL_SIZE, Math.min(byWidth, byHeight, MAX_CELL_SIZE))

    this.cellSize = cell
    this.boardWidth = cell * GRID_COLS
    this.boardHeight = cell * GRID_ROWS
    this.boardOffsetX = Math.round((canvas.width - this.boardWidth) / 2)
    this.boardOffsetY = Math.round(LAYOUT_TOP + (availHeight - this.boardHeight) / 2)

    console.log(`[Layout] 画布 ${canvas.width}x${canvas.height} → 格子 ${cell}px，棋盘原点 (${this.boardOffsetX}, ${this.boardOffsetY})`)
  }

  /**
   * 读取窗口信息（新版基础库用 getWindowInfo，老版本回落到 getSystemInfoSync）
   * @returns {Object|null}
   */
  getWindowInfo() {
    if (typeof wx === 'undefined') return null
    try {
      if (typeof wx.getWindowInfo === 'function') {
        const info = wx.getWindowInfo()
        if (info && info.windowWidth > 0) return info
      }
      if (typeof wx.getSystemInfoSync === 'function') {
        const info = wx.getSystemInfoSync()
        if (info && info.windowWidth > 0) return info
      }
    } catch (e) {
      console.warn('[Lifecycle] 读取窗口信息失败:', e)
    }
    return null
  }

  /**
   * 画布像素与窗口逻辑像素的比值
   * 小游戏里 canvas.width 可能是 windowWidth × pixelRatio，resize 时沿用同一比值才不会变模糊
   */
  getCanvasRatio() {
    const info = this.getWindowInfo()
    if (info && info.windowWidth > 0) {
      const ratio = canvas.width / info.windowWidth
      if (ratio > 0 && isFinite(ratio)) return ratio
    }
    return 1
  }

  /**
   * 绑定前后台与窗口尺寸事件（C2）
   */
  bindLifecycle() {
    if (typeof wx === 'undefined') return

    if (typeof wx.onHide === 'function') {
      wx.onHide(() => this.handleHide())
    }
    if (typeof wx.onShow === 'function') {
      wx.onShow(() => this.handleShow())
    }
    if (typeof wx.onWindowResize === 'function') {
      wx.onWindowResize((res) => this.handleResize(res))
    }
  }

  /**
   * 切到后台：暂停计时、停 BGM，对局中自动弹暂停面板
   */
  handleHide() {
    this.hiddenAt = Date.now()
    console.log('[Lifecycle] 切到后台')

    // 后台不播 BGM，避免回到前台后出现叠音
    if (this.audioManager) {
      this.audioManager.pauseBGM()
    }

    // 对局中自动暂停：否则玩家回来时企鹅的补间动画已经按真实时间跑完
    if (this.gameState === 'playing') {
      this.pauseGame()
    }
  }

  /**
   * 回到前台：恢复 BGM，并刷新广告可用性
   */
  handleShow() {
    const hiddenMs = this.hiddenAt ? Date.now() - this.hiddenAt : 0
    this.hiddenAt = 0

    if (hiddenMs > 0) {
      console.log(`[Lifecycle] 回到前台，后台时长 ${Math.round(hiddenMs / 1000)}s`)
    }

    if (this.audioManager) {
      this.audioManager.playBGM()
    }

    // 广告实例可能在后台被回收，回前台重新探测
    if (this.adManager) {
      this.adAvailable = this.adManager.isRewardedVideoAvailable()
    }
  }

  /**
   * 窗口尺寸变化：重算棋盘布局并重建所有 UI 场景的按钮坐标
   * @param {Object} res - wx.onWindowResize 回调参数 {windowWidth, windowHeight}
   */
  handleResize(res) {
    const info = res && res.windowWidth ? res : this.getWindowInfo()
    if (!info || !info.windowWidth || !info.windowHeight) return

    const ratio = this.canvasRatio || 1
    const width = Math.round(info.windowWidth * ratio)
    const height = Math.round(info.windowHeight * ratio)

    if (width <= 0 || height <= 0) return
    if (width === canvas.width && height === canvas.height) return

    canvas.width = width
    canvas.height = height
    console.log(`[Lifecycle] 窗口变化 → 画布 ${width}x${height}`)

    // 注意：必须先让 relayoutBoard 用旧布局把像素位置反算成格坐标，
    // 再由它内部重算布局，所以这里不能提前调 computeLayout()
    this.relayoutBoard()
    this.relayoutUI()
  }

  /**
   * 按新棋盘尺寸重建对局内的对象
   * 先记下格坐标，重算布局后再按格还原，避免像素位置漂移
   */
  relayoutBoard() {
    if (!this.penguin || !this.target) {
      // 不在对局中（菜单 / 结算等），只需要把棋盘布局算好供下次进关使用
      this.computeLayout()
      return
    }

    const penguinCell = this.getCell(this.penguin)
    const stoneCells = this.stones.map(stone => this.getCell(stone))
    const targetCell = this.getCell(this.target)
    const targetSpan = {
      cols: Math.max(1, Math.round(this.target.width / this.cellSize)),
      rows: Math.max(1, Math.round(this.target.height / this.cellSize))
    }
    const obstacleCells = this.obstacles.map(obstacle => this.getCell(obstacle))

    // 格坐标已全部记录，可以安全地按新画布重算布局了
    this.computeLayout()

    // 新布局下重建背景（背景按 grid 参数绘制网格与光斑）
    this.background = new Background(this.ctx, {
      cols: GRID_COLS,
      rows: GRID_ROWS,
      cellSize: this.cellSize,
      offsetX: this.boardOffsetX,
      offsetY: this.boardOffsetY
    })

    const place = (obj, cell) => {
      const pixel = this.cellToPixel(cell.col, cell.row)
      obj.x = pixel.x
      obj.y = pixel.y
      obj.width = this.cellSize
      obj.height = this.cellSize
      obj.isMoving = false
    }

    place(this.penguin, penguinCell)
    this.stones.forEach((stone, i) => place(stone, stoneCells[i]))
    this.obstacles.forEach((obstacle, i) => place(obstacle, obstacleCells[i]))

    const targetPixel = this.cellToPixel(targetCell.col, targetCell.row)
    this.target.x = targetPixel.x
    this.target.y = targetPixel.y
    this.target.width = targetSpan.cols * this.cellSize
    this.target.height = targetSpan.rows * this.cellSize
    this.target.cellSize = this.cellSize
    this.target.cols = targetSpan.cols
    this.target.rows = targetSpan.rows
  }

  /**
   * 让所有 UI 组件按当前画布尺寸重建按钮坐标
   */
  relayoutUI() {
    const scenes = [
      this.menuScene,
      this.rankScene,
      this.achievementScene,
      this.pauseScene,
      this.resultScene,
      this.gameOverScene,
      this.reviveScene,
      this.privacyScene
    ]

    scenes.forEach(scene => {
      if (scene && typeof scene.relayout === 'function') {
        scene.relayout()
      }
    })

    if (this.gameHUD && typeof this.gameHUD.relayout === 'function') {
      this.gameHUD.relayout()
    }

    if (this.foodDisplay) {
      this.foodDisplay.setPosition(8, 6)
      this.foodDisplay.setSize(canvas.width - 16)
    }
  }

  /**
   * 当前关卡已用时（秒），已扣除暂停与后台时长
   * 正在暂停时把当前这段暂停窗口也实时扣掉，避免回到前台瞬间计时跳变
   * @returns {number}
   */
  getElapsedSeconds() {
    if (!this.startTime) return 0
    const activePause = this.pauseStartedAt ? Date.now() - this.pauseStartedAt : 0
    return Math.max(0, Math.floor((Date.now() - this.startTime - this.pausedAccum - activePause) / 1000))
  }

  /**
   * 把当前这次暂停的时长并入累计值
   * @returns {number} 本次并入的毫秒数
   */
  accumulatePause() {
    if (!this.pauseStartedAt) return 0
    const elapsed = Date.now() - this.pauseStartedAt
    this.pausedAccum += elapsed
    this.pauseStartedAt = 0
    return elapsed
  }

  /**
   * 初始化游戏
   */
  init() {
    this.computeLayout()
    this.initWechat()
    this.initAudio()
    this.initAds()
    this.initPrivacy()
    this.initFood()
    this.initAchievement()
    this.initRevive()
    this.initSettlement()
    this.initUI()
    this.bindEvent()
    this.bindLifecycle()
    this.initErrorHandler()
    this.initUpdateManager()
    this.loop()

    // 进入主菜单
    this.sceneManager.switchTo('menu')

    // 播放背景音乐
    this.audioManager.playBGM()
  }

  /**
   * 初始化隐私授权
   * 微信只会在真正调用隐私接口时回调，这里负责把系统请求转成自绘弹窗
   */
  initPrivacy() {
    if (typeof wx === 'undefined' || !wx.onNeedPrivacyAuthorization) {
      console.log('[Privacy] 当前基础库不支持 onNeedPrivacyAuthorization')
      return
    }

    this.privacyScene = new PrivacyScene()

    wx.onNeedPrivacyAuthorization((resolve, eventInfo) => {
      console.log('[Privacy] 需要用户授权:', eventInfo && eventInfo.referrer)
      this.privacyScene.show(resolve)
    })
  }

  /**
   * 初始化广告
   * 未配置广告位时 adAvailable 保持 false，所有广告入口自动隐藏
   */
  initAds() {
    this.adManager = new AdManager(AD_UNITS)
    this.adManager.init()
    this.adAvailable = this.adManager.isRewardedVideoAvailable()

    console.log(`[Ad] 激励视频可用: ${this.adAvailable}`)
  }

  /**
   * 初始化微信服务
   */
  initWechat() {
    this.wechatService = new WechatService()
    this.wechatService.init()
  }

  /**
   * 初始化全局错误兜底（D3）
   * 小游戏里未捕获异常只会让画面静默卡死，玩家看到的是「点了没反应」，
   * 这里至少把错误打出来，并在首次异常时尝试退回菜单复位状态。
   */
  initErrorHandler() {
    if (typeof wx === 'undefined') return

    // 只允许自动复位一次，避免渲染循环里每帧抛错 → 无限 backToMenu
    this.errorRecovered = false

    if (typeof wx.onError === 'function') {
      wx.onError((error) => {
        console.error('[Error] 未捕获异常:', error && (error.message || error), error && error.stack)

        if (this.errorRecovered) return
        this.errorRecovered = true

        try {
          this.clearOverlays()
          this.backToMenu()
          wx.showToast({ title: '出现异常，已返回菜单', icon: 'none' })
        } catch (e) {
          // 兜底逻辑自身不能再抛
          console.error('[Error] 异常复位失败:', e)
        }
      })
    }

    if (typeof wx.onUnhandledRejection === 'function') {
      wx.onUnhandledRejection((res) => {
        const reason = res && res.reason
        console.error('[Error] 未处理的 Promise 拒绝:', reason && (reason.message || reason))
      })
    }
  }

  /**
   * 初始化热更新（D3）
   * 小游戏默认会缓存旧包，不发版就永远跑老代码
   */
  initUpdateManager() {
    if (typeof wx === 'undefined' || typeof wx.getUpdateManager !== 'function') return

    try {
      const updateManager = wx.getUpdateManager()
      if (!updateManager || typeof updateManager.onUpdateReady !== 'function') return

      updateManager.onUpdateReady(() => {
        wx.showModal({
          title: '发现新版本',
          content: '新版本已准备好，重启后生效',
          showCancel: false,
          confirmText: '立即重启',
          success: (res) => {
            if (res.confirm) updateManager.applyUpdate()
          }
        })
      })

      updateManager.onUpdateFailed(() => {
        wx.showModal({
          title: '更新失败',
          content: '新版本下载失败，请退出小游戏后重新进入',
          showCancel: false
        })
      })
    } catch (e) {
      console.warn('[Update] 热更新不可用:', e)
    }
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
  }

  /**
   * 初始化复活系统
   */
  initRevive() {
    this.reviveManager = new ReviveManager()
    this.reviveScene = new ReviveScene(this.reviveManager, this.foodManager, this.adManager)
    this.reviveScene.onReviveSuccess = (result) => this.onReviveSuccess(result)
    this.reviveScene.onGiveUp = () => this.onReviveGiveUp()

    // 广告未接入时隐藏"看视频复活"入口
    this.reviveScene.setOptionVisible('watchAd', this.adAvailable)
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

    // 广告位未接入前隐藏"看广告复活"，避免玩家点到未实现的入口（B 批次接入真实广告位）
    this.gameOverScene.setWatchAdVisible(this.adAvailable)
  }

  /**
   * 初始化UI系统
   */
  initUI() {
    // 注册场景
    // C8：登录体系采用轻量方案，已移除伪登录入口（LoginScene）
    this.menuScene = new MenuScene(this.sceneManager)
    this.menuScene.onToggleSound = () => this.toggleSound()
    this.menuScene.onShare = () => this.wechatService.share()
    this.menuScene.setSoundEnabled(this.audioManager.soundEnabled)
    this.sceneManager.register('menu', this.menuScene)

    this.rankScene = new RankScene(this.sceneManager, this.wechatService)
    this.sceneManager.register('rank', this.rankScene)

    // 注册成就场景
    this.sceneManager.register('achievement', this.achievementScene)

    // 创建暂停和结算场景（覆盖层）
    this.pauseScene = new PauseScene(this.sceneManager)
    this.pauseScene.onResume = () => this.resumeGame()
    this.pauseScene.onRestart = () => this.restartLevel()
    // 关键：必须走 backToMenu 统一复位 isPaused / gameState，否则主菜单会被输入拦截卡死
    this.pauseScene.onBackToMenu = () => this.backToMenu()

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
            if (!res.confirm) return
            this.watchAdForFood(cost, levelNum)
          }
        })
        // 无法开战时回到菜单，避免停留在空白的游戏场景
        this.backToMenu()
        return
      }

      // 消耗食物
      if (cost > 0) {
        this.foodManager.consumeFood(cost)
        console.log(`消耗食物: ${cost}🐟`)
      }

      this.currentLevel = levelNum
      this.levelManager.setCurrentLevel(levelNum)

      // 创建游戏对象（关卡坐标按格换算到当前棋盘）
      const grid = {
        cols: GRID_COLS,
        rows: GRID_ROWS,
        cellSize: this.cellSize,
        offsetX: this.boardOffsetX,
        offsetY: this.boardOffsetY
      }
      this.background = new Background(this.ctx, grid)
      this.penguin = new Penguin({ ...this.toBoardPixel(levelData.penguin), size: this.cellSize })
      this.stones = levelData.stones.map(s => new Stone({ ...this.toBoardPixel(s), size: this.cellSize }))
      this.target = new Target({
        ...this.toBoardPixel(levelData.target),
        width: this.scaleLevelSize(levelData.target.width),
        height: this.scaleLevelSize(levelData.target.height),
        cellSize: this.cellSize
      })

      // 创建障碍物：关卡坐标（50px 网格）换算到当前棋盘，尺寸对齐一格
      this.obstacles = ObstacleFactory.createFromLevelData(
        (levelData.obstacles || []).map(obstacle => ({
          ...obstacle,
          ...this.toBoardPixel(obstacle),
          size: this.cellSize
        }))
      )

      // 重置状态
      this.moves = 0
      this.startTime = Date.now()
      this.pausedAccum = 0
      this.pauseStartedAt = 0
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
   * 观看激励视频换食物（食物不足时的兜底入口）
   * 看完后直接续上刚才那一关，避免玩家还要回菜单再点一次
   * @param {number} cost - 本关所需食物
   * @param {number} levelNum - 关卡编号
   */
  watchAdForFood(cost, levelNum) {
    if (!this.adAvailable) {
      wx.showToast({ title: '广告暂不可用', icon: 'none' })
      return
    }

    const reward = Math.max(10, cost)

    this.adManager.showRewardedVideoAd().then((ended) => {
      if (!ended) {
        console.log('[Ad] 未看完激励视频，不发奖励')
        return
      }

      this.foodManager.addFish(reward)
      wx.showToast({ title: `获得 ${reward}🐟`, icon: 'none' })
      console.log(`[Ad] 看完激励视频，获得 ${reward} 食物`)

      // 食物已补足，重新进入该关（食物检查会通过）
      this.sceneManager.switchTo('game', { level: levelNum })
    })
  }

  /**
   * 关卡坐标（50px 网格）换算为棋盘像素坐标
   * @param {Object} pos - 关卡坐标 {x, y}
   * @returns {Object} 棋盘坐标 {x, y}
   */
  toBoardPixel(pos) {
    return {
      x: this.boardOffsetX + Math.round(pos.x / LEVEL_CELL) * this.cellSize,
      y: this.boardOffsetY + Math.round(pos.y / LEVEL_CELL) * this.cellSize
    }
  }

  /**
   * 关卡尺寸（50px 网格）换算为当前格子尺寸
   * @param {number} value - 关卡中的像素尺寸
   * @returns {number}
   */
  scaleLevelSize(value) {
    return Math.round((value / LEVEL_CELL) * this.cellSize)
  }

  /**
   * 格子坐标换算为棋盘像素坐标
   */
  cellToPixel(col, row) {
    return {
      x: this.boardOffsetX + col * this.cellSize,
      y: this.boardOffsetY + row * this.cellSize
    }
  }

  /**
   * 获取对象所在格子
   */
  getCell(obj) {
    return {
      col: Math.round((obj.x - this.boardOffsetX) / this.cellSize),
      row: Math.round((obj.y - this.boardOffsetY) / this.cellSize)
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
    // 记录暂停起点，恢复时把这段时长从关卡用时里扣掉
    this.pauseStartedAt = Date.now()
    this.pauseScene.show()
  }

  /**
   * 恢复游戏
   */
  resumeGame() {
    this.accumulatePause()
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
    this.clearOverlays()
    this.gameState = 'menu'
    this.penguin = null
    this.sceneManager.switchTo('menu')
  }

  /**
   * 复位所有覆盖层与暂停标记
   * 任何"离开当前对局"的路径都必须先走这里，避免状态残留导致输入被拦截
   */
  clearOverlays() {
    this.isPaused = false
    // 离开对局时直接丢弃本次暂停区间（下一关会重置 pausedAccum）
    this.pauseStartedAt = 0
    if (this.pauseScene) this.pauseScene.hide()
    if (this.resultScene) this.resultScene.hide()
    if (this.reviveScene) this.reviveScene.hide()
    if (this.gameOverScene) this.gameOverScene.hide()
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
      this.backToMenu()
    }
  }

  /**
   * 触摸开始处理
   */
  touchStartHandler(e) {
    const touch = e.touches[0]

    // 隐私弹窗优先级最高，展示时吞掉所有输入
    if (this.privacyScene && this.privacyScene.isVisible) {
      this.privacyScene.onTouchStart(touch)
      return
    }

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

    // 优先处理暂停场景（仅在面板真正可见时拦截，避免残留 isPaused 吞掉所有输入）
    if (this.isPaused && this.pauseScene.isVisible) {
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

    // 隐私弹窗优先级最高
    if (this.privacyScene && this.privacyScene.isVisible) {
      this.privacyScene.onTouchMove(touch)
      return
    }

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

    // 优先处理暂停场景（仅在面板真正可见时拦截）
    if (this.isPaused && this.pauseScene.isVisible) {
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

    // 隐私弹窗优先级最高
    if (this.privacyScene && this.privacyScene.isVisible) {
      this.privacyScene.onTouchEnd(touch)
      return
    }

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

    // 优先处理暂停场景（仅在面板真正可见时拦截）
    if (this.isPaused && this.pauseScene.isVisible) {
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
    if (this.isPaused && this.pauseScene.isVisible) {
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

    // 更新HUD时间（已扣除暂停与后台时长）
    this.gameHUD.setTime(this.getElapsedSeconds())

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
    // 注：分享类复活已下线（B1 诱导分享合规），只统计"看广告"与"消耗食物"
    const status = this.reviveManager.getStatus()
    const canRevive = !status.currentLevelRevived && (
      (this.adAvailable && status.remaining.watchAd > 0) ||
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

    if (this.settlementManager) {
      this.settlementManager.recordRevive()
    }

    // 复活次数驱动的成就（原"分享"成就已改为复活成就）
    if (this.achievementManager) {
      this.achievementManager.recordRevive()
      this.flushAchievementRewards()
    }
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
    this.backToMenu()
  }

  /**
   * 游戏结束-观看广告复活
   * 走 ReviveManager 的统一复活入口；只有完整看完视频才发放复活
   */
  onGameOverWatchAd() {
    console.log('游戏结束-观看广告')

    if (!this.adAvailable || !this.adManager) {
      wx.showToast({ title: '广告暂不可用', icon: 'none' })
      return
    }

    if (!this.reviveManager.canRevive('watchAd')) {
      wx.showToast({ title: '今日广告次数已用完', icon: 'none' })
      return
    }

    this.adManager.showRewardedVideoAd().then((ended) => {
      if (!ended) {
        wx.showToast({ title: '未看完视频，无法复活', icon: 'none' })
        return
      }

      const result = this.reviveManager.revive('watchAd', this.foodManager)
      if (result.success) {
        this.gameOverScene.hide()
        this.onReviveSuccess(result)
        wx.showToast({ title: '复活成功！', icon: 'none' })
      } else {
        wx.showToast({ title: result.reason || '复活失败', icon: 'none' })
      }
    }).catch(() => {
      wx.showToast({ title: '广告加载失败，请稍后再试', icon: 'none' })
    })
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
    const time = this.getElapsedSeconds()
    const levelData = this.levelManager.getLevel(this.currentLevel)
    const par = levelData ? levelData.par : 3
    const stars = this.calculateStars()

    console.log(`恭喜通关！关卡 ${this.currentLevel}，步数: ${this.moves}，时间: ${time}秒`)

    // 振动反馈
    wx.vibrateShort({ type: 'heavy' })

    // 播放通关音效
    this.audioManager.playWinSound()

    // 通知结算管理器完成关卡（使用对象参数，避免与旧的位置参数错位）
    if (this.settlementManager) {
      this.settlementManager.completeLevel({ moves: this.moves, time, par, stars })
    }

    // 保存关卡进度
    this.saveLevelProgress()

    // 上报分数到排行榜
    this.reportScore()

    // 计算并发放食物奖励
    const rewards = this.foodManager.calculateRewards(this.currentLevel, this.moves, par, time)
    this.foodManager.giveRewards(rewards)
    console.log('获得食物奖励:', rewards.details)

    // 显示奖励动画
    this.foodDisplay.showRewardAnimation(rewards)

    // 记录成就：多个维度依次记录，最后统一取"新解锁"列表，避免互相覆盖
    this.achievementManager.recordWin(this.currentLevel, stars, this.moves, par, time)
    this.achievementManager.recordStreak(this.foodManager.consecutiveWins)
    this.achievementManager.recordFoodCollection(this.foodManager.food)
    this.achievementManager.recordPlayTime(time)
    this.achievementManager.recordAllThreeStars(this.isAllThreeStars())

    this.flushAchievementRewards()

    // 显示结算界面
    this.resultScene.setResult(this.currentLevel, this.moves, par, time)
    this.resultScene.setRewards(rewards)
    this.resultScene.show()
  }

  /**
   * 取出新解锁的成就：弹通知 + 发放奖励
   * @returns {Array} 本次新解锁的成就
   */
  flushAchievementRewards() {
    if (!this.achievementManager) return []

    const newAchievements = this.achievementManager.getNewUnlocked()
    newAchievements.forEach(achievement => {
      if (this.achievementNotification) {
        this.achievementNotification.add(achievement)
      }
      if (achievement.reward) {
        this.foodManager.giveRewards(achievement.reward)
      }
    })
    return newAchievements
  }

  /**
   * 是否所有已通关关卡都拿到了 3 星（至少通关 3 关后才有意义）
   */
  isAllThreeStars() {
    try {
      const progress = wx.getStorageSync('gameProgress') || {}
      const cleared = Math.max(0, (parseInt(progress.unlockedLevel, 10) || 1) - 1)
      if (cleared < 3) return false

      for (let i = 1; i <= cleared; i++) {
        const record = wx.getStorageSync(`level_${i}`)
        if (!record || record.stars !== 3) return false
      }
      return true
    } catch (e) {
      console.error('统计三星进度失败:', e)
      return false
    }
  }

  /**
   * 计算星级（口径见 js/utils/score.js，D2 统一）
   */
  calculateStars() {
    const levelData = this.levelManager.getLevel(this.currentLevel)
    const par = levelData ? levelData.par : 3
    return calcStars(this.moves, par)
  }

  /**
   * 保存关卡进度
   */
  saveLevelProgress() {
    try {
      // 计算星级
      const levelData = this.levelManager.getLevel(this.currentLevel)
      const par = levelData ? levelData.par : 3
      const stars = calcStars(this.moves, par)

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
    if (!this.wechatService) return

    // wx.setUserCloudStorage 本身就绑定当前 openid，不需要先"登录"。
    // 旧代码用 isLogin 做门禁，而登录入口几乎没人点，导致排行榜长期为空（C6/C8）
    const levelData = this.levelManager.getLevel(this.currentLevel)
    const par = levelData ? levelData.par : 3
    const stars = calcStars(this.moves, par)

    this.wechatService.reportScore(this.currentLevel, this.moves, stars)
  }

  /**
   * 切换音效开关（菜单「音效」按钮）
   */
  toggleSound() {
    const next = !this.audioManager.soundEnabled
    this.audioManager.setSoundEnabled(next)
    this.audioManager.setMusicEnabled(next)
    if (this.menuScene) this.menuScene.setSoundEnabled(next)

    wx.showToast({
      title: next ? '音效已开启' : '音效已关闭',
      icon: 'none'
    })
  }

  /**
   * 渲染游戏
   */
  render() {
    // 清屏
    this.ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 根据当前场景渲染
    const currentSceneName = this.sceneManager.getCurrentSceneName()
    const uiScenes = ['menu', 'rank', 'achievement']

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

    // 渲染隐私授权弹窗（覆盖一切）
    if (this.privacyScene && this.privacyScene.isVisible) {
      this.privacyScene.render(this.ctx)
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
