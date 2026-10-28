# 一企推推乐

一款微信小游戏：滑动一次让企鹅移动一格，把冰块推到目标区域。

棋盘 7 列 × 9 行。前 200 关离线烘焙，之后运行时无限生成，盘面永不重复。
标准步数 = 最优步数，三星必须走出最优解。

- 主平台：微信小游戏（原生 Canvas 2D）
- 附带：H5 预览/投放版（`local-preview/` 把 `wx.*` 映射到浏览器 API）
- 无后端、无游戏引擎、无运行时第三方依赖

---

## 玩法速览

| 操作 | 结果 |
|---|---|
| 上下左右滑动 | 企鹅移动**一格**（不是物理滑行） |
| 撞上冰块 | 冰块一起推走一格；推不动时只有碰撞反馈，不计步数 |
| 冰块 / 企鹅掉进冰窟窿 | 立即失败（可看广告或花 10🐟 复活，每关限一次） |
| 全部冰块进入目标区 | 通关 |
| 星级 | 步数 ≤ par → 3 星；≤ par × 1.5 → 2 星；其余 1 星 |

障碍物三类：冰墙（挡路）、冰窟窿（掉进去就输）、雪堆（减速且冰块推不上去）。

完整玩法、关卡生成算法、食物/成就数值见 [game.md](./game.md)。

---

## 技术框架

| 层级 | 方案 |
|---|---|
| 运行平台 | 微信小游戏（原生 Canvas 2D），同时提供 H5 适配预览 |
| 语言 / 模块 | 原生 JavaScript + ES Modules，无第三方游戏引擎 |
| 渲染 | Canvas 2D 自绘；离屏图层缓存（`LayerCache`）复用海洋背景与棋盘静态层 |
| 主循环 | `game.js` 中 `requestAnimationFrame` 驱动 `update / render` |
| 场景管理 | 自研 `SceneManager`：菜单、关卡、暂停、结算、复活、排行、成就、隐私 |
| 棋盘实体 | `Penguin / Stone / Target / Obstacle / Background` 独立运行时类 |
| 坐标适配 | `js/ui/layout.js` 以 375×667 设计稿为基准，等比缩放并做 `project / unproject` |
| 输入 | `wx.onTouchStart / Move / End`，滑动阈值 24px，方向一旦判定即锁定 |
| 关卡数据 | `js/levels/level-manager.js` + `generated-levels.js`，由离线 BFS 求解器验证 |
| 存档 | `wx.getStorageSync / setStorageSync`（H5 下映射到 `localStorage`） |
| 音频 | `wx.createInnerAudioContext`；BGM 只有 `audio/bgm.wav`（见 `bgmSources`） |
| 广告 | `wx.createRewardedVideoAd`，仅激励视频；未配置广告位时自动隐藏所有广告入口 |
| 社交 | 微信开放数据域 `open-data/` 好友排行榜；分享纯传播、不绑定奖励 |
| 平台能力 | 隐私授权、热更新、`wx.onError` / `wx.onUnhandledRejection` |
| 构建 / 发布 | Node.js ESM 脚本；`miniprogram-ci` 上传；H5 自带补后缀静态服务器 |
| 测试 | `tools/regression/run.mjs` 用 `node:vm` 加载真实模块做离线断言（318 项） |
| 后端 | 无后端；进度、食物、成就在本地，排行榜依赖微信开放数据域 |

补充说明：

- **无游戏引擎**：没有 Cocos / Laya / Phaser，全部是原生 Canvas 2D 绘制。
- **无运行时第三方依赖**：`miniprogram-ci` 只用于上传，不进入游戏包。
- **双端同源**：H5 通过 `local-preview/wechat-adapter.js` 把 `wx.*` 映射到浏览器 API；`tools/h5-server.js` 负责无后缀 `import` 的路径兜底。
- **关卡生成**：`tools/gen-levels.mjs` 用逆向构造 + BFS 校验生成关卡，保证可解与难度单调递增。

---

## 快速开始

```bash
npm install
```

| 目的 | 命令 |
|---|---|
| 浏览器预览 | `node local-preview/server.js` → http://localhost:8080 |
| 构建 H5 | `npm run build:h5` → `dist-h5/` |
| 构建微信小游戏 | `npm run build:weapp` → `dist-weapp/` |
| 上传小游戏 | `npm run upload -- 1.0.1 "版本说明"` |
| 构建并上传 | `npm run release -- 1.0.1 "版本说明"` |
| 生成真机预览二维码 | `npm run preview -- 1.0.0 "预览说明"` |
| 回归测试 | `npm test`（318 项） |
| 验证画布环境 | `npm run verify:env` |
| 重新烘焙关卡 | `node tools/gen-levels.mjs 200` |
| 重新生成分享图 / 图标 | `python tools/gen-share-image.py` / `python tools/gen-icon.py`（需 Pillow） |

> ⚠️ `npm run preview` **不是**本地预览，它是用 `miniprogram-ci` 生成真机预览二维码（需要 `private.wx.key`）。
> 浏览器预览请用 `node local-preview/server.js`。

完整发布步骤见 [docs/PUBLISH.md](./docs/PUBLISH.md)，模块地图与硬约束见 [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)。

### 微信开发者工具

1. 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)。
2. **导入项目** → 选择本目录。
3. 项目类型选 **小游戏**，不要选小程序。
4. 填入 AppID → 点「编译」。

> 如果提示 `未找到 app.json`，说明导入时选成了小程序。删除项目引用（不要删文件）后重新导入为小游戏。

### H5

```bash
npm run build:h5
cd dist-h5
node server.js
# http://localhost:8080
```

H5 包自带 `server.js`：源码里的 `import` 没写 `.js` 后缀，纯静态托管会 404。H5 下登录、云存档、好友排行榜、分享、广告都是模拟的，只保留单机玩法。

---

## 功能清单

| 模块 | 现状 |
|---|---|
| 关卡 | 1~200 离线烘焙，201 关起运行时确定性生成，盘面签名全局去重 |
| 星级 | `js/utils/score.js` 单一口径，三星 = 走出最优解 |
| 食物（体力） | 4 种（🐟1 / 🦐3 / 🦑10 / 🐠50），总量上限 30，只按前台时间恢复 |
| 入场费 | 教程 0 / 简单 1 / 中等 2 / 困难 3 / 专家 5 |
| 通关奖励 | 基础 + 速度 + 首通 + 三星首通 + 连击，单次 ≈ 回本，一次性收益为主 |
| 退一步 | 2🐟/步，撤销栈 30 步，用过则不计「精准操作」成就 |
| 复活 | 看广告（每日 5 次）或 10🐟，每关限 1 次，复活后步数 +5 |
| 成就 | 15 个，含前置门槛、进度显示、造型详情卡 |
| 排行榜 | 开放数据域好友榜，`level / stars / moves / score` 四项各自单调 |
| 分享 | 纯传播无奖励；直连被平台拒时引导右上角菜单 |
| 隐私授权 | 按需弹窗（`wx.onNeedPrivacyAuthorization`），拒绝后核心玩法仍可玩 |
| 广告 | 只有激励视频；未配置广告位时整条链路静默关闭，食物不足走每日免费补给兜底 |

---

## 项目结构

```
penguin-skating-game/
├── game.js                      # 入口：主循环、状态机、胜负判定、奖励发放
├── game.json                    # 小游戏配置（竖屏、开放数据域）
├── project.config.json          # 开发者工具配置 + 包体排除项
├── js/
│   ├── env.js                   # 环境引导：创建上屏画布（必须最先 import）
│   ├── config.js                # 广告位、版本号
│   ├── base/sprite.js           # 精灵基类
│   ├── runtime/                 # 棋盘实体
│   │   ├── penguin.js           #   企鹅（含情绪动画）
│   │   ├── stone.js             #   冰块
│   │   ├── target.js            #   目标区
│   │   ├── obstacle.js          #   冰墙 / 冰窟窿 / 雪堆
│   │   └── background.js        #   棋盘背景
│   ├── levels/
│   │   ├── level-generator.js   # 生成器 + BFS 求解器 + 难度分档（离线/运行时共用）
│   │   ├── generated-levels.js  # 200 关烘焙数据（tools/gen-levels.mjs 产出，勿手改）
│   │   └── level-manager.js     # 取关 / 201 关起运行时确定性生成 / par 计算
│   ├── ui/
│   │   ├── layout.js            # 375×667 设计稿坐标 + 对局纵向布局（唯一数据源）
│   │   ├── theme.js             # 调色板、按钮/面板绘制、企鹅绘制（唯一入口）
│   │   ├── scene-manager.js     # 场景注册与切换
│   │   ├── menu-scene.js        # 主菜单
│   │   ├── game-scene.js        # 对局画布壳
│   │   ├── game-hud.js          # 顶部信息面板 + 底部三按钮
│   │   ├── pause-scene.js       # 暂停面板
│   │   ├── result-scene.js      # 通关结算
│   │   ├── gameover-scene.js    # 失败结算
│   │   ├── revive-scene.js      # 复活选择
│   │   ├── rank-scene.js        # 好友排行榜
│   │   ├── achievement-scene.js # 成就页 + 详情弹层
│   │   ├── achievement-notification.js  # 成就浮层通知（串行队列）
│   │   ├── food-display.js      # 食物飘字
│   │   ├── privacy-scene.js     # 隐私授权弹窗
│   │   └── button.js            # 通用按钮
│   └── utils/
│       ├── score.js             # 星级口径（唯一来源）
│       ├── food-manager.js      # 食物、入场费、奖励、自然恢复
│       ├── achievement-manager.js  # 成就定义与统计
│       ├── revive-manager.js    # 复活次数与惩罚
│       ├── settlement-manager.js   # 累计统计与最佳记录
│       ├── wechat-service.js    # 分享、云存档、排行榜上报
│       ├── ad-manager.js        # 激励视频
│       ├── audio-manager.js     # BGM 与音效
│       └── layer-cache.js       # 离屏图层缓存
├── open-data/                   # 好友排行榜（开放数据域）
├── audio/                       # bgm.wav + 7 个音效
├── images/                      # 分享图、图标
├── local-preview/               # 浏览器预览适配层（不打包）
├── design-preview/              # 设计对照图与企鹅造型页（不打包）
├── tools/                       # 构建、上传、生成、回归脚本（不打包）
├── docs/
│   ├── PUBLISH.md               # H5 + 微信小游戏发布指南
│   ├── DEVELOPMENT.md           # 模块地图、存档键、调参入口、硬约束
│   ├── AUDIO.md                 # 音频系统设计（总线/池化/冷却/闪避 + Cue Sheet）
│   └── review/                  # 历史问题分析与决策记录
├── game.md                      # 玩法、关卡、系统数值说明
└── README.md                    # 项目入口
```

`docs/`、`tools/`、`local-preview/`、`design-preview/` 只在开发期使用，上传包会自动排除（`project.config.json` 的 `packOptions.ignore`）。

---

## 常见问题

### 真机黑屏 / `ReferenceError: Can't find variable: canvas`

**微信小游戏没有全局 `canvas`**，上屏画布必须用 `wx.createCanvas()` 创建，且整个生命周期里
**第一次调用**返回的才是屏幕上的那张，之后都是离屏画布。

`js/env.js` 负责这件事，并且必须是 `game.js` 的第一个 import。`js/ui/*`、`js/runtime/*`
里所有 `canvas.width` / `canvas.height` 都依赖它建立的全局变量。

浏览器预览之所以"看起来正常"，是因为 `local-preview/wechat-adapter.js` 补了
`window.canvas`。**改完代码务必真机预览一次**（开发者工具 → 预览 → 手机扫码），
模拟器会提供浏览器式的全局对象，很多"只在真机崩"的问题在模拟器里看不出来。

完整分析见 [docs/review/E5-weapp-black-screen-fix.md](./docs/review/E5-weapp-black-screen-fix.md)。

### 点按钮没反应 / 点第 N 项弹出第 N-1 项

坐标系没对齐。UI 一律按 375×667 设计稿坐标书写，`render()` 里 `stage().apply(ctx)`，
触摸用 `stage().unproject()` 反算，**两者必须成对出现**。只加一边就会整体偏移，
而且本地预览（画布钉死 375×667）永远复现不出来。详见 [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)。

### BGM 不响

- 仓库里只有 `audio/bgm.wav`，`bgmSources` 也只列了它，不要再往回加 `bgm.mp3`（从没提交过，只会多一条 404）。
- 切后台期间平台接管音频，调 `play / pause / stop` 一律 `operateAudio:fail:access denied`（异步回调，`try/catch` 抓不到）。只能 `AudioManager.suspend()` 记状态、回前台 `resume()` 再播。

### 未找到 `app.json`

导入项目时选成了「小程序」。删掉项目引用（不要删文件）后重新导入，类型选 **小游戏**。

### `npm run build:weapp` 报 `EBUSY: resource busy or locked`

`dist-weapp/` 被微信开发者工具或资源管理器占用。构建脚本会就地覆盖复用目录，但仍需关掉占用程序；某些 Windows 环境下该目录无法删除，重建时用「就地覆盖同步」而不是先删。

---

## 配置

- AppID：`project.config.json` → `appid`
- 激励视频广告位：`js/config.js` → `AD_UNITS.rewardedVideo`（留空 = 关闭广告，入口自动隐藏）
- 版本号（热更新提示文案）：`js/config.js` → `GAME_VERSION`
- 上传密钥：项目根目录 `private.wx.key`（已 gitignore）
- 分享图：`images/share-image.png`（PNG，建议 5:4）
- 难度曲线 / 关卡数量：`js/levels/level-generator.js` 的 `LEVEL_BANDS`，改完必须重跑 `node tools/gen-levels.mjs 200`

---

## 文档

| 文档 | 内容 |
|---|---|
| [game.md](./game.md) | 玩法、障碍、关卡生成、食物、成就、复活、已知限制 |
| [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) | 模块地图、存档键、调参入口、改代码前必读的硬约束 |
| [docs/AUDIO.md](./docs/AUDIO.md) | 音频系统设计：总线、声部池、冷却、闪避、Cue Sheet、验收清单 |
| [docs/PUBLISH.md](./docs/PUBLISH.md) | H5 与微信小游戏发布步骤、常见错误 |
| [docs/review/E5-weapp-black-screen-fix.md](./docs/review/E5-weapp-black-screen-fix.md) | 审核驳回「黑屏卡死」问题分析与修复 |
| [docs/review/F-reward-rebalance-plan.md](./docs/review/F-reward-rebalance-plan.md) | 奖励通胀、成就农场化、退一步改版的决策记录 |

## License

MIT
