# 企鹅滑冰 — 发布操作手册（微信小游戏 + H5）

> 本文档给出两条发布路径的完整操作步骤：**A. 微信小游戏（原生）**、**B. H5 网页版**。
> 每一步都标注了"卡点"（容易失败的地方）与"验收方式"。
> 平台规则会变，涉及资质/备案的具体要求请以提交时后台提示为准。

---

## 0. 总览

| 项目 | 微信小游戏 | H5 |
|---|---|---|
| 运行载体 | 微信客户端内置运行时 | 浏览器 / 微信内置浏览器 |
| 入口 | 微信搜索、分享卡片、扫码 | URL 链接、二维码、公众号菜单 |
| 需要改动代码 | 少量（合规、资源、适配） | **较多**（wx API 全部要替换） |
| 需要的资质 | 主体 + 类目 + 备案（+软著） | 域名 + ICP 备案（微信内打开必须） |
| 变现 | 流量主广告 | 广告联盟 / 自有 |
| 分享 | 原生 `wx.shareAppMessage` | 微信内需 JSSDK（公众号），否则只能引导右上角 |
| 当前项目状态 | **A/B/C/D 四批修复已完成，回归 170 项全绿，可直接进入提审** | `local-preview/` 已有适配层，可直接跑；正式 H5 需打包 + 域名备案 |

**建议顺序**：先发小游戏（同一套代码，成本最低），H5 作为补充渠道（用于抖音/浏览器/短信投放）。

---

## 0.5 手机上先跑起来（5 分钟）

提审之前，先用最省事的方式在真手机上看到画面。三条路，按「真实度」从低到高：

### 路线 1：手机浏览器看 H5（30 秒，只验画面）

```bash
# 电脑上启动本地预览（已启动可跳过）
node local-preview/server.js
```

手机连**同一个 WiFi**，浏览器打开：

```
http://<电脑内网IP>:8080
```

查内网 IP：Windows `ipconfig`，Mac/Linux `ifconfig | grep inet`。
服务监听 `0.0.0.0`，无需额外配置；打不开就是防火墙拦了 8080 端口，或手机和电脑不在同一网段（公司 WiFi / 访客网络常做客户端隔离）。

> ⚠️ 这条路上所有 `wx.*` 都是浏览器模拟的：排行榜是空态、云存档不生效、分享是假的。
> **只能验画面和操作手感**，不能作为提审依据。

### 路线 2：微信开发者工具「预览」扫码（2 分钟，推荐）

这是真机上跑**真实小游戏代码**最快的方式：

1. 打开微信开发者工具 → **导入项目** → 目录选项目根（含 `game.json` 的那一层）→ AppID 填自己的。
2. 点右上角 **「预览」** → 生成二维码。
3. 手机微信 **扫一扫** → 直接在小游戏运行时里打开。

和真机的差别只剩「不是正式版本」这一条，`wx.*` 全部真实可用。

### 路线 3：真机调试（看日志用）

开发者工具点 **「真机调试」** → 扫码。手机跑真机、电脑看 `console` 与 Network，排查「只在手机上复现」的问题只能靠它。

### 路线 4：体验版（给别人测）

上传 → 后台「版本管理」→ 选为体验版 → 生成体验二维码。
需要先把测试者加入「成员管理 → 体验成员」（上限 100 人）。

| 想验证什么 | 用哪条路 |
|---|---|
| 画面、布局、手感 | 路线 1（最快） |
| 排行榜 / 云存档 / 分享 / 广告 | 路线 2 |
| 崩溃、白屏、接口报错 | 路线 3 |
| 让同事 / 客户试玩 | 路线 4 |

---

# A. 微信小游戏发布

## A1. 账号与资质（1~2 周，可与开发并行）

1. **注册小游戏账号**
   - 打开 <https://mp.weixin.qq.com> → 立即注册 → 选择「小程序」，注册完成后在「设置 → 基本设置 → 服务类目」里选到**游戏**，账号类型会自动转为小游戏。
   - 主体建议选**企业 / 个体工商户**。个人主体在类目与变现能力上受限（不能开通虚拟支付），以后台可选类目为准。
   - 记下 **AppID**（`wx` 开头 18 位）。

2. **完成小程序备案（ICP）**
   - 2023-09 起新注册的小程序/小游戏必须先完成备案才能发布。
   - 路径：后台「设置 → 基本设置 → 小程序备案」，填写主体信息、负责人、服务内容（选"游戏"），提交后等待管局审核（一般 1~20 个工作日）。
   - **卡点**：备案期间无法提交代码审核，务必提前启动。

3. **准备游戏类目资质**
   - 后台「设置 → 基本设置 → 服务类目」→ 添加「游戏」→ 选择细分（如"休闲游戏"）。
   - 通常需要提交《计算机软件著作权登记证书》（软著）。软著申请周期约 30~60 个工作日（可加急），**这是最长的关键路径，建议第一天就去办**。
   - 若涉及内购/虚拟支付，还需游戏版号（本项目无内购，一般不需要）。
   - **卡点**：软著上的软件名称需与小游戏名称一致或高度相关，否则会被要求补充说明。

4. **配置《用户隐私保护指引》**
   - 后台「设置 → 服务内容声明 → 用户隐私保护指引」。
   - 本项目会用到：`wx.getUserInfo`（昵称头像）、`wx.login`（登录凭证）、`wx.getSetting`（授权状态）、`wx.getFriendCloudStorage`（好友关系链，开放数据域）。
   - 勾选对应项并说明用途，提交后一般 1 个工作日内通过。
   - **卡点**：代码里必须配合 `wx.onNeedPrivacyAuthorization`（见走查报告 P1-11），否则真机上相关接口会返回失败。

5. **准备分享素材**
   - 分享图：500×400 PNG（本项目 `images/share-image.png` **当前缺失**，见 P0-7）。
   - 小游戏头像：144×144 PNG，后台「基本设置 → 小程序头像」上传。
   - 简介、关键词、截图（提审时用）。

---

## A2. 工程配置检查（提审前必做）

### A2-1 `game.json`

当前内容已基本正确：

```json
{
  "deviceOrientation": "portrait",
  "showStatusBar": false,
  "networkTimeout": { "request": 5000, "connectSocket": 5000, "uploadFile": 5000, "downloadFile": 5000 },
  "openDataContext": "open-data"
}
```

检查项：

- [ ] `deviceOrientation` 为 `portrait`（竖屏，与 UI 一致）
- [ ] `openDataContext` 指向的目录存在且**含 `index.js`**（本项目 `open-data/index.js` ✓，`index.html` 可删）
- [ ] 若后续加分包，需补 `"subpackages"`；当前主包 <300KB，**不需要分包**

### A2-2 `project.config.json`

- [ ] `appid` 换成正式 AppID（当前 `wx25bf5262c669e9a9`，确认是否为你的正式号，测试号无法上传）
- [ ] `compileType` 必须为 `"game"` ✓
- [ ] `libVersion` 建议 `"3.x"`（当前 2.25.0 被 `project.private.config.json` 的 3.17.4 覆盖，建议直接统一，避免团队不一致）
- [ ] `setting.es6: true`、`minified: true` ✓（小游戏需要 ES6 转 ES5）
- [ ] `packOptions.ignore` 补上非运行时文件：

```json
"packOptions": {
  "ignore": [
    { "type": "folder", "value": "docs" },
    { "type": "folder", "value": "local-preview" },
    { "type": "file",   "value": "penguin-skating-design.html" },
    { "type": "file",   "value": "audio/generate-audio.html" },
    { "type": "file",   "value": "audio/README.md" },
    { "type": "file",   "value": "open-data/index.html" }
  ]
}
```

> ⚠️ `local-preview/wechat-adapter.js` 里有一套会**覆盖 `wx` 对象**的 mock 代码，绝对不能进包体。

### A2-3 资源完整性

- [ ] `audio/` 下 7 个 wav 存在 ✓
- [ ] `audio/bgm.mp3` **不存在**（`audio-manager.js:21` 引用了它）→ 补文件或删配置
- [ ] `images/share-image.png` **不存在** → 补图
- [ ] `levels/*.json` 是否保留：取决于是否采用"单一数据源"改造（见 P1-10）

### A2-4 合规文案自检

在小游戏代码里全局搜索以下关键词，**不允许存在面向用户的残留**：

```
模拟 / 待实现 / TODO / 广告功能待实现 / 分享成功 +5🐟
```

当前命中：

| 位置 | 文案 |
|---|---|
| `game.js:264` | `广告功能待实现` |
| `revive-scene.js:217` | `模拟观看30秒视频广告` |
| `revive-scene.js:187` | `模拟分享成功` |
| `game.js:945` | `分享成功 +5🐟` |

---

## A3. 本地调试

1. 下载并安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)（稳定版）。
2. 打开工具 → 导入项目 → 选择项目根目录（含 `game.json` 的那一层）→ 填入 AppID。
3. 点击「编译」，模拟器应直接进入主菜单。
4. **必须做真机调试**（模拟器测不出音频、振动、DPR、安全区）：

| 真机验证项 | 预期 | 状态 |
|---|---|---|
| 主菜单 / 关卡 / 结算 全部按钮可点 | 无死界面 | ✅ A1 |
| 暂停 → 返回菜单 → 再点"第 N 关" | 能进入关卡，状态已复位 | ✅ A1 |
| 失败到无法复活 → 点"看广告复活" | 不崩溃（无广告位时入口隐藏） | ✅ A2 |
| 320 宽设备（iPhone SE） | 棋盘完整可见 | ✅ A5 |
| 切后台 30s 再回来 | 计时不跳变、无后台声音 | ✅ A7 |
| 断网 / 飞行模式 | 不白屏，仅排行榜/分享不可用 | ✅ B3 |
| iOS 静音键开启 | 有声音（`obeyMuteSwitch = false`） | ✅ D 批次补 |
| 首次启动 | 弹出隐私授权，拒绝后核心玩法仍可玩 | ✅ B4 |
| 连续滑动 | 手指抖动不误触、方向不中途反转 | ✅ D6 |

5. 用「性能」面板看帧率：中低端机应稳定 55fps+。背景已改为离屏缓存（每帧 2 次 `drawImage`），`shadowBlur` 已全部移除，见 `docs/review/batch-d-engineering.md` 第 7 节。

---

## A4. 上传体验版

1. 开发者工具右上角「上传」→ 填**版本号**（如 `1.0.0`）与**项目备注**（如"首个提审版本"）。
2. 上传成功后，进入后台「管理 → 版本管理」→ 找到刚上传的开发版本 → 「选为体验版」。
3. 生成体验二维码，用真机扫码做**全流程回归**（建议按走查报告第 10 节的验收清单逐条过）。
4. **卡点**：体验版最多 100 人，且需要把测试者加入「成员管理 → 体验成员」。

---

## A5. 提交审核

后台「管理 → 版本管理 → 提交审核」，需要填写：

| 字段 | 填写建议 |
|---|---|
| 版本描述 | 一句话说明本次版本内容（如"首版：推箱子玩法 + 7 个手工关卡 + 无限关卡"） |
| 功能页面 | 选"游戏"，填写主界面路径（小游戏无路径概念，一般填 `game.js` 或留空） |
| 测试账号 | 本项目无登录墙，可留空 |
| 补充材料 | 若有广告，说明广告位用途；若有分享奖励，**必须删除后再提审** |
| 视频材料 | 建议上传 30s 录屏，能显著降低"功能不完整"的误判 |

**提审前 30 秒自检**（对应走查报告第 6 节）：

- [ ] 无诱导分享（分享不绑定任何奖励）
- [ ] 无模拟/占位文案
- [ ] 隐私指引已配置且代码已接入授权流程
- [ ] 分享图存在
- [ ] 所有按钮在 320×568 与 390×844 上均可见可点
- [ ] 无死界面、无崩溃

**审核周期**：一般 1~7 个工作日。被驳回会给出具体原因，按原因整改后重新提交（不消耗次数）。

---

## A6. 发布与版本管理

1. 审核通过后，后台「版本管理」→ 「发布」→ 选择**全量发布**（首次必须全量）。
2. 发布后 5~30 分钟生效，可通过「搜索小游戏名称 / 扫码 / 分享卡片」进入。
3. **灰度发布**（后续版本可用）：上传新版本 → 提审 → 通过后选"分阶段发布"，按 1%→10%→50%→100% 放量。
4. **回滚**：后台「版本管理 → 线上版本 → 回退」，可回退到上一个线上版本（仅保留最近若干个版本）。
5. **热更新**：小游戏代码包不支持热更，必须走"上传→审核→发布"。若只想改配置/数值，可考虑放到云端（本项目关卡是本地 JSON/JS，需要走版本发布）。
6. 在 `game.js` 里接入更新提示（走查报告 P1-13）：

```js
const um = wx.getUpdateManager && wx.getUpdateManager()
if (um) {
  um.onUpdateReady(() => {
    wx.showModal({
      title: '更新提示',
      content: '新版本已准备好，是否重启应用？',
      success: (res) => { if (res.confirm) um.applyUpdate() }
    })
  })
}
```

---

## A7. 上线后运营（可选）

1. **流量主 / 广告**：后台「流量主」→ 开通（需满足平台门槛，如累计独立访客数）→ 创建**激励视频**广告位 → 拿到 `adunit-xxxxxxxx` → 填入 `js/utils/ad-manager.js:17-21`。
   - 激励视频是复活/补体力的唯一合规变现方式，**不要用分享换奖励**。
2. **数据看板**：后台「数据分析」可看新增/留存/时长；建议同时接 `wx.reportMonitor` 上报关键漏斗（进入关卡 / 通关 / 失败 / 复活）。
3. **异常监控**：`wx.onError` + `wx.onUnhandledRejection` 上报（当前缺失，见 P1-13）。
4. **客服/反馈**：小游戏支持「客服消息」，可在设置页挂一个反馈入口。

---

# B. H5 网页版发布

## B1. 两条路线，先做选择

| 路线 | 做法 | 工作量 | 适用 |
|---|---|---|---|
| **B-1 适配层复用**（推荐） | 保留现有 `game.js` + `js/**`，写一层完整的 `wx → Web` 适配器，用 esbuild 打成单文件 | 3~5 人日 | 想快速上线、双端同源 |
| B-2 纯 Web 重写 | 用 PixiJS/Phaser 重写渲染层 | 15+ 人日 | 长期做多端、要接更多平台 |

**现有 `local-preview/` 还不能当正式 H5 上线**，原因：

- 用的是原生 ES Module + 相对路径 import，需要 HTTP 服务器，无法单文件分发（首屏会串行请求 20+ 个模块）；
- `getOpenDataContext` 返回空白 canvas，排行榜不可用；
- 无 DPR 处理，高分屏上画面偏软；
- 无安全区适配（刘海屏顶部 HUD 可能被挡）。

**已经补掉的两项**（2026-10 更新）：

- ✅ **音频**：`createInnerAudioContext` 原来是空实现（`play()` 只打日志），现在用真实 `HTMLAudioElement` 驱动，`onError` 也接上了 —— 所以 `bgm.mp3 → bgm.wav` 的回退在浏览器里同样生效，手机上能听到声音；
- ✅ **原生弹窗**：`shareAppMessage` 的 `alert` 换成自绘提示条（`showModal` 仍用 `confirm`，正式 H5 需替换）。

所以 `local-preview/` 现在的定位是「**开发期预览 + 内测可玩**」：可以直接部署给手机做体验测试，但正式对外仍建议按 B3 打一份 `web/` 单文件版本。

---

## B2. 需要替换的 wx API 清单

对现有代码 grep 出的全部 wx 调用（共 24 个），逐个给出 Web 实现方案：

| wx API | 使用位置 | Web 替代方案 | 难度 |
|---|---|---|---|
| `wx.onTouchStart/Move/End` | `game.js:229-231` | `canvas.addEventListener('touchstart/move/end')` + `pointerdown/move/up`（同时支持鼠标） | 低 |
| `wx.createInnerAudioContext` | `audio-manager.js` | `new Audio()` 池 + 首次触摸解锁（iOS 策略） | 中 |
| `wx.getStorageSync/setStorageSync` | 多处 | `localStorage`（JSON 序列化，注意 try/catch 与 5MB 上限） | 低 |
| `wx.getSystemInfoSync` | `ad-manager`、`open-data` | `window.innerWidth/innerHeight/devicePixelRatio` | 低 |
| `wx.getFileSystemManager` + `wx.env.USER_DATA_PATH` | `level-manager.js:300` | 直接改成静态 `import` 关卡数据（**推荐**），或 `fetch('levels/level1.json')` | 低 |
| `wx.createImage` | `login-scene.js:182` | `new Image()`（需 `crossOrigin='anonymous'` 才能绘制跨域图） | 低 |
| `wx.vibrateShort` | `game.js:458,728,865` | `navigator.vibrate(50)`（iOS Safari 不支持，静默降级） | 低 |
| `wx.showToast` | 多处 | 自绘 DOM toast（现有 adapter 里已有一版可用） | 低 |
| `wx.showModal` | `game.js:256`、`revive-scene.js` | 自绘 DOM 弹窗（**不要用 `confirm`**） | 中 |
| `wx.showLoading/hideLoading` | `login-scene.js` | 自绘 loading | 低 |
| `wx.login` | `wechat-service.js:51` | H5 无此概念 → 改为"游客模式"，或接自有账号体系 | 中 |
| `wx.getUserInfo` / `getUserProfile` | `wechat-service.js` | 移除，或改为"昵称输入框 + 本地头像" | 中 |
| `wx.showShareMenu` / `onShareAppMessage` / `onShareTimeline` | `wechat-service.js:149-161` | 移除；改为页面级 `navigator.share()`（移动端支持有限）或"点击右上角分享"引导图 | 中 |
| `wx.shareAppMessage` | `revive-scene.js:199`、`wechat-service.js:204` | 同上；微信内可接 JSSDK（需公众号 + 域名备案） | 中 |
| `wx.setUserCloudStorage` / `getFriendCloudStorage` | `wechat-service.js:288,310` | 需要**自建后端**（KV 表 + 简单 API），否则排行榜功能直接关闭 | 高 |
| `wx.getOpenDataContext` / `wx.getSharedCanvas` | `rank-scene.js`、`open-data/` | 整块删除，排行榜改为主域渲染 + 自建后端数据 | 中 |
| `wx.createRewardedVideoAd` | `ad-manager.js` | 换广告联盟 SDK（如穿山甲/腾讯优量汇 H5 版），或先不做广告 | 中 |
| `wx.createBannerAd` / `createInterstitialAd` | `ad-manager.js` | 同上 | 中 |
| `wx.exitMiniProgram` | `wechat-service.js:345` | `window.close()`（多数浏览器无效）→ 删除 | 低 |
| `wx.onError`（缺失） | — | `window.onerror` + `unhandledrejection` | 低 |

**结论**：核心玩法（渲染 + 输入 + 存储 + 音频）替换成本低；**社交与广告（登录/排行榜/分享/广告）是主要工作量**，建议 H5 首版**直接砍掉排行榜与广告**，只保留单机玩法 + 本地存档，2~3 天即可上线。

---

## B3. 推荐的 H5 工程结构

```
web/
├── index.html          # 唯一入口，内联 viewport / 安全区 / 防选中
├── adapter.js          # wx → Web 适配层（在 bundle 之前加载）
├── main.js             # 只做一件事：import('../game.js')
└── dist/
    ├── game.bundle.js  # esbuild 产物（含 js/**）
    └── style.css
```

### B3-1 `index.html` 关键点

```html
<meta name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<style>
  html, body { margin:0; height:100%; overflow:hidden; background:#0b2a3d;
               -webkit-tap-highlight-color:transparent; -webkit-user-select:none; user-select:none; }
  #stage { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; }
  canvas { display:block; touch-action:none; }   /* 关键：禁止浏览器接管手势 */
</style>
<div id="stage"><canvas id="game"></canvas></div>
<script src="./adapter.js"></script>
<script src="./dist/game.bundle.js"></script>
```

**必须项**：
- `touch-action: none` —— 否则滑动会被浏览器当成滚动/回弹，手势失效；
- `viewport-fit=cover` + `env(safe-area-inset-*)` —— 否则刘海屏顶部/底部被遮挡；
- `user-scalable=no` + `-webkit-tap-highlight-color: transparent` —— 否则双击缩放、点击蓝框。

### B3-2 `adapter.js` 骨架

```js
// 1) 画布与 DPR
const canvas = document.getElementById('game')
const dpr = Math.min(window.devicePixelRatio || 1, 3)
const W = window.innerWidth, H = window.innerHeight
canvas.width = W * dpr
canvas.height = H * dpr
canvas.style.width = W + 'px'
canvas.style.height = H + 'px'
const ctx = canvas.getContext('2d')
ctx.scale(dpr, dpr)

// 2) 游戏代码读的是全局 canvas / wx，这里挂到 window 上
window.canvas = canvas
// ⚠️ 但 game.js 里用的是 canvas.width 做布局，缩放后需让它拿到"逻辑尺寸"
Object.defineProperty(canvas, 'width', { get: () => W })   // 或在 adapter 里包一层代理对象
```

> ⚠️ **这里有一个必须提前决策的点**：`game.js` 直接用 `canvas.width/height` 做全部布局计算。如果按 DPR 放大 canvas 尺寸，布局会按 3 倍计算 → UI 全乱。
> **推荐做法**：在 adapter 里创建一个"逻辑画布代理"（`{ width: W, height: H, getContext: () => scaledCtx }`），赋给 `window.canvas`，让游戏代码永远看到逻辑尺寸，DPR 只在 `ctx.scale` 里体现。这同时解决了走查报告里 P2-10 提到的"全局 canvas 依赖"问题。

```js
// 3) 输入（触摸 + 鼠标统一）
function toLocal(e) {
  const r = canvas.getBoundingClientRect()
  return { clientX: e.clientX - r.left, clientY: e.clientY - r.top }
}
let onStart, onMove, onEnd
canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); onStart?.({ touches:[toLocal(e)], changedTouches:[toLocal(e)] }) })
canvas.addEventListener('pointermove', e => { if (e.buttons || e.pointerType==='touch') onMove?.({ touches:[toLocal(e)], changedTouches:[toLocal(e)] }) })
canvas.addEventListener('pointerup',   e => onEnd?.({ touches:[], changedTouches:[toLocal(e)] }))

// 4) 音频（首次交互解锁）
const audioCache = new Map()
function createAudio(src) {
  const a = new Audio(src); a.preload = 'auto'; a._src = src; audioCache.set(src, a)
  return {
    set src(v) { a.src = v }, get src() { return a.src },
    set loop(v) { a.loop = v }, set volume(v) { a.volume = v },
    play() { a.currentTime = 0; a.play().catch(()=>{}) },
    pause() { a.pause() }, stop() { a.pause(); a.currentTime = 0 },
    destroy() { a.pause(); a.src = '' }, onError(cb) { a.onerror = cb }
  }
}
// 注意：iOS 必须在用户手势内首次 play，否则静音。可在首个 pointerdown 里对静音片段 play() 一次解锁。

// 5) 存储
window.wx = {
  getStorageSync: k => { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } },
  setStorageSync: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  // ... 其余 API 见 B2 表格
}
```

### B3-3 打包

```bash
# 安装（仅构建期依赖）
npm i -D esbuild

# 打包：把 game.js 及其 import 打成一个 IIFE
npx esbuild game.js \
  --bundle --format=iife --target=es2019 --minify \
  --outfile=web/dist/game.bundle.js
```

**卡点**：
- `game.js` 末尾是 `new Main()`，打包后会自动执行 —— 所以 `adapter.js` 必须**先于** bundle 加载，否则 `canvas` / `wx` 未定义会直接报错。
- `import` 路径必须保持相对路径（`./js/...`），esbuild 才能解析。
- 如果用了 `wx.getFileSystemManager` 读关卡，浏览器里会 404 → 建议按 P1-10 改为静态 import，H5 端直接受益。

---

## B4. 移动端适配清单（H5 特有）

- [ ] `100dvh` 而非 `100vh`（iOS Safari 地址栏收起会跳动）
- [ ] `env(safe-area-inset-bottom)` 给底部按钮留白
- [ ] `touch-action: none` + `preventDefault` 防滚动/回弹
- [ ] 禁止长按弹菜单：`-webkit-touch-callout: none`
- [ ] 禁止双击缩放：`user-scalable=no` + `touch-action: manipulation`
- [ ] 横屏提示：竖屏游戏在横屏下给"请竖屏游玩"遮罩
- [ ] 微信内置浏览器（X5/WKWebView）单独回归：音频、`navigator.vibrate`、`localStorage` 配额
- [ ] 弱网：首屏资源 <1MB，加 loading 骨架
- [ ] 页面隐藏时暂停：`document.visibilitychange` → `pauseGame()`

---

## B5. 部署

### 方案 1：对象存储 + CDN（推荐，国内访问快）

1. 开通腾讯云 COS / 阿里云 OSS，创建**公有读**存储桶。
2. 上传 `web/` 目录（`index.html` 在根）。
3. 绑定自定义域名 + 开启 HTTPS（免费证书即可）。
4. 配置 CDN 加速与缓存策略（`index.html` 不缓存，`*.js` 长缓存 + 文件名 hash）。

### 方案 2：静态托管平台（最快，适合验证）

- Vercel / Netlify / Cloudflare Pages / GitHub Pages：把 `web/` 推到仓库，选目录一键部署。
- **注意**：这些平台默认域名在国内访问不稳定，且**无法完成 ICP 备案**，不能用于微信内传播。

### 方案 3：WorkBuddy「发布为应用」

如果只是想快速拿到一个可访问链接做内测，可以直接用内置的发布能力把 `web/` 目录发布成在线链接（支持静态站点），拿到 `https://xxx` 后即可在浏览器/微信里打开验证。

### 域名与备案（关键卡点）

| 场景 | 要求 |
|---|---|
| 浏览器直接访问 | 无需备案（境外服务器）/ 国内服务器需备案 |
| **微信内打开** | 域名必须 **ICP 备案** 且 **HTTPS**，否则会被拦截提示"非微信官方网页" |
| 微信内分享（JSSDK） | 额外需要**已认证的公众号** + JS 接口安全域名配置 |

---

## B6. 微信内 H5 的分享限制

- 微信内置浏览器**不支持** `navigator.share`。
- 想自定义分享标题/图片，必须接 **微信 JS-SDK**（`wx.updateAppMessageShareData`），前置条件：
  1. 有已认证的**服务号/订阅号**；
  2. 公众号后台配置「JS 接口安全域名」（需上传校验文件到域名根目录）；
  3. 后端签名（`jsapi_ticket`）。
- 不接 JSSDK 的降级方案：页面右上角加"↗ 点击右上角分享给好友"引导图，分享出去的是页面标题 + 首图。

---

## B7. H5 验收清单

- [ ] iOS Safari / 微信 iOS / 安卓 Chrome / 微信安卓 四端可玩
- [ ] 首次触摸后有声音（iOS 音频解锁）
- [ ] 滑动不触发页面滚动/回弹
- [ ] 刘海屏顶部 HUD 不被遮挡
- [ ] 刷新页面后进度/体力仍在（localStorage）
- [ ] 切到后台再回来，计时未跳变
- [ ] 320 宽设备棋盘完整
- [ ] 无 `alert` / `confirm` 原生弹窗
- [ ] 首屏 <2s（4G）

---

# C. 双端差异对照（改造时注意）

| 能力 | 小游戏 | H5 | 处理方式 |
|---|---|---|---|
| 画布尺寸 | `canvas.width` 为逻辑像素 | 需手动 `width = W*dpr` + `ctx.scale` | adapter 里做"逻辑画布代理" |
| 手势 | `wx.onTouchStart` 已归一化 | 需同时处理 touch/pointer/mouse | adapter 统一成 `{touches, changedTouches}` |
| 音频 | `InnerAudioContext` | `HTMLAudioElement`，需手势解锁 | adapter 统一 `play/pause/stop` |
| 静音键 | `obeyMuteSwitch` 可关 | 浏览器无此概念 | 忽略 |
| 振动 | `wx.vibrateShort` | iOS 不支持 | 静默降级 |
| 存档 | `wx.setStorageSync` | `localStorage`（5MB，同步阻塞） | adapter 包装 try/catch |
| 排行榜 | 开放数据域（好友关系链） | 需自建后端 | H5 首版建议砍掉 |
| 分享 | 原生 API | JSSDK / 引导 | H5 降级为引导图 |
| 广告 | 流量主激励视频 | 广告联盟 SDK | H5 首版建议砍掉 |
| 包体 | 主包 4MB | 无硬限制，但首屏要快 | H5 单文件 <500KB |

---

# D. 发布前总 Checklist（打印版）

## 代码
- [ ] P0-1 暂停→菜单不卡死
- [ ] P0-2 游戏结束页无崩溃
- [ ] P0-3 结算参数正确
- [ ] P0-4 排行榜可用且返回按钮可见
- [ ] P0-8 320 宽棋盘不溢出
- [ ] P0-9 成就通知与奖励不丢
- [ ] 全仓库无 `模拟` / `待实现` / `TODO` 用户文案

## 资源
- [ ] `images/share-image.png`（500×400）
- [ ] `audio/bgm.mp3`（或删除 BGM 配置）
- [ ] 小游戏头像 144×144、简介、截图

## 配置
- [ ] `project.config.json` 的 `appid` 为正式号
- [ ] `packOptions.ignore` 已排除 docs / local-preview / design.html
- [ ] `libVersion` 统一
- [ ] 后台已配置服务类目 + 资质 + 备案 + 隐私指引

## 真机
- [ ] 320×568 / 390×844 / 412×915 / iPad 四档尺寸全界面可达
- [ ] 切后台回来计时正常
- [ ] iOS 静音键下有声音
- [ ] 首次启动隐私弹窗，拒绝后仍可玩
- [ ] 断网不白屏

## 提审
- [ ] 版本描述清晰
- [ ] 30s 录屏（可选但强烈建议）
- [ ] 无诱导分享
- [ ] 无虚假/模拟功能

---

*本文档为操作手册，不包含代码改动。具体修复见 `docs/phase11-pre-release-review.md` 第 9 节修改清单。*
