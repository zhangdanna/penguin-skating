# A 批次修复记录 — 稳定性

> 对应走查报告：`docs/phase11-pre-release-review.md` 第 9 节「批次 A」
> 执行日期：2026-10-22
> 范围：A1~A6（6 项阻断级缺陷）+ 2 项连带修复
> 代码改动：11 个文件，+575 / −517
> 回归结果：**49 / 49 通过**（离线 harness，加载真实模块跑完整通关流程）

---

## 0. 批次概览

| 编号 | 问题 | 状态 | 影响文件 |
|---|---|---|---|
| A1 | 暂停页「返回菜单」导致主菜单永久卡死 | ✅ 已修 | `game.js`、`js/ui/pause-scene.js` |
| A2 | 游戏结束页「看广告复活」必崩 | ✅ 已修 | `game.js`、`js/ui/gameover-scene.js`、`js/ui/revive-scene.js` |
| A3 | 结算管理器参数错位，统计数据全错 | ✅ 已修 | `game.js`、`js/utils/settlement-manager.js` |
| A4 | 成就解锁后通知与奖励丢失 | ✅ 已修 | `game.js`、`js/utils/achievement-manager.js` |
| A5 | 320 宽设备棋盘溢出 | ✅ 已修 | `game.js`、`js/runtime/penguin.js`、`js/runtime/stone.js` |
| A6 | 排行榜不可用 + 画布遮挡返回按钮 | ✅ 已修 | `js/ui/rank-scene.js`、`open-data/index.js`、`js/utils/wechat-service.js` |
| A+1 | 冰块在格子里偏左上（原 P2-3） | ✅ 连带修复 | `js/runtime/stone.js` |
| A+2 | 食物不足/通关全部关卡时未复位覆盖层 | ✅ 连带修复 | `game.js` |

---

## 1. A1 — 暂停 → 返回菜单死锁

### 问题
`PauseScene` 的「返回菜单」只做 `hide() + sceneManager.switchTo('menu')`，没有复位 `game.isPaused`。
而 `touchStartHandler` 的第一优先级是 `if (this.isPaused) { pauseScene.onTouchStart(...); return }`，
此时面板已隐藏 → 回调直接 return → **主菜单所有按钮都点不动，只能杀进程**。

### 改动

**`js/ui/pause-scene.js`**
- 新增回调 `this.onBackToMenu`（构造时置 `null`，避免调用顺序问题）。
- 「返回菜单」按钮改为优先调用 `onBackToMenu()`，仅在未注入回调时才回落到旧的 `switchTo('menu')`。

**`game.js`**
- `initUI()` 注入 `pauseScene.onBackToMenu = () => this.backToMenu()`。
- 新增 `clearOverlays()`：统一复位 `isPaused` 并隐藏 `pauseScene / resultScene / reviveScene / gameOverScene`。
- `backToMenu()` 首行调用 `clearOverlays()`。
- 三处触摸处理 + `update()` 的暂停拦截，从 `if (this.isPaused)` 改为
  `if (this.isPaused && this.pauseScene.isVisible)` —— 即使将来还有别的路径漏掉复位，输入也不会被静默吞掉（**双保险**）。
- `onGameOverBackToMenu()`、`nextLevel()` 的兜底分支、`loadLevel()` 的"食物不足"分支，全部改走 `backToMenu()`，不再裸调 `switchTo('menu')`。

### 验证
- 暂停 → `isPaused === true`、面板可见
- 返回菜单 → `isPaused === false`、`gameState === 'menu'`、面板隐藏、场景为 `menu`
- **关键回归**：返回菜单后向主按钮中心派发 `touchStart`，`mainButton.isHovered === true`（证明输入真的到达了菜单）

---

## 2. A2 — 看广告复活崩溃

### 问题
`game.js` 调用 `this.reviveManager.reviveByWatchAd()`，但 `ReviveManager` 只有 `revive(type, foodManager)`。
点击即抛 `TypeError`，界面卡在 GameOver 层无法退出。

### 改动

**`game.js`**
- `onGameOverWatchAd()` 改为 `this.reviveManager.revive('watchAd', this.foodManager)`。
- 方法入口增加 `adAvailable` 守卫：不可用时 toast「广告暂不可用」并返回，不消耗次数。
- toast 的 `icon` 从 `'success'` 改为 `'none'`（`success` 图标配文字在部分机型被截断）。
- 错误分支读 `result.reason`（`revive()` 返回的字段是 `reason`，旧代码读的是不存在的 `message`）。
- 新增实例字段 `this.adAvailable = false` —— 作为**广告能力的唯一开关**，B 批次接入真实广告位后只需置 `true`。

**`js/ui/gameover-scene.js`**
- 新增 `setWatchAdVisible(visible)`：隐藏广告按钮，并把「返回菜单」从 `y=568` 上移到 `y=502`，不留空档。
- 隐藏时同步不渲染「看广告可以复活哦~」提示文案（避免出现"有提示但没按钮"）。

**`js/ui/revive-scene.js`**
- 新增 `this.buttonKeys = ['shareFriend','shareGroup','watchAd','useFood','giveUp']`，按钮与复活方式建立稳定映射，**不再依赖数组下标**。
- 新增 `setOptionVisible(key, visible)` + `relayoutButtons()`：隐藏某个入口后自动紧凑重排。
- `renderButtons()` 的禁用判定从 `index === 0/1/2/3` 改为按 `key` 判断；隐藏的按钮不再绘制遮罩与副标题。
- `handleRevive(type)` 增加"入口已隐藏则忽略"的守卫。

### 验证
- `adAvailable = false` 时调用 `onGameOverWatchAd()` 不抛异常
- 隐藏广告后返回菜单按钮 `y === 502`；恢复后回到 `y === 568`
- 复活页隐藏 `watchAd` 后，`useFood` 从 `y=436` 上移到 `y=366`，`giveUp` 从 `y=506` 上移到 `y=436`（自动紧凑排布）

---

## 3. A3 — 结算参数错位

### 问题
调用 `completeLevel(this.moves, time, par)`，定义 `completeLevel(stars, par)`。
实参被错配为 `stars = moves`、`par = time`，导致 `totalStars` 被步数污染、`perfectGames` 永远为 0、
`efficiency` 变成"时间/步数"。

### 改动

**`js/utils/settlement-manager.js`**
- `completeLevel(result = {})` 改为**对象参数** `{ moves, time, par, stars }`，并做 `Number.isFinite` 兜底（缺省回落到 `currentSettlement` 的值）。
- `startLevel()` 增加 `settled` 与 `isNewRecord` 字段。
- `completeLevel()` / `failLevel()` 增加 `settled` 幂等守卫：同一关只计入统计一次（修掉原 P2-18「失败→复活→再失败重复累加」）。
- 「是否破纪录」改为**先判定、后更新**（旧实现是先更新 `bestRecords` 再比较，`checkNewRecord` 依赖"恰好相等"，语义脆弱）。
- `checkNewRecord()` 直接读 `currentSettlement.isNewRecord`。
- `getSettlementSummary()` 的 `efficiency` 增加 `moves > 0` 保护，避免除零。

**`game.js`**
- `onWin()` 里 `par` / `stars` 只算一次（原来 `levelData` 与 `par` 在函数内重复声明两次），
  并作为对象传给 `completeLevel`。
- `onReviveSuccess()` 补 `settlementManager.recordRevive()`（原来 `totalStats.revives` 永远是 0）。

### 验证
| 断言 | 结果 |
|---|---|
| 通关 L1（13 步）后 `totalStars = 3` | ✅（旧代码为 13） |
| `perfectGames = 1` | ✅（旧代码恒为 0） |
| `summary.par = 13 / moves = 13 / stars = 3` | ✅ |
| `efficiency = 100` | ✅（旧代码为 0） |
| 重复 `completeLevel` 不重复累加 | ✅ |

---

## 4. A4 — 成就通知与奖励丢失

### 问题
`checkAchievements()` 首行 `this.newUnlocked = []`，而一次通关会依次调用
`recordWin → recordStreak → recordFoodCollection`，每次都会触发 `checkAchievements()` 并清空列表，
最终 `getNewUnlocked()` 只拿到最后一次的结果 —— 前面解锁的成就既不弹通知也拿不到鱼。

### 改动

**`js/utils/achievement-manager.js`**
- `checkAchievements()` **不再清空** `newUnlocked`，只追加（`unlockAchievement` 已有"未解锁才解锁"判断，不会重复）。
- 新增 `flushNewUnlocked()`，`getNewUnlocked()` 委托给它（保持向后兼容）。

**`game.js`**
- 抽出 `flushAchievementRewards()`：统一"弹通知 + 发奖励"，`onWin` 与 `onShareReward` 共用。
- `onWin` 补 `recordPlayTime(time)` —— 修掉 `persistent`（累计 1 小时）永远不可达。
- `onWin` 补 `recordAllThreeStars(this.isAllThreeStars())` —— 修掉 `all_3star`（完美主义）永远不可达。
- 新增 `isAllThreeStars()`：读 `gameProgress.unlockedLevel`，遍历已通关关卡的 `level_N.stars`，
  要求**至少通关 3 关**且全部 3 星才返回 `true`（避免第 1 关 3 星就解锁"所有关卡 3 星"）。

### 验证
通关 L1 后：
- 解锁 `first_win`、`perfect_moves`、`speed_demon` 三个成就
- 通知队列 3 条（旧代码只有最后 1 条）
- `newUnlocked` 被消费后为空
- 食物总数 > 0（含成就奖励 5🐟 + 10🐟 等）

---

## 5. A5 — 棋盘自适应

### 问题
`CELL_SIZE = 50`、`BOARD_OFFSET_X = (canvas.width - 350) / 2` 是**模块级常量**。
320 宽设备（iPhone SE）算出 `-15`，棋盘左侧 15px 被裁掉，第一列格子/冰块显示不全；
`canvas.height < 450` 时还会和顶部 HUD 面板重叠。

### 改动

**`game.js`**
- 常量拆分：`LEVEL_CELL = 50`（**只用于解析关卡数据**，`levels/*.json` 的坐标仍按 50px 网格书写）+ `GRID_COLS/GRID_ROWS`。
- 新增布局常量：`LAYOUT_MARGIN_X = 10`、`LAYOUT_TOP = 96`（顶部 HUD 面板底边 88 + 8 间距）、`LAYOUT_BOTTOM = 64`、`MIN_CELL_SIZE = 28`、`MAX_CELL_SIZE = 56`。
- 新增 `computeLayout()`：在"HUD 面板下方 ~ 底部操作条上方"的安全区里取最大可用格子，并居中棋盘。`init()` 首行调用。
- `CELL_SIZE / BOARD_OFFSET_X / BOARD_OFFSET_Y` 全部改为实例属性 `cellSize / boardOffsetX / boardOffsetY / boardWidth / boardHeight`。
- `toBoardPixel()` 用 `Math.round(pos.x / LEVEL_CELL) * this.cellSize`，`getCell()` 用 `(x - boardOffsetX) / cellSize` —— **坐标换算公式不变，只换单位**。
- 新增 `scaleLevelSize(v)`：把关卡里的像素尺寸（如目标区宽 150）换算成当前格子尺寸。
- `Target` 的 `width/height` 走 `scaleLevelSize`（原来直接把 150 传进去，格子缩小时目标区会跨格）。
- 障碍物改为 `ObstacleFactory.createFromLevelData(obstacles.map(o => ({...o, ...toBoardPixel(o), size: cellSize})))`，
  删掉原来"先创建再 `x += offset`"的补丁式写法（原写法在格子缩放后尺寸不会跟着变）。

**`js/runtime/penguin.js`**
- `drawPenguin(..., 1, ...)` → `drawPenguin(..., this.width / 50, ...)`，企鹅按格子尺寸等比缩放。

**`js/runtime/stone.js`**
- 菱形系数 `0.58 → 0.464`。冰块尺寸改为等于格子尺寸后，`0.464` 恰好等于原来"40px 冰块在 50px 格子里的菱形边长"，
  视觉不变但**自动居中**（连带修掉原 P2-3 的"冰块偏左上 5px"）。

### 验证（实测数值）

| 设备 | 画布 | 格子 | 棋盘原点 | 棋盘底边 | 结论 |
|---|---|---|---|---|---|
| iPhone SE | 320×568 | 42px | (13, 111) | 489 | 不溢出（旧：原点 −15） |
| iPhone 8 | 375×667 | 50px | (13, 125) | 575 | 与旧版格子一致 |
| iPhone 14 | 390×844 | 52px | (13, 204) | 672 | 居中 |
| Android 大屏 | 412×915 | 56px | (10, 222) | 726 | 触顶上限 |
| iPad | 768×1024 | 56px | (188, 276) | 780 | 居中 |

坐标映射回归：
- `level1` 企鹅 `(50,50)` → 第 1 列 1 行 ✅
- `level1` 冰块 `(200,150)` → 第 4 列 3 行 ✅
- `level7` 冰墙 `(5,5)` / 冰窟窿 `(5,3)` / 雪堆 `(3,4)` / 三块冰 `(4,4)(5,4)(6,4)` / 目标区 3 格宽 ✅

通关回归：按最优解走 13 步（走**真实触摸链路**：`touchStart → touchMove → 等待动画 → touchEnd`），
`moves === 13`、`gameState === 'win'` ✅

---

## 6. A6 — 排行榜

### 问题（三重叠加）
1. `wx.getFriendCloudStorage` **只能在开放数据域**调用，主域调用必然 fail → 列表永远为空。
2. 开放数据域启动时用不透明色铺满整块画布，主域又每帧整屏 `drawImage`，
   而「返回」按钮画在 `drawImage` **之前** → 按钮被完全盖住。
3. 排行榜被画两遍（开放数据域一套 + 主域 `renderRankList` 一套），字号/配色/分页逻辑互不相同。

### 改动

**`js/ui/rank-scene.js`（重写，311 → 178 行）**
- 删除主域的 `getFriendRank()` 调用、`rankList`、`isLoading`、`renderRankList`、`renderEmpty`、`renderNotLogin`。
- `show()` → `postMessage({ type: 'SHOW_RANK', layout })`，把**内容矩形**（`x:16, y:96, w:W-32, h:H-96-88`）一并下发。
- 渲染顺序改为：**背景 → 开放数据域画布 → 标题 → 返回按钮**。
  即使开放数据域将来画了不透明内容，标题与按钮也永远在最上层、永远可见可点。
- 无开放数据域（如 H5 预览）时降级显示「排行榜暂不可用 / 请在微信小游戏中打开」，不再白屏。
- 返回按钮的 `x` 从写死 `18` 改为 `canvas.width/2 - 90` 的标题面板对齐（标题也改为按画布居中）。

**`open-data/index.js`（重写）**
- **移除启动时的整屏 `drawBackground()`** —— 未进入排行榜时画布保持全透明，不再干扰主域任何界面。
- 只在下发的 `layout` 矩形内绘制，矩形外一律 `clearRect` 保持透明。
- 不再画自己的深蓝背景与标题栏，改用与主域一致的奶油/冰蓝卡片风格（`rgba(255,255,255,.82)` 交替行）。
- 移除分页（主域无法把触摸事件传给开放数据域，原来的"上一页/下一页"按钮是**点了没反应的死按钮**），改为按可用高度自适应显示 Top N 行。
- 过滤条件从 `score > 0` 改为 `level > 0`，避免低分/负分玩家被整条过滤掉。
- 新增空态 / 加载中 / 加载失败的统一提示（都画在内容区内）。
- 昵称超长自动截断（`ellipsis()`），不再溢出到分数列。

**`js/utils/wechat-service.js`**
- 删除 `getFriendRank()`（主域不可用，属错误 API 用法），原位置留注释说明改由开放数据域读取。

### 验证
- 切到排行榜 → 下发 `SHOW_RANK`，且 `layout.y >= 96`、`layout.height > 0`（避开标题与返回按钮）✅
- 离开排行榜 → 下发 `HIDE_RANK` ✅
- 主域渲染排行榜不抛异常 ✅

> ⚠️ 真机需重点回归：好友列表是否正常渲染、返回按钮是否可见可点、切到排行榜再返回主菜单是否残留内容。

---

## 7. 连带修复

| 项 | 文件 | 说明 |
|---|---|---|
| 冰块居中 | `js/runtime/stone.js` | 见 A5，菱形系数改为 0.464，冰块自动落在格子中心 |
| 覆盖层复位 | `game.js` | `loadLevel()` 食物不足、`nextLevel()` 无下一关两个分支改走 `backToMenu()`，避免 `gameState` 残留 |
| 广告文案 | `game.js` | 「广告功能待实现」→「广告暂不可用」（提审前仍需在 B 批次彻底处理） |

---

## 8. 回归测试

### 工具
新增 `tools/regression/run.mjs`：用 `vm.SourceTextModule` **直接加载真实模块**（不复制源码、不改测试专用分支），
只把 `new Main()` 挂到全局便于断言；用可控时钟驱动补间动画，用真实触摸链路驱动操作。

```bash
node --experimental-vm-modules tools/regression/run.mjs .
```

### 覆盖范围（49 项）
| 分组 | 项数 | 内容 |
|---|---|---|
| [1] 布局自适应 | 5 | 5 档屏幕尺寸下格子/原点/底边 |
| [2] 坐标映射 | 2 | 关卡坐标 → 格子 |
| [3] 关卡加载 | 5 | 对象尺寸、状态 |
| [4] 通关流程 | 2 | 13 步最优解、`moves`/`gameState` |
| [5] 结算统计 | 6 | 星级/完美/摘要/效率 |
| [6] 成就 | 4 | 解锁、通知、清空、奖励 |
| [7] 暂停复位 | 8 | 状态复位 + 输入可达 |
| [8] 广告入口 | 6 | 不崩溃、按钮隐藏与重排 |
| [9] 结算幂等 | 2 | 重复结算不累加 |
| [10] 障碍物映射 | 6 | L7 障碍/冰块/目标区 |
| [11] 排行榜 | 3 | SHOW_RANK/HIDE_RANK/layout |
| [12] 渲染 | 1 | 全场景 render 不抛异常 |

结果：**49 通过 / 0 失败**。

---

## 9. 本批次未处理（留给后续批次）

| 项 | 批次 | 说明 |
|---|---|---|
| 广告真实接入（`adUnitId`） | B2 | 现在只是把入口藏起来，`adAvailable` 开关已就位 |
| 诱导分享（分享复活/送鱼） | B1 | 复活页仍有「分享给好友/分享到群」两个按钮，且 `setTimeout 500ms` 无条件复活 |
| 分享图 / BGM 资源 | B3 | 仍缺失 |
| 隐私授权 | B4 | 未接入 |
| 包体 ignore | B5 | 未配置 |
| 各弹层硬编码 375×667 布局 | C1 | 本批次只修了**棋盘**，菜单/结算/复活/结束页的 Y 坐标仍是写死的（320×568 上仍会出屏） |
| `wx.onShow/onHide` | C2 | 切后台计时仍会跳变 |
| `par` = 最优解 | C4 | 3 星仍需零失误 |
| 关卡变体循环 | C5 | 第 16 关仍会重复第 8 关 |
| 排行榜分数语义 | C6 | 仍是"最后一次通关"覆盖写入 |
| `LoginScene` 每帧 `createImage` | C7 | 未动 |
| 死代码清理 | D1 | `js/physics/*`、`js/base/pool.js`、`js/ui/level-select-scene.js` 仍未引用 |

---

## 10. 提测建议

**真机必测路径**（A 批次专项）：

1. 进入关卡 → 暂停 → 返回菜单 → 点「第 N 关」→ 应能正常进入（原死锁）
2. 失败到无法复活 → 游戏结束页 → 只剩「重新挑战 / 返回菜单」两个按钮，且都不崩溃（原崩溃）
3. 通关一关 → 检查结算页星级、成就弹窗（可能连续多条）、食物增量
4. 320×568 设备 → 棋盘完整、第一列可见
5. 菜单 → 排行榜 → 返回按钮可见可点 → 回主菜单无残留
6. 412×915 设备 → 棋盘不超出底部操作条

**已知观感变化**（属预期）：
- 棋盘在竖屏上略微下移（顶部让出了 HUD 面板的空间），不再与顶部信息面板贴边
- 冰块位置更居中（原来偏左上 5px）
- 游戏结束页/复活页少了广告按钮，按钮整体上移
