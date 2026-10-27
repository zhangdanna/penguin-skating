// 环境引导必须排在所有 import 之前：
// 微信小游戏没有全局 canvas，这里用 wx.createCanvas() 创建上屏画布并挂到全局，
// 否则 game.js 一执行就会抛 ReferenceError: Can't find variable: canvas（详见 js/env.js）
import screenCanvas, { viewport, DPR } from './js/env'
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
import GameHUD, { UNDO_FOOD_COST } from './js/ui/game-hud'
import {
  computeBoardLayout,
  GRID_COLS,
  GRID_ROWS
} from './js/ui/layout'
import FoodDisplay from './js/ui/food-display'
import GameScene from './js/ui/game-scene'

// 关卡数据使用的网格单位：levels/*.json 里的坐标按 50px 一格书写
const LEVEL_CELL = 50

// 撤销栈上限：只保留最近 N 步，防止一路退回开局
const MAX_UNDO_STEPS = 30

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

    // 上屏画布由 js/env.js 创建（小游戏走 wx.createCanvas，H5 复用适配层画布）
    if (!screenCanvas) {
      console.error('[Boot] 上屏画布缺失，游戏无法启动。请检查 js/env.js 是否被正确导入。')
      this.bootFailed = true
      return
    }
    this.ctx = screenCanvas.getContext('2d')

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

    // 撤销栈（F3）：「退一步」用格子坐标快照回滚，避开动画中间态
    this.history = []
    this.undoUsed = false
    this.undoCost = UNDO_FOOD_COST

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
   * 计算棋盘布局
   *
   * 顶部 HUD、棋盘、底部按钮当成一个整体垂直居中：
   *   - 三者间距在 GAP_*_MIN ~ GAP_*_MAX 之间随屏幕高度伸缩，
   *     长屏上会把多余空间先用来拉开间距，不再全部堆在屏幕上下边缘
   *   - 小屏纵向没有富余，间距退回最小值，优先保证棋盘塞得下
   *
   * 具体公式在 js/ui/layout.js 的 computeBoardLayout()，那里是对局与排行榜共用的
   * 唯一数据源，改数字请改那边。
   */
  computeLayout() {
    const vp = viewport()
    const layout = computeBoardLayout(vp)

    this.cellSize = layout.cellSize
    this.boardWidth = layout.boardWidth
    this.boardHeight = layout.boardHeight
    this.contentTopY = layout.contentTopY
    this.hudPanelY = layout.hudPanelY
    this.boardOffsetX = layout.boardOffsetX
    this.boardOffsetY = layout.boardOffsetY
    this.actionBarY = layout.actionBarY

    console.log(
      `[Layout] 视口 ${vp.width}x${vp.height}@${vp.dpr}x → 格子 ${this.cellSize}px，` +
      `HUD y=${this.hudPanelY}（间距 ${layout.gapHudBoard}），` +
      `棋盘原点 (${this.boardOffsetX}, ${this.boardOffsetY})，` +
      `按钮 y=${this.actionBarY}（间距 ${layout.gapBoardButtons}）`
    )

    this.syncHudLayout()
  }

  /**
   * 把棋盘布局算出的纵向锚点同步给 HUD 与食物条
   * HUD / 食物条可能在 computeLayout 之后才创建，所以两处都要调用
   */
  syncHudLayout() {
    if (typeof this.hudPanelY !== 'number' || typeof this.actionBarY !== 'number') return

    const vp = viewport()

    if (this.gameHUD) {
      this.gameHUD.computeLayout({
        panelY: this.hudPanelY,
        buttonY: this.actionBarY
      })
    }

    if (this.foodDisplay) {
      this.foodDisplay.setPosition(8, this.hudPanelY)
      this.foodDisplay.setSize(vp.width - 16)
    }
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
    // 读不到窗口信息时退回设备像素比，至少不会在 resize 后变模糊
    return DPR > 0 ? DPR : 1
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

    // 后台不播 BGM，避免回到前台后出现叠音。
    // 只标记挂起、不调 pause()：平台此刻已接管音频，pause() 必然返回
    // operateAudio:fail:access denied，真机调试台会刷一条红字。
    if (this.audioManager) {
      this.audioManager.suspend()
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

    // 后台这段时间不计入体力恢复：否则玩家挂着不管 / 睡一觉回来
    // 就会白拿一堆鱼，等于靠时间无限获取食物
    if (hiddenMs > 0 && this.foodManager) {
      this.foodManager.skipRecoveryTime(hiddenMs)
    }

    if (this.audioManager) {
      this.audioManager.resume()
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

    // HUD 与食物条跟着棋盘走，位置由 computeLayout 算好
    this.syncHudLayout()
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
    // 顶部信息面板内，与关卡信息上下排列（位置由 syncHudLayout 统一校准）
    this.syncHudLayout()
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
    // F3/F4：底部第三个按钮从「返回」改成「退一步」，
    // 退出对局的入口统一走暂停面板里的「返回菜单」，避免误触浪费本关入场费
    this.gameHUD = new GameHUD()
    this.gameHUD.onPauseClick = () => this.pauseGame()
    this.gameHUD.onRestartClick = () => this.restartLevel()
    this.gameHUD.onUndoClick = () => this.undoMove()

    // 用棋盘布局算出的锚点摆好 HUD（此时 HUD 才刚创建）
    this.syncHudLayout()
    
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
        this.promptInsufficientFood(cost, { levelNum })
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
      this.history = []
      this.undoUsed = false
      this.startTime = Date.now()
      this.pausedAccum = 0
      this.pauseStartedAt = 0
      this.gameState = 'playing'
      this.isPaused = false

      // 更新HUD
      this.gameHUD.setLevelInfo(levelNum, levelData.par)
      this.gameHUD.setMoves(0)
      this.syncUndoButton()

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
   * 食物不足时的统一入口
   *
   * 三条路按优先级走：
   *   1. 激励视频可用 → 看广告换食物（看完直接续上这一关）
   *   2. 广告不可用   → 免费补给（每日限量），保证「没开通流量主」时也能继续玩
   *   3. 免费次数用完 → 告诉玩家自然恢复还要等多久
   *
   * 原实现只有第 1 条，广告位没开通时确认框点下去只弹一句「广告暂不可用」，
   * 玩家就彻底卡住了 —— 既没有广告也没有别的补给来源。
   *
   * @param {number} cost - 本次需要的食物
   * @param {Object} [options]
   * @param {number} [options.levelNum] - 补足后要续上的关卡编号
   * @param {boolean} [options.restart=true] - 补足后是否重新进入该关
   *        局内操作（如退一步）传 false，只补食物不重开棋局
   * @param {string} [options.action='开始关卡'] - 弹窗里的动作描述
   */
  promptInsufficientFood(cost, options = {}) {
    const { levelNum, restart = true, action = '开始关卡' } = options

    if (this.adAvailable) {
      wx.showModal({
        title: '食物不足',
        content: `${action}需要 ${cost}🐟，是否观看广告获取食物？`,
        confirmText: '看广告',
        cancelText: '取消',
        success: (res) => {
          if (!res.confirm) return
          this.watchAdForFood(cost, { levelNum, restart })
        }
      })
      return
    }

    const left = this.foodManager.getFreeRefillLeft()
    if (left > 0) {
      const amount = this.getFreeRefillAmount(cost)
      wx.showModal({
        title: '食物不足',
        content: `${action}需要 ${cost}🐟。广告暂不可用，是否免费领取 ${amount}🐟？` +
          `\n（今日还可领取 ${left} 次）`,
        confirmText: '免费领取',
        cancelText: '取消',
        success: (res) => {
          if (!res.confirm) return
          this.grantFreeFood(cost, { levelNum, restart })
        }
      })
      return
    }

    const waitSeconds = this.foodManager.getNextRecoveryTime()
    const waitText = waitSeconds > 0
      ? `${Math.ceil(waitSeconds / 60)} 分钟后自然恢复 1🐟`
      : '稍后会自动恢复'
    wx.showModal({
      title: '食物不足',
      content: `${action}需要 ${cost}🐟。\n今日免费领取次数已用完，${waitText}。\n` +
        `（需保持游戏在前台运行才会恢复）`,
      showCancel: false,
      confirmText: '知道了'
    })
  }

  /**
   * 免费补给量：要盖过本关入场费还有富余，
   * 否则「领完立刻被扣光」，玩家每次进关都得再领一次，5 次用完照样卡住
   * @param {number} cost - 本关所需食物
   * @returns {number}
   */
  getFreeRefillAmount(cost) {
    return Math.max(cost + 3, 5)
  }

  /**
   * 免费补给并续上刚才那一关（广告不可用时的兜底）
   * @param {number} cost - 本关所需食物
   * @param {Object} [options] - { levelNum, restart }
   */
  grantFreeFood(cost, options = {}) {
    const { levelNum, restart = true } = options

    const amount = this.getFreeRefillAmount(cost)
    const given = this.foodManager.grantFreeRefill(amount)
    if (given <= 0) {
      wx.showToast({ title: '今日免费次数已用完', icon: 'none' })
      return
    }

    wx.showToast({ title: `获得 ${given}🐟`, icon: 'none' })
    console.log(`[Food] 免费补给 ${given}🐟，今日剩余 ${this.foodManager.getFreeRefillLeft()} 次`)

    if (restart && typeof levelNum === 'number') {
      this.sceneManager.switchTo('game', { level: levelNum })
    }
  }

  /**
   * 观看激励视频换食物（食物不足时的兜底入口）
   * 看完后直接续上刚才那一关，避免玩家还要回菜单再点一次
   * @param {number} cost - 本关所需食物
   * @param {Object} [options] - { levelNum, restart }
   */
  watchAdForFood(cost, options = {}) {
    const { levelNum, restart = true } = options

    // 广告中途失效（后台被回收 / 拉取失败）时不能让玩家无路可走
    if (!this.adAvailable || !this.adManager) {
      this.promptInsufficientFood(cost, { levelNum, restart })
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
      if (restart && typeof levelNum === 'number') {
        this.sceneManager.switchTo('game', { level: levelNum })
      }
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
   *
   * 两点约束：
   *   1. 还没走过第一步时点「重玩」没有任何意义（画面跟刚进来时一模一样），
   *      直接拦掉 —— 原实现会重新 loadLevel，白扣一次入场食物。
   *   2. 真的重玩要重新付入场费（否则重玩一关「不扣费 + 拿通关奖励」就变成刷鱼漏洞），
   *      所以必须先弹确认框把消耗说清楚，不能点了就默默扣。
   *
   * @param {Object} [options]
   * @param {boolean} [options.confirm=true] - 是否先弹确认框
   *        游戏结束 / 放弃复活这类「玩家已经明确表态要重开」的入口传 false
   * @param {boolean} [options.force=false] - 跳过「还没移动」的拦截
   *        游戏结束面板必须保证一定能重开，不能被这个拦截卡住
   */
  restartLevel(options = {}) {
    const { confirm = true, force = false } = options

    if (!force && this.moves === 0) {
      wx.showToast({ title: '还没移动，无需重玩', icon: 'none' })
      return
    }

    const levelData = this.levelManager.getLevel(this.currentLevel)
    const cost = levelData
      ? this.foodManager.getLevelCost(levelData.difficulty || 'easy')
      : 0

    if (confirm && cost > 0) {
      wx.showModal({
        title: '重新开始',
        content: `重玩本关会重新消耗 ${cost}🐟，确定吗？`,
        confirmText: '重玩',
        cancelText: '取消',
        success: (res) => {
          if (!res.confirm) return
          this.restartLevel({ confirm: false })
        }
      })
      return
    }

    // 重置复活状态
    if (this.reviveManager) {
      this.reviveManager.resetLevelRevive()
    }
    this.loadLevel(this.currentLevel)
  }

  /**
   * 拍一张当前局面快照（F3）
   * 存格子坐标而不是像素，避免把移动动画的中间态写进历史
   * @returns {Object|null}
   */
  captureSnapshot() {
    if (!this.penguin) return null
    return {
      penguin: this.getCell(this.penguin),
      stones: this.stones.map(stone => this.getCell(stone)),
      moves: this.moves
    }
  }

  /**
   * 入栈，最多保留最近 MAX_UNDO_STEPS 步
   * @param {Object|null} snapshot
   */
  pushHistory(snapshot) {
    if (!snapshot) return
    this.history.push(snapshot)
    if (this.history.length > MAX_UNDO_STEPS) {
      this.history.shift()
    }
  }

  /**
   * 把「退一步」的可用状态同步给 HUD
   */
  syncUndoButton() {
    if (!this.gameHUD || typeof this.gameHUD.setUndoState !== 'function') return
    this.gameHUD.setUndoState({
      steps: this.history.length,
      food: this.foodManager ? this.foodManager.getTotalFood() : 0
    })
  }

  /**
   * 退一步（F3）
   *
   * 花 2🐟 撤销最近一次移动，企鹅与冰块一起回到上一步的位置。
   * 步数一并回退，所以本关会被标记 undoUsed —— 使用过撤销的关卡
   * 不计入「精准操作」成就，避免用食物刷成就。
   *
   * @returns {boolean} 是否撤销成功
   */
  undoMove() {
    if (this.gameState !== 'playing') return false

    if (this.penguin && (this.penguin.isMoving || this.stones.some(stone => stone.isMoving))) {
      return false
    }

    if (this.history.length === 0) {
      wx.showToast({ title: '已经是第一步了', icon: 'none' })
      return false
    }

    if (!this.foodManager.hasEnoughFood(this.undoCost)) {
      // 局内操作：只补食物，不重开棋局（否则退一步会变成整关重来）
      this.promptInsufficientFood(this.undoCost, {
        restart: false,
        action: '退一步'
      })
      return false
    }

    const snapshot = this.history.pop()
    this.foodManager.consumeFood(this.undoCost)

    // 企鹅回到上一步
    const penguinPixel = this.cellToPixel(snapshot.penguin.col, snapshot.penguin.row)
    this.penguin.x = penguinPixel.x
    this.penguin.y = penguinPixel.y
    this.penguin.isMoving = false
    this.penguin.resetSwipe()

    // 冰块回到上一步
    if (snapshot.stones.length === this.stones.length) {
      snapshot.stones.forEach((cell, index) => {
        const pixel = this.cellToPixel(cell.col, cell.row)
        this.stones[index].x = pixel.x
        this.stones[index].y = pixel.y
        this.stones[index].isMoving = false
      })
    }

    // 步数一并回退
    this.moves = snapshot.moves
    this.gameHUD.setMoves(this.moves)
    if (this.settlementManager && this.settlementManager.currentSettlement) {
      this.settlementManager.currentSettlement.moves = this.moves
    }

    this.undoUsed = true

    // 反向音效 + 轻振动
    this.audioManager.playSlideSound()
    if (typeof wx !== 'undefined') {
      wx.vibrateShort({ type: 'light' })
    }

    // 消耗提示：按钮上的角标只在卡片右上角，实际操作后给一次明确反馈
    wx.showToast({ title: `退一步 -${this.undoCost}🐟`, icon: 'none', duration: 1200 })

    this.syncUndoButton()
    console.log(`[Undo] 撤销一步，剩余历史 ${this.history.length}，消耗 ${this.undoCost}🐟`)
    return true
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
        // 先拍快照再移动：撤销要回到"这一步之前"
        const snapshot = this.captureSnapshot()
        const moved = this.tryMove(direction)

        // 撞墙、推不动、掉入冰窟窿都不计入步数
        if (moved) {
          this.pushHistory(snapshot)
          this.moves++
          this.gameHUD.setMoves(this.moves)

          // 记录步数到结算管理器
          if (this.settlementManager) {
            this.settlementManager.recordMove()
          }

          // 播放滑动音效
          this.audioManager.playSlideSound()
          this.syncUndoButton()
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

    // 难过表情常驻，直到复活或重开
    if (this.penguin) {
      this.penguin.setMood('sad')
    }

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

    // 复活后情绪归位，别把失败表情带进新的一局
    if (this.penguin) {
      this.penguin.resetMood()
    }

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
    // 玩家已经在复活面板上明确选择了「放弃」，不必再弹一次确认
    this.restartLevel({ confirm: false, force: true })
  }

  /**
   * 游戏结束-重新开始
   */
  onGameOverRestart() {
    console.log('游戏结束-重新开始')
    this.gameOverScene.hide()
    this.restartLevel({ confirm: false, force: true })
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
    let justScored = false
    this.stones.forEach(stone => {
      const wasInTarget = stone.inTarget
      stone.inTarget = this.target.contains(stone)
      if (!stone.inTarget) {
        allInTarget = false
      } else if (!wasInTarget) {
        justScored = true
      }
    })

    // 每推进一块冰都值得开心一下，不是只有全部完成才笑。
    // 加 moves > 0 的守卫：关卡一开始就有冰块摆在目标里时不该触发。
    if (justScored && this.penguin && this.moves > 0) {
      this.penguin.setMood('happy')
    }

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

    // 首通 / 三星首通判定（F1：一次性收益，重刷不再发放）
    const rewardState = this.readLevelReward(this.currentLevel)
    const firstClear = !rewardState.first
    const firstThreeStar = stars === 3 && !rewardState.three

    // 计算并发放食物奖励
    const rewards = this.foodManager.calculateRewards(this.currentLevel, this.moves, par, time, {
      difficulty: levelData ? levelData.difficulty : 'hard',
      firstClear,
      firstThreeStar
    })
    const given = this.foodManager.giveRewards(rewards)
    this.markLevelRewarded(this.currentLevel, { first: firstClear, three: stars === 3 })
    console.log('获得食物奖励:', rewards.details)
    console.log('实际入账:', given)

    // 显示奖励动画（用实际入账，避免飘字写着 +5🐟 而背包没变）
    this.foodDisplay.showRewardAnimation(given)

    // 记录成就：一次调用更新通关数 / 星级 / 精准步数 / 速度 / 时长
    this.achievementManager.recordWin({
      level: this.currentLevel,
      stars,
      moves: this.moves,
      par,
      time,
      firstClear,
      undoUsed: this.undoUsed
    })
    this.achievementManager.recordStreak(this.foodManager.consecutiveWins)
    this.achievementManager.recordFoodEarned(given)

    // 通关解锁的成就不走浮层通知，直接画进结算面板（见 ResultScene.renderAchievements）：
    // 一次通关可能解锁好几个，浮层同时弹会糊住标题，底部还会叠出多层阴影
    const newAchievements = this.flushAchievementRewards({ notify: false })

    // 显示结算界面
    this.resultScene.setResult(this.currentLevel, this.moves, par, time)
    // 传实际入账（given），并把理论值一并带上，食物满了才能在结算页说清楚
    this.resultScene.setRewards(given, {
      firstClear,
      firstThreeStar,
      requested: rewards
    })
    this.resultScene.setAchievements(newAchievements)
    this.resultScene.show()

    this.prefetchNextLevel()
  }

  /**
   * 预热下一关（G1）
   *
   * 第 200 关之后的关卡是运行时生成的，单关要跑十几次 BFS（手机上
   * 100~300ms）。玩家点「下一关」时再算就会卡一下，所以趁结算页正在展示
   * 的空档先生成好，点下去直接命中缓存。
   *
   * 用 setTimeout 而不是立刻执行：结算页刚 show()，同步跑生成会把
   * 出场动画卡住。
   */
  prefetchNextLevel() {
    if (typeof setTimeout !== 'function') return

    const next = this.currentLevel + 1
    setTimeout(() => {
      try {
        this.levelManager.getLevel(next)
      } catch (e) {
        // 预热失败无所谓，真正加载时会再算一次
        console.warn('预生成下一关失败:', e && e.message)
      }
    }, 400)
  }

  /**
   * 读取某关的奖励发放记录（F1）
   * @param {number} level
   * @returns {{first:boolean, three:boolean}}
   */
  readLevelReward(level) {
    try {
      const saved = wx.getStorageSync(`levelReward_${level}`)
      return {
        first: !!(saved && saved.first),
        three: !!(saved && saved.three)
      }
    } catch (e) {
      return { first: false, three: false }
    }
  }

  /**
   * 记录某关已发放过的奖励
   * @param {number} level
   * @param {{first?:boolean, three?:boolean}} patch
   */
  markLevelRewarded(level, patch = {}) {
    try {
      const current = this.readLevelReward(level)
      const next = {
        first: current.first || !!patch.first,
        three: current.three || !!patch.three
      }
      wx.setStorageSync(`levelReward_${level}`, next)
    } catch (e) {
      console.error('保存奖励记录失败:', e)
    }
  }

  /**
   * 取出新解锁的成就：发放奖励 +（可选）弹通知
   *
   * @param {Object} [options]
   * @param {boolean} [options.notify=true] - 是否走浮层通知
   *        通关场景传 false：结算面板自己会显示成就条，再叠一层浮层就是重复且会糊住标题
   * @returns {Array} 本次新解锁的成就
   */
  flushAchievementRewards(options = {}) {
    if (!this.achievementManager) return []

    const { notify = true } = options
    const newAchievements = this.achievementManager.getNewUnlocked()
    newAchievements.forEach(achievement => {
      if (notify && this.achievementNotification) {
        this.achievementNotification.add(achievement)
      }
      if (achievement.reward) {
        this.foodManager.giveRewards(achievement.reward)
      }
    })
    return newAchievements
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
    const vp = viewport()

    // 每帧把基准变换重置为「逻辑坐标 → 设备像素」，
    // 之后所有绘制（包括各场景内部的 save/scale）都用逻辑坐标书写。
    // 少了这一步，画布会被放大 dpr 倍，只有左上角 1/dpr 的内容可见。
    this.ctx.setTransform(DPR, 0, 0, DPR, 0, 0)

    // 清屏（此时已是缩放后的坐标系，按逻辑尺寸清就等于清满整块画布）
    this.ctx.clearRect(0, 0, vp.width, vp.height)

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
