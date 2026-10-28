# 开发说明

改代码前先看本文。这里只放**改了就会出问题**的硬约束、模块职责、存档键和调参入口；
玩法数值与关卡设计见 [../game.md](../game.md)，发布步骤见 [./PUBLISH.md](./PUBLISH.md)。

---

## 1. 启动链路

```
game.js
 └─ import './js/env'          ← 必须是第一个 import
      ├─ 找现成的 canvas（H5 由 local-preview/wechat-adapter.js 提供 window.canvas）
      └─ 没有就 wx.createCanvas() 建上屏画布，并挂回 GameGlobal / globalThis / window
 └─ 其它模块（js/ui/*、js/runtime/*）直接读裸标识符 canvas
```

**为什么顺序不能动**：微信小游戏里「第一次调用 `wx.createCanvas()` 返回上屏画布」是一次性资源。
如果 `LayerCache` 或任何离屏缓存抢先调用，上屏画布就变成了离屏画布，画面永远上不了屏。
历史上就是因为没有这一步，审核被判「黑屏卡死」（见 [review/E5](./review/E5-weapp-black-screen-fix.md)）。

---

## 2. 模块职责

### 入口与配置

| 文件 | 职责 |
|---|---|
| `game.js` | 主循环、状态机、触摸路由、移动/推箱、胜负判定、奖励发放、存档写入 |
| `js/env.js` | 创建上屏画布、导出 `viewport()` / `DPR` / `screenCanvas` |
| `js/config.js` | `AD_UNITS.rewardedVideo`、`GAME_VERSION` |
| `js/ui/layout.js` | 375×667 设计稿坐标系（`stage()` / `CENTER_X`）+ 对局纵向布局（`computeBoardLayout`） |
| `js/ui/theme.js` | 调色板、按钮/玻璃面板绘制、**企鹅唯一绘制入口** `drawPenguin()` |

### 关卡

| 文件 | 职责 |
|---|---|
| `js/levels/level-generator.js` | `LEVEL_BANDS` 难度分档、逆向构造生成器、BFS 求解器、`boardSignature` / `levelDataSignature` |
| `js/levels/generated-levels.js` | 200 关烘焙产物，**由脚本生成，禁止手改** |
| `js/levels/level-manager.js` | 取关、`calcPar`、201 关起运行时生成、`getOptimalFloor` 下界、跨段去重 |

### 运行时实体

`js/runtime/` 下 `penguin.js`（含情绪动画）、`stone.js`、`target.js`、`obstacle.js`（冰墙/冰窟窿/雪堆）、`background.js`。

### 场景与面板

| 文件 | 职责 |
|---|---|
| `js/ui/scene-manager.js` | 场景注册与切换 |
| `js/ui/menu-scene.js` | 主菜单：`第N关` 主按钮 + 音效 / 排行榜 / 成就 / 分享 四个次级按钮 |
| `js/ui/game-hud.js` | 顶部信息面板 + 底部暂停 / 退一步 / 重玩三张卡片 |
| `js/ui/pause-scene.js` | 继续游戏 / 重新开始 / 返回菜单 |
| `js/ui/result-scene.js` | 通关结算（含本关解锁的成就） |
| `js/ui/gameover-scene.js` | 失败结算（重新挑战 / 看广告复活 / 返回菜单） |
| `js/ui/revive-scene.js` | 复活选择（看视频 / 10 食物 / 放弃重玩） |
| `js/ui/rank-scene.js` | 好友排行榜（把开放数据域画布贴到主域） |
| `js/ui/achievement-scene.js` | 成就列表 + 详情弹层（`POPUP` 常量是版式唯一数据源） |
| `js/ui/achievement-notification.js` | 成就浮层通知，**串行队列**，只渲染队首 |
| `js/ui/food-display.js` | 食物数量与飘字 |
| `js/ui/privacy-scene.js` | 隐私授权弹窗（`wx.onNeedPrivacyAuthorization` 驱动） |

### 系统

| 文件 | 职责 |
|---|---|
| `js/utils/score.js` | 星级口径 `calcStars()`，**唯一来源** |
| `js/utils/food-manager.js` | 食物库存、入场费、通关奖励、自然恢复、免费补给 |
| `js/utils/achievement-manager.js` | 15 个成就定义（含 `pose` / `prop` / `quote`）、统计与门槛 |
| `js/utils/revive-manager.js` | 每日复活次数、每关一次标记、步数惩罚 |
| `js/utils/settlement-manager.js` | 累计统计与最佳记录 |
| `js/utils/wechat-service.js` | 分享、云存档、排行榜四项上报 |
| `js/utils/ad-manager.js` | 激励视频（未配置广告位时整条链路关闭） |
| `js/utils/audio-manager.js` | 音频引擎：总线 / 声部池 / 冷却 / BGM 闪避与场景音量 / 前后台挂起恢复（设计见 `docs/AUDIO.md`） |
| `js/utils/audio-cues.js` | 音效表：12 个 cue 的素材路径、总线、增益、并发、冷却、闪避（音频唯一数据源） |
| `js/utils/layer-cache.js` | 离屏图层缓存 |

---

## 3. 硬约束

### 3.1 坐标系

- 所有场景按 **375×667 设计稿坐标**书写，`render()` 里 `stage().apply(ctx)`，
  触摸用 `stage().unproject()` 反算。**禁止**在场景里写 `canvas.width / 2`。
- `stage().apply()` 与 `stage().unproject()` **必须成对**：要么都写、要么都不写。
  只加一边 = 触摸整体偏移（390×844 上 offsetY≈75，行高 90 → 点第 N 项弹第 N−1 项）。
- `js/ui/achievement-scene.js` 是**都不写**的那个（它的 `render()` 不用 stage，
  直接吃 `viewport()` 的原始逻辑坐标），别再给它加 `unproject`。
- **坐标类 bug 在本地预览里复现不出来**：`local-preview/server.js` 把 canvas 钉死在 375×667，
  `viewport()` 恒为 375×667，`stage()` 永远是恒等变换。只能靠静态断言或真机验证。

### 3.2 布局

- 纵向布局单一数据源：`js/ui/layout.js` 的 `computeBoardLayout(vp)`。
  格子、HUD/按钮 y、两处间距全由它算，`game.js` 只做赋值，`rank-scene.js` 取它的
  `hudPanelY` 对齐顶部。**禁止**在别处再写布局数字。
- `relayout()` 契约：重建按钮的方法必须先把回调存到构造函数字段、先清空 `this.buttons`，
  否则 resize 后按钮全部失效。

### 3.3 数值

- `par === optimal`：`level-manager.js` 的 `calcPar()` 直接返回 optimal，不再 ×1.2。
  改这个会同时动到 3 星线、二星线、速度奖励线、`perfect_moves` 成就口径。
- 星级只在 `js/utils/score.js` 的 `calcStars()` 定义，任何地方不许再写 `moves <= par * 1.5`。
- 关卡 seed 只由关卡号派生：同一关在任何设备、任何次数下都是同一张盘面。
  `seedSalt` 只用于「下界没命中时换一批候选」，不能拿它做随机化。
- 两种盘面签名必须口径一致：`boardSignature()` 吃格子坐标、`levelDataSignature()` 吃像素坐标，
  内部折回格子后输出同一格式。不一致的话烘焙段与运行时段之间的去重会失效（会出现重复关卡）。
- 7×9 棋盘 + 3 冰的 optimal 天花板约 50：想更高只能加冰块（4 块 BFS 状态空间爆炸）或
  加大棋盘（UI 固定）。烘焙段用 `MAX_OPTIMAL = 42` 封顶，与运行时生成（30~45）对齐。
- **障碍不是越多越难**：堆到 25 格时冰块没空间被拉远，optimal 反而下降；放松到 12 格又会让
  BFS 状态空间爆炸（115ms → 295ms/关）。高档稳定在 16~23 格。

### 3.4 渲染与性能

- 源码中不允许出现 `shadowBlur`（回归会拦）。需要柔光时用多层 spread 描边。
- 静态层走 `LayerCache`；海洋静态层三场景共用 `drawOceanCached()`（菜单 / 排行榜 / 成就页）。
- 背景装饰分层：海草（`drawSeaweed`，4 类造型）与小鱼（`drawFish`）在**动效层**每帧重绘，
  海星 / 贝壳在**静态层**。小鱼必须画在棋盘之前——调序会被棋盘遮住。
- 海草渐变只能用在**无 transform** 的 fill/stroke；feather / finger 因 `translate+rotate`
  会带着渐变转，必须用纯色。

### 3.5 生命周期与兜底

- `wx.onError` 的自动复位必须带一次性开关 `errorRecovered`，否则渲染循环异常会无限 `backToMenu`。
- 计时一律用 `game.getElapsedSeconds()`，不要自己写 `Date.now() - startTime`（暂停与切后台要扣）。
- 切后台不允许碰 `InnerAudioContext`：平台接管音频，调 `play / pause / stop` 一律
  `operateAudio:fail:access denied`（异步回调，`try/catch` 抓不到）。只能
  `AudioManager.suspend()` 记状态、回前台 `resume()` 再播。`initBGM` 的 `onError`
  必须过滤 access denied，否则候选源被挨个耗尽 → BGM 永久关闭。
- 上屏画布只能由 `js/env.js` 创建，**不要**在别处再调 `wx.createCanvas()`。

---

## 4. 存档键

| 键 | 写入方 | 内容 |
|---|---|---|
| `gameProgress` | `game.js` | `{ unlockedLevel, currentLevel }` |
| `level_N` | `game.js` | `{ stars, moves, timestamp }`，**每次通关覆盖** |
| `levelReward_N` | `game.js` | `{ firstClear, threeStar }`，首通与三星首通只发一次 |
| `playerFood` | `food-manager.js` | `{ fish, shrimp, squid, goldfish }` |
| `lastRecoveryTime` | `food-manager.js` | 恢复计时基准（每次启动重置为当前时刻） |
| `freeRefill` | `food-manager.js` | `{ date, used }`，每日免费补给次数 |
| `unlockedAchievements` | `achievement-manager.js` | 已解锁成就 id 数组（加载时过滤已下线 id） |
| `achievementStats` | `achievement-manager.js` | `uniqueWins / levelStars / perfectMoves / bestSpeedRatio / foodEarned / totalPlayTime` 等 |
| `dailyRevive` | `revive-manager.js` | `{ date, watchAd, useFood }` |
| `audioSettings` | `audio-manager.js` | `{ soundEnabled, musicEnabled, soundVolume, musicVolume }` |
| `totalStats` / `bestRecords` | `settlement-manager.js` | 累计统计与最佳记录 |
| `cloudRecord` | `wechat-service.js` | 云端上报的本地镜像，用于「只升不降」比较 |

> **已知口径差异**：排行榜的 `stars` 走 `getTotalStars()`，读的是 `level_N` 的**最近一次**成绩；
> 成就的星数走 `achievementStats.levelStars`，是**历史最高星**。重玩低星会拉低前者，
> 但 `reportScore()` 用 `Math.max(prev.stars, …)` 兜底，所以云端不会回退。

---

## 5. 调参入口

| 想改什么 | 改哪里 |
|---|---|
| 难度曲线、冰块数、目标形状、障碍密度 | `js/levels/level-generator.js` → `LEVEL_BANDS`（改完必须重跑 `node tools/gen-levels.mjs 200`） |
| 烘焙关卡数量 | `node tools/gen-levels.mjs <N>`（默认 200） |
| 三星 / 二星线 | `js/utils/score.js` → `THREE_STAR_RATIO` / `TWO_STAR_RATIO` |
| 入场费 | `js/utils/food-manager.js` → `levelCost` |
| 通关基础奖励 | `js/utils/food-manager.js` → `baseReward` |
| 首通 / 三星首通 / 速度奖励额度 | `js/utils/food-manager.js` → `firstClearBonus` / `firstThreeStarBonus` / `speedBonus` |
| 速度奖励线 | `js/utils/food-manager.js` → `SPEED_BONUS_PAR_RATIO`（当前 2.2） |
| 体力上限 / 恢复间隔 / 单次补发上限 | `js/utils/food-manager.js` → `maxFood` / `recoveryInterval` / `MAX_RECOVERY_BURST` |
| 免费补给次数 | `js/utils/food-manager.js` → `freeRefillPerDay` |
| 退一步单价 | `js/ui/game-hud.js` → `UNDO_FOOD_COST` |
| 撤销栈深度 | `game.js` → `MAX_UNDO_STEPS` |
| 复活次数 / 食物复活价 / 步数惩罚 | `js/utils/revive-manager.js` → `dailyLimits` / `foodCost` / `movePenalty` |
| 音效音量 / 并发 / 冷却 / 闪避 | `js/utils/audio-cues.js` → 对应 cue 的 `gain` / `voices` / `cooldown` / `duck` |
| UI 与玩法音效的相对电平 | `js/utils/audio-manager.js` → `busGain` |
| BGM 默认音量 / 分场景音量 | `js/utils/audio-cues.js` → `BgmConfig.defaultVolume` / `stateVolume` |
| 音频素材本身（音色、时长、包络） | `tools/gen-sfx.py` 里对应的 `build_*()`，改完重跑脚本 |
| 成就条件与奖励 | `js/utils/achievement-manager.js` → `achievements` 数组 |
| 成就里程碑关数 | `js/utils/achievement-manager.js` → `CAMPAIGN_SIZE`（当前 60） |
| 广告位 | `js/config.js` → `AD_UNITS.rewardedVideo` |
| 排行榜分数权重 | `js/utils/wechat-service.js` → `computeScore()`（开放数据域按 `score` 排序，两处要一起改） |

---

## 6. 测试与调试

### 回归

```bash
npm test          # node --experimental-vm-modules tools/regression/run.mjs
npm run verify:env
```

- 当前 **318 项**，分组 `[1]`~`[26]`（布局自适应、坐标映射、通关结算、状态复位、开放数据域、
  合规项、广告、隐私、包体排除、奖励与成就、退一步、底部按钮、体力恢复等）。
- 加载器是「静态建图 → 按依赖顺序 link → 按依赖顺序 evaluate」三段式，不要改回递归 link
  （会触发 V8 `not been linked`）。`loadModule()` 返回 `vm.SourceTextModule`，默认导出在 `mod.namespace.default`。
- **断言不要写死关卡编号 / par / 解法**：关卡重编号过两次，现在整批由生成器产出，
  任何硬编码的「第 1 关 13 步」都会随重新烘焙失效。通关类测试用
  `solveBoard(levelToBoard(lv), { withSolution: true })` 拿方向序列回放。

### 浏览器预览

```bash
node local-preview/server.js       # http://localhost:8080
```

- 画布固定 375×667，只验证逻辑与视觉，**不验证**坐标缩放。
- `local-preview/wall-preview.html?level=N` 只画静态层（背景 + 目标 + 障碍 + 冰块），
  用于排查「障碍物和冰面糊在一起」；`node tools/shot-wall.mjs 200` 可直接出图到 `design-preview/`。
- 截图脚本用系统 Chrome（`channel: 'chrome'`），playwright 装在
  `C:/Users/danna.zhang/.workbuddy-ai/binaries/node/workspace`，ESM 下需绝对路径 import。
- **模拟点击的坐标口径**：`wechat-adapter.js` 的 `getCanvasPoint` 把 client 坐标换算成
  **画布像素**，而游戏要的是**逻辑坐标**（`viewport()` = `canvas.width / dpr`）。
  派发 `TouchEvent` 时 client 坐标要按 `designX * rect.width / canvas.width` 算；
  按 `designX / 375 * rect.width` 算会在 `devicePixelRatio=2` 时偏大一倍，**任何按钮都点不中**。
- `page.mouse.click` / `page.touchscreen.tap` 点不动画布，必须 `page.evaluate` 里
  `new Touch(...)` + `new TouchEvent(...)` 派发到 canvas 上。

### 真机

改完**必须**真机预览（开发者工具 → 预览 → 扫码）。模拟器会提供浏览器式的全局对象，
「只在真机崩」的问题在模拟器里看不出来。

---

## 7. 命名与文案

- 展示名一律 **一企推推乐**（英文 Push & Fun）。目录名 `penguin-skating-game`、
  `package.json` 的 `name`、`project.config.json` 的 `projectname` 这类**标识符保留原名**，
  文档里引用它们的路径不要跟着改。
- 分享卡片图带文字，改名必须重跑 `tools/gen-share-image.py`，只改文档会留下旧图。
- 结算标题是「通关成功」，**不带感叹号**。
