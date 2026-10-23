/**
 * 离线回归 harness（A 批次稳定性 + B 批次合规）
 * 用 vm.SourceTextModule 直接加载真实模块（不改动源码），验证：
 *   [1-12] A 批次：布局自适应、坐标映射、通关结算、状态复位、开放数据域排行榜
 *   [13]   B1：诱导分享下线、成就替换
 *   [14]   B2：激励视频配置校验与完整观看判定
 *   [15]   B3：分享图 / BGM 资源就位
 *   [16]   B4：隐私授权弹窗与 resolve 语义
 *   [17]   B5：包体上传排除项
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { pathToFileURL } from 'node:url'

const ROOT = path.resolve(process.argv[2] || '.')
const LAYOUT_TOP_MIN = 96
let clock = 1_700_000_000_000
const realNow = Date.now
Date.now = () => clock

// ---------- Canvas / ctx stubs ----------
function makeCtx() {
  const state = {}
  return new Proxy(state, {
    get(target, key) {
      if (key === 'measureText') return (text) => ({ width: String(text).length * 8 })
      if (key === 'createLinearGradient' || key === 'createRadialGradient') {
        return () => ({ addColorStop() {} })
      }
      if (key in target) return target[key]
      return () => {}
    },
    set(target, key, value) {
      target[key] = value
      return true
    }
  })
}

const canvas = { width: 375, height: 667, getContext: () => makeCtx() }

// ---------- wx stub ----------
const storage = new Map()
const openDataMessages = []
const audioStub = () => ({
  src: '', loop: false, volume: 1,
  play() {}, pause() {}, stop() {}, destroy() {},
  onError() {}, onPlay() {}, onEnded() {}
})

const wxBase = {
  env: { USER_DATA_PATH: '/tmp' },
  getStorageSync: (k) => (storage.has(k) ? storage.get(k) : ''),
  setStorageSync: (k, v) => { storage.set(k, v) },
  removeStorageSync: (k) => { storage.delete(k) },
  getSystemInfoSync: () => ({
    windowWidth: canvas.width,
    windowHeight: canvas.height,
    pixelRatio: 2,
    platform: 'devtools'
  }),
  createInnerAudioContext: audioStub,
  createImage: () => ({ set src(v) {}, onload: null }),
  createCanvas: () => ({ width: 0, height: 0, getContext: () => makeCtx() }),
  getOpenDataContext: () => ({
    canvas: { width: canvas.width, height: canvas.height },
    postMessage: (msg) => { openDataMessages.push(msg) }
  }),
  getFileSystemManager: () => ({
    readFile: ({ fail }) => fail && fail(new Error('ENOENT'))
  }),
  onTouchStart() {}, onTouchMove() {}, onTouchEnd() {},
  onShareAppMessage() {}, onShareTimeline() {}, showShareMenu() {},
  setUserCloudStorage() {}, getFriendCloudStorage() {},
  vibrateShort() {}, vibrateLong() {},
  showToast() {}, showModal() {}, showLoading() {}, hideLoading() {},
  login() {}, getUserInfo() {}, getUserProfile() {},
  shareAppMessage() {}, exitMiniProgram() {},
  createRewardedVideoAd: () => ({ load: () => Promise.resolve(), show: () => Promise.resolve(), onLoad() {}, onError() {}, onClose() {} }),
  createBannerAd: () => ({ show: () => Promise.resolve(), hide() {}, destroy() {}, onError() {}, onResize() {} }),
  createInterstitialAd: () => ({ show: () => Promise.resolve(), onLoad() {}, onError() {} })
}

const wx = new Proxy(wxBase, {
  get(target, key) {
    if (key in target) return target[key]
    return () => {}
  }
})

// ---------- 模块加载器（补全无扩展名的相对路径） ----------
const context = vm.createContext({
  canvas,
  wx,
  console,
  Date,
  Math,
  JSON,
  parseInt,
  parseFloat,
  isNaN,
  Number,
  String,
  Object,
  Array,
  Promise,
  Error,
  setTimeout,
  clearTimeout,
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
  globalThis: null
})
context.globalThis = context

/**
 * 模块图加载器
 *
 * 不能用「递归 link 子模块」的写法：link() 是异步的，父模块的 link 会在
 * 等子模块时把状态留在 linking，此时若另一个兄弟模块也 import 同一文件，
 * 拿到的就是一个未 link 完成的模块，V8 直接报 "not been linked"。
 *
 * 改成三段式：先整图建模块 → 按依赖顺序 link → 按依赖顺序 evaluate。
 */
const cache = new Map()
const evaluated = new Set()

function resolveSpecifier(specifier, referencingId) {
  if (!specifier.startsWith('.')) return null
  const baseDir = path.dirname(referencingId)
  let file = path.resolve(baseDir, specifier)
  if (!file.endsWith('.js')) file += '.js'
  return file
}

function buildModule(file) {
  if (cache.has(file)) return cache.get(file)

  let source = fs.readFileSync(file, 'utf8')
  // 只改这一处：把自动实例化挂到全局，便于断言
  if (file.endsWith(`${path.sep}game.js`)) {
    source = source.replace('new Main()', 'globalThis.__game = new Main()')
  }

  const mod = new vm.SourceTextModule(source, {
    identifier: file,
    context,
    initializeImportMeta() {}
  })
  cache.set(file, mod)
  return mod
}

/**
 * 静态解析 import 语句拿依赖（只用于决定 link 顺序，不参与求值）
 */
function collectDeps(file) {
  const source = fs.readFileSync(file, 'utf8')
  const deps = []
  const re = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g
  let match
  while ((match = re.exec(source)) !== null) {
    const resolved = resolveSpecifier(match[1], file)
    // 注释或字符串里出现的伪 import 会解析到不存在的文件，直接忽略
    if (resolved && fs.existsSync(resolved)) deps.push(resolved)
  }
  return deps
}

async function loadModule(entry) {
  if (evaluated.has(entry)) return cache.get(entry)

  // 1) 后序遍历建图：依赖排在前面
  const order = []
  const seen = new Set()
  const visiting = new Set()
  const visit = (file) => {
    if (seen.has(file) || visiting.has(file)) return
    visiting.add(file)
    buildModule(file)
    for (const dep of collectDeps(file)) visit(dep)
    visiting.delete(file)
    seen.add(file)
    order.push(file)
  }
  visit(entry)

  // 2) 依赖先 link：linker 里只返回已建好的模块，保证状态不会卡在 linking
  for (const file of order) {
    const mod = cache.get(file)
    if (mod.status !== 'unlinked') continue
    await mod.link((specifier, referencing) => {
      const resolved = resolveSpecifier(specifier, referencing.identifier)
      if (!resolved) throw new Error(`无法解析: ${specifier}`)
      const dep = cache.get(resolved)
      if (!dep) throw new Error(`未预加载: ${resolved}`)
      return dep
    })
  }

  // 3) 依赖先求值
  for (const file of order) {
    const mod = cache.get(file)
    if (evaluated.has(file) || mod.status !== 'linked') continue
    evaluated.add(file)
    await mod.evaluate()
  }

  return cache.get(entry)
}

// ---------- 断言 ----------
let passed = 0
let failed = 0
function check(name, condition, detail = '') {
  if (condition) {
    passed++
    console.log(`  ✅ ${name}`)
  } else {
    failed++
    console.log(`  ❌ ${name} ${detail}`)
  }
}

// ---------- 开始 ----------
await loadModule(path.join(ROOT, 'game.js'))
const game = context.__game
if (!game) throw new Error('游戏实例未创建')

console.log('\n[1] 布局自适应（A5）')
const sizes = [
  [320, 568, 'iPhone SE'],
  [375, 667, 'iPhone 8'],
  [390, 844, 'iPhone 14'],
  [412, 915, 'Android 大屏'],
  [768, 1024, 'iPad']
]
for (const [w, h, label] of sizes) {
  canvas.width = w
  canvas.height = h
  game.computeLayout()
  const fitsX = game.boardOffsetX >= 0
  const fitsY = game.boardOffsetY >= LAYOUT_TOP_MIN
  const bottom = game.boardOffsetY + game.boardHeight
  check(
    `${label} ${w}x${h}: 格子 ${game.cellSize}px，原点 (${game.boardOffsetX},${game.boardOffsetY})，底边 ${bottom}`,
    fitsX && game.cellSize >= 28 && game.cellSize <= 56 && bottom <= h - 40,
    `[fitsX=${fitsX} bottom=${bottom} h=${h}]`
  )
}

console.log('\n[2] 关卡坐标 → 棋盘映射（A5）')
canvas.width = 375
canvas.height = 667
game.computeLayout()
const p1 = game.toBoardPixel({ x: 50, y: 50 })
check('level1 企鹅 (50,50) → 第 1 列 1 行',
  game.getCell({ x: p1.x, y: p1.y }).col === 1 && game.getCell({ x: p1.x, y: p1.y }).row === 1,
  JSON.stringify(game.getCell({ x: p1.x, y: p1.y })))
const s1 = game.toBoardPixel({ x: 200, y: 150 })
check('level1 冰块 (200,150) → 第 4 列 3 行',
  game.getCell({ x: s1.x, y: s1.y }).col === 4 && game.getCell({ x: s1.x, y: s1.y }).row === 3,
  JSON.stringify(game.getCell({ x: s1.x, y: s1.y })))

console.log('\n[3] 加载关卡与对象尺寸')
await game.loadLevel(1)
check('penguin 尺寸 = 格子尺寸', game.penguin.width === game.cellSize, `${game.penguin.width} vs ${game.cellSize}`)
check('stone 尺寸 = 格子尺寸', game.stones[0].width === game.cellSize, `${game.stones[0].width}`)
check('target 宽度 = 1 格', game.target.width === game.cellSize, `${game.target.width}`)
check('障碍物为空', game.obstacles.length === 0, `${game.obstacles.length}`)
check('gameState = playing', game.gameState === 'playing', game.gameState)

console.log('\n[4] 按最优解 13 步通关（走真实触摸链路）')
const DIR_DELTA = { right: [40, 0], left: [-40, 0], up: [0, -40], down: [0, 40] }
function swipe(dir) {
  const [dx, dy] = DIR_DELTA[dir]
  const start = { clientX: 200, clientY: 300 }
  const end = { clientX: 200 + dx, clientY: 300 + dy }
  game.touchStartHandler({ touches: [start] })
  game.touchMoveHandler({ touches: [end] })
  clock += 300
  game.update()                        // 让上一段动画结束
  game.touchEndHandler({ changedTouches: [end] })
  clock += 300
  game.update()
}

const plan = ['right', 'right', 'down', 'down', 'right', 'right', 'up', 'right', 'down', 'down', 'down', 'down', 'down']
for (const dir of plan) swipe(dir)

check(`步数 = 13（实际 ${game.moves}）`, game.moves === 13, `${game.moves}`)
check(`gameState = win（实际 ${game.gameState}）`, game.gameState === 'win', game.gameState)

console.log('\n[5] 结算统计（A3）')
const stats = game.settlementManager.totalStats
check(`totalStars = 3（实际 ${stats.totalStars}）`, stats.totalStars === 3, `${stats.totalStars}`)
check(`perfectGames = 1（实际 ${stats.perfectGames}）`, stats.perfectGames === 1, `${stats.perfectGames}`)
check(`totalWins = 1（实际 ${stats.totalWins}）`, stats.totalWins === 1, `${stats.totalWins}`)
const summary = game.settlementManager.getSettlementSummary()
// C4 之后 par = ceil(optimal × 1.2)，不再是 optimal 本身，断言改为跟着关卡数据走
const parOfLevel1 = game.levelManager.getLevel(1).par
check(`summary.stars = 3 / par = ${parOfLevel1} / moves = 13`,
  summary && summary.stars === 3 && summary.par === parOfLevel1 && summary.moves === 13,
  JSON.stringify(summary))
const expectEfficiency = Math.floor((parOfLevel1 / 13) * 100)
check(`efficiency = floor(par/moves×100) = ${expectEfficiency}（实际 ${summary && summary.efficiency}）`,
  summary && summary.efficiency === expectEfficiency, `${summary && summary.efficiency}`)
check(`13 步低于 par(${parOfLevel1})，判定为完美通关`,
  summary && summary.moves <= summary.par)

console.log('\n[6] 成就通知与奖励（A4）')
const unlocked = game.achievementManager.unlockedAchievements
check(`解锁了 first_win（已解锁 ${unlocked.join(',')}）`, unlocked.includes('first_win'))
check(`成就通知已入队（${game.achievementNotification.notifications.length} 条）`,
  game.achievementNotification.notifications.length >= 1, `${game.achievementNotification.notifications.length}`)
check('newUnlocked 已被消费清空', game.achievementManager.newUnlocked.length === 0,
  `${game.achievementManager.newUnlocked.length}`)
check(`食物奖励到账（总 ${game.foodManager.getTotalFood()}）`, game.foodManager.getTotalFood() > 0,
  `${game.foodManager.getTotalFood()}`)

console.log('\n[7] 暂停/返回菜单状态复位（A1）')
await game.loadLevel(2)
check('重新进入关卡后 gameState = playing', game.gameState === 'playing', game.gameState)
game.pauseGame()
check('暂停后 isPaused = true', game.isPaused === true, `${game.isPaused}`)
check('暂停面板可见', game.pauseScene.isVisible === true, `${game.pauseScene.isVisible}`)
game.pauseScene.onBackToMenu()
check('返回菜单后 isPaused = false', game.isPaused === false, `${game.isPaused}`)
check('返回菜单后 gameState = menu', game.gameState === 'menu', game.gameState)
check('暂停面板已隐藏', game.pauseScene.isVisible === false, `${game.pauseScene.isVisible}`)
check('场景已切到 menu', game.sceneManager.getCurrentSceneName() === 'menu',
  game.sceneManager.getCurrentSceneName())

// 回归死锁：返回菜单后，触摸必须能到达菜单按钮
const menuScene = game.sceneManager.getCurrentScene()
const mainBtn = menuScene.mainButton
mainBtn.isHovered = false
game.touchStartHandler({ touches: [{ clientX: mainBtn.x + mainBtn.width / 2, clientY: mainBtn.y + mainBtn.height / 2 }] })
check('返回菜单后主按钮能收到触摸（不再被 isPaused 吞掉）', mainBtn.isHovered === true, `${mainBtn.isHovered}`)
mainBtn.isHovered = false

console.log('\n[8] 游戏结束页 / 复活页的广告入口（A2）')
let crash = null
try {
  game.onGameOverWatchAd()
} catch (e) {
  crash = e
}
check('广告不可用时 onGameOverWatchAd 不再抛异常', crash === null, crash && crash.message)

game.gameOverScene.setWatchAdVisible(false)
check('隐藏广告后，返回菜单按钮上移到 y=502',
  game.gameOverScene.buttons[2].y === 502, `${game.gameOverScene.buttons[2].y}`)
check('广告按钮已隐藏', game.gameOverScene.buttons[1].isVisible === false,
  `${game.gameOverScene.buttons[1].isVisible}`)
game.gameOverScene.setWatchAdVisible(true)
check('恢复广告后，返回菜单按钮回到 y=568',
  game.gameOverScene.buttons[2].y === 568, `${game.gameOverScene.buttons[2].y}`)

game.reviveScene.setOptionVisible('watchAd', false)
check('复活页广告按钮已隐藏', game.reviveScene.buttons[0].isVisible === false,
  `${game.reviveScene.buttons[0].isVisible}`)
check('隐藏广告后"食物复活"上移到 y=226', game.reviveScene.buttons[1].y === 226,
  `${game.reviveScene.buttons[1].y}`)
check('隐藏广告后"放弃重玩"上移到 y=316（含 20px 间隔）',
  game.reviveScene.buttons[2].y === 316, `${game.reviveScene.buttons[2].y}`)
game.reviveScene.setOptionVisible('watchAd', true)
check('恢复广告后"放弃重玩"回到 y=386（226 + 2×70 + 20）',
  game.reviveScene.buttons[2].y === 386, `${game.reviveScene.buttons[2].y}`)

console.log('\n[9] 结算幂等（A3）')
const before = game.settlementManager.totalStats.totalGames
game.settlementManager.completeLevel({ moves: 5, time: 9, par: 10, stars: 3 })
const mid = game.settlementManager.totalStats.totalGames
game.settlementManager.completeLevel({ moves: 5, time: 9, par: 10, stars: 3 })
const after = game.settlementManager.totalStats.totalGames
check(`首次结算 +1（${before} → ${mid}）`, mid === before + 1, `${before} → ${mid}`)
check(`重复结算不再累加（${mid} → ${after}）`, after === mid, `${mid} → ${after}`)

console.log('\n[10] 带障碍物关卡的对象映射（A5）')
// 关卡体系在 C5 重建后编号已重排，改为「找一关真有障碍物的关卡」再按关卡数据校验映射
let obstacleLevelNum = 0
for (let i = 1; i <= game.levelManager.getCampaignSize(); i++) {
  const lv = game.levelManager.getLevel(i)
  if (lv.obstacles && lv.obstacles.length >= 3) {
    obstacleLevelNum = i
    break
  }
}
check(`战役中存在带障碍物的关卡（第 ${obstacleLevelNum} 关）`, obstacleLevelNum > 0)

game.foodManager.addFish(50)
await game.loadLevel(obstacleLevelNum)
const lvObstacles = game.levelManager.getLevel(obstacleLevelNum)
const rawCell = (p) => ({ col: Math.round(p.x / 50), row: Math.round(p.y / 50) })

let obstacleMapOk = true
for (const raw of lvObstacles.obstacles) {
  const expect = rawCell(raw)
  if (!game.getObstacleAt(expect.col, expect.row, raw.type)) {
    obstacleMapOk = false
    console.log(`    缺失 ${raw.type} @ (${expect.col},${expect.row})`)
  }
}
check(`第 ${obstacleLevelNum} 关 ${lvObstacles.obstacles.length} 个障碍物全部按格映射`,
  obstacleMapOk && game.obstacles.length === lvObstacles.obstacles.length,
  `${game.obstacles.length}/${lvObstacles.obstacles.length}`)

let stoneMapOk = true
for (const raw of lvObstacles.stones) {
  const expect = rawCell(raw)
  if (!game.getStoneAt(expect.col, expect.row)) {
    stoneMapOk = false
    console.log(`    缺失冰块 @ (${expect.col},${expect.row})`)
  }
}
check(`第 ${obstacleLevelNum} 关 ${lvObstacles.stones.length} 块冰块全部按格映射`, stoneMapOk)

const expectCols = Math.max(1, Math.round(lvObstacles.target.width / 50))
const expectRows = Math.max(1, Math.round(lvObstacles.target.height / 50))
check(`目标区映射为 ${expectCols}x${expectRows} 格`,
  game.target.cols === expectCols && game.target.rows === expectRows,
  `${game.target.cols}x${game.target.rows}`)

console.log('\n[11] 排行榜走开放数据域（A6）')
game.sceneManager.switchTo('rank')
check('切换排行榜后下发了 SHOW_RANK',
  openDataMessages.some(m => m.type === 'SHOW_RANK'),
  JSON.stringify(openDataMessages.map(m => m.type)))
const showMsg = openDataMessages.find(m => m.type === 'SHOW_RANK')
check('SHOW_RANK 携带内容区域（避开标题与返回按钮）',
  showMsg && showMsg.layout && showMsg.layout.y >= 96 && showMsg.layout.height > 0,
  JSON.stringify(showMsg && showMsg.layout))
game.sceneManager.switchTo('menu')
check('离开排行榜后下发了 HIDE_RANK',
  openDataMessages.some(m => m.type === 'HIDE_RANK'),
  JSON.stringify(openDataMessages.map(m => m.type)))

console.log('\n[12] 渲染不抛异常')
let renderOk = true
try {
  game.render()
  game.sceneManager.switchTo('rank')
  game.render()
  game.sceneManager.switchTo('menu')
} catch (e) {
  renderOk = false
  console.log('    渲染异常:', e.message)
}
check('render() 正常执行', renderOk)

// ================= B 批次（合规整改） =================

console.log('\n[13] B1 诱导分享已下线')
const reviveKeys = game.reviveScene.buttonKeys.join(',')
check(`复活页按钮只保留 watchAd/useFood/giveUp（实际 ${reviveKeys}）`,
  reviveKeys === 'watchAd,useFood,giveUp', reviveKeys)
const remainKeys = Object.keys(game.reviveManager.getStatus().remaining).sort().join(',')
check(`复活状态只含 useFood/watchAd（实际 ${remainKeys}）`,
  remainKeys === 'useFood,watchAd', remainKeys)
check('wechat-service 不再暴露分享奖励回调',
  typeof game.wechatService.setShareRewardCallback === 'undefined')
check('wechat-service 不再有分享冷却',
  typeof game.wechatService.getShareCooldownRemaining === 'undefined')
check('game.onShareReward 已删除', typeof game.onShareReward === 'undefined')
check('结算统计不再记录分享次数',
  !Object.prototype.hasOwnProperty.call(game.settlementManager.totalStats, 'shares'))

const achievementIds = game.achievementManager.achievements.map(a => a.id)
check('已移除不可达的 first_share / share_10',
  !achievementIds.includes('first_share') && !achievementIds.includes('share_10'))
check('替换为 revive_first / revive_10',
  achievementIds.includes('revive_first') && achievementIds.includes('revive_10'))

// 复活一次 → 应解锁 revive_first
game.achievementManager.recordRevive()
check('复活 1 次解锁 revive_first',
  game.achievementManager.unlockedAchievements.includes('revive_first'),
  game.achievementManager.unlockedAchievements.join(','))
game.achievementManager.getNewUnlocked()

console.log('\n[14] B2 激励视频广告接入')
const AdManager = (await loadModule(path.join(ROOT, 'js/utils/ad-manager.js'))).namespace.default

check('空字符串不是合法广告位', AdManager.isValidAdUnitId('') === false)
check('占位符 adunit-xxx 不合法', AdManager.isValidAdUnitId('adunit-xxx') === false)
check('真实广告位 adunit-1234567890abcdef 合法',
  AdManager.isValidAdUnitId('adunit-1234567890abcdef') === true)

const adOff = new AdManager({})
adOff.init()
check('未配置广告位时不创建实例', adOff.isRewardedVideoAvailable() === false)
check('未配置时 showRewardedVideoAd resolve(false)',
  (await adOff.showRewardedVideoAd()) === false)
check('game.adAvailable 与配置一致（当前未配置 → false）',
  game.adAvailable === false && game.adManager.isConfigured() === false)
game.reviveScene.setOptionVisible('watchAd', game.adAvailable)
check('广告不可用时复活页隐藏"看视频复活"',
  game.reviveScene.buttons[0].isVisible === false, `${game.reviveScene.buttons[0].isVisible}`)

// 用可控桩验证完整观看 / 中途关闭
let adCloseCb = null
wxBase.createRewardedVideoAd = () => ({
  load: () => Promise.resolve(),
  show: () => Promise.resolve(),
  onLoad() {},
  onError() {},
  onClose(cb) { adCloseCb = cb }
})
const adOn = new AdManager({ rewardedVideo: 'adunit-1234567890abcdef' })
adOn.init()
check('配置合法广告位后可用', adOn.isRewardedVideoAvailable() === true)
const watchEnded = adOn.showRewardedVideoAd()
adCloseCb({ isEnded: true })
check('完整观看 → resolve(true)', (await watchEnded) === true)
const watchQuit = adOn.showRewardedVideoAd()
adCloseCb({ isEnded: false })
check('中途关闭 → resolve(false)', (await watchQuit) === false)

console.log('\n[15] B3 资源补齐')
const shareImage = path.join(ROOT, 'images/share-image.png')
const bgmFile = path.join(ROOT, 'audio/bgm.wav')
check('images/share-image.png 存在', fs.existsSync(shareImage))
if (fs.existsSync(shareImage)) {
  const buf = fs.readFileSync(shareImage)
  const isPng = buf.slice(1, 4).toString() === 'PNG'
  const w = buf.readUInt32BE(16)
  const h = buf.readUInt32BE(20)
  check(`分享图为合法 PNG 且为 500x400（实际 ${w}x${h}）`,
    isPng && w === 500 && h === 400, `${w}x${h}`)
}
check('audio/bgm.wav 存在', fs.existsSync(bgmFile))
if (fs.existsSync(bgmFile)) {
  const size = fs.statSync(bgmFile).size
  check(`bgm.wav 体积合理（${Math.round(size / 1024)}KB）`,
    size > 100 * 1024 && size < 1024 * 1024, `${size}`)
}
check('BGM 候选源优先 mp3、回落 wav',
  game.audioManager.bgmSources[0] === 'audio/bgm.mp3' &&
  game.audioManager.bgmSources[1] === 'audio/bgm.wav',
  game.audioManager.bgmSources.join(' > '))

console.log('\n[16] B4 隐私授权')
check('隐私弹窗已创建', !!game.privacyScene)
let privacyResolved = null
game.privacyScene.show((res) => { privacyResolved = res })
check('隐私弹窗可展示', game.privacyScene.isVisible === true)

// 弹窗展示时触摸必须被吞掉
const menuNow = game.sceneManager.getCurrentScene()
const probe = menuNow.mainButton
probe.isHovered = false
game.touchStartHandler({ touches: [{ clientX: probe.x + probe.width / 2, clientY: probe.y + probe.height / 2 }] })
check('隐私弹窗展示时吞掉菜单按钮触摸', probe.isHovered === false, `${probe.isHovered}`)

game.privacyScene.handleAgree()
check('同意后 resolve({ event: "agree" })',
  privacyResolved && privacyResolved.event === 'agree', JSON.stringify(privacyResolved))
check('同意后弹窗关闭', game.privacyScene.isVisible === false)

game.privacyScene.show((res) => { privacyResolved = res })
game.privacyScene.handleDisagree()
check('拒绝后 resolve({ event: "disagree" })',
  privacyResolved && privacyResolved.event === 'disagree', JSON.stringify(privacyResolved))

game.privacyScene.show(() => {})
let privacyRenderOk = true
try {
  game.render()
} catch (e) {
  privacyRenderOk = false
  console.log('    隐私弹窗渲染异常:', e.message)
}
check('隐私弹窗 render() 正常执行', privacyRenderOk)
game.privacyScene.handleDisagree()

console.log('\n[17] B5 包体排除项')
const projectConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'project.config.json'), 'utf8'))
const ignored = (projectConfig.packOptions && projectConfig.packOptions.ignore) || []
const ignoredValues = ignored.map(i => i.value)
for (const target of ['docs', 'local-preview', 'tools', 'penguin-skating-design.html', 'README.md']) {
  check(`已排除 ${target}`, ignoredValues.includes(target), ignoredValues.join(','))
}

console.log('\n[18] C 批次：适配 / 生命周期 / 数值 / 关卡 / 账号')

// ---------- C1 设计稿坐标系 ----------
const layoutMod = await loadModule(path.join(ROOT, 'js/ui/layout.js'))
const { stage, DESIGN_WIDTH, DESIGN_HEIGHT } = layoutMod.namespace

canvas.width = 375
canvas.height = 667
const stageBase = stage()
check('375x667 即设计基准（scale=1、无偏移）',
  stageBase.scale === 1 && stageBase.offsetX === 0 && stageBase.offsetY === 0,
  `scale=${stageBase.scale} off=(${stageBase.offsetX},${stageBase.offsetY})`)

canvas.width = 320
canvas.height = 568
const stageSmall = stage()
check('320x568 等比缩放并在两侧留边（不拉伸变形）',
  stageSmall.scale > 0.8 && stageSmall.scale < 0.9 &&
  stageSmall.offsetX >= 0 &&
  Math.abs(stageSmall.offsetX * 2 + DESIGN_WIDTH * stageSmall.scale - 320) < 0.01,
  `scale=${stageSmall.scale.toFixed(4)} off=(${stageSmall.offsetX.toFixed(1)},${stageSmall.offsetY.toFixed(1)})`)

const designPoint = { clientX: 187.5, clientY: 333.5 }
const projected = stageSmall.project(designPoint.clientX, designPoint.clientY)
const roundTrip = stageSmall.unproject({ clientX: projected.x, clientY: projected.y })
check('触摸反投影可往返（设计坐标 ↔ 真实像素）',
  Math.abs(roundTrip.clientX - designPoint.clientX) < 0.01 &&
  Math.abs(roundTrip.clientY - designPoint.clientY) < 0.01,
  `${roundTrip.clientX},${roundTrip.clientY}`)

// 按钮坐标必须与画布尺寸无关，否则说明还在用 canvas.width 算布局
canvas.width = 375
canvas.height = 667
game.menuScene.relayout()
const menuAt375 = JSON.stringify(game.menuScene.buttons.map(b => [b.x, b.y, b.width, b.height]))
game.pauseScene.relayout()
const pauseAt375 = JSON.stringify(game.pauseScene.buttons.map(b => [b.x, b.y, b.width, b.height]))
canvas.width = 320
canvas.height = 568
game.menuScene.relayout()
const menuAt320 = JSON.stringify(game.menuScene.buttons.map(b => [b.x, b.y, b.width, b.height]))
game.pauseScene.relayout()
const pauseAt320 = JSON.stringify(game.pauseScene.buttons.map(b => [b.x, b.y, b.width, b.height]))
check('菜单按钮坐标与画布尺寸无关（设计稿坐标系生效）', menuAt375 === menuAt320,
  `${menuAt375} vs ${menuAt320}`)
check('暂停面板按钮坐标与画布尺寸无关', pauseAt375 === pauseAt320,
  `${pauseAt375} vs ${pauseAt320}`)

const relayoutMissing = ['menuScene', 'pauseScene', 'resultScene', 'gameOverScene', 'reviveScene', 'privacyScene']
  .filter(key => !game[key] || typeof game[key].relayout !== 'function')
check('六个 UI 场景都实现了 relayout()', relayoutMissing.length === 0, relayoutMissing.join(','))
check('HUD 实现了 relayout()', typeof game.gameHUD.relayout === 'function')

// 重排会重建按钮对象，回调必须还在，否则 resize 后按钮就点不动了
game.resultScene.relayout()
check('result-scene 重排后 onNextLevel / onReplay 回调仍在',
  typeof game.resultScene.onNextLevel === 'function' && typeof game.resultScene.onReplay === 'function')
game.pauseScene.relayout()
check('pause-scene 重排后 onResume / onRestart / onBackToMenu 回调仍在',
  typeof game.pauseScene.onResume === 'function' &&
  typeof game.pauseScene.onRestart === 'function' &&
  typeof game.pauseScene.onBackToMenu === 'function')
game.gameOverScene.setWatchAdVisible(false)
game.gameOverScene.relayout()
check('gameover-scene 重排后保持广告按钮隐藏状态',
  game.gameOverScene.buttons[1].isVisible === false, `${game.gameOverScene.buttons[1].isVisible}`)
game.gameOverScene.setWatchAdVisible(true)
game.privacyScene.relayout()
check('privacy-scene 重复重排不会累积按钮',
  game.privacyScene.buttons.length === 2, `${game.privacyScene.buttons.length}`)

canvas.width = 375
canvas.height = 667
game.computeLayout()

// ---------- C2 前后台与窗口生命周期 ----------
const T0 = clock
game.startTime = T0
game.pausedAccum = 0
game.pauseStartedAt = 0
game.hiddenAt = 0
game.gameState = 'playing'
game.isPaused = false

clock = T0 + 5000
check('对局 5s 后用时 5s', game.getElapsedSeconds() === 5, `${game.getElapsedSeconds()}`)

game.pauseGame()
check('暂停后状态为 paused', game.gameState === 'paused' && game.isPaused === true)
clock = T0 + 15000
check('暂停期间用时冻结在 5s（暂停时长实时扣除）',
  game.getElapsedSeconds() === 5, `${game.getElapsedSeconds()}`)
game.resumeGame()
check('恢复后 15s 处的用时仍为 5s', game.getElapsedSeconds() === 5, `${game.getElapsedSeconds()}`)

// 切后台 30s
game.handleHide()
check('切后台自动暂停对局', game.gameState === 'paused', game.gameState)
clock = T0 + 45000
check('后台 30s 期间用时仍为 5s（不跳变）',
  game.getElapsedSeconds() === 5, `${game.getElapsedSeconds()}`)
game.handleShow()
check('回到前台后用时仍为 5s', game.getElapsedSeconds() === 5, `${game.getElapsedSeconds()}`)
check('回到前台不自动续玩（等玩家点继续）', game.gameState === 'paused', game.gameState)

game.resumeGame()
clock = T0 + 48000
check('恢复后继续正常计时（5+3=8s）', game.getElapsedSeconds() === 8, `${game.getElapsedSeconds()}`)

// 窗口尺寸变化：棋盘与对象必须一起重算
const PenguinClass = (await loadModule(path.join(ROOT, 'js/runtime/penguin.js'))).namespace.default
const StoneClass = (await loadModule(path.join(ROOT, 'js/runtime/stone.js'))).namespace.default
const TargetClass = (await loadModule(path.join(ROOT, 'js/runtime/target.js'))).namespace.default

canvas.width = 375
canvas.height = 667
game.computeLayout()
const cellBeforeResize = game.cellSize

game.penguin = new PenguinClass({ x: 0, y: 0, size: game.cellSize })
const penguinPixel = game.cellToPixel(1, 1)
game.penguin.x = penguinPixel.x
game.penguin.y = penguinPixel.y
game.stones = [new StoneClass({ x: 0, y: 0, size: game.cellSize })]
const stonePixel = game.cellToPixel(4, 3)
game.stones[0].x = stonePixel.x
game.stones[0].y = stonePixel.y
game.obstacles = []
game.target = new TargetClass({
  x: 0, y: 0, width: game.cellSize * 2, height: game.cellSize, cellSize: game.cellSize
})
const targetPixel = game.cellToPixel(3, 6)
game.target.x = targetPixel.x
game.target.y = targetPixel.y

game.handleResize({ windowWidth: 320, windowHeight: 568 })
check('resize 后画布尺寸同步（320x568）', canvas.width === 320 && canvas.height === 568,
  `${canvas.width}x${canvas.height}`)
check(`resize 后棋盘按新画布重算（${cellBeforeResize} → ${game.cellSize}）`,
  game.cellSize !== cellBeforeResize && game.cellSize >= 28, `${game.cellSize}`)
const penguinCellAfter = game.getCell(game.penguin)
check('resize 后企鹅仍落在原格 (1,1)',
  penguinCellAfter.col === 1 && penguinCellAfter.row === 1, JSON.stringify(penguinCellAfter))
const stoneCellAfter = game.getCell(game.stones[0])
check('resize 后冰块仍落在原格 (4,3)',
  stoneCellAfter.col === 4 && stoneCellAfter.row === 3, JSON.stringify(stoneCellAfter))
check('resize 后对象尺寸跟随新格子',
  game.penguin.width === game.cellSize && game.stones[0].width === game.cellSize,
  `${game.penguin.width}/${game.cellSize}`)
check('resize 后目标区仍是 2x1 格',
  game.target.cols === 2 && game.target.rows === 1, `${game.target.cols}x${game.target.rows}`)
let resizeRenderOk = true
try {
  game.render()
} catch (e) {
  resizeRenderOk = false
  console.log('    resize 后渲染异常:', e.message)
}
check('resize 后 render() 正常执行', resizeRenderOk)

canvas.width = 375
canvas.height = 667
game.computeLayout()
game.relayoutUI()

// ---------- C3 食物经济 ----------
const FoodMod = await loadModule(path.join(ROOT, 'js/utils/food-manager.js'))
const fm = new FoodMod.namespace.default()
const emptyRewards = () => ({ fish: 0, shrimp: 0, squid: 0, goldfish: 0, details: [] })

const r50 = emptyRewards()
fm.applyBonus(r50, 50, 't')
check('50 价值 → 1 金鱼（金鱼档不再被鱿鱼分支吞掉）',
  r50.goldfish === 1 && r50.squid === 0, JSON.stringify(r50))
const r10 = emptyRewards()
fm.applyBonus(r10, 10, 't')
check('10 价值 → 1 鱿鱼', r10.squid === 1 && r10.goldfish === 0, JSON.stringify(r10))
const r3 = emptyRewards()
fm.applyBonus(r3, 3, 't')
check('3 价值 → 1 虾', r3.shrimp === 1, JSON.stringify(r3))
const r1 = emptyRewards()
fm.applyBonus(r1, 1, 't')
check('1 价值 → 1 鱼', r1.fish === 1, JSON.stringify(r1))

fm.food = { fish: 0, shrimp: 0, squid: 0, goldfish: 0 }
fm.maxFood = 30
fm.recoveryRate = 1
fm.recoveryInterval = 5
const intervalMs = 5 * 60 * 1000
fm.lastRecoveryTime = Date.now() - (intervalMs + 30 * 1000)
const recovered = fm.checkRecovery()
check('恢复 1 点并保留 30s 余数（不再白丢整周期进度）',
  recovered === 1 && Date.now() - fm.lastRecoveryTime === 30000,
  `recovered=${recovered} rest=${Date.now() - fm.lastRecoveryTime}ms`)

// ---------- C4 / C5 关卡体系 ----------
const lm = game.levelManager
check('战役共 60 关', lm.getCampaignSize() === 60, `${lm.getCampaignSize()}`)

let parOk = true
let parDetail = ''
let optimalMonotonic = true
let prevOptimal = -1
const boardKeys = new Set()
let hasOptimal = true
for (let i = 1; i <= 60; i++) {
  const lv = lm.getLevel(i)
  if (!lv || typeof lv.optimal !== 'number') {
    hasOptimal = false
    break
  }
  if (lv.par !== Math.ceil(lv.optimal * 1.2)) {
    parOk = false
    parDetail = `Lv.${i} par=${lv.par} optimal=${lv.optimal}`
  }
  if (lv.optimal < prevOptimal) {
    optimalMonotonic = false
    parDetail = parDetail || `Lv.${i} optimal=${lv.optimal} < ${prevOptimal}`
  }
  prevOptimal = lv.optimal
  boardKeys.add(JSON.stringify([lv.penguin, lv.stones, lv.target, lv.obstacles]))
}
check('每关都带 optimal 字段', hasOptimal)
check('par = ceil(optimal × 1.2)（3 星不再要求零失误）', parOk, parDetail)
check('难度按 optimal 单调递增（无断崖）', optimalMonotonic, parDetail)
check(`60 关盘面互不重复（实际 ${boardKeys.size} 个）`, boardKeys.size === 60, `${boardKeys.size}`)

const lv1 = lm.getLevel(1)
const lv60 = lm.getLevel(60)
check(`第 1 关 optimal=${lv1.optimal}、第 60 关 optimal=${lv60.optimal}（难度确实在涨）`,
  lv60.optimal > lv1.optimal, `${lv1.optimal} → ${lv60.optimal}`)
check('第 61 关起复用旧盘面（镜像或循环），不会报错',
  !!lm.getLevel(61) && !!lm.getLevel(61).stones.length)

// ---------- C6 排行榜上报口径 ----------
const WechatMod = await loadModule(path.join(ROOT, 'js/utils/wechat-service.js'))
const WechatService = WechatMod.namespace.default
check('computeScore 随关卡单调递增',
  WechatService.computeScore({ level: 1, stars: 0, moves: 99 }) <
  WechatService.computeScore({ level: 2, stars: 0, moves: 99 }))
check('computeScore 随星数单调递增',
  WechatService.computeScore({ level: 1, stars: 0, moves: 99 }) <
  WechatService.computeScore({ level: 1, stars: 3, moves: 99 }))
check('computeScore 随步数单调递减（同关步数越少分越高）',
  WechatService.computeScore({ level: 5, stars: 2, moves: 10 }) >
  WechatService.computeScore({ level: 5, stars: 2, moves: 40 }))

const svc = new WechatService()
svc.init()
svc.reportScore(10, 20, 3)
const rec1 = svc.loadCloudRecord()
svc.reportScore(8, 99, 1)
const rec2 = svc.loadCloudRecord()
check('上报只升不降（低关卡不会覆盖高关卡记录）',
  rec2.level === rec1.level && rec2.stars === rec1.stars && rec2.moves === rec1.moves,
  `${JSON.stringify(rec1)} → ${JSON.stringify(rec2)}`)

// ---------- C8 账号体系轻量化 ----------
check('伪登录场景文件已删除', !fs.existsSync(path.join(ROOT, 'js/ui/login-scene.js')))
check('wechat-service 不再提供 login()', typeof WechatService.prototype.login === 'undefined')
check('wechat-service 不再提供 getUserInfo()', typeof WechatService.prototype.getUserInfo === 'undefined')
check('主菜单不再注册 login 场景', !game.sceneManager.scenes || !game.sceneManager.scenes.login)

game.menuScene.setSoundEnabled(false)
check('音效关闭后按钮文案变为「音效 关」',
  game.menuScene.soundButton && game.menuScene.soundButton.text === '音效 关',
  game.menuScene.soundButton && game.menuScene.soundButton.text)
game.menuScene.setSoundEnabled(true)
check('音效开启后按钮文案变为「音效 开」',
  game.menuScene.soundButton && game.menuScene.soundButton.text === '音效 开',
  game.menuScene.soundButton && game.menuScene.soundButton.text)
check('主菜单挂载了分享入口（原「个人中心」位）',
  typeof game.menuScene.onShare === 'function')

console.log('\n[19] D 批次：工程化清理')

// 收集全部源码，用于静态检查
function collectSources() {
  const files = [path.join(ROOT, 'game.js')]
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.js')) files.push(full)
    }
  }
  walk(path.join(ROOT, 'js'))
  return files.map(file => ({ file, src: fs.readFileSync(file, 'utf8') }))
}
const allSources = collectSources()

// ---------- D1 死代码清理 ----------
const removedFiles = [
  'js/physics/physics.js',
  'js/physics/collision.js',
  'js/base/pool.js',
  'js/ui/level-select-scene.js',
  'open-data/index.html'
]
const stillThere = removedFiles.filter(rel => fs.existsSync(path.join(ROOT, rel)))
check('五个死代码文件已删除', stillThere.length === 0, stillThere.join(','))

const danglingImports = allSources.filter(({ src }) =>
  /from\s+['"][^'"]*(?:\/physics|base\/pool|level-select-scene)['"]/.test(src))
check('没有 import 指向已删模块', danglingImports.length === 0,
  danglingImports.map(s => path.basename(s.file)).join(','))

// ---------- D2 星级口径统一 ----------
const ScoreClass = (await loadModule(path.join(ROOT, 'js/utils/score.js'))).namespace
const { calcStars } = ScoreClass
check('步数 = par → 3 星', calcStars(16, 16) === 3, `${calcStars(16, 16)}`)
check('步数 = par×1.5 → 2 星', calcStars(24, 16) === 2, `${calcStars(24, 16)}`)
check('步数 > par×1.5 → 1 星', calcStars(25, 16) === 1, `${calcStars(25, 16)}`)
check('少于 par 仍是 3 星', calcStars(13, 16) === 3, `${calcStars(13, 16)}`)
const invalidStars = [calcStars(5, NaN), calcStars(5, undefined), calcStars(5, 0), calcStars(NaN, 10)]
check('非法参数不产生 NaN，仍返回 1~3 的整数星级',
  invalidStars.every(v => Number.isInteger(v) && v >= 1 && v <= 3),
  invalidStars.join(','))

const starDuplicates = allSources.filter(({ src }) => /TWO_STAR_RATIO|par\s*\*\s*1\.5/.test(src))
check('星级阈值只在 score.js 定义（D2）',
  starDuplicates.length === 1 && starDuplicates[0].file.endsWith('score.js'),
  starDuplicates.map(s => path.basename(s.file)).join(','))

// ---------- D3 错误兜底与热更新 ----------
check('已实现全局错误兜底', typeof game.initErrorHandler === 'function')
check('已实现热更新检查', typeof game.initUpdateManager === 'function')
check('错误自动复位有一次性开关（errorRecovered）', 'errorRecovered' in game,
  `${game.errorRecovered}`)
check('注册了 wx.onError', /wx\.onError\s*\(/.test(fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8')))
check('注册了 wx.onUnhandledRejection',
  /wx\.onUnhandledRejection\s*\(/.test(fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8')))
check('注册了 wx.getUpdateManager',
  /wx\.getUpdateManager\s*\(/.test(fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8')))

// ---------- D5 仓库配置 ----------
const gitignorePath = path.join(ROOT, '.gitignore')
check('.gitignore 已创建', fs.existsSync(gitignorePath))
if (fs.existsSync(gitignorePath)) {
  const gitignore = fs.readFileSync(gitignorePath, 'utf8')
  const ignoreLines = gitignore.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'))

  check('.gitignore 排除了 project.private.config.json',
    ignoreLines.includes('project.private.config.json'), ignoreLines.join(' '))
  check('.gitignore 排除了 .workbuddy-ai/ 与 node_modules/',
    ignoreLines.includes('.workbuddy-ai/') && ignoreLines.includes('node_modules/'))

  const wronglyIgnored = ['docs', 'docs/', 'tools', 'tools/', 'local-preview', 'local-preview/']
    .filter(name => ignoreLines.includes(name))
  check('.gitignore 没有误排除 docs / tools / local-preview', wronglyIgnored.length === 0,
    wronglyIgnored.join(','))
}

const privateConfigPath = path.join(ROOT, 'project.private.config.json')
if (fs.existsSync(privateConfigPath)) {
  const privateConfig = JSON.parse(fs.readFileSync(privateConfigPath, 'utf8'))
  check(`libVersion 与私有配置一致（${projectConfig.libVersion}）`,
    projectConfig.libVersion === privateConfig.libVersion,
    `${projectConfig.libVersion} vs ${privateConfig.libVersion}`)
}
check('包体排除项不再包含已删除的 open-data/index.html',
  !ignoredValues.includes('open-data/index.html'), ignoredValues.join(','))

// ---------- D6 滑动阈值 ----------
const freshPenguin = new PenguinClass({ x: 0, y: 0, size: 50 })

freshPenguin.handleTouchStart({ clientX: 100, clientY: 100 })
freshPenguin.handleTouchMove({ clientX: 108, clientY: 104 })
check('8px 手指抖动不算滑动（阈值 24px）', freshPenguin.handleTouchEnd() === null)

freshPenguin.handleTouchStart({ clientX: 100, clientY: 100 })
freshPenguin.handleTouchMove({ clientX: 140, clientY: 100 })
check('40px 右滑 → right', freshPenguin.handleTouchEnd() === 'right')

freshPenguin.handleTouchStart({ clientX: 100, clientY: 100 })
freshPenguin.handleTouchMove({ clientX: 100, clientY: 40 })
check('60px 上滑 → up', freshPenguin.handleTouchEnd() === 'up')

// 方向锁定：先右后上，仍取首次判定的方向
freshPenguin.handleTouchStart({ clientX: 100, clientY: 100 })
freshPenguin.handleTouchMove({ clientX: 140, clientY: 100 })
freshPenguin.handleTouchMove({ clientX: 140, clientY: 20 })
check('方向一旦判定就锁定（先右后上仍为 right）',
  freshPenguin.handleTouchEnd() === 'right')

freshPenguin.handleTouchStart({ clientX: 100, clientY: 100 })
freshPenguin.handleTouchEnd()
check('纯点击不产生移动', freshPenguin.handleTouchEnd() === null)

// ---------- D7 静态层缓存与 shadowBlur ----------
const shadowBlurHits = allSources.filter(({ src }) => /\.shadowBlur\s*=/.test(src))
check('源码中不再有 shadowBlur（D7）', shadowBlurHits.length === 0,
  shadowBlurHits.map(s => path.basename(s.file)).join(','))

const backgroundSrc = allSources.find(({ file }) => file.endsWith('background.js'))
check('背景使用离屏层缓存', !!backgroundSrc &&
  /LayerCache/.test(backgroundSrc.src) &&
  /boardLayer/.test(backgroundSrc.src) &&
  /drawOceanCached\s*\(/.test(backgroundSrc.src))

const themeCacheSrc = allSources.find(({ file }) => file.endsWith('theme.js'))
check('海洋静态层由 theme.js 统一缓存（三个界面共用一张离屏画布）',
  !!themeCacheSrc &&
  /export function drawOceanCached/.test(themeCacheSrc.src) &&
  /const oceanLayer = new LayerCache/.test(themeCacheSrc.src))

const oceanConsumers = ['menu-scene.js', 'rank-scene.js', 'background.js']
  .map((name) => allSources.find(({ file }) => file.endsWith(name)))
check('菜单 / 排行榜 / 对局都走共享海洋缓存，且不再各建一张',
  oceanConsumers.every((item) => item &&
    /drawOceanCached\s*\(/.test(item.src) &&
    !/new LayerCache\('(menu|rank)?-?ocean'\)/.test(item.src)))
check('棋盘静态部分已抽成独立方法',
  !!backgroundSrc && /drawBoardStatic\s*\(/.test(backgroundSrc.src))

const themeSrc = allSources.find(({ file }) => file.endsWith('theme.js'))
check('海洋背景已拆成静态层 / 动态层',
  !!themeSrc && /export function drawOceanBase/.test(themeSrc.src) &&
  /export function drawOceanMotion/.test(themeSrc.src))

const LayerCacheClass = (await loadModule(path.join(ROOT, 'js/utils/layer-cache.js'))).namespace.default
const cacheProbe = new LayerCacheClass('probe')
let drawCount = 0
const drawOnce = () => { drawCount++ }
let cacheOk = true
try {
  cacheProbe.render(makeCtx(), 'probe-key', 120, 90, drawOnce)
  cacheProbe.render(makeCtx(), 'probe-key', 120, 90, drawOnce)
  cacheProbe.render(makeCtx(), 'probe-key', 120, 90, drawOnce)
} catch (e) {
  cacheOk = false
  console.log('    LayerCache 异常:', e.message)
}
check('LayerCache 同 key 只绘制一次', cacheOk && drawCount === 1, `drawCount=${drawCount}`)

try {
  cacheProbe.render(makeCtx(), 'probe-key-2', 120, 90, drawOnce)
} catch (e) {
  cacheOk = false
}
check('LayerCache key 变化触发重建', cacheOk && drawCount === 2, `drawCount=${drawCount}`)

try {
  cacheProbe.render(makeCtx(), 'probe-key-2', 120, 90, drawOnce)
} catch (e) {
  cacheOk = false
}
check('LayerCache 尺寸不变时不重建', cacheOk && drawCount === 2, `drawCount=${drawCount}`)

// 真机准备：iOS 静音键不应让游戏彻底没声音
const audioSrc = allSources.find(({ file }) => file.endsWith('audio-manager.js'))
check('音频实例统一关闭 iOS 静音键影响（obeyMuteSwitch）',
  !!audioSrc &&
  /obeyMuteSwitch\s*=\s*false/.test(audioSrc.src) &&
  // 两处创建都应走 createAudio，不允许再裸调 createInnerAudioContext
  (audioSrc.src.match(/wx\.createInnerAudioContext\(\)/g) || []).length === 1)

Date.now = realNow
console.log(`\n===== 结果：${passed} 通过 / ${failed} 失败 =====`)
process.exit(failed === 0 ? 0 : 1)
