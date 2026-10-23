# 企鹅滑冰 — 发布前技术与功能走查报告

> 走查对象：`penguin-skating-game`（微信小游戏 / Canvas 2D / ES6）
> 走查方式：全量阅读 33 个 JS 模块 + 7 份关卡 JSON + 配置与文档；用 BFS 求解器回归验证关卡可解性与 `par` 合理性；按「可发布性 / 合规 / 体验 / 性能 / 工程化」五个维度定级。
> 结论日期：2026-10-22

---

## 0. 结论摘要

**当前状态：不具备直接提审条件。**

核心玩法（推箱子 + 网格移动 + 障碍物）实现完整、关卡全部可解、`par` 与最优解完全一致，这部分质量是好的。但存在 **10 个阻断级缺陷**，其中 3 个是"必崩/必卡死"级别，4 个是"功能形同虚设"，3 个是"审核会直接驳回"的合规问题。

| 维度 | 评级 | 说明 |
|---|---|---|
| 核心玩法 | 良好 | 关卡可解性 100% 通过；移动/推箱/障碍判定逻辑正确 |
| 稳定性 | 差 | 2 处必然触发的运行时崩溃/死锁 |
| 功能完整性 | 差 | 排行榜、登录、广告、分享奖励、背景音乐均为"占位"状态 |
| 合规性 | 不合格 | 诱导分享 + 模拟广告 + 无隐私授权，任一都会导致审核驳回 |
| 适配性 | 差 | 全站硬编码 375×667，320 宽设备棋盘溢出，短屏弹层按钮出屏 |
| 性能 | 一般 | 每帧大量 gradient / shadowBlur，中低端机有掉帧风险 |
| 工程化 | 一般 | 5 个模块为死代码，关卡数据双份维护，README 与实现不符 |

**建议路径**：先修 P0（约 1.5 人日）→ 过合规（约 1 人日）→ 修 P1 适配与数值（约 2 人日）→ 清理 P2（约 0.5 人日）→ 再提审。完整修改清单见第 9 节。

---

## 1. 走查范围

- `game.js`（1097 行，主循环 / 状态机 / 输入 / 结算）
- `js/base`（2）、`js/runtime`（5）、`js/ui`（15）、`js/utils`（8）、`js/levels`（1）、`js/physics`（2，未被引用）
- `game.json`、`project.config.json`、`project.private.config.json`
- `levels/level1~7.json`、`audio/`、`open-data/`、`local-preview/`、`docs/`、`README*.md`

---

## 2. 阻断级问题（P0）— 不修无法上线

### P0-1 暂停页「返回菜单」导致主菜单永久卡死（死锁）

**位置**：`js/ui/pause-scene.js:77-80` + `game.js:540-543`

```js
// pause-scene.js：返回菜单只切场景，没有通知 game 复位状态
onClick: () => { this.hide(); this.sceneManager.switchTo('menu') }
```

`pauseGame()` 会把 `game.isPaused = true`，只有 `resumeGame()` / `loadLevel()` / `backToMenu()` 会复位。走暂停页的「返回菜单」这条路三者都没走到，于是 `game.isPaused` 永远为 `true`。此后 `touchStartHandler` 第一优先级判断：

```js
if (this.isPaused) { this.pauseScene.onTouchStart(touch); return }
```

而 `pauseScene.isVisible` 已被 `hide()` 置 false，`onTouchStart` 直接 return false —— **主菜单画面正常显示，但所有按钮完全点不动，只能杀进程**。这是玩家最容易踩到的路径之一。

**修复**：暂停页的「返回菜单」改为回调 `game.backToMenu()`；或在 `SceneManager.switchTo` 统一清 overlay 状态。建议给 `game` 增加 `clearOverlays()`，在 `switchTo('menu')` 前统一调用。

---

### P0-2 游戏结束页「看广告复活」必崩（方法不存在）

**位置**：`game.js:816-827`

```js
onGameOverWatchAd() {
  const result = this.reviveManager.reviveByWatchAd()   // ← 该方法不存在
```

`ReviveManager` 只提供 `revive(type, foodManager)`，全仓库 grep 不到 `reviveByWatchAd`。点击后抛 `TypeError: this.reviveManager.reviveByWatchAd is not a function`，界面卡在 GameOver 层（`gameState` 仍为 `fail`，`isPaused` 为 false，后续输入被 gameOverScene 拦截），**等于死界面**。

**修复**：改为 `this.reviveManager.revive('watchAd', this.foodManager)`，并按 P0-6 接入真实激励视频；广告未接入前，该按钮应直接隐藏。

---

### P0-3 结算管理器调用参数错位，统计数据全错

**位置**：`game.js:874` vs `js/utils/settlement-manager.js:80`

```js
// 调用方：3 个参数
this.settlementManager.completeLevel(this.moves, time, par)
// 定义方：2 个参数
completeLevel(stars, par) { ... }
```

实参映射结果：`stars = moves`、`par = time`、第三个参数 `par` 被丢弃。连锁后果：

- `totalStats.totalStars += moves`（星星数被步数污染，几百上千）
- `if (stars === 3)` 永不成立 → `perfectGames` 永远是 0
- `currentSettlement.par = time` → `efficiency = 时间 / 步数`，无意义
- `currentSettlement.stars = moves`

目前 `getSettlementSummary()` / `getTotalStats()` / `getBestRecords()` **没有任何 UI 调用**，所以问题被掩盖；一旦后续接"数据统计页"就会全线错乱。同时 `recordRevive()` 也从未被调用（`totalStats.revives` 恒为 0）。

**修复**：统一签名 `completeLevel({ moves, time, par, stars })`，并在 `onWin` 里把已算好的 `stars` 传进去，避免第 4 处重复实现星级算法。

---

### P0-4 排行榜完全不可用，且开放数据域画布遮挡返回按钮

**位置**：`js/utils/wechat-service.js:308-339`、`js/ui/rank-scene.js:142-149`、`open-data/index.js`（末尾初始化段）

三个独立缺陷叠加：

1. **`wx.getFriendCloudStorage` 只能在开放数据域调用**，主域调用会 fail。`RankScene.loadRankData()` 在主域 `await this.wechatService.getFriendRank()` → 必然 reject → `rankList = []` → 永远显示"暂无排行数据"。
2. **开放数据域画布整屏覆盖主域 UI**。`open-data/index.js` 启动时执行 `clearCanvas(); drawBackground()`，用不透明色填满 `windowWidth × windowHeight`；`RankScene.render()` 每帧再 `ctx.drawImage(sharedCanvas, 0, 0, canvas.width, canvas.height)`。而「返回」按钮在 `drawImage` **之前**绘制 → 被完全盖住，**玩家看不到返回按钮**（虽然点击区域还在，属于"隐形按钮"）。
3. **排行榜被画了两遍**：开放数据域画一套（`drawRankItems`），主域 `renderRankList` 又画一套，两套字号/配色/分页逻辑完全不同，视觉上互相打架。

**修复**（三选一，建议方案 A）：

- **A（推荐）**：只保留开放数据域渲染。主域 `RankScene` 仅负责画遮罩/返回按钮/标题，并把 `sharedCanvas` 缩放到内容区域内（`drawImage` 目标矩形避开顶部标题栏与返回按钮），删掉主域的 `renderRankList`。
- **B**：只保留主域渲染。开放数据域仅 `wx.getFriendCloudStorage` → `postMessage` 回传数据，主域收到后自己画；`sharedCanvas` 完全不绘制。
- **C**：临时关闭排行榜入口（`MenuScene` 隐藏按钮），上线后再补。

---

### P0-5 诱导分享：分享即复活 / 分享即送食物（审核必拒）

**位置**：`js/ui/revive-scene.js:175-207`、`game.js:930-948`

```js
shareToFriend(callback) {
  this.wechatService.share()
  setTimeout(() => { callback && callback() }, 500)   // 500ms 后无条件复活
}
```

问题有三层：

1. **违反《微信小游戏平台运营规范》关于诱导分享的规定**——"分享后才能继续游戏 / 分享获得复活 / 分享获得奖励"属于明令禁止的诱导分享行为，提审会被驳回，已上线也可能被处罚。
2. **逻辑本身是假的**：`setTimeout` 500ms 后无条件回调，玩家点分享后立刻取消也照样复活；`wx.shareAppMessage` 的 `success` 也**不能**用来判断"是否真的分享成功"（微信早已不返回真实结果）。
3. 分享冷却 60s 只在 `WechatService.share()` 内部生效，而 `shareToGroup()` 直接调 `wx.shareAppMessage` 完全绕过冷却。

**修复**：

- 删除「分享复活」「分享送鱼」两条奖励链路；分享按钮保留但**不给任何奖励**（纯传播）。
- 复活渠道收敛为：**激励视频（主）+ 消耗食物（次）**。
- `onShareReward` 及其成就 `first_share` / `share_10` 一并移除或改为"分享次数"展示性统计（不绑定奖励）。

---

### P0-6 广告是模拟实现，且"食物不足"入口是空壳

**位置**：`js/ui/revive-scene.js:212-225`、`game.js:256-267`

```js
// revive-scene.js
watchAd(callback) {
  wx.showModal({ title: '观看视频', content: '模拟观看30秒视频广告', ... })
}
// game.js
success: (res) => { if (res.confirm) { wx.showToast({ title: '广告功能待实现' }) } }
```

`js/utils/ad-manager.js` 写好了完整的激励视频封装（256 行），但**从未被 import**，且 `adUnitIds` 全是 `adunit-xxx` 占位符。结果是：

- 游戏结束页「看广告复活」→ 崩溃（见 P0-2）
- 复活页「看视频复活」→ 弹一个写着"模拟观看 30 秒视频广告"的 confirm 框，点确定就复活
- 关卡开始"食物不足"→ 提示"广告功能待实现"

这种"自曝是模拟"的文案提审必被打回（视为功能不完整/虚假功能）。

**修复**：接入 `AdManager`，把 `adUnitId` 换成真实单元（需先在 MP 后台开通流量主并创建广告位）；在广告位审批下来之前，**隐藏所有广告入口**，不要留 `showModal` 假广告。

---

### P0-7 分享图与背景音乐资源缺失

| 资源 | 引用位置 | 实际文件 | 后果 |
|---|---|---|---|
| `images/share-image.png` | `wechat-service.js:174,186`；`revive-scene.js:201` | `images/` 目录为空 | 分享卡片无图，退化为截图，且截图可能是空白 |
| `audio/bgm.mp3` | `audio-manager.js:21` | 不存在（只有 7 个 wav） | `onError` 把 `bgm` 置 null → **全局无背景音乐**，`playBGM()` 静默返回 |

**修复**：补 500×400 分享图；补 BGM（建议 mp3，128kbps，30~60s 循环，<500KB），或显式删掉 `bgm` 配置并在 README 注明"无 BGM"。

---

### P0-8 320 宽设备棋盘横向溢出

**位置**：`game.js:30-34`

```js
const CELL_SIZE = 50, GRID_COLS = 7          // 350px
const BOARD_OFFSET_X = Math.round((canvas.width - GRID_COLS * CELL_SIZE) / 2)
```

`canvas.width = 320`（iPhone SE 一代 / 部分安卓小屏）时 `BOARD_OFFSET_X = -15`，**棋盘最左 15px 被裁到屏幕外**，第一列格子与其中的冰块/冰墙显示不全，直接影响可玩性。同理 `canvas.height < 450` 时纵向溢出，并与顶部 HUD 面板（`y: 6, height: 82`）重叠。

**修复**：改为按可用区域动态计算格子尺寸：

```
cellSize = min(floor((W - 2*margin) / 7), floor((H - topHUD - bottomBar - 2*margin) / 9), 56)
```

并把 `CELL_SIZE / GRID_COLS / BOARD_OFFSET_*` 从模块级常量改为实例属性，在 `init` 与 `wx.onWindowResize` 时重算。**注意**：`level-manager` 与关卡 JSON 里的坐标是 50px 网格单位，缩放时只需换 `cellSize` 与 `offset`，坐标换算公式不变（`col = round(x/50)`）。

---

### P0-9 成就解锁后通知与奖励丢失

**位置**：`js/utils/achievement-manager.js:287-299` + `game.js:893-907`

```js
checkAchievements() {
  this.newUnlocked = []            // ← 每次调用都清空
  ...
}
```

`onWin` 里连续调用三次会触发 `checkAchievements` 的方法：

```js
recordWin(...)             // → checkAchievements()，解锁 A，newUnlocked=[A]
recordStreak(...)          // → checkAchievements()，newUnlocked=[]，解锁 B，newUnlocked=[B]
recordFoodCollection(...)  // → checkAchievements()，newUnlocked=[]，可能解锁 C
const list = getNewUnlocked()   // 只剩最后一次的结果
```

后果：`recordWin` 解锁的成就（如"初出茅庐"）**既不会弹通知，也不会发奖励**——玩家看到成就列表里已解锁，但没拿到 5🐟。这是玩家可感知的"吞奖励"。

**修复**：`checkAchievements()` 不要重置 `newUnlocked`，改为只追加；新增 `flushNewUnlocked()` 在消费后清空。

---

### P0-10 三个成就永远无法解锁（含"收藏家"）

| 成就 | 判定条件 | 不可达原因 |
|---|---|---|
| `all_3star` 完美主义 | `stats.allThreeStars` | `recordAllThreeStars()` **从未被调用** |
| `persistent` 坚持不懈 | `stats.totalPlayTime >= 3600` | `recordPlayTime()` **从未被调用** |
| `collector` 收藏家 | 四种食物都 > 0 | 金鱼（goldfish）**无法获得**，见 P1-4 |

**修复**：`onWin` 里补 `recordPlayTime(本关用时)`；通关时统计"是否所有已解锁关卡都 3 星"并调 `recordAllThreeStars`；修 P1-4 让金鱼可达。

---

## 3. 严重问题（P1）— 影响体验与上线效果

### P1-1 全站布局硬编码 375×667，短屏大面积出屏

所有弹层/菜单的 Y 坐标都是写死的（基于 375×667 设计稿）：

| 组件 | 关键坐标 | 375×667 | 320×568（SE） |
|---|---|---|---|
| `MenuScene` | 主按钮 y=392；副按钮 y=500；说明文字 y=634 | 正常 | **说明文字出屏，副按钮贴底** |
| `GameOverScene` | 面板 y=76 h=560；按钮 436/502/568 | 正常 | **第三个按钮出屏** |
| `ReviveScene` | 面板 y=70 h=580；按钮 226~572；状态文字 604/626 | 正常 | **食物/惩罚文字与"放弃重玩"出屏** |
| `ResultScene` | 面板 y=88 h=540；按钮 y=452 | 正常 | **面板与按钮出屏** |
| `AchievementScene` | 面板 `10 ~ H-10`，列表裁剪 `H-startY-24` | 正常 | 正常（唯一用了自适应的） |
| `RankScene` | 列表 8 行 × 64 起于 142 → 底部 654 | 正常 | **第 6~8 名出屏** |

**修复**：引入一个 `js/ui/layout.js`，以 `canvas.width/height` 为基准算安全区与栅格（顶部 HUD 高度、底部操作条高度、中间内容区），把各场景的常量改为 `layout.xxx`。工作量集中在 6 个文件，属于机械替换。

### P1-2 没有应用生命周期处理（切后台）

`game.js` 只注册了 `wx.onTouchStart/Move/End`，全仓库没有 `wx.onShow` / `wx.onHide`。后果：

- 切后台再回来，关卡计时继续累加（`startTime` 用 `Date.now()`，`update()` 里直接算差）→ **时间奖励直接归零、结算用时虚高**
- BGM 不暂停（部分机型后台继续出声，审核/体验都扣分）
- 来电/音频打断后音效可能失效（缺 `wx.onAudioInterruptionBegin/End`）

**修复**：`onHide` → `pauseGame()` + `audioManager.pauseBGM()` + 记录 `hideTime`；`onShow` → 若在 playing 则停留暂停页（让玩家主动继续），并把 `startTime += (now - hideTime)` 补偿。

### P1-3 体力自然恢复离线不计，且恢复时间不落盘

**位置**：`js/utils/food-manager.js:340-356, 401-407`

- `saveRecoveryTime()` **从未被调用**，`lastRecoveryTime` 只存在于内存；重启后 `loadRecoveryTime()` 读不到值 → 回落到 `Date.now()` → **离线时长永远不产生恢复**。
- `checkRecovery()` 由 `FoodDisplay.update()` 驱动，而 `FoodDisplay` 只在 `gameState === 'playing'` 时 update → **主菜单挂机也不恢复**。
- 恢复成功时 `lastRecoveryTime = now`，丢弃余数（例如离线 12 分钟、间隔 5 分钟，只补 2 次并抹掉 2 分钟）。

**修复**：`checkRecovery` 改为 `lastRecoveryTime += actualRecoveries * interval`；在 `init()` 与 `onShow` 各调一次；恢复时间写入 storage。

### P1-4 金鱼永远拿不到，货币体系失效

**位置**：`js/utils/food-manager.js:326-334` + `:241-254`

`getTimeBonus()` 的金鱼档返回 **50**，但 `calculateRewards` 的分支是：

```js
if (timeBonus >= 10) { rewards.squid += 1 }        // 50 也走这里
else if (timeBonus >= 3) { rewards.shrimp += 1 }
else { rewards.fish += timeBonus }
```

连续通关奖励同理（`getConsecutiveBonus()` 返回 50 也映射到 1🦑）。结果：**四种食物里价值最高的金鱼（50 鱼单位）在常规玩法中完全不可获得**，只有 3 个不可达成就才给。而关卡消耗按"总食物值"结算，金鱼缺失让经济曲线完全失衡。

**修复**：`calculateRewards` 改为按 `timeBonus` 的**枚举类型**分发（`getTimeBonus` 返回 `{type:'goldfish'|'squid'|'shrimp'|'fish', amount}`），或加 `if (timeBonus >= 50) goldfish += 1` 分支。

### P1-5 `par` 等于理论最优解 → 3 星几乎不可能

**求解器验证结果**（BFS 最短解 vs 关卡 `par`）：

| 关卡 | 最优解 | par | 结论 |
|---|---|---|---|
| L1 初学滑冰 | 13 | 13 | 完全一致 |
| L2 双石挑战 | 17 | 17 | 完全一致 |
| L3 精准推送 | 23 | 23 | 完全一致 |
| L4 冰墙迷宫 | 27 | 27 | 完全一致 |
| L5 危险冰窟 | 29 | 29 | 完全一致 |
| L6 雪地减速 | 31 | 31 | 完全一致 |
| L7 综合挑战 | 39 | 39 | 完全一致 |
| L8~L48（程序化） | 38/39/42/43/45 | 同左 | **全部完全一致** |

全部关卡可解（这点很好），但 **3 星条件是 `moves <= par`，即"一步不错"**。对推箱子类玩法，人类玩家几乎不可能零试错通关；L7 需要 39 步最优解，实际 3 星率会接近 0。这会让星级系统、成就（`perfect_moves`、`all_3star`）、时间/星级奖励全部失效。

**修复**：`par` 改为"设计目标步数" = `ceil(最优解 × 1.15~1.25)`，并保留 `optimal` 字段用于展示"完美通关"（可选）。3 星 `moves <= par`，2 星 `<= par*1.5`，1 星其余。注意 `par` 同时被 `game-hud`、`result-scene`、`food-manager`、`achievement-manager` 使用，改数据即可，逻辑不用动。

### P1-6 程序化关卡只有 8 个变体循环，第 16 关开始重复

**位置**：`js/level-manager.js:344-361`

```js
const variant = variants[(levelNum - band.startLevel) % variants.length]  // 8 个变体
```

- L8~L15 用满 8 个变体，**L16 起回到 L8 的布局**，每 8 关一个循环。
- L8~L19 共 12 关，`par` 全是 39，难度零变化。
- 三个 band（hardA/B/C）的 `penguin` 固定 `(1,1)`、`stones` 固定在第 4 行，只有镜像/平移，玩家第 20 关就会识破"这是同一关"。

**修复**：把模板改为"参数化生成 + 求解器校验"（可直接复用本次走查用的 BFS 思路：状态 = 企鹅格 + 冰块格集合，动作 = 四方向一格，规则同 `game.js:400-462`）：随机撒 3 块冰 + 随机障碍 → 求解 → 过滤掉无解或最优解 < 30 的样本 → 缓存成关卡池。至少要保证 60 关不重复。

### P1-7 排行榜分数语义错误，且会越刷越低

**位置**：`js/utils/wechat-service.js:288-301`

```js
{ key: 'level', value: level }, { key: 'stars', value: stars },   // 单关星级
{ key: 'score', value: stars * 1000 - moves * 10 }
```

每次通关都用**当前这一关**的 `level/stars/moves` **覆盖**云存储，不是历史最佳。后果：通关到 L30 后回头重玩 L1，排行榜上的"关卡"会从 30 掉到 1，分数也掉。排序按 `score`，而 `score` 只反映"最后一次通关的单关表现"。

**修复**：上报前先读本地最佳记录，只在更优时写入；`level` 存**最高解锁关**，`stars` 存**总星数**，`score` 用"最高关 × 1000 + 总星 × 100 - 总步数惩罚"这类单调不减的公式。

### P1-8 `LoginScene` 每帧 `wx.createImage()`，内存泄漏

**位置**：`js/ui/login-scene.js:180-191`

```js
renderUserInfo(ctx) {
  if (this.userInfo.avatarUrl) {
    const img = wx.createImage()      // 每帧创建一个 Image 对象
    img.src = this.userInfo.avatarUrl  // 每帧发起一次网络请求
    img.onload = () => { ... }
```

个人中心页在 60fps 下每秒创建 60 个 Image、发起 60 次图片请求，长时间停留会 OOM 或卡死。**必须在 `onEnter` 时加载一次并缓存到 `this.avatarImage`**，`render` 只负责 `drawImage`。

### P1-9 登录体系是空壳（`getUserInfo` 已废弃）

**位置**：`js/utils/wechat-service.js:49-115`

- `wx.getUserInfo` 自 2021 年起返回**匿名数据**（昵称"微信用户"、灰色头像），`wx.getUserProfile` 自 2022-10-25 起同样返回匿名数据。所以"个人中心"永远是"微信用户 + 🐧 占位图"。
- `login()` 把 `res.code`（一次性、5 分钟有效）直接当 `openId` 存本地，**没有后端换取 openid**，`reportScore` 仅凭 `isLogin` 布尔值放行 → 排行榜数据可被本地伪造。
- `getUserProfile()`、`exitMiniProgram()` 均为死代码。

**修复**：二选一——
- **轻量**：去掉"个人中心/登录"入口，直接用 `wx.getUserInfo`（开放数据域内）展示好友信息，不做主域登录。
- **完整**：接后端（`code2session` 换 openid + 云函数校验分数），个人中心改用"头像昵称填写能力"（`wx.getUserInfo` 不再提供真实资料）。

### P1-10 `levels/*.json` 与内置关卡双份维护，且 JSON 实际读不到

**位置**：`js/level-manager.js:299-317`

```js
const filePath = `${wx.env.USER_DATA_PATH}/levels/level${levelNum}.json`
```

`USER_DATA_PATH` 是**用户本地存储目录**，不是代码包目录。首次运行时该路径一定不存在 → `fail` → 回落 `HANDCRAFTED_LEVELS`。也就是说：

- `levels/level1~7.json`（约 3KB）**永远不会被读取**，却仍被打进包体；
- 同一份关卡数据在 `level-manager.js:21-136` 和 `levels/*.json` 里各存一份，改一处必然不同步（本次走查发现两者目前恰好一致，但没有任何机制保证）。

**修复**：保留 JSON 为唯一数据源，改用 `fs.readFileSync('levels/level1.json')`（代码包内相对路径可读），删掉 `HANDCRAFTED_LEVELS`；或反过来删掉 JSON，只留 JS。**不要两套并存。**

### P1-11 缺少隐私合规配置

微信自 2023-09 起要求：使用 `wx.getUserInfo` / `wx.login` / `wx.getSetting` 等涉及用户信息的接口前，必须在 MP 后台配置《用户隐私保护指引》，并在代码里处理 `wx.onNeedPrivacyAuthorization` / `wx.requirePrivacyAuthorize`。本项目两者都没有 → 提审会被要求整改，真机上也可能出现接口调用失败。

**修复**：后台配置隐私指引 → 代码在 `init()` 里注册 `wx.onNeedPrivacyAuthorization`，首次触发时弹自定义隐私弹窗，用户同意后 `resolve({ buttonId, event: 'agree' })`。

### P1-12 包体未做 ignore，开发文件全量上传

`project.config.json` 的 `packOptions.ignore` 为空数组，当前会打进包体的非运行时代码：

| 路径 | 体积 | 说明 |
|---|---|---|
| `penguin-skating-design.html` | 72KB | 设计稿 |
| `docs/*.md`（10 份） | ~70KB | 开发文档 |
| `local-preview/*`（4 个） | ~18KB | H5 适配层，**不应上传** |
| `audio/generate-audio.html` + `README.md` | ~10KB | 工具与说明 |
| `levels/*.json` | 3KB | 见 P1-10 |
| `open-data/index.html` | <1KB | 开放数据域只需 `index.js` |

总计约 170KB，虽远低于 4MB 主包上限，但 `local-preview/wechat-adapter.js` 里有一套会覆盖 `wx` 的 mock，属于**必须排除**的代码（万一被误引入会直接破坏线上逻辑）。

**修复**：`packOptions.ignore` 补上以上 6 条。

### P1-13 缺少更新管理器与全局错误兜底

- 无 `wx.getUpdateManager()` → 玩家长期停留在旧版本，热更不生效。
- 无 `wx.onError` / `wx.onUnhandledRejection` → 线上崩溃无日志，问题无法定位。

**修复**：`game.js` 顶部加更新检查（`onUpdateReady` 弹"重启应用新版本"），并上报错误到 `wx.reportMonitor` 或自建日志。

---

## 4. 一般问题（P2）— 优化项

| 编号 | 位置 | 问题 | 建议 |
|---|---|---|---|
| P2-1 | `js/physics/physics.js`、`js/physics/collision.js`、`js/base/pool.js`、`js/ui/level-select-scene.js`、`js/utils/ad-manager.js` | 5 个模块共 ~800 行，**全仓库零引用**（`ad-manager` 见 P0-6，其余纯死代码） | 删除，或接入（`ad-manager` 应接入） |
| P2-2 | `game.js:918-925`、`game.js:953-960`、`game.js:991-996`、`result-scene.js:108-116` | 星级算法**同一逻辑写了 4 遍** | 抽 `calcStars(moves, par)` 到 `js/utils/score.js` |
| P2-3 | `js/runtime/stone.js:35` + `game.js:292` | 冰块 `size: 40` 放在 50px 格子里，左上对齐 → **视觉偏左上 5px**，与企鹅（size 50 居中）不一致 | 构造时 `x + (cellSize - size)/2`，或直接把 size 设为 `cellSize` |
| P2-4 | `js/runtime/penguin.js:44` | 滑动阈值 `distance > 10` 偏敏感，误触率高 | 提到 24~30px，并加"最小滑动时长"过滤 |
| P2-5 | `js/ui/food-display.js:69`、`js/ui/achievement-notification.js:40` | 用帧计数做动画计时（60 帧 = 1 秒），120Hz 设备上时长减半 | 改用 `deltaTime` 累计 |
| P2-6 | `js/ui/target.js:82-98`、`js/runtime/background.js:64-142` | 每帧 `createRadialGradient` × 目标格数、`shadowBlur`（最贵的 2D 操作之一）、63 格逐格绘制 | 背景与棋盘静态层用 `wx.createCanvas()` 离屏缓存，每帧只 `drawImage` + 画动态气泡/闪光 |
| P2-7 | `js/runtime/obstacle.js:24-37` | `onPenguinCollide` / `onStoneCollide` 定义了但**从未调用**（判定逻辑写在 `game.js:400-462` 里） | 要么删掉这套抽象，要么把判定收敛到障碍物自身，避免"看起来有逻辑其实没走" |
| P2-8 | `game.js:33-34` | `BOARD_OFFSET_X/Y` 是模块级常量，`wx.onWindowResize` 后不重算 | 改为实例属性 + resize 重算（与 P0-8 一起改） |
| P2-9 | `game.js:221` | `this.gameScene` 未在 constructor 声明，动态挂载 | 构造函数里初始化 `null`，便于阅读与静态检查 |
| P2-10 | `js/ui/theme.js:186-189, 221-224` | `drawOverlay` / `drawOceanBackdrop` 直接读全局 `canvas`，与 `ctx` 参数不一致 | 传入 `width/height`，去掉全局依赖（H5 适配时更关键） |
| P2-11 | `game.js:112-121` | 未注册 `wx.onError`，且 `init` 里 `audioManager.playBGM()` 在用户首次触摸前调用（iOS 可能被静音策略拦截） | 首次 `onTouchStart` 后再 `playBGM`；加 `wx.setInnerAudioOption({ obeyMuteSwitch: false })` |
| P2-12 | `js/utils/audio-manager.js` | 7 个 wav 音效 + 8 个常驻 `InnerAudioContext`；wav 在部分安卓机型解码不稳 | 统一转 mp3（44.1kHz/96kbps），或改用 `wx.createWebAudioContext` 预解码 |
| P2-13 | `project.config.json:45` | `libVersion: "2.25.0"`，但 `project.private.config.json` 覆盖为 `3.17.4` | 统一为 `3.x`，避免团队协作时行为不一致 |
| P2-14 | `README.md` / `README.zh-CN.md` | 声称"冰面物理模拟/摩擦系数/推力传递 50%/关卡选择/对象池"，**实际实现是逐格移动、无物理引擎、无关卡选择** | 按实际实现重写技术栈与玩法说明 |
| P2-15 | 仓库根 | 无 `.gitignore` | 补 `node_modules/`、`.DS_Store`、`project.private.config.json`、`*.log` |
| P2-16 | `open-data/index.html` | 开放数据域只需要 `index.js`，HTML 是多余文件 | 删除 |
| P2-17 | `js/utils/wechat-service.js:260-273` | `getTotalStars()` 只统计 `level_1~30`，关卡无限 | 改为统计 `1..unlockedLevel` |
| P2-18 | `js/utils/settlement-manager.js:119-135` | `failLevel()` 在"失败→复活→再失败"链路会重复累加 `totalGames` | 每关只记一次 |

---

## 5. 性能专项

单帧绘制开销（以 L7 为例，3 冰块 + 3 障碍 + 3 目标格）：

| 绘制项 | 每帧次数 | 备注 |
|---|---|---|
| `drawOceanBackdrop` | 1 | 3 个渐变 + 14 气泡 + 2 鱼 + 4 珊瑚 + 7 海草 + 沙地曲线 |
| 棋盘 63 格 | 63 × (1 渐变填充 + 1 描边 + 1 高光描边) | 静态内容，**完全可缓存** |
| `Target.renderCell` | 3 | 每格 1 个 `radialGradient` + 1 个 `shadowBlur` |
| `Stone.render` | 3 | 每个 1 个 `linearGradient` + 2 次 clip |
| `IceHole.render` | n | 每个 2 个 `radialGradient` + 9 条裂纹 + 4 个碎冰三角 |
| `IceWall.render` | n | 每个 3 个 `linearGradient` + clip |

**风险点**：`ctx.shadowBlur`（目标格 + 玻璃面板）在 Canvas 2D 小游戏里是软件渲染路径，中低端安卓上单帧可能超 16ms。`ctx.createXxxGradient` 每帧新建也会持续产生 GC 压力。

**建议**：
1. 背景 + 棋盘 + 静态障碍 → 离屏 canvas 缓存，只在 resize / 换关时重绘。
2. 目标格的 `shadowBlur` 改为"预先画一张带辉光的贴图"或直接用 `radialGradient` 模拟，去掉 shadow。
3. 冰块/冰墙的渐变在 `constructor` 里建一次（坐标相对对象左上角，随 `translate` 复用）。
4. 加一个 FPS 采样（`wx.getPerformance()` 或自算），在 `wx.reportMonitor` 上报。

---

## 6. 合规与审核风险清单（提审前必须逐条确认）

| # | 风险项 | 现状 | 处置 |
|---|---|---|---|
| 1 | 诱导分享 | 分享→复活 / 分享→+5🐟 | **删除奖励绑定**（P0-5） |
| 2 | 虚假/模拟功能 | "模拟观看 30 秒视频广告"、`广告功能待实现` | 接真广告或隐藏入口（P0-6） |
| 3 | 用户隐私保护指引 | 未配置、代码无授权流程 | 后台配置 + 代码接入（P1-11） |
| 4 | 游戏类目资质 | 未知 | 后台选「游戏」类目并提交资质（软著；涉内购需版号） |
| 5 | 分享图缺失 | `images/share-image.png` 不存在 | 补图（P0-7） |
| 6 | 排行榜数据真实性 | 主域伪造 `openId`，无服务端校验 | 至少改为开放数据域读取（P0-4）；有后端再校验 |
| 7 | 未成年人保护 | 无提示 | 若有内购/广告，需在游戏内展示适龄提示（8+/12+/16+） |
| 8 | 广告位资质 | `adunit-xxx` 占位 | 开通流量主后创建真实广告位 |

---

## 7. 关卡与数值验证结果（供参考）

用 BFS 求解器（状态 = 企鹅格 + 冰块格集合，动作 = 上下左右一格，规则与 `game.js:400-462` 完全一致：边界/冰墙阻挡、冰块前方为边界/冰墙/雪堆/冰块则推不动、冰块或企鹅入洞即失败）对 L1~L48 全量验证：

- **可解性：48/48 通过**，无死关。
- **`par` = 最优解：48/48 完全相等** → 见 P1-5，3 星条件过严。
- **L7 最优解 39 步**（本次走查首次确认其可解，此前代码注释里只有"综合挑战"未标注验证）。
- **L16~L19 与 L8~L11 布局完全相同**（变体循环，见 P1-6）。

结论：**关卡数据本身没有 bug，问题在数值设计（par 过严）与内容量（重复）。**

---

## 8. 亮点（建议保留）

避免只列问题，以下实现质量较好，改动时应保护：

1. **关卡坐标与棋盘坐标分离**（`toBoardPixel` / `cellToPixel` / `getCell`），关卡数据用 50px 网格单位，为后续做分辨率自适应留了口子（只需替换 `cellSize/offset`）。
2. **移动补间与胜负判定解耦**：`checkWinCondition` 等所有 `isMoving` 结束才判定，正确避免了"冰块途经目标格误判通关"这类经典 bug。
3. **失败态处理清晰**：`gameState` 状态机（menu/playing/paused/win/fail）+ 覆盖层优先级（gameOver > revive > pause > win > HUD）顺序正确，`tryMove` 里对 `isMoving` 的互斥也到位。
4. **全 Canvas 绘制、零图片资源**，包体极小（<300KB），启动快，很适合小游戏。
5. **视觉统一**：`theme.js` 集中色板与绘制工具，糖果海洋馆风格贯穿所有界面，完成度高。

---

## 9. 修改清单（待确认后执行）

按"风险/收益"排序，分 4 个批次。**每批次可独立提测，建议逐批确认。**

### 批次 A — 稳定性修复（P0，必须先做）

| # | 文件 | 改动 | 影响面 | 风险 |
|---|---|---|---|---|
| A1 | `js/ui/pause-scene.js`、`game.js` | 暂停页「返回菜单」改为回调 `game.backToMenu()`；`game` 增加 `clearOverlays()` 在切菜单前统一复位 `isPaused/gameState` | 暂停→菜单链路 | 低 |
| A2 | `game.js:816-827` | `reviveByWatchAd()` → `revive('watchAd', this.foodManager)`；广告未接入时隐藏该按钮 | 游戏结束页 | 低 |
| A3 | `game.js:874`、`js/utils/settlement-manager.js:80` | 统一 `completeLevel({moves,time,par,stars})` 签名；`onWin` 传入已算好的 `stars`；补 `recordRevive()` | 统计（当前无 UI，风险低） | 低 |
| A4 | `js/utils/achievement-manager.js:287` | `checkAchievements()` 不再清空 `newUnlocked`，新增 `flushNewUnlocked()`；`onWin` 补 `recordPlayTime` / `recordAllThreeStars` | 成就通知与奖励 | 中（需回归 20 个成就） |
| A5 | `game.js:30-34, 342-364` | 棋盘尺寸改为按可用区域动态计算；`BOARD_OFFSET/CELL_SIZE` 改实例属性 | 全部关卡的坐标换算 | **中高**（涉及核心坐标，需逐关回归） |
| A6 | `js/utils/wechat-service.js:308`、`js/ui/rank-scene.js:142`、`open-data/index.js` | 排行榜改为"开放数据域取数 + 主域绘制"，`sharedCanvas` 只绘制到内容区（避开返回按钮），删掉重复渲染 | 排行榜页 | 中 |

### 批次 B — 合规整改（提审前置）

| # | 文件 | 改动 | 影响面 | 风险 |
|---|---|---|---|---|
| B1 | `js/ui/revive-scene.js`、`game.js:930`、`js/utils/achievement-manager.js` | 删除「分享复活」「分享送鱼」；分享改为纯传播；移除 `first_share`/`share_10` 的奖励 | 复活/分享/成就 | 中 |
| B2 | `js/ui/revive-scene.js:212`、`game.js:256`、`js/utils/ad-manager.js` | 接入 `AdManager` 激励视频（真实 `adUnitId`）；未开通前隐藏所有广告入口，删除"模拟广告"文案 | 复活、体力补充 | 中（依赖后台开通流量主） |
| B3 | `images/` | 补 `share-image.png`（500×400）；`audio/` 补 `bgm.mp3` 或删除 BGM 配置 | 分享、音频 | 低 |
| B4 | `game.js:105-121` | 接入 `wx.onNeedPrivacyAuthorization` + 隐私弹窗；后台配置《用户隐私保护指引》 | 首启流程 | 中 |
| B5 | `project.config.json` | `packOptions.ignore` 排除 docs/local-preview/design.html/audio 工具文件/levels（若改 P1-10 则保留 levels） | 包体 | 低 |

### 批次 C — 体验与数值（决定留存）

| # | 文件 | 改动 | 影响面 | 风险 |
|---|---|---|---|---|
| C1 | 新增 `js/ui/layout.js`；`menu/gameover/revive/result/rank/pause-scene` | 所有硬编码 Y 坐标改为基于 `layout` 的安全区栅格 | 6 个界面 | 中（纯视觉，易回归） |
| C2 | `game.js` | 注册 `wx.onShow/onHide/onWindowResize`；切后台自动暂停并补偿计时；resize 重算棋盘 | 全局 | 中 |
| C3 | `js/utils/food-manager.js:326-356, 401` | 修金鱼奖励分支；`checkRecovery` 余数保留 + 落盘 + `onShow` 触发 | 经济系统 | 低 |
| C4 | `levels/*.json` + `js/level-manager.js:21-136, 358` | `par` 上调为 `ceil(最优×1.2)`；新增 `optimal` 字段；删除双份关卡数据（单一数据源） | 全关卡数值 | 中 |
| C5 | `js/level-manager.js:344-361` | 程序化关卡改为"生成 + 求解器校验 + 缓存池"，保证 60 关不重复 | 无限关卡 | 中高 |
| C6 | `js/utils/wechat-service.js:288-301` | 排行榜上报改为"只升不降"（最高关 + 总星 + 最佳步数） | 排行榜 | 低 |
| C7 | `js/ui/login-scene.js:180` | 头像改为 `onEnter` 加载一次并缓存 | 个人中心 | 低 |
| C8 | `js/utils/wechat-service.js:49-142` | 登录体系二选一（轻量：去掉登录入口；完整：接后端 `code2session`） | 登录/排行 | 中高（需后端） |

### 批次 D — 工程化清理

| # | 文件 | 改动 | 风险 |
|---|---|---|---|
| D1 | 删除 `js/physics/*`、`js/base/pool.js`、`js/ui/level-select-scene.js`、`open-data/index.html` | 清理死代码（约 800 行） | 低（需先 grep 确认零引用） |
| D2 | 新增 `js/utils/score.js` | 抽 `calcStars()`，替换 4 处重复 | 低 |
| D3 | `game.js` | 注册 `wx.onError`/`onUnhandledRejection` + `wx.getUpdateManager` | 低 |
| D4 | `README.md`、`README.zh-CN.md` | 按实际实现重写（去掉物理引擎/关卡选择/对象池等不存在的能力） | 低 |
| D5 | 仓库根 | 补 `.gitignore`；`project.config.json` libVersion 统一 | 低 |
| D6 | `js/runtime/stone.js`、`penguin.js` | 冰块居中、滑动阈值调优 | 低 |
| D7 | `js/runtime/background.js`、`js/ui/target.js` | 静态层离屏缓存、去掉 `shadowBlur` | 中（需真机测帧率） |

---

## 10. 验收清单（每批次提测前自查）

**稳定性**
- [ ] 游戏中暂停 → 返回菜单 → 菜单所有按钮可点（P0-1）
- [ ] 失败到无法复活 → 游戏结束页三个按钮均可用，无崩溃（P0-2）
- [ ] 连续通关 10 关，成就通知逐条弹出且食物奖励到账（P0-9）
- [ ] 通关后重玩低关，排行榜关卡数不下降（P1-7）

**适配**
- [ ] iPhone SE（320×568）、iPhone 14（390×844）、大屏安卓（412×915）、iPad 各界面按钮不出屏（P0-8 / P1-1）
- [ ] 切后台 30s 再回来，关卡计时未跳变、BGM 未在后台响（P1-2）
- [ ] 横竖屏切换 / 折叠屏展开后棋盘重新居中（C2）

**功能**
- [ ] 4 种食物均可获得，关卡消耗扣减正确（P1-4）
- [ ] 体力离线 10 分钟回来有恢复（P1-3）
- [ ] 排行榜显示好友数据、返回按钮可见可点（P0-4）
- [ ] 分享卡片有图有标题（P0-7）

**合规**
- [ ] 全仓库搜索 `模拟`、`待实现`、`TODO`，无残留面向用户的文案
- [ ] 分享不给任何奖励（P0-5）
- [ ] 首次启动弹出隐私授权，拒绝后核心玩法仍可玩（B4）
- [ ] 后台已配置类目资质、隐私指引、分享图

---

*本报告仅为走查结论，未改动任何代码。第 9 节修改清单确认后再执行。*
