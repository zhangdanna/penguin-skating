# 一企推推乐

一款微信小游戏：滑动一次让企鹅移动一格，把冰块推到目标区域。

棋盘 7 列 × 9 行。共 60 关（7 关手工设计 + 53 关程序化生成），之后按 60 关循环。

---

## 技术框架

| 层级 | 方案 |
|---|---|
| 运行平台 | 微信小游戏（原生 Canvas 2D），同时提供 H5 适配预览 |
| 语言 / 模块 | 原生 JavaScript + ES Modules，无第三方游戏引擎 |
| 渲染 | Canvas 2D 自绘；离屏图层缓存（`LayerCache`）复用海洋背景与棋盘静态层 |
| 主循环 | `game.js` 中 `requestAnimationFrame` 驱动 `update / render` |
| 场景管理 | 自研 `SceneManager`：菜单、关卡、暂停、结算、复活、排行、隐私等场景 |
| 棋盘实体 | `Penguin / Stone / Target / Obstacle / Background` 独立运行时类 |
| 坐标适配 | `js/ui/layout.js` 以 375×667 设计稿为基准，等比缩放并做 `project / unproject` |
| 输入 | `wx.onTouchStart / Move / End`，滑动方向判定，一次滑动移动一格 |
| 关卡数据 | `js/levels/level-manager.js` + `generated-levels.js`，由离线 BFS 求解器验证 |
| 存档 | `wx.getStorageSync / setStorageSync`（H5 下映射到 `localStorage`） |
| 音频 | `wx.createInnerAudioContext`；BGM 优先 `bgm.mp3`，回落 `bgm.wav` |
| 广告 | `wx.createRewardedVideoAd`；未配置广告位时自动隐藏所有广告入口 |
| 社交 | 微信开放数据域 `open-data/` 好友排行榜；分享纯传播、不绑定奖励 |
| 平台能力 | 隐私授权、热更新、`wx.onError` / `wx.onUnhandledRejection` |
| 构建 / 发布 | Node.js ESM 脚本；`miniprogram-ci` 上传；H5 自带静态服务器 |
| 测试 | `tools/regression/run.mjs` 用 `node:vm` 加载真实模块做离线断言 |
| 后端 | 无后端；进度、食物、成就在本地，排行榜依赖微信开放数据域 |

补充说明：

- **无游戏引擎**：没有 Cocos / Laya / Phaser，全部是原生 Canvas 2D 绘制。
- **无运行时第三方依赖**：`miniprogram-ci` 只用于上传，不进入游戏包。
- **双端同源**：H5 通过 `local-preview/wechat-adapter.js` 把 `wx.*` 映射到浏览器 API；`tools/h5-server.js` 负责无后缀 `import` 的路径兜底。
- **关卡生成**：`tools/gen-levels.mjs` 用逆向构造 + BFS 校验生成关卡，保证可解与难度递增。

---

## 快速开始

```bash
npm install
```

| 目的 | 命令 |
|---|---|
| 浏览器预览 | `npm run preview` → http://localhost:8080 |
| 构建 H5 | `npm run build:h5` → `dist-h5/` |
| 构建微信小游戏 | `npm run build:weapp` → `dist-weapp/` |
| 上传小游戏 | `npm run upload -- 1.0.1 "版本说明"` |
| 构建并上传 | `npm run release -- 1.0.1 "版本说明"` |
| 生成预览二维码 | `npm run preview -- 1.0.0 "预览说明"` |
| 回归测试 | `node --experimental-vm-modules tools/regression/run.mjs .` |

完整发布步骤见 [docs/PUBLISH.md](./docs/PUBLISH.md)。

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

## 项目结构

```
penguin-skating-game/
├── game.js                  # 入口：主循环、状态机
├── game.json                # 小游戏配置（竖屏、开放数据域）
├── project.config.json      # 开发者工具配置 + 包体排除项
├── js/
│   ├── config.js            # 广告位、版本号
│   ├── base/                # 精灵基类
│   ├── runtime/             # 棋盘实体与背景
│   ├── levels/              # 60 关（手工 + 生成）
│   ├── ui/                  # 场景、HUD、按钮、主题、布局
│   └── utils/               # 音频、广告、存储、食物、成就、星级
├── open-data/               # 好友排行榜（开放数据域）
├── audio/                   # bgm.wav + 音效
├── images/                  # 分享图
├── local-preview/           # 浏览器预览适配层（不打包）
├── tools/                   # 构建、上传、生成、回归脚本
├── docs/PUBLISH.md          # H5 + 微信小游戏发布指南
├── game.md                  # 玩法、关卡、系统说明
└── README.md                # 项目入口
```

`docs/`、`tools/`、`local-preview/` 只在开发期使用，上传包会自动排除。

---

## 配置

- AppID：`project.config.json` → `appid`
- 激励视频广告位：`js/config.js` → `AD_UNITS.rewardedVideo`（留空 = 关闭广告）
- 上传密钥：项目根目录 `private.wx.key`（已 gitignore）
- 分享图：`images/share-image.png`（PNG，建议 5:4）

---

## 文档

| 文档 | 内容 |
|---|---|
| [game.md](./game.md) | 玩法、障碍、关卡、食物、成就、复活、已知限制 |
| [docs/PUBLISH.md](./docs/PUBLISH.md) | H5 与微信小游戏发布步骤、常见错误 |

## License

MIT
