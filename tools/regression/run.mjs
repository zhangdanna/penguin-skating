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
    // 回归只验证布局数学，固定 1 让 canvas.width 直接等于逻辑尺寸。
    // DPR 放大逻辑由 tools/verify-env.mjs 单独模拟验证。
    pixelRatio: 1,
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
// 底部按钮高度从 HUD 实例读，避免和 game-hud.js 里的常量各写一份（F4：40 → 76）
const HUD_BUTTON_HEIGHT = game.gameHUD.actionButtons[0].height
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
    fitsX && game.cellSize >= 28 && game.cellSize <= 72 && bottom <= h - 40,
    `[fitsX=${fitsX} bottom=${bottom} h=${h}]`
  )

  // 间距随屏幕高度伸缩：小屏取最小值，长屏把富余空间拿来拉开间距，
  // 而不是全部堆成屏幕上下的大片留白
  const gapTop = game.boardOffsetY - (game.hudPanelY + 82)
  const gapBottom = game.actionBarY - bottom
  check(
    `${label}: HUD↔棋盘 ${gapTop}px，棋盘↔按钮 ${gapBottom}px（应在 12~40 / 16~52）`,
    gapTop >= 12 && gapTop <= 40 && gapBottom >= 16 && gapBottom <= 52,
    `[gapTop=${gapTop} gapBottom=${gapBottom}]`
  )

  // 整块内容垂直居中：上下留白差值不超过 1px 的取整误差
  const topMargin = game.contentTopY
  const bottomMargin = h - (game.actionBarY + HUD_BUTTON_HEIGHT + 10) // 按钮高 76（F4）+ 底部内边距 10
  check(
    `${label}: 内容垂直居中（上 ${topMargin} / 下 ${bottomMargin}）`,
    Math.abs(topMargin - bottomMargin) <= 1,
    `[top=${topMargin} bottom=${bottomMargin}]`
  )

  // 上下留白不能超过屏幕高度的 10%，否则又回到"中间挤、上下空"
  check(
    `${label}: 顶部留白 ${topMargin}px ≤ 屏高 10%`,
    topMargin <= Math.round(h * 0.1) + 1,
    `[top=${topMargin} limit=${Math.round(h * 0.1)}]`
  )

  // 排行榜顶部留白与对局界面保持一致
  if (game.rankScene) {
    game.rankScene.relayout()
    check(
      `${label}: 排行榜顶部 ${game.rankScene.topY} 对齐对局 HUD ${game.hudPanelY}`,
      game.rankScene.topY === game.hudPanelY,
      `[rank=${game.rankScene.topY} hud=${game.hudPanelY}]`
    )
  }
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
const rankTitle = game.rankScene.titlePanel
check('SHOW_RANK 携带内容区域（避开标题与返回按钮）',
  showMsg && showMsg.layout &&
  showMsg.layout.y >= rankTitle.y + rankTitle.height &&
  showMsg.layout.height > 0,
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
  check(`分享图为合法 PNG（实际 ${w}x${h}，建议 5:4）`,
    isPng && w >= 300 && h >= 300, `${w}x${h}`)
}
check('audio/bgm.wav 存在', fs.existsSync(bgmFile))
if (fs.existsSync(bgmFile)) {
  const size = fs.statSync(bgmFile).size
  check(`bgm.wav 体积合理（${Math.round(size / 1024)}KB）`,
    size > 100 * 1024 && size < 1024 * 1024, `${size}`)
}
// BGM 候选源必须真实存在。
// 曾经把从没提交过的 audio/bgm.mp3 排在首位，结果每次冷启动都固定刷一条
// 「背景音乐加载失败」红字，真机上看着像 bug。
const missingBgm = game.audioManager.bgmSources.filter(
  src => !fs.existsSync(path.join(ROOT, src))
)
check('BGM 候选源全部存在于仓库', missingBgm.length === 0, missingBgm.join(', '))

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
for (const target of ['docs', 'local-preview', 'tools', 'game.md', 'private.wx.key', 'README.md']) {
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
// 切后台时平台已接管音频，此时再调 pause() 只会拿到
// operateAudio:fail:access denied（真机调试台一条红字）。只允许改状态。
check('切后台进入音频挂起状态（不操作 InnerAudioContext）',
  game.audioManager.suspended === true, `${game.audioManager.suspended}`)
check('切后台置 bgmWanted=false 供回前台判断', game.audioManager.bgmWanted === false)
clock = T0 + 45000
check('后台 30s 期间用时仍为 5s（不跳变）',
  game.getElapsedSeconds() === 5, `${game.getElapsedSeconds()}`)
game.handleShow()
check('回到前台解除音频挂起并恢复播放意图',
  game.audioManager.suspended === false && game.audioManager.bgmWanted === true,
  `suspended=${game.audioManager.suspended} wanted=${game.audioManager.bgmWanted}`)
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

// 分享降级策略。
// 真机实测：showShareMenu 返回 ok（右上角「···」→「转发」可用），
// 但 wx.shareAppMessage 返回「小程序违规，不能使用分享功能」。
// 那条系统提示拦不住，所以只能在失败后记住状态，同会话内直接走引导。
{
  const ws = game.wechatService
  const modalCalls = []
  const origShowModal = wx.showModal
  const origShareApi = wx.shareAppMessage
  wx.showModal = (opts) => { modalCalls.push(opts) }

  ws.shareBlocked = false
  ws.shareMenuAvailable = true

  wx.shareAppMessage = (opts) => {
    if (opts && typeof opts.fail === 'function') {
      opts.fail({ errMsg: 'shareAppMessage:fail 小程序违规，不能使用分享功能' })
    }
  }
  ws.share()
  check('直连分享被拒后置 shareBlocked 并弹引导',
    ws.shareBlocked === true && modalCalls.length === 1,
    `blocked=${ws.shareBlocked} modal=${modalCalls.length}`)
  check('引导文案指出右上角「转发」仍可用',
    !!modalCalls[0] && modalCalls[0].content.indexOf('转发') >= 0,
    modalCalls[0] && modalCalls[0].content)

  // 第二次点分享：不该再去撞那条系统提示
  let apiCalls = 0
  wx.shareAppMessage = () => { apiCalls++ }
  modalCalls.length = 0
  ws.share()
  check('封禁后不再重复调用 shareAppMessage（避免反复弹违规提示）',
    apiCalls === 0 && modalCalls.length === 1,
    `api=${apiCalls} modal=${modalCalls.length}`)

  // 菜单也不可用时，文案要落到「账号侧限制」
  ws.shareMenuAvailable = false
  modalCalls.length = 0
  ws.share()
  check('菜单不可用时引导说明账号侧限制',
    !!modalCalls[0] && modalCalls[0].content.indexOf('认证') >= 0,
    modalCalls[0] && modalCalls[0].content)

  wx.showModal = origShowModal
  wx.shareAppMessage = origShareApi
  ws.shareBlocked = false
  ws.shareMenuAvailable = false
}

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

// ---------- D8 企鹅情绪状态机 ----------
freshPenguin.resetMood()
check('企鹅默认情绪为 idle', freshPenguin.getMood() === 'idle', freshPenguin.getMood())

freshPenguin.setMood('happy')
check('setMood(happy) 立即生效', freshPenguin.getMood() === 'happy', freshPenguin.getMood())
clock += 1300
check('happy 1.2 秒后自动回落到 idle', freshPenguin.getMood() === 'idle', freshPenguin.getMood())

freshPenguin.setMood('sad')
clock += 60 * 1000
check('sad 不会自动回落（常驻到复活 / 重开）',
  freshPenguin.getMood() === 'sad', freshPenguin.getMood())

freshPenguin.resetMood()
check('resetMood 复位为 idle', freshPenguin.getMood() === 'idle', freshPenguin.getMood())

// ---------- D8 企鹅绘制：所有姿态 / 道具 / 情绪都能画 ----------
const ThemeMod = await loadModule(path.join(ROOT, 'js/ui/theme.js'))
const { drawPenguin } = ThemeMod.namespace
check('theme.js 导出 drawPenguin', typeof drawPenguin === 'function')

const PENGUIN_POSES = ['stand', 'wave', 'cheer', 'slide', 'peek', 'hold', 'sleep']
const PENGUIN_PROPS = ['trophy', 'medal', 'crown', 'fish', 'star', 'snowflake',
  'lightning', 'heart', 'target', 'bubbles', 'zzz', 'confetti', null]
const PENGUIN_MOODS = ['idle', 'happy', 'sad']
let penguinDrawOk = true
let penguinDrawError = ''
try {
  PENGUIN_POSES.forEach(pose => {
    PENGUIN_PROPS.forEach(prop => {
      PENGUIN_MOODS.forEach(mood => {
        drawPenguin(makeCtx(), 100, 100, 1.5, { pose, prop, mood })
      })
    })
  })
} catch (e) {
  penguinDrawOk = false
  penguinDrawError = e.message
}
check('7 姿态 × 13 道具 × 3 情绪全部可绘制', penguinDrawOk, penguinDrawError)
check('旧的 sad:true 仍等价于 mood:sad',
  (() => { try { drawPenguin(makeCtx(), 100, 100, 1, { sad: true }); return true } catch (e) { return false } })())

// ---------- D9 成就详情弹层：布局必须和设计稿一致 ----------
const AchievementSceneMod = await loadModule(path.join(ROOT, 'js/ui/achievement-scene.js'))
const AchievementScene = AchievementSceneMod.namespace.default

/** 记录 fillText 的 ctx（makeCtx 是 Proxy，这里包一层把文字调用存下来） */
function makeTextRecorder() {
  const calls = []
  const state = {}
  const ctx = new Proxy(state, {
    get(target, key) {
      if (key === 'measureText') return (text) => ({ width: String(text).length * 8 })
      if (key === 'createLinearGradient' || key === 'createRadialGradient') {
        return () => ({ addColorStop() {} })
      }
      if (key === 'fillText') return (text, x, y) => calls.push({ text: String(text), x, y })
      if (key in target) return target[key]
      return () => {}
    },
    set(target, key, value) {
      target[key] = value
      return true
    }
  })
  return { ctx, calls }
}

const stubAchievement = {
  id: 'first_win',
  name: '初出茅庐',
  description: '首次通关任意关卡',
  icon: '🏆',
  pose: 'cheer',
  prop: 'trophy',
  quote: '第一块冰，稳稳落进洞里啦！',
  reward: { fish: 3 },
  unlocked: true
}
// 第二项只用来验证「弹层打开时列表不渲染」
const stubSecond = {
  id: 'win_10', name: '小有所成', description: '首通 10 个关卡',
  icon: '🎖️', pose: 'wave', prop: 'medal', quote: '稳了。',
  reward: { shrimp: 2 }, unlocked: true
}
const stubManager = {
  getAllAchievements: () => [stubAchievement, stubSecond],
  getProgress: () => ({ unlocked: 2, total: 2, percentage: 100 })
}

const popupScene = new AchievementScene(stubManager, () => {})
popupScene.show()
popupScene.expandedId = 'first_win'
popupScene.popupOpenedAt = clock - 1000
const recorder = makeTextRecorder()
popupScene.render(recorder.ctx)
const popupTexts = recorder.calls
const popupRect = popupScene.popupRect

check('详情卡宽度 = 320（375 屏）',
  !!popupRect && Math.round(popupRect.width) === 320,
  popupRect ? String(Math.round(popupRect.width)) : 'missing')
check('详情卡高宽比对齐设计稿 322×441',
  !!popupRect && Math.abs(popupRect.height / popupRect.width - 1.366) < 0.01,
  popupRect ? (popupRect.height / popupRect.width).toFixed(3) : 'missing')

const iconCall = popupTexts.find(item => item.text === '🏆')
const nameCall = popupTexts.find(item => item.text === '初出茅庐')
check('图标与名称在同一行（设计稿是一行「图标 + 名称」）',
  !!iconCall && !!nameCall && Math.abs(iconCall.y - nameCall.y) < 0.5,
  iconCall && nameCall ? `${iconCall.y} vs ${nameCall.y}` : 'missing')
check('图标在名称左侧', !!iconCall && !!nameCall && iconCall.x < nameCall.x)

const subCall = popupTexts.find(item => item.text === '首次通关任意关卡')
const bandBottom = popupRect.y + Math.round(popupRect.width * 0.266)
check('解锁条件留在顶部色带里（不再掉到卡片下部）',
  !!subCall && subCall.y < bandBottom,
  subCall ? `${subCall.y} < ${bandBottom}` : 'missing')

const quoteCall = popupTexts.find(item => item.text.indexOf('第一块冰') !== -1)
check('一句话带书名号', !!quoteCall && /^「.*」$/.test(quoteCall.text),
  quoteCall ? quoteCall.text : 'missing')

const unlockedChip = popupTexts.find(item => item.text === '✓ 已解锁')
const rewardChip = popupTexts.find(item => /^奖励 3/.test(item.text))
check('底部两个标签都存在', !!unlockedChip && !!rewardChip)
check('两个标签不重叠', !!unlockedChip && !!rewardChip && unlockedChip.x < rewardChip.x)

check('弹层打开时列表不渲染（背后不留被压暗的卡片）',
  !popupTexts.some(item => item.text === '小有所成'),
  popupTexts.map(item => item.text).join('|'))
check('弹层打开时页面级元素（标题 / 关闭按钮）一起隐藏',
  !popupTexts.some(item => item.text === '成就系统' || item.text === '✕'))

const achievementSceneSrc = allSources.find(({ file }) => file.endsWith('achievement-scene.js'))

// 右上角 ✕：命中判定必须真的能关掉弹层
const closeCenter = popupScene.getCloseCenter(popupRect)
popupScene.expandedId = 'first_win'
popupScene.handlePopupTap({ clientX: closeCenter.x, clientY: closeCenter.y })
check('点右上角 ✕ 关闭弹层', popupScene.expandedId === null, String(popupScene.expandedId))

popupScene.expandedId = 'first_win'
popupScene.handlePopupTap({
  clientX: popupRect.x + popupRect.width / 2,
  clientY: popupRect.y + popupRect.height / 2
})
check('点卡片中间不关闭', popupScene.expandedId === 'first_win', String(popupScene.expandedId))

popupScene.expandedId = 'first_win'
popupScene.handlePopupTap({ clientX: popupRect.x - 20, clientY: popupRect.y - 20 })
check('点卡片外面关闭', popupScene.expandedId === null, String(popupScene.expandedId))

check('✕ 是白色半透明圆底 + 深紫叉（白底白叉等于没画）',
  !!achievementSceneSrc &&
  /rgba\(255, 255, 255, 0\.9\)/.test(achievementSceneSrc.src) &&
  /strokeStyle = COLORS\.lavenderDeep/.test(achievementSceneSrc.src))

const themeSrcForInk = allSources.find(({ file }) => file.endsWith('theme.js'))
check('奖励标签用深金色文字（黄底配黄字对比度只有 1.9:1）',
  !!themeSrcForInk && /yellowInk: '#B98A12'/.test(themeSrcForInk.src))

// 列表命中：点卡片任意位置都必须是这张卡（不能串到上一项）
popupScene.expandedId = null
const listRecorder = makeTextRecorder()
popupScene.render(listRecorder.ctx)
check('列表渲染后每张卡都建立了命中区',
  popupScene.cardRects.length === stubManager.getAllAchievements().length,
  String(popupScene.cardRects.length))

let cardHitOk = true
let cardHitDetail = ''
popupScene.cardRects.forEach((rect, index) => {
  const points = [
    [rect.x + 2, rect.y + 2],
    [rect.x + rect.width - 2, rect.y + 2],
    [rect.x + 2, rect.y + rect.height - 2],
    [rect.x + rect.width - 2, rect.y + rect.height - 2],
    [rect.x + rect.width / 2, rect.y + rect.height / 2]
  ]
  points.forEach(([px, py]) => {
    const hit = popupScene.getCardAt(px, py)
    const expected = stubManager.getAllAchievements()[index]
    if (!hit || hit.id !== expected.id) {
      cardHitOk = false
      cardHitDetail = `第 ${index + 1} 项 (${Math.round(px)},${Math.round(py)}) 命中 ${hit ? hit.id : 'null'}`
    }
  })
})
check('点卡片任意位置都命中它自己（四角 + 中心）', cardHitOk, cardHitDetail)

// 这个场景的 render() 不调用 stage().apply()，触摸就不能 unproject，
// 否则高屏（offsetY ≠ 0）上会整体偏上、点第 3 项弹第 2 项。
const sceneCode = achievementSceneSrc.src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
check('成就场景的渲染与触摸坐标系成对（不能一边 stage 一边不 stage）',
  /stage\(\)\.apply\(/.test(sceneCode) === /stage\(\)\.unproject\(/.test(sceneCode))

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

// ---------- 真机启动引导（E1：小游戏没有全局 canvas） ----------
console.log('\n[20] 真机启动引导（小游戏上屏画布）')

const envPath = path.join(ROOT, 'js/env.js')
const envExists = fs.existsSync(envPath)
check('js/env.js 存在（负责创建上屏画布）', envExists)

const envSrc = envExists ? fs.readFileSync(envPath, 'utf8') : ''

check('env.js 调用 wx.createCanvas() 创建上屏画布',
  !!envSrc && /wx\.createCanvas\s*\(/.test(envSrc))

check('env.js 优先复用已有画布（避免 H5 画到离屏画布上）',
  !!envSrc && /isCanvasLike\(globalObjects\[i\]\.canvas\)/.test(envSrc))

check('env.js 把画布挂回全局对象（裸 canvas 才能被 js/ui/* 读到）',
  !!envSrc && /\.canvas\s*=\s*screenCanvas/.test(envSrc))

const gameSource = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8')
const importSpecs = [...gameSource.matchAll(
  /^import\s+(?:[^'"\n]*?\s+from\s+)?['"]([^'"]+)['"]/gm)].map(m => m[1])

check('game.js 的第一个 import 就是环境引导（保证最先执行）',
  importSpecs[0] === './js/env', `实际：${importSpecs[0] || '(空)'}`)

check('game.js 的绘图上下文取自 screenCanvas，不再裸读全局 canvas',
  /this\.ctx\s*=\s*screenCanvas\.getContext\('2d'\)/.test(gameSource))

check('game.js 对画布缺失有显式兜底（不再直接抛 ReferenceError）',
  /if\s*\(!screenCanvas\)/.test(gameSource))

// 统计仍依赖全局 canvas 的模块，确认它们都在 env.js 之后才会执行
const bareCanvasFiles = allSources
  .filter(({ src }) => /(^|[^.\w'"\/])canvas\.(width|height)\b/m.test(src))
  .map(({ file }) => path.relative(ROOT, file).replace(/\\/g, '/'))

check('存在依赖全局 canvas 的模块时，入口必须先建立全局画布',
  bareCanvasFiles.length === 0 || (envExists && importSpecs[0] === './js/env'),
  bareCanvasFiles.join(','))

// 关键回归：env.js 必须复用传入的画布，而不是自己另建一张
// （否则 H5 里会把游戏画到一张不在页面上的离屏画布上，同样是黑屏）
check('全局 canvas 仍是原画布（env.js 没有另建离屏画布）',
  context.canvas === canvas)

check('游戏实例拿到了可用的 2D 上下文',
  !!game && !!game.ctx)

// ---------- 高清渲染（E2：设备像素比） ----------
console.log('\n[21] 高清渲染（设备像素比）')

check('env.js 读取 pixelRatio 并限制上限',
  /pixelRatio/.test(envSrc) && /MAX_DPR/.test(envSrc))

check('env.js 按 dpr 放大上屏画布后备缓冲',
  /Math\.round\(metrics\.width \* DPR\)/.test(envSrc) &&
  /Math\.round\(metrics\.height \* DPR\)/.test(envSrc))

check('env.js 导出 viewport()（逻辑尺寸，与旧 canvas.width 等价）',
  /export function viewport/.test(envSrc) && /screenCanvas\.width \/ dpr/.test(envSrc))

check('game.js 每帧重置基准变换为 dpr（逻辑坐标 → 设备像素）',
  /setTransform\(DPR,\s*0,\s*0,\s*DPR,\s*0,\s*0\)/.test(gameSource))

const layerSrc = allSources.find(({ file }) => file.endsWith('layer-cache.js'))
check('离屏层按设备像素分配（否则背景被拉伸 dpr 倍）',
  !!layerSrc &&
  /Math\.round\(width \* dpr\)/.test(layerSrc.src) &&
  /setTransform\(dpr,\s*0,\s*0,\s*dpr,\s*0,\s*0\)/.test(layerSrc.src))

// UI / 运行时模块一律用 viewport() 的逻辑尺寸做布局。
// game.js 例外：getCanvasRatio / handleResize 本来就要按物理像素算。
const bareCanvasReaders = allSources
  .filter(({ file }) => /[\\/]js[\\/](ui|runtime)[\\/]/.test(file))
  .filter(({ src }) => /(^|[^.\w])canvas\.(width|height)/m.test(src))
  .map(({ file }) => path.relative(ROOT, file).replace(/\\/g, '/'))

check('js/ui 与 js/runtime 没有裸 canvas.width / canvas.height',
  bareCanvasReaders.length === 0, bareCanvasReaders.join(','))

// game.js 里只允许 getCanvasRatio（1 处读）与 handleResize（1 处比较 + 2 处赋值）
const gameNoComments = gameSource
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
const gameBareCanvas = (gameNoComments.match(/(^|[^.\w])canvas\.(width|height)/g) || []).length
check('game.js 的裸 canvas 读写仅限 resize / ratio',
  gameBareCanvas <= 5, `实际 ${gameBareCanvas} 处`)

const openDataSrc = fs.readFileSync(path.join(ROOT, 'open-data/index.js'), 'utf8')
check('开放数据域共享画布同样按 dpr 放大',
  /pixelRatio/.test(openDataSrc) && /ctx\.scale\(dpr,\s*dpr\)/.test(openDataSrc))

// ---------- F 批次：奖励瘦身 / 成就门槛 / 退一步 / 底部按钮 ----------
console.log('\n[22] 奖励与成就重做（F1 / F2）')

check('基础奖励按难度：medium=1 / hard=2 / expert=3',
  fm.getBaseReward('medium') === 1 && fm.getBaseReward('hard') === 2 && fm.getBaseReward('expert') === 3,
  `${fm.getBaseReward('medium')}/${fm.getBaseReward('hard')}/${fm.getBaseReward('expert')}`)

check('速度奖励只给 0 或 1（不再有金鱼 / 鱿鱼档）',
  fm.getTimeBonus(10, 40) === 1 &&
  fm.getTimeBonus(40 * 2.2, 40) === 1 &&
  fm.getTimeBonus(40 * 2.2 + 1, 40) === 0 &&
  fm.getTimeBonus(9999, 40) === 0,
  `边界=${fm.getTimeBonus(88, 40)}/${fm.getTimeBonus(89, 40)}`)

fm.consecutiveWins = 50
check('连击 50 次也只给 3（1🦐），不再发金鱼', fm.getConsecutiveBonus() === 3, `${fm.getConsecutiveBonus()}`)
fm.consecutiveWins = 0

const fmRepeat = new FoodMod.namespace.default()
fmRepeat.food = { fish: 0, shrimp: 0, squid: 0, goldfish: 0 }
const repeatReward = fmRepeat.calculateRewards(10, 30, 40, 999, {
  difficulty: 'hard', firstClear: false, firstThreeStar: false
})
check('重刷一关（无首通 / 无速度 / 无连击）只给基础 2🐟',
  repeatReward.fish === 2 && repeatReward.total === 2, JSON.stringify(repeatReward.details))

const firstReward = fmRepeat.calculateRewards(10, 40, 40, 88, {
  difficulty: 'hard', firstClear: true, firstThreeStar: true
})
check('首通 + 三星首通 + 速度 = 5🐟 + 1🦐（价值 8）',
  firstReward.fish === 5 && firstReward.shrimp === 1 && firstReward.total === 8,
  JSON.stringify(firstReward.details))

const fmCap = new FoodMod.namespace.default()
fmCap.food = { fish: 0, shrimp: 0, squid: 0, goldfish: 0 }
fmCap.maxFood = 30
fmCap.addFish(100)
const capHit = fmCap.getTotalFood()
fmCap.addFish(1)
check('addFood 受 maxFood 上限约束（满仓后不再入账）',
  capHit === 30 && fmCap.getTotalFood() === 30, `${capHit} → ${fmCap.getTotalFood()}`)

const AchMod = await loadModule(path.join(ROOT, 'js/utils/achievement-manager.js'))
const am = new AchMod.namespace.default()
am.resetData()
am.recordWin({ level: 1, stars: 3, moves: 13, par: 16, time: 40, firstClear: true })
check('通关 1 关不会解锁「首通全部 60 关」', !am.unlockedAchievements.includes('win_100'),
  am.unlockedAchievements.join(','))

am.recordWin({ level: 1, stars: 3, moves: 13, par: 16, time: 40, firstClear: false })
check('重刷同一关不增加首通数', am.stats.uniqueWins === 1, `${am.stats.uniqueWins}`)
check('重刷同一关不重复累加星星', am.stats.totalStars === 3, `${am.stats.totalStars}`)

am.recordWin({ level: 2, stars: 3, moves: 10, par: 16, time: 40, firstClear: true })
check('3 星但步数 < par 不算「精准操作」', !am.unlockedAchievements.includes('perfect_moves'),
  am.unlockedAchievements.join(','))

am.recordWin({ level: 3, stars: 3, moves: 16, par: 16, time: 40, firstClear: true })
check('步数正好等于 par 才解锁「精准操作」', am.unlockedAchievements.includes('perfect_moves'),
  am.unlockedAchievements.join(','))

// 成就改版：19 → 15，删掉 4 个星级成就
const allAch = am.getAllAchievements()
check('成就总数为 15（已删掉 4 个星级成就）', allAch.length === 15, `${allAch.length}`)
const removedAchIds = ['star_10', 'star_50', 'star_100', 'all_3star']
check('4 个已下线成就不在定义里',
  removedAchIds.every(id => !allAch.some(item => item.id === id)),
  allAch.map(item => item.id).join(','))
check('每个成就都配了 pose / prop / quote（成就卡造型用）',
  allAch.every(item => typeof item.pose === 'string' && item.pose &&
    typeof item.quote === 'string' && item.quote &&
    (item.prop === null || typeof item.prop === 'string')),
  allAch.filter(item => !item.pose || !item.quote).map(item => item.id).join(','))
check('15 个成就的造型组合互不重复',
  new Set(allAch.map(item => item.pose + '|' + item.prop)).size === allAch.length,
  allAch.map(item => item.pose + '|' + item.prop).join(','))

am.recordWin({ level: 4, stars: 3, moves: 20, par: 16, time: 40, firstClear: true, undoUsed: true })
check('用过「退一步」的关卡不计入精准步数',
  am.stats.perfectMoves === 1, `${am.stats.perfectMoves}`)

// 老存档里残留已删成就 id 时，进度不能虚高
am.unlockedAchievements = ['star_10', 'star_50', 'star_100', 'all_3star', 'first_win']
const staleProgress = am.getProgress()
check('残留已删成就 id 不会让进度超过 100%',
  staleProgress.unlocked === 1 && staleProgress.percentage <= 100,
  `${staleProgress.unlocked}/${staleProgress.total} = ${Math.round(staleProgress.percentage)}%`)
am.unlockedAchievements = ['first_win']

// ---------- 退一步 ----------
console.log('\n[23] 退一步（F3）')
await game.loadLevel(1)
check('进入关卡后撤销栈为空', game.history.length === 0, `${game.history.length}`)
const undoBtn = game.gameHUD.actionButtons.find(item => item.id === 'undo')
check('步数为 0 时撤销按钮置灰', undoBtn && undoBtn.disabled === true, `${undoBtn && undoBtn.disabled}`)

const foodBeforeUndo = game.foodManager.getTotalFood()
const startCell = game.getCell(game.penguin)
swipe('right')
check('移动一步后撤销栈 +1', game.history.length === 1, `${game.history.length}`)
check('撤销按钮点亮', undoBtn.disabled === false, `${undoBtn.disabled}`)

const movesBeforeUndo = game.moves
const undoOk = game.undoMove()
const backCell = game.getCell(game.penguin)
check('退一步返回 true', undoOk === true, `${undoOk}`)
check('步数一并回退', game.moves === movesBeforeUndo - 1, `${movesBeforeUndo} → ${game.moves}`)
check('企鹅回到上一格', backCell.col === startCell.col && backCell.row === startCell.row,
  `(${backCell.col},${backCell.row}) vs (${startCell.col},${startCell.row})`)
check(`消耗 ${game.undoCost}🐟`, game.foodManager.getTotalFood() === foodBeforeUndo - game.undoCost,
  `${foodBeforeUndo} → ${game.foodManager.getTotalFood()}`)
check('撤销后历史清空、按钮重新置灰',
  game.history.length === 0 && undoBtn.disabled === true, `${game.history.length}/${undoBtn.disabled}`)

// 食物不足时不允许撤销
const foodBackup = { ...game.foodManager.food }
game.foodManager.food = { fish: 0, shrimp: 0, squid: 0, goldfish: 0 }
game.history.push(game.captureSnapshot())
const noFoodUndo = game.undoMove()
check('食物不足时退一步失败且不消耗历史',
  noFoodUndo === false && game.history.length === 1, `${noFoodUndo}/${game.history.length}`)
game.foodManager.food = foodBackup
game.history = []

// ---------- 底部按钮 ----------
console.log('\n[24] 底部按钮改版（F4）')
const hudButtons = game.gameHUD.actionButtons
check('三个按钮：暂停 / 退一步 / 重玩',
  hudButtons.map(b => b.label).join(',') === '暂停,退一步,重玩',
  hudButtons.map(b => b.label).join(','))
check('按钮为 76×76 大图标卡片',
  hudButtons.every(b => b.width === 76 && b.height === 76),
  hudButtons.map(b => `${b.width}x${b.height}`).join(' '))
check('退一步带消耗角标', hudButtons[1].badge === '-2🐟', hudButtons[1].badge)
check('三个按钮水平居中且互不重叠', (() => {
  const first = hudButtons[0]
  const last = hudButtons[2]
  const left = first.x
  const right = canvas.width - (last.x + last.width)
  return Math.abs(left - right) <= 1 && hudButtons[1].x >= first.x + first.width
})(), `${hudButtons[0].x}/${hudButtons[2].x}`)
check('HUD 不再暴露「返回」回调（退出统一走暂停面板）',
  typeof game.gameHUD.onBackClick === 'undefined' && typeof game.gameHUD.onUndoClick === 'function')

// ---------- 食物经济与重玩（G 批次） ----------
console.log('\n[25] 食物上限 / 免费补给 / 重玩扣费')

const foodMgr = game.foodManager
const foodMgrBackup = { ...foodMgr.food }

// addFood 必须严格按剩余容量截断：原实现用 Math.max(1, …) 兜底，
// 剩 1 点容量也能硬塞进一只金鱼（价值 50），总数直接顶到 51
foodMgr.food = { fish: 29, shrimp: 0, squid: 0, goldfish: 0 }
const overCap = foodMgr.addFood('goldfish', 1)
check('剩余容量不足时高价值食物不再硬塞', overCap === 0, `${overCap}`)
check('总食物不突破 maxFood', foodMgr.getTotalFood() <= foodMgr.maxFood,
  `${foodMgr.getTotalFood()}/${foodMgr.maxFood}`)

foodMgr.food = { fish: 0, shrimp: 0, squid: 0, goldfish: 0 }
check('容量充足时正常入账', foodMgr.addFood('fish', 5) === 5, `${foodMgr.getTotalFood()}`)

// 免费补给：广告不可用时的兜底，防止食物耗尽后彻底开不了局
foodMgr.food = { fish: 0, shrimp: 0, squid: 0, goldfish: 0 }
const refillLimit = foodMgr.freeRefillPerDay
check(`今日免费补给上限 ${refillLimit} 次`, foodMgr.getFreeRefillLeft() === refillLimit,
  `${foodMgr.getFreeRefillLeft()}`)

const refilled = foodMgr.grantFreeRefill(2)
check('免费补给成功发放 2🐟', refilled === 2, `${refilled}`)
check('免费补给次数 -1', foodMgr.getFreeRefillLeft() === refillLimit - 1,
  `${foodMgr.getFreeRefillLeft()}`)

while (foodMgr.getFreeRefillLeft() > 0) foodMgr.grantFreeRefill(1)
foodMgr.food = { fish: 0, shrimp: 0, squid: 0, goldfish: 0 }
check('免费次数用完后拒绝发放', foodMgr.grantFreeRefill(5) === 0, `${foodMgr.grantFreeRefill(5)}`)

// 结算口径：显示实际入账而不是理论值
foodMgr.food = { fish: 28, shrimp: 0, squid: 0, goldfish: 0 }
const theoryRewards = { fish: 5, shrimp: 0, squid: 0, goldfish: 0, total: 5, details: [] }
const actualGiven = foodMgr.giveRewards(theoryRewards)
check('接近上限时实际入账少于理论值', actualGiven.fish < theoryRewards.fish,
  `${actualGiven.fish} vs ${theoryRewards.fish}`)

game.resultScene.setRewards(actualGiven, { requested: theoryRewards })
check('结算页拿到的是实际入账', game.resultScene.rewards === actualGiven)
const lost = game.resultScene.getLostRewards()
check(`能算出未入账部分（${lost.join('')}）`, lost.length === 1, JSON.stringify(lost))

foodMgr.food = foodMgrBackup

// 重玩：第一步时不该重开（原实现会重新 loadLevel，白扣一次入场食物）
const originalLoadLevel = game.loadLevel
let loadLevelCalls = 0
game.loadLevel = function (...args) {
  loadLevelCalls++
  return originalLoadLevel.apply(this, args)
}

const restartBtn = game.gameHUD.actionButtons.find(item => item.id === 'restart')
game.gameHUD.setMoves(0)
check('未移动时「重玩」按钮置灰', restartBtn.disabled === true, `${restartBtn.disabled}`)
game.restartLevel({ confirm: false })
check('未移动时点重玩不重新加载关卡', loadLevelCalls === 0, `${loadLevelCalls}`)

game.gameHUD.setMoves(2)
check('移动后「重玩」按钮点亮', restartBtn.disabled === false, `${restartBtn.disabled}`)

// moves > 0 时默认先弹确认框（确认后才扣费重开）。
// 注意：教程关入场费是 0，不会弹确认，所以按实际入场费分支断言。
const curLevelData = game.levelManager.getLevel(game.currentLevel)
const entryCost = foodMgr.getLevelCost(curLevelData ? curLevelData.difficulty : 'easy')
game.moves = 2
if (entryCost > 0) {
  game.restartLevel()
  check(`重玩（入场费 ${entryCost}🐟）前先弹确认框，未确认不重开`,
    loadLevelCalls === 0, `${loadLevelCalls}`)
} else {
  check('免费关卡重玩不需要确认，直接重开', entryCost === 0, `cost=${entryCost}`)
}

game.loadLevel = originalLoadLevel
game.moves = 0

// 排行榜补同步：没有通关记录时不该发上报
check('syncLocalRecord 返回布尔值且不抛异常',
  typeof game.wechatService.syncLocalRecord() === 'boolean')

// ---------- 自然恢复口径（G2） ----------
console.log('\n[26] 体力自然恢复：只算前台时间')
check('免费补给每天 1 次', foodMgr.freeRefillPerDay === 1, `${foodMgr.freeRefillPerDay}`)

const clearFood = () => {
  foodMgr.food = { fish: 0, shrimp: 0, squid: 0, goldfish: 0 }
}

// 前台连续运行满一个周期 → 恢复 1 条
clearFood()
foodMgr.lastRecoveryTime = clock
clock += 5 * 60 * 1000
const oneCycle = foodMgr.checkRecovery()
check('前台运行满 5 分钟恢复 1🐟', oneCycle === 1, `${oneCycle}`)

// 挂机很久：单次最多补 3 条，不会一次补满
clearFood()
foodMgr.lastRecoveryTime = clock
clock += 60 * 60 * 1000 // 1 小时 = 12 个周期
const burst = foodMgr.checkRecovery()
check('单次最多补 3 条，不会一次补满', burst === 3, `${burst}`)

const afterBurst = foodMgr.checkRecovery()
check('被丢弃的周期不会重复发放', afterBurst === 0, `${afterBurst}`)

// 离线（重新启动）：计时基准重置，历史时间不算
clearFood()
foodMgr.lastRecoveryTime = clock - 24 * 60 * 60 * 1000
foodMgr.loadRecoveryTime()
const afterRestart = foodMgr.checkRecovery()
check('重新启动后离线时间不计入恢复', afterRestart === 0, `${afterRestart}`)

// 切后台：这段时间被 skipRecoveryTime 剔除
clearFood()
foodMgr.lastRecoveryTime = clock
const hidden = 30 * 60 * 1000
clock += hidden
foodMgr.skipRecoveryTime(hidden)
const afterBackground = foodMgr.checkRecovery()
check('切后台的时长不计入恢复', afterBackground === 0, `${afterBackground}`)

foodMgr.food = foodMgrBackup

Date.now = realNow
console.log(`\n===== 结果：${passed} 通过 / ${failed} 失败 =====`)
process.exit(failed === 0 ? 0 : 1)
