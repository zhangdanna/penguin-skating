# 发布指南（H5 + 微信小游戏）

本文只保留发布所需的步骤、命令和常见故障。玩法与关卡设计见 [../game.md](../game.md)，
模块地图与改代码前的硬约束见 [./DEVELOPMENT.md](./DEVELOPMENT.md)。

## 0. 命令总览

| 目的 | 命令 |
|---|---|
| 安装依赖（首次） | `npm install` |
| 浏览器本地预览 | `node local-preview/server.js` → http://localhost:8080 |
| 构建 H5 | `npm run build:h5` → `dist-h5/` |
| 构建微信小游戏 | `npm run build:weapp` → `dist-weapp/` |
| 上传微信小游戏 | `npm run upload -- 1.0.1 "版本说明"` |
| 构建并上传 | `npm run release -- 1.0.1 "版本说明"` |
| 生成真机预览二维码 | `npm run preview -- 1.0.0 "预览说明"` |
| 回归测试 | `npm test`（当前 380 项） |
| 验证画布环境 | `npm run verify:env` |
| 重新烘焙关卡 | `node tools/gen-levels.mjs 200` |

> ⚠️ **`npm run preview` 不是浏览器预览**，它用 `miniprogram-ci` 生成真机预览二维码（需要 `private.wx.key`）。
> 浏览器预览请用 `node local-preview/server.js`。
>
> 不带版本号时，`release` / `upload` 会读取 `package.json` 的 `version`。
> 版本号与说明是**位置参数**：`npm run upload -- 1.0.1 "说明"`，不要写成 `--version 1.0.1 --desc "说明"`。

---

## 1. H5 发布

### 1.1 构建

```bash
npm run build:h5
```

产出 `dist-h5/`，包含：

- `index.html`
- `game.js` 与 `js/**`
- `audio/**`、`images/**`
- `local-preview/{game-wrapper.js, wechat-adapter.js}`（适配层）
- `server.js`（`tools/h5-server.js` 的副本，补后缀静态服务器）

### 1.2 本地运行

```bash
cd dist-h5
node server.js
# 打开 http://localhost:8080
```

`PORT=3000 node server.js` 可改端口。

> 必须用这个 `server.js`，不要直接用 `python -m http.server` 或普通静态托管。
> 源码里的 `import './js/...'` 没有 `.js` 后缀，微信小游戏会自动补，浏览器原生 ESM 不会；纯静态服务器会大量 404。

### 1.3 部署

任选一种：

1. **WorkBuddy「发布为应用」**（当前使用的方式）
   - 目录：`dist-h5/`
   - 语言：`node`
   - 启动命令：`node server.js`
   - 安装命令：**留空（必须显式传空字符串）**

   > ⚠️ 只传 `language: node` + `startCmd` 会让平台先跑 `npm install`，
   > 而 `dist-h5/` 里没有 `package.json`，安装阶段直接失败。
   > 必须同时传 `installCmd: ""` 跳过安装。

2. **自有服务器 / 容器**
   - 上传 `dist-h5/`，用 `node server.js` 启动，前面挂 Nginx/HTTPS。
3. **静态托管平台**
   - 需要平台支持"无扩展名路径回退到 `.js`"，否则会 404；不满足时请使用方案 1 或 2。

### 1.4 H5 能力边界

浏览器里没有真实的微信运行时：

- 登录、云存档、好友排行榜不可用；
- 分享是模拟的；
- 广告位不可用（食物不足会走「每日 1 次免费补给」的兜底路径）；
- 音频、触摸、`localStorage` 由适配层模拟。

适合做玩法预览、内测和投放落地页；正式商业化 H5 需要补自有账号、排行榜和广告 SDK。

---

## 2. 微信小游戏发布

### 2.1 前置条件

1. `project.config.json` 里的 `appid` 换成你的正式小游戏 AppID（当前为 `wxf7f7eb0563f85b47`）。
2. 首次执行 `npm install`。
3. 在微信公众平台下载上传密钥，保存为项目根目录的 `private.wx.key`（已在 `.gitignore` 中）。
4. 在微信公众平台配置 **小程序代码上传 IP 白名单**，加入当前机器的公网出口 IP。

### 2.2 本地调试

1. 打开微信开发者工具 → 导入项目 → 选择项目根目录（含 `game.json` 的那一层）。
2. 项目类型必须选 **小游戏**，不能选小程序。
3. 点「编译」进入主菜单；点「预览」用手机扫码真机测试。

如果提示「未找到 app.json」，说明项目类型选成了小程序：删除项目引用（不要删文件）后重新导入为小游戏。

> **改完代码必须真机预览一次。** 开发者工具模拟器会提供浏览器式的全局对象，
> 「只在真机崩」的问题（例如 2026-10-26 那次 `canvas` 未定义导致审核驳回）在模拟器里看不出来。
> 详见 [review/E5-weapp-black-screen-fix.md](./review/E5-weapp-black-screen-fix.md)。

### 2.3 构建与上传

```bash
# 只构建
npm run build:weapp

# 上传已构建的 dist-weapp
npm run upload -- 1.0.1 "修复若干问题"

# 构建 + 上传一步完成
npm run release -- 1.0.1 "修复若干问题"
```

也可以把 `dist-weapp/` 直接导入微信开发者工具，用右上角「上传」手动发布。

### 2.4 上传后

1. 打开 <https://mp.weixin.qq.com> → 管理 → 版本管理。
2. 找到刚上传的开发版本 → 选为体验版 → 生成体验二维码。
3. 真机全流程回归后 → 提交审核。
4. 审核通过 → 发布（首次必须全量发布）。

### 2.5 常见错误

| 错误 | 原因 | 处理 |
|---|---|---|
| `errCode: -10008 invalid ip: x.x.x.x` | 当前出口 IP 不在上传白名单 | 微信公众平台 → 开发 → 开发管理 → 开发设置 → 小程序代码上传 → IP 白名单，加入该 IP |
| `未找到 app.json` | 导入时选了小程序 | 重新导入为「小游戏」 |
| `未找到上传密钥 private.wx.key` | 未下载上传密钥 | 微信公众平台生成并保存到项目根目录 |
| `EBUSY: resource busy or locked, rmdir 'dist-weapp'` | 目录被微信开发者工具/资源管理器占用 | 构建脚本会就地覆盖复用；仍失败时关闭占用程序。部分 Windows 环境该目录无法删除，重建走「就地覆盖同步」而不是先删 |
| 上传包过大 | 主包超过 4MB | 检查是否把 `docs/tools/local-preview/design-preview` 打进包；使用 `npm run build:weapp` 而不是直接上传项目根 |
| 审核驳回「游戏卡在此界面无法进一步游戏」 | 真机启动即崩（首帧未渲染） | 打开 vConsole 看红色报错；重点查 `js/env.js` 是否仍是 `game.js` 的第一个 import |

### 2.6 配置项

- `project.config.json`：AppID、编译类型、基础库版本、包体排除项（`packOptions.ignore`）。
- `js/config.js` → `AD_UNITS.rewardedVideo`：激励视频广告位；留空会隐藏所有广告入口。
  开通流量主、创建广告位、错误码处理的完整流程见 [2.7](#27-流量主开通与广告位配置激励视频)。
- `js/config.js` → `GAME_VERSION`：热更新提示文案用的版本号。
- `images/share-image.png`：分享卡片 PNG（建议 5:4；可用 `tools/gen-share-image.py` 重新生成）。
- `audio/bgm.wav`：内置背景音乐。**没有** `bgm.mp3`，`bgmSources` 只列 wav；
  想换 BGM 直接替换这个文件，或改 `js/utils/audio-manager.js` 的 `bgmSources`。

---

### 2.7 流量主开通与广告位配置（激励视频）

广告是**可选的**。`AD_UNITS.rewardedVideo` 留空时整条链路静默关闭：三个入口全部隐藏，
游戏是纯单机，不会出现「点了没反应」的死按钮。要变现就按下面走一遍。

#### 开通流量主：三个条件**满足任一**即可

| 条件 | 要求 | 说明 |
|---|---|---|
| 一 | 累计独立访客 **UV > 100** | 是**去重人数**，不是浏览次数（一个人刷 100 次只算 1） |
| 二 | 开通内置游戏圈 + 发 5 篇官方帖 + 有有效活跃 | 不要求 UV，适合人少但愿意运营的号 |
| 三 | 同主体名下已有小程序：已开通流量主、连续 **1 个季度**有变现、无违规 | 已有小程序的话**先看这条**，可能直接开通，一个 UV 都不用等 |

> ⚠️ **两份官方文档的数字不一致**：微信广告后台文档（`ad.weixin.qq.com/docs/237`）写 `UV > 100`，
> 小游戏开发者指南（`developers.weixin.qq.com/minigame/introduction/commercialization/ad/`，
> 2026-04-01 更新）写 `UV > 500`。**以后台「流量主」页显示的达标进度为准**——
> 没达标时它会直接写「还需 X 个访客」，那个数字才是当前生效标准。

- 达标后**次日刷新**才出现开通入口。当天看到够数了没按钮，不是 bug
- 入口：微信公众平台 → 推广（部分账号在「功能」下）→ 流量主 → 申请开通 → 同意协议 → 选广告位 → 提交
- 开通后**立刻补财务资料**，否则收益结不出来
- **不要刷 UV**：判定为刷量后永久失去资格，比晚开通一个月亏得多

#### 创建广告位

流量主 → 广告位管理 → 新建 → 类型选**激励视频** → 得到形如 `adunit-1234567890abcdef` 的 ID。

本项目**只用激励视频**，不要建 Banner / 插屏：底部 76×76 三张卡片是唯一操作区
（暂停 / 退一步 / 重玩），任何悬浮广告都会把它盖住。

#### 填配置并发布

1. 把 ID 填进 `js/config.js` → `AD_UNITS.rewardedVideo`
2. `npm run build:weapp` → 上传 → 选体验版 → **真机**验一遍 → 提审
3. 三个入口会自动从隐藏变可用：

| 入口 | 触发 | 频次上限 |
|---|---|---|
| 看视频复活 | 掉进冰窟窿后的复活面板 | 每关 1 次 + 每日 5 次 |
| 看广告复活 | 失败结算页 | 同上 |
| 看广告换食物 | 食物不足且入场费不够 | 由体力系统决定，无额外广告频次 |

#### 错误码与自愈行为

`js/utils/ad-manager.js` 把平台错误分两类处理，别一股脑当成「广告不可用」：

| 错误码 | 含义 | 行为 |
|---|---|---|
| **1008** | 广告位不存在 / 未开通流量主 | **永久关闭**：销毁实例 → `onInvalid` 回调一次 → 所有入口收回 |
| **1002** | 广告单元已关闭 | 同上 |
| 1003 | 无合适广告素材 | 只结束本次请求，**入口保留**（下次还能拉） |
| 1000 / 1004 / 1005 | 后端错误 / 内部错误 / 组件被回收 | 同上（非致命） |

- 致命集合在 `FATAL_AD_ERROR_CODES` 里，增删只改那一处
- `disable()` 是幂等的：平台连续回多个致命错误，`onInvalid` 也只触发一次
- 收回入口的实现在 `game.js` 的 `applyAdAvailability()`，同时管复活面板与失败结算两处

> **别填假 ID 测试**：`isValidAdUnitId()` 只校验 `adunit-` + 6 位以上的**格式**，不校验真伪。
> 填个假的会通过校验、把入口亮出来，然后加载失败——玩家点到的就是那个「没反应的按钮」。
> 要么留空，要么填真的。

#### 验收（必须在真机，开发者工具里的广告结果不可信）

- [ ] 未配置广告位：三个入口全部隐藏，游戏能一路玩到底
- [ ] 配置错误 ID：入口亮一下后自动收回，控制台出现 `[Ad] 广告位不可用（ad-unit-not-found）`
- [ ] 配置正确 ID：三处入口都能拉起视频
- [ ] 完整看完 → 发奖；中途关掉 → **不发**奖（只认 `isEnded`）
- [ ] 看完后体力 / 复活次数正确写进存档，重进游戏不重复发放
- [ ] 弱网（4G/Wi-Fi 切换）下点广告不卡死，失败能退回免费补给那条路
- [ ] iOS 与 Android 各验一台（广告表现差异主要在这两端）

---

## 3. 目录约定

```
penguin-skating-game/
├── game.js / game.json          # 小游戏入口与配置
├── project.config.json          # 微信开发者工具配置 + 包体排除项
├── js/                          # 游戏源码
├── open-data/                   # 好友排行榜开放数据域
├── audio/ images/               # 运行时资源
├── local-preview/               # 浏览器预览适配层（不打包）
├── design-preview/              # 设计对照图（不打包）
├── tools/                       # 构建、上传、生成、回归脚本（不打包）
├── docs/                        # 发布指南 / 开发说明 / 历史记录（不打包）
├── game.md                      # 玩法与关卡说明（不打包）
└── README.md                    # 项目入口（不打包）
```

`docs/`、`tools/`、`local-preview/`、`design-preview/` 只在开发期使用，
`tools/build-weapp.mjs` 与 `project.config.json` 的 `packOptions.ignore` 都会排除。
`.gitignore` 里**不要**加这几个目录——它们是开发资料，需要入库，只是不进上传包。

---

## 4. 发布前 30 秒检查

- [ ] `npm test` 全绿（380 项，0 失败）
- [ ] `npm run verify:env` 三种环境全部通过
- [ ] `npm run build:weapp` 成功，包体 < 4MB
- [ ] `project.config.json` 的 `appid` 是正式号
- [ ] `private.wx.key` 存在且未入库
- [ ] 上传 IP 已加入白名单
- [ ] **真机**走通：主菜单 → 关卡 → 暂停 → 退一步 → 结算 → 下一关 → 返回菜单
- [ ] 真机走通失败链路：掉进冰窟窿 → 复活面板 → 看广告复活（或食物复活）
- [ ] 广告两种状态都验过：未配置（入口全隐藏）/ 已配置（三处入口可拉起，看完才发奖）
- [ ] 配置了广告位时，控制台无 `[Ad] 广告位不可用` 警告（有 = ID 错了或还没开通流量主）
- [ ] 无 `模拟` / `待实现` / `TODO` 用户文案
- [ ] 隐私授权弹窗正常，拒绝后核心玩法仍可玩
- [ ] 分享不绑定奖励
- [ ] 改名或换分享图文案后，已重跑 `tools/gen-share-image.py`
