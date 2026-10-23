# C 批次修复记录 — 体验与数值

> 对应走查报告：`docs/phase11-pre-release-review.md` 第 9 节「批次 C」
> 执行日期：2026-10-22
> 范围：C1~C8（决定留存的体验与数值问题）
> 代码改动：新增 3 个文件（`js/ui/layout.js`、`tools/gen-levels.mjs`、`js/levels/generated-levels.js`）+ 重写 2 个 + 删除 2 处 + 修改 12 个
> 回归结果：**136 / 136 通过**（A 批次 49 项 + B 批次 38 项 + C 批次 49 项）

---

## 0. 批次概览

| 编号 | 问题 | 状态 | 影响文件 |
|---|---|---|---|
| C1 | UI 按 375×667 硬编码坐标，窄屏/iPad 按钮出屏 | ✅ 已修 | `js/ui/layout.js`(新)、`menu/pause/result/gameover/revive/privacy-scene.js` |
| C2 | 未接前后台事件：切后台计时继续跑、BGM 后台响、resize 棋盘不重算 | ✅ 已修 | `game.js`、`js/ui/game-hud.js`、`js/ui/achievement-scene.js`、`local-preview/wechat-adapter.js` |
| C3 | 金鱼奖励分支永不可达；体力恢复白丢整周期进度 | ✅ 已修 | `js/utils/food-manager.js` |
| C4 | `par` 等于最优步数，3 星要求零失误 | ✅ 已修 | `js/levels/level-manager.js`、`js/levels/generated-levels.js`(新) |
| C5 | 程序化关卡靠随机摆盘，60 关重复且大量无解 | ✅ 已修 | `tools/gen-levels.mjs`(新)、`js/levels/generated-levels.js`(新)、`js/levels/level-manager.js` |
| C6 | 排行榜上报用 `isLogin` 做门禁 → 长期空白；口径可被覆盖 | ✅ 已修 | `js/utils/wechat-service.js`、`open-data/index.js` |
| C7 | 个人中心头像每次 `onEnter` 重复加载 | ✅ 自然消解 | 见 C8（LoginScene 整体删除） |
| C8 | 伪登录：`wx.login` 拿到 code 无处兑换，`getUserInfo` 已不返回真实资料 | ✅ 已修 | `js/ui/login-scene.js`(删)、`js/utils/wechat-service.js`、`game.js`、`js/ui/menu-scene.js` |

**一句话结论**：A 批次让游戏「不崩」、B 批次让游戏「能过审」，C 批次解决的是「玩家愿不愿意玩第二关」—— 屏幕适配、后台不白扣时间、3 星可达、60 关不重复、排行榜不空。

---

## 1. C1 — 屏幕适配：设计稿坐标系 + 等比缩放

### 问题

原实现所有 UI 坐标都按 375×667 写死，且部分位置直接用 `canvas.width / 2`：

- iPhone SE（320×568）上两侧各溢出 27px，返回按钮被裁掉一半；
- iPad（768×1024）上整个面板缩在中间一小块，四周大片留白；
- 更麻烦的是**触摸判定用的还是硬编码矩形**，即使把图形画对了，点击位置也会错位。

走查报告原方案是「所有硬编码 Y 坐标改为基于 layout 的安全区栅格」，但那需要把 6 个界面的每一个数字都重算一遍，回归风险极高。这里换了一个更省事也更稳的做法。

### 方案：设计稿坐标系 + 等比缩放

新增 `js/ui/layout.js`（78 行）。核心是把「设计稿坐标」和「屏幕像素」彻底分开：

```js
export const DESIGN_WIDTH = 375
export const DESIGN_HEIGHT = 667

export function stage() {
  const scale = Math.min(canvas.width / DESIGN_WIDTH, canvas.height / DESIGN_HEIGHT)
  const offsetX = (canvas.width - DESIGN_WIDTH * scale) / 2
  const offsetY = (canvas.height - DESIGN_HEIGHT * scale) / 2
  return {
    scale, offsetX, offsetY,
    apply(ctx) { ctx.translate(offsetX, offsetY); ctx.scale(scale, scale) },
    unproject(touch) { /* 真实像素 → 设计坐标 */ },
    project(x, y) { /* 设计坐标 → 真实像素 */ }
  }
}
```

于是每个场景只需要三步改造：

1. `render()` 里**先**用真实像素画全屏遮罩，**再** `stage().apply(ctx)` 包住面板内容，最后 `restore()`；
2. 所有 `canvas.width / 2` 换成常量 `CENTER_X`（= 187.5）；
3. 三个触摸方法开头加 `const t = stage().unproject(touch)`，后面全用 `t`。

这样 6 个界面的**布局数字一个都没改**，只是换了一套坐标系 —— 375×667 上 scale 恒等于 1，画面与改动前像素级一致；换到别的屏幕整块等比缩放并居中，不会拉伸变形。

### 改动清单

| 文件 | 改动 |
|---|---|
| `js/ui/layout.js` | **新增**。`DESIGN_WIDTH/HEIGHT`、`CENTER_X`、`stage()`、`isCompactScreen()` |
| `js/ui/menu-scene.js` | 引入 `CENTER_X`/`stage`；`init()` 首行 `this.buttons = []`（原实现是 `push`，重排会重复）；新增 `relayout()`；海洋背景仍用真实像素铺满，前景进设计坐标系 |
| `js/ui/pause-scene.js` | 回调从 `init()` 末尾**移到构造函数** —— 因为 `relayout()` 会重建按钮，放 `init()` 里会被清空 |
| `js/ui/result-scene.js` | `relayout()` 先存 `onNextLevel`/`onReplay`，`init()` 后再恢复；星星行按 `(DESIGN_WIDTH - totalWidth) / 2` 居中 |
| `js/ui/gameover-scene.js` | `relayout()` 额外重放一次 `setWatchAdVisible(this.adVisible)`，避免重排把广告按钮显示状态丢掉 |
| `js/ui/revive-scene.js` | `getPanelRect()` 改用设计稿尺寸（原来按 `canvas.height` 算，高屏上按钮会飘到屏幕外） |
| `js/ui/privacy-scene.js` | 同上；`relayout()` 必须先清空 `this.buttons`，否则重复调用会累积按钮 |

### 验证

回归里加了一组**坐标不变量**断言 —— 这是这套方案最直接的证据：

```
✅ 375x667 即设计基准（scale=1、无偏移）
✅ 320x568 等比缩放并在两侧留边（不拉伸变形）
✅ 触摸反投影可往返（设计坐标 ↔ 真实像素）
✅ 菜单按钮坐标与画布尺寸无关（设计稿坐标系生效）
✅ 暂停面板按钮坐标与画布尺寸无关
✅ 六个 UI 场景都实现了 relayout()
✅ result-scene 重排后 onNextLevel / onReplay 回调仍在
✅ pause-scene 重排后 onResume / onRestart / onBackToMenu 回调仍在
✅ gameover-scene 重排后保持广告按钮隐藏状态
✅ privacy-scene 重复重排不会累积按钮
```

后四条是 C1 最容易踩的坑：`relayout()` 会重建按钮对象，回调、可见性状态、按钮数组都可能被清空。`pause-scene` 第一版就是把回调写在 `init()` 末尾，重排一次就点不动了。

「与画布尺寸无关」的含义是：在 375×667 和 320×568 下分别 `relayout()`，取出的按钮坐标 JSON **完全相同**。如果哪天有人又在场景里写了 `canvas.width / 2`，这条断言会立刻挂掉。

---

## 2. C2 — 前后台与窗口生命周期

### 问题

三个独立但同源的坑：

1. **计时按 `Date.now() - startTime` 硬算**。切后台 5 分钟回来，关卡用时直接 +300 秒，时间奖励（≤30 秒档）必然拿不到。
2. **BGM 在后台继续播**。虽然微信会自动静音，但回到前台后可能出现叠音。
3. **`wx.onWindowResize` 完全没接**。折叠屏展开、横竖屏切换后，`canvas.width/height` 变了但棋盘还是按旧尺寸画的，企鹅会跑出棋盘。

### 改动

**`game.js` 新增 9 个方法**

| 方法 | 作用 |
|---|---|
| `getWindowInfo()` | `wx.getWindowInfo()` 优先，回落到 `getSystemInfoSync()`；任一返回的 `windowWidth` 无效则继续回落（本地预览的 `wx` 是 Proxy，缺的 key 会返回空函数，必须做这层校验） |
| `getCanvasRatio()` | 构造时记录 `canvas.width / windowWidth`。小游戏里 canvas 可能是 `windowWidth × pixelRatio`，resize 时沿用同一比值才不会变模糊 |
| `bindLifecycle()` | 注册 `wx.onHide` / `wx.onShow` / `wx.onWindowResize`，每个都做 `typeof === 'function'` 判断 |
| `handleHide()` | 记 `hiddenAt`、`pauseBGM()`、`gameState === 'playing'` 时自动 `pauseGame()` |
| `handleShow()` | 恢复 BGM、重新探测广告可用性（广告实例可能被后台回收） |
| `handleResize(res)` | 同步 canvas 尺寸 → `relayoutBoard()` → `relayoutUI()` |
| `relayoutBoard()` | 按新棋盘尺寸重建对局对象 |
| `relayoutUI()` | 遍历所有 UI 组件调 `relayout()` |
| `getElapsedSeconds()` | 关卡用时，实时扣除暂停窗口 |
| `accumulatePause()` | 把当前暂停区间并入 `pausedAccum` |

**计时口径（关键）**

```js
getElapsedSeconds() {
  if (!this.startTime) return 0
  const activePause = this.pauseStartedAt ? Date.now() - this.pauseStartedAt : 0
  return Math.max(0, Math.floor((Date.now() - this.startTime - this.pausedAccum - activePause) / 1000))
}
```

注意 `activePause` 是**实时**扣的，不是等 `resumeGame()` 才结算。这样「回到前台但还没点继续」的那一刻，HUD 上的时间也是对的，不会先跳一下再被拉回来。

`pauseGame()` 记 `pauseStartedAt = Date.now()`，`resumeGame()` 调 `accumulatePause()`；`handleHide()` 走的是 `pauseGame()`，所以后台时长和手动暂停时长走的是同一套累计逻辑，不需要为后台单开一个分支。

`loadLevel()` 重置 `pausedAccum = 0 / pauseStartedAt = 0`，`clearOverlays()` 清 `pauseStartedAt`（离开对局时直接丢弃当前区间，下一关会重置累计值）。

**`relayoutBoard()` 的顺序陷阱**

第一版实现是 `computeLayout()` 再 `relayoutBoard()`，结果企鹅从 (1,1) 跳到了 (1,2)。原因是 `relayoutBoard()` 内部用 `getCell()` 把像素位置反算成格坐标 —— 如果布局已经被换掉，反算出来就是错的。正确顺序是**先用旧布局反算格坐标，再由 `relayoutBoard()` 内部重算布局**：

```js
const penguinCell = this.getCell(this.penguin)   // 旧布局
const targetSpan = { cols: ..., rows: ... }      // 旧 cellSize
this.computeLayout()                             // 换布局
// ...按格还原
```

同时把 `isMoving` 置 false —— 否则补间动画会继续朝旧坐标飞。

**`relayoutUI()` 覆盖范围**

`menuScene / rankScene / achievementScene / pauseScene / resultScene / gameOverScene / reviveScene / privacyScene` + `gameHUD` + `foodDisplay`。

其中 `rank-scene` 本身没有 `relayout()`（返回按钮是固定坐标、列表在 `render()` 时按实时 `canvas.width` 算），由 `typeof === 'function'` 判断跳过；`game-hud` 与 `achievement-scene` 这一批补上了 `relayout()`。

**`js/ui/game-hud.js`**

把构造函数的布局代码抽成 `computeLayout()`，构造函数与 `relayout()` 都调它。HUD 是**真实像素**坐标系（不套设计稿缩放），因为它需要撑满屏幕宽度；这样在 320 宽的机器上按钮自然变窄，不会像设计稿缩放那样两侧留黑边。

**顺手修掉的过期逻辑**

`loadLevel()` 里食物不足的弹窗，原来确认后只弹一句「广告暂不可用」，注释还写着「广告入口在 B 批次接入」。现在改成真实入口 `watchAdForFood(cost, levelNum)`：看完激励视频补 `max(10, cost)` 条鱼，然后直接 `switchTo('game', { level })` 续上刚才那一关，玩家不用回菜单再点一次。

**`local-preview/wechat-adapter.js`**

补 `getWindowInfo` / `onShow` / `onHide` / `onWindowResize` 四个桩。前后台用 `document.visibilitychange` 模拟 —— 浏览器切标签页就能验证「切后台自动暂停」。

### 验证

```
✅ 对局 5s 后用时 5s
✅ 暂停后状态为 paused
✅ 暂停期间用时冻结在 5s（暂停时长实时扣除）
✅ 恢复后 15s 处的用时仍为 5s
✅ 切后台自动暂停对局
✅ 后台 30s 期间用时仍为 5s（不跳变）
✅ 回到前台后用时仍为 5s
✅ 回到前台不自动续玩（等玩家点继续）
✅ 恢复后继续正常计时（5+3=8s）
✅ resize 后画布尺寸同步（320x568）
✅ resize 后棋盘按新画布重算（50 → 42）
✅ resize 后企鹅仍落在原格 (1,1)
✅ resize 后冰块仍落在原格 (4,3)
✅ resize 后对象尺寸跟随新格子
✅ resize 后目标区仍是 2x1 格
✅ resize 后 render() 正常执行
```

用可控时钟驱动真实方法（`pauseGame` / `resumeGame` / `handleHide` / `handleShow`），不是断言内部字段。

---

## 3. C3 — 食物经济

### 问题 1：金鱼奖励分支永不可达

```js
// 修改前
if (value >= 10) { rewards.squid += 1; ... }
else if (value >= 3) { rewards.shrimp += 1; ... }
else if (value >= 1) { rewards.fish += value; ... }
```

`getTimeBonus()` 在「难度 × 时间」都最优时返回 **50**，`getConsecutiveBonus()` 连续 10 场也返回 50。但 50 同时满足 `>= 10`，于是被鱿鱼分支吞掉 —— 玩家拿到 1 只鱿鱼（10 点）而不是 1 条金鱼（50 点），而且**金鱼这个食物类型在整局游戏里永远不会出现**。

修法是抽出一个统一换算函数，按价值从高到低判定：

```js
applyBonus(rewards, value, label) {
  if (!(value > 0)) return
  if (value >= 50)      { rewards.goldfish += 1; ... }
  else if (value >= 10) { rewards.squid += 1; ... }
  else if (value >= 3)  { rewards.shrimp += 1; ... }
  else                  { rewards.fish += value; ... }
}
```

`calculateRewards()` 里连续通关奖励和时间奖励都改调它，两处重复的 `if/else` 一起消掉。

### 问题 2：体力恢复白丢整周期

```js
// 修改前
if (elapsed < intervalMs) return 0
this.addFish(this.recoveryRate)
this.lastRecoveryTime = now      // ← 问题在这里
```

玩家离开 12 分 50 秒（间隔 5 分钟）回来，本该恢复 2 点，实际只恢复 1 点，而且 `lastRecoveryTime` 被推到现在 —— 剩下那 2 分 50 秒的进度**直接清零**。反复进出还会不断重置。

```js
// 修改后
const pending = Math.floor(elapsed / intervalMs)          // 攒了几个周期
const capacity = Math.max(0, this.maxFood - this.getTotalFood())
const affordable = Math.floor(capacity / this.recoveryRate)
const actual = Math.min(pending, affordable)              // 体力满了就不发，避免溢出
if (actual <= 0) { this.lastRecoveryTime = now; ... return 0 }
this.addFish(actual * this.recoveryRate)
this.lastRecoveryTime += actual * intervalMs              // 只前进已消费的整周期
```

同时 `loadRecoveryTime()` 修了 `Number(saved) > 0` 的判断 —— 原来存的是 `0` 或空串时会退化成 `Date.now()`，第一次进游戏永远不恢复。

### 验证

```
✅ 50 价值 → 1 金鱼（金鱼档不再被鱿鱼分支吞掉）
✅ 10 价值 → 1 鱿鱼
✅ 3 价值 → 1 虾
✅ 1 价值 → 1 鱼
✅ 恢复 1 点并保留 30s 余数（不再白丢整周期进度）
```

---

## 4. C4 / C5 — 关卡体系重建

### 问题

**C4**：`par` 字段直接等于最优步数。这意味着 3 星 = 零失误，只要多走一步就掉星。对推箱子这种「一步推错要重来」的类型，实际效果是所有玩家都是 1~2 星。

**C5**：第 8 关起的程序化关卡是 `generateLevel()` 随机摆盘 —— 3 块冰随便撒在 7×9 网格上，**绝大多数布局根本无解**，而且 `level-7.json` 到 `level-30.json` 与代码里的 `HANDCRAFTED_LEVELS` 是两份数据源，改了一边另一边不生效。

### C4：par = ceil(optimal × 1.2)

先做了一件必须做的事 —— **用 BFS 实测每个盘面的真实最优步数**。7 个手工关实测 `optimal` = 13 / 17 / 23 / 27 / 29 / 31 / 39，与原文写死的 `par` **完全相同**。这反过来证实了走查报告的判断：原文的 `par` 就是最优步数。

于是 `par` 改为 `Math.ceil(optimal * 1.2)`：

| 关卡 | optimal | 原 par | 新 par | 3 星允许的冗余 |
|---|---|---|---|---|
| 1 初学滑冰 | 13 | 13 | 16 | +3 步 |
| 2 双石挑战 | 17 | 17 | 21 | +4 步 |
| 3 绕行迷宫 | 23 | 23 | 28 | +5 步 |
| 7 冰墙回廊 | 39 | 39 | 47 | +8 步 |

容错随关卡长度自然放大，短关仍然紧、长关不至于因为一次小失误就掉星。

### C5：逆向构造 + BFS 校验

随机摆盘行不通 —— 实测**平均 700+ 次**随机布局才能撞到一个可解盘面，生成 53 关需要几十分钟。改成逆向构造：

1. **从终局出发**：把 3 块冰直接摆在目标区里，此时盘面必然已解。
2. **反向随机走**：随机挑一块冰，「拉」着它反向移动（企鹅后撤 + 冰块跟随），走 60~360 步。推箱子的每一步都可逆，所以反向走出来的任何盘面**必然可解**。
3. **让冰块跑远**：纯随机反向走会让冰块越走越贴脸（难度不足）。给每个候选方向打分 —— 走完之后「冰块到目标的曼哈顿距离变大」得 +3 分，变小得 −1 分，加权随机选方向。实测 `optimal` 区间从 14~22 拉到 **18~39**。
4. **BFS 算 optimal**：用整数状态编码 `p | s0<<6 | s1<<12 | s2<<18` 做 BFS，`maxDepth=120`、`maxStates=200000`。
5. **盘面池排序**：先生成 96 个 `optimal >= 18` 的盘面，按 `optimal` 升序排序，再等距取 53 个。这样难度曲线是连续上升的，不会出现「按区间硬卡导致某个区间一直生成不出来」的死循环（第一版就卡在第 9 关，3000 次尝试全失败）。

产物 `js/levels/generated-levels.js`（53 关，第 8~60 关），每关带 `optimal` 与 `par`。

### 单一数据源

`js/levels/level-manager.js` 重写：

- `HANDCRAFTED_LEVELS` 保留 7 关原始设计，新增 `originalId` 与实测 `optimal`；
- `CAMPAIGN = 手工关 + 生成关`，**按 `optimal` 升序排序**后重新编号 1..60；
- 构造函数预填充 `this.levels`，`loadLevel()` 改同步返回（保留 async 签名，调用方不用改）；
- `generateLevel()` 从第 61 关起按 60 循环，奇数轮水平镜像（`mirrorPoint` / `mirrorRect`）；
- **删除 `levels/` 目录**（7 个 JSON 从未被读取，因为 `loadLevel` 早就走代码内数据了）。

排序这一步顺手解决了走查报告没提的一个问题：原来第 7 关是 39 步、第 8 关是 18 步，难度断崖式下跌。按 `optimal` 重排后第 1 关 13 步、第 60 关 39 步，单调递增。

### 验证

```
✅ 战役共 60 关
✅ 每关都带 optimal 字段
✅ par = ceil(optimal × 1.2)（3 星不再要求零失误）
✅ 难度按 optimal 单调递增（无断崖）
✅ 60 关盘面互不重复（实际 60 个）
✅ 第 1 关 optimal=13、第 60 关 optimal=39（难度确实在涨）
✅ 第 61 关起复用旧盘面（镜像或循环），不会报错
```

> **注**：BFS 只验证「可解」与「最少步数」，没有验证「可解但不显然」。生成关的视觉引导（冰块的初始朝向、目标区位置）不如手工关讲究，上线后建议按真实玩家通关率再手工调几关。

---

## 5. C6 — 排行榜上报

### 问题

```js
// 修改前
reportScore() {
  if (!this.wechatService.isLogin) return    // ← 门禁
  ...
}
```

而登录入口在主菜单角落，几乎没人点。结果就是**排行榜长期空白** —— 不是没数据，是根本没上报。

另外上报口径也可被覆盖：通关第 10 关后重玩第 3 关，会把「最高关卡」写回 3。

### 改动

**去掉门禁**。`wx.setUserCloudStorage` 本身就会绑定 openid，不需要 `wx.login` 换 session —— 这是开放数据域的设计前提，原实现多此一举。

**口径改为「只升不降」**，三项各自单调：

```js
const prev = this.loadCloudRecord()
const totalStars = Math.max(prev.stars, this.getTotalStars())
let bestMoves = prev.moves
if (level > prev.level) bestMoves = moves                              // 新关卡，直接取
else if (level === prev.level) bestMoves = prev.moves > 0 ? Math.min(prev.moves, moves) : moves
const next = { level: Math.max(prev.level, level), stars: totalStars, moves: bestMoves }
```

- `level` 只增；
- `stars` 取累计总星数的历史最大值；
- `moves` 只在同一关内取更小值。

新增 `loadCloudRecord()` / `saveCloudRecord()` 做本地镜像（storage key `cloudRecord`），作为比较基准 —— 否则每次都得上云读一次，而 `getFriendCloudStorage` 拿不到自己的记录。

**`computeScore(record)`** 统一成静态方法：`level * 10000 + stars * 100 + moveBonus`，其中 `moveBonus = max(0, 99 - min(moves, 99))`。三项都在同一个数量级上单调，不会出现「刷星数比推关卡更划算」。

**`getTotalStars()`** 原来写死遍历前 30 关，现在按 `getCurrentLevel()` 遍历。

**`open-data/index.js`** 星星列从 `'★'.repeat(n) + '☆'.repeat(3-n)`（单关星级）改为 `★{总星数}` —— 与上报口径对齐，否则玩家看到的是「3 颗星」而不是「累计 87 颗星」。

### 验证

```
✅ computeScore 随关卡单调递增
✅ computeScore 随星数单调递增
✅ computeScore 随步数单调递减（同关步数越少分越高）
✅ 上报只升不降（低关卡不会覆盖高关卡记录）
```

---

## 6. C8 — 账号体系轻量化（C7 随之消解）

### 问题

项目没有后端：

- `wx.login()` 拿到的 `code` 需要服务端调 `code2session` 才能换 openid，无处可换；
- `wx.getUserInfo()` 自 2022 年起不再返回真实头像昵称，`wx.getUserProfile()` 也已被收回；
- 于是 `login-scene.js` 的「登录」按钮点下去，实际上只是把 `isLogin` 置 true 并把昵称填成「企鹅玩家」——**伪登录**，却给 C6 的排行榜加了一道门禁。

走查报告给了两条路（轻量 / 完整）。完整方案要接后端，不在本批次范围内，所以选**轻量方案**。

### 改动

| 文件 | 改动 |
|---|---|
| `js/ui/login-scene.js` | **删除**（299 行），`grep` 确认零引用 |
| `js/utils/wechat-service.js` | 删除 `login()` / `getUserInfo()` / `getUserProfile()` / `isLogin` / `userInfo` / `openId` |
| `game.js` | 删除 `LoginScene` 的 import 与注册；`render()` 的 `uiScenes` 去掉 `'login'`；`reportScore()` 去掉 `isLogin` 门禁 |
| `js/ui/menu-scene.js` | 「个人中心」位改为「分享」（调 `onShare`）；「设置」位改为真实可用的「音效 开/关」开关 |

**为什么把「设置」改成音效开关**：原「设置」按钮的 `onClick` 只有一句 `console.log('设置')`，是个纯死入口。而 `audio-manager` 早就有 `setSoundEnabled` / `setMusicEnabled`，只是从来没被 UI 调过 —— 也就是说**玩家无法关闭音效**。换成开关后一举两得：填掉一个死入口，同时补上一个本该有的能力。

`game.js` 新增 `toggleSound()`：同步 `setSoundEnabled` + `setMusicEnabled` + `menuScene.setSoundEnabled()`（刷新文案）+ toast 提示。

**C7 的处理**：C7 是「头像改为 `onEnter` 加载一次并缓存」。`login-scene.js` 整体删除后，头像逻辑不复存在，这一项自然消解，无需单独修。

### 验证

```
✅ 伪登录场景文件已删除
✅ wechat-service 不再提供 login()
✅ wechat-service 不再提供 getUserInfo()
✅ 主菜单不再注册 login 场景
✅ 音效关闭后按钮文案变为「音效 关」
✅ 音效开启后按钮文案变为「音效 开」
✅ 主菜单挂载了分享入口（原「个人中心」位）
```

---

## 7. 回归测试变动

`tools/regression/run.mjs` 从 87 项扩到 **136 项**，新增 `[18] C 批次` 共 49 项。

同时**修正了 8 项因关卡体系重建而失效的旧断言**（这些不是新 bug，是 C4/C5 改变了数值与编号）：

| 旧断言 | 失效原因 | 改为 |
|---|---|---|
| `summary.par === 13` | C4 后 par = ceil(13×1.2) = 16 | 从 `levelManager.getLevel(1).par` 动态取 |
| `efficiency === 100` | 同上，实际 123 | 按 `floor(par/moves×100)` 计算期望值 |
| `level7 障碍物数量 = 3` / `冰墙在 (5,5)` 等 6 项 | C5 后第 7 关不再是手工关「冰墙回廊」 | 改为「扫描战役找到第一个带 ≥3 障碍物的关卡」，再按关卡数据逐格校验映射 |

后 6 项改成了**结构性断言**（遍历关卡数据里的每个障碍物/冰块/目标格，检查游戏对象是否落在对应格），比原来硬编码坐标更能防回归 —— 换关卡数据不会让测试失效。

顺带修了两个测试基础设施的坑：

- `loadModule()` 返回的是 `vm.SourceTextModule`，取默认导出必须 `mod.namespace.default`，直接 `mod.default` 恒为 `undefined`；
- 关卡数据在 `normalize()` 后重新编号，测试不能假设「第 N 关 = 第 N 个 JSON」。

---

## 8. 浏览器实机走查

除离线回归外，用 Chrome 跑了一遍真实渲染链路（`local-preview/server.js` + `local-preview/wechat-adapter.js`），确认 C1 的坐标变换没有把画面画歪：

| 场景 | 结果 |
|---|---|
| 主菜单 375×667 / 390×844 / 320×568 | 内容等比缩放并居中，无按钮出屏；「音效 开」「分享」两个新入口文案正确 |
| 对局界面（第 1 关） | HUD 显示「标准 16」（C4 生效）、计时正常走、棋盘 7×9 完整、企鹅 (1,1) / 冰块 (4,3) / 目标区右下角，与关卡数据一致 |
| 暂停面板 | 遮罩铺满真实屏幕，面板按设计稿居中，三个按钮位置正确 |
| 结算面板 | 走完 13 步最优解 → 3 星、`步数 13 / 标准 16`、奖励 3🐟+1🦐、三条成就通知依次弹出 |

> **注意**：本地预览的画布固定为 375×667（`wechat-adapter.js` 里写死），所以浏览器里改 viewport 只能验证「CSS 缩放后是否变形」，验证不了「320 逻辑像素下的布局」。后者由离线回归的坐标不变量断言覆盖 —— 因为 `stage()` 是纯等比缩放，320 逻辑画布渲染出的构图与 375 完全一致，只是整体缩小 15%。

---

## 9. 验收自查（对照走查报告第 10 节）

### 适配

- [x] iPhone SE（320×568）、iPhone 8（375×667）、iPhone 14（390×844）、大屏安卓（412×915）、iPad（768×1024）各界面按钮不出屏 —— 设计稿坐标系下按钮坐标与画布尺寸无关
- [x] 切后台 30s 再回来，关卡计时未跳变（5s → 5s）
- [x] BGM 不在后台响（`handleHide()` → `pauseBGM()`）
- [x] 折叠屏展开 / 窗口变化后棋盘重新居中（`handleResize()` → `relayoutBoard()`，企鹅/冰块/目标区格坐标不变）

### 数值

- [x] 3 星不再要求零失误（`par = ceil(optimal × 1.2)`）
- [x] 60 关盘面互不重复，全部可解
- [x] 难度单调递增，无断崖
- [x] 金鱼奖励可达（`applyBonus` 50 档）
- [x] 体力恢复余数保留

### 功能

- [x] 排行榜不再需要登录，上报只升不降
- [x] 音效开关真实可用
- [x] 分享入口保留（纯传播，不挂奖励）

### 待人工验证（无法离线断言）

- [ ] **真机切后台**：小游戏 `onHide` 与 `onShow` 的实际时序，尤其是「微信来电」「息屏」两种场景
- [ ] **真机 resize**：折叠屏展开时 `wx.onWindowResize` 的 `windowWidth` 是否包含安全区
- [ ] **生成关可玩性**：BFS 只保证可解，需要真实玩家跑一遍看是否「一眼看出怎么推」
- [ ] **iPad 大屏观感**：等比缩放到 768 宽后，设计稿 375 宽的内容会被放大 2 倍，字号可能偏大

---

## 10. 后续（批次 D）

C 批次留下的已知问题，都归到 D 批次工程化清理：

1. `js/physics/*`、`js/base/pool.js`、`js/ui/level-select-scene.js`、`open-data/index.html` 仍是无引用死代码（约 800 行）；
2. `calcStars()` 在 `game.js` / `result-scene.js` / `settlement-manager.js` / `gameover-scene.js` 有 4 份重复实现；
3. 缺 `wx.onError` / `wx.onUnhandledRejection` / `wx.getUpdateManager`；
4. `README.md` / `README.zh-CN.md` 仍描述着物理引擎、关卡选择、对象池等并不存在的能力；
5. 缺 `.gitignore`，`project.config.json` 的 `libVersion` 需统一；
6. **结算面板留白**：`result-scene` 面板固定 540 高，按钮下方还剩约 80px 空白；成就通知（最上层）会盖住「通关成功！」标题约 1 秒。都不影响操作，属视觉打磨；
7. **`isCompactScreen()` 已删除**：C1 第一版在 `layout.js` 里留了这个导出，但没有任何调用点，为避免又添一处死代码直接移除。如果后续真需要按屏高做紧凑排版，再按需加回。
