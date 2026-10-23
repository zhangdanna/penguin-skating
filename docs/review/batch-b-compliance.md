# B 批次修复记录 — 合规整改

> 对应走查报告：`docs/phase11-pre-release-review.md` 第 9 节「批次 B」
> 执行日期：2026-10-22
> 范围：B1~B5（提审前置的合规阻断项）
> 代码改动：新增 4 个文件（2 源文件 + 2 资源）+ 2 个生成脚本 + 2 个文件重写 + 9 个文件修改
> 回归结果：**87 / 87 通过**（离线 harness，A 批次 49 项 + B 批次 38 项）

---

## 0. 批次概览

| 编号 | 问题 | 状态 | 影响文件 |
|---|---|---|---|
| B1 | 诱导分享：分享复活 / 分享送鱼 / 假分享无条件复活 | ✅ 已修 | `js/ui/revive-scene.js`、`js/utils/revive-manager.js`、`js/utils/wechat-service.js`、`js/utils/achievement-manager.js`、`js/utils/settlement-manager.js`、`game.js` |
| B2 | 模拟广告（弹窗假装看视频）、`adunit-xxx` 占位 ID | ✅ 已修 | `js/config.js`(新)、`js/utils/ad-manager.js`(重写)、`js/ui/revive-scene.js`、`game.js`、`local-preview/wechat-adapter.js` |
| B3 | `images/share-image.png`、`audio/bgm.mp3` 缺失 | ✅ 已修 | `images/share-image.png`(新)、`audio/bgm.wav`(新)、`js/utils/audio-manager.js`、`audio/README.md` |
| B4 | 未接入隐私授权，涉及用户信息的接口会被平台拦截 | ✅ 已修 | `js/ui/privacy-scene.js`(新)、`game.js`、`local-preview/wechat-adapter.js` |
| B5 | 包体把 docs / 设计稿 / 本地预览一起上传 | ✅ 已修 | `project.config.json` |

**一句话结论**：这一批改完，游戏从「审核必被驳回」变成「可以提交审核」。但 B2 的真实广告收入能力取决于你什么时候拿到 `adunit-` 广告位 ID —— 没拿到之前，所有广告入口自动隐藏，不影响玩法与过审。

---

## 1. B1 — 诱导分享下线

### 问题

微信《小程序运营规范》4.3 明确禁止「分享后才能继续游戏 / 领取奖励」。原实现踩了三条红线：

1. **复活页直接写「🎯 分享给好友」「👥 分享到群聊」两个复活按钮**，分享即复活 —— 典型诱导分享。
2. `shareToFriend()` 里 `setTimeout(500ms)` 后**无条件**调用 `callback()` 复活。也就是说用户点「取消」、甚至分享根本没成功，500ms 后照样复活。这不是"判断分享结果"，是"假装判断"。
3. `wechat-service.share()` 的 `success` 回调里触发 `onShareReward()` → 送 5🐟。而 `wx.shareAppMessage` 的 `success` **只代表调起成功**，微信早已不提供"是否真的分享出去"的回调。用它发奖励等于给所有点击发奖励。
4. 连带：`first_share` / `share_10` 两个成就依赖 `totalShares`，奖励下线后**永久不可达**（走查报告 P0-10 已列）。

### 改动

**`js/ui/revive-scene.js`**（重写，414 行）
- 删除 `shareFriend` / `shareGroup` 两个按钮，`buttonKeys` 收敛为 `['watchAd', 'useFood', 'giveUp']`。
- 删除 `shareToFriend()` / `shareToGroup()`，以及那个 `setTimeout 500ms` 的假回调。
- 构造函数第三参数从 `wechatService` 换成 `adManager`（复活页不再需要分享能力）。
- 面板高度改为按可见按钮数量收缩（`getPanelRect()`），底部状态文字跟着面板走，避免少两个按钮后中间空一大块。

**`js/utils/revive-manager.js`**
- `dailyLimits` / `dailyRevive` 移除 `shareFriend`、`shareGroup`，新增 `createDailyRevive()` 统一构造，消掉三处重复字面量。
- `loadDailyRevive()` 改为**白名单合并**：只从旧存档里取当前仍存在的复活方式，旧的 `shareFriend: 2` 之类脏数据直接丢弃，不会污染新结构。
- `getStatus().remaining` 只返回 `{ watchAd, useFood }`。

**`js/utils/wechat-service.js`**
- 删除 `onShareReward` / `setShareRewardCallback()` / `lastShareTime` / `shareCooldown` / `getShareCooldownRemaining()`。
- `share()` 简化为一行 `wx.shareAppMessage(this.getShareConfig())`，不再挂 `success/fail`，**分享变成纯传播动作**。
- `canShare()` 保留但恒返回 `true`（冷却机制原本只为限制刷奖励而存在）。
- 保留 `getShareConfig()` / `getTimelineShareConfig()`，分享标题与图片正常。

**`js/utils/achievement-manager.js`**
- `first_share` → `revive_first`「重整旗鼓」：首次使用复活，奖励 5🐟
- `share_10` → `revive_10`「不死企鹅」：累计复活 10 次，奖励 3🦐
- 统计字段 `totalShares` → `revives`，`recordShare()` → `recordRevive()`。
- 替换理由：复活可通过消耗食物**无限次**触发（`useFood: Infinity`），是稳定可达成的成长线；同时把原本毫无反馈的复活行为接入了成就体系。

**`js/utils/settlement-manager.js`**
- 删除死方法 `recordShare()` 与 `totalStats.shares` 字段。

**`game.js`**
- 删除 `onShareReward()` 方法与 `initAchievement()` 里的 `setShareRewardCallback` 注入。
- `onFail()` 的 `canRevive` 判定去掉分享分支，并加上 `this.adAvailable &&` 前置条件 —— 广告未接入时不会因为"广告次数还有 5 次"而弹出只有「放弃重玩」能点的复活页。
- `onReviveSuccess()` 新增 `achievementManager.recordRevive()` + `flushAchievementRewards()`，复活成就即时弹通知。

### 验证

| 断言 | 结果 |
|---|---|
| 复活页按钮序列 = `watchAd,useFood,giveUp` | ✅ |
| `getStatus().remaining` 只含 `useFood,watchAd` | ✅ |
| `wechatService.setShareRewardCallback` 不存在 | ✅ |
| `wechatService.getShareCooldownRemaining` 不存在 | ✅ |
| `game.onShareReward` 不存在 | ✅ |
| `totalStats` 无 `shares` 字段 | ✅ |
| 成就列表无 `first_share` / `share_10`，有 `revive_first` / `revive_10` | ✅ |
| 复活 1 次后 `unlockedAchievements` 含 `revive_first` | ✅ |

### 合规影响

| 动作 | 整改前 | 整改后 |
|---|---|---|
| 分享给好友 | 立即复活 + 送鱼 | 纯分享，无任何游戏内收益 |
| 分享到群 | 立即复活 | 纯分享 |
| 分享成就 | 2 个（不可达成） | 0 个，改为复活成就 |
| 复活入口 | 4 个（2 个违规） | 2 个（看广告 / 吃鱼） |

> 分享按钮仍保留在**登录页**（`js/ui/login-scene.js`）和系统右上角菜单，只是不再和奖励挂钩 —— 微信允许"邀请好友一起玩"，不允许"分享才能继续"。

---

## 2. B2 — 激励视频广告接入

### 问题

- `AdManager` 里写死 `adunit-xxx` / `adunit-yyy` / `adunit-zzz` 三个**占位 ID**，`init()` 无条件创建三个广告实例。微信侧会直接报 `invalid adUnitId`，且每次启动都刷 3 条错误日志。
- `revive-scene.watchAd()` 是**假广告**：弹一个 `wx.showModal({ content: '模拟观看30秒视频广告' })`，点「完成」就复活。上线后等于"点两下白送复活"，且审核会认定功能与描述不符。
- `game.onGameOverWatchAd()` 虽然有 `adAvailable` 守卫，但 `adAvailable` 是写死的 `false`，广告链路等于完全没接。
- 顺带发现：`local-preview/wechat-adapter.js` 的 `createRewardedVideoAd` 桩**在注册 `onClose` 时就 setTimeout 触发**，而不是在 `show()` 之后。这意味着真实 `AdManager` 接上去以后，Promise 永远等不到结果（回调早在初始化阶段就打完了）。

### 改动

**`js/config.js`（新增）**

```js
export const AD_UNITS = {
  rewardedVideo: ''   // 填 adunit-xxxxxxxxxxxxxxxx
}
export const GAME_VERSION = '1.0.0'
```

**`js/utils/ad-manager.js`（重写，157 行）**

| 设计点 | 说明 |
|---|---|
| `isValidAdUnitId()` | 正则 `/^adunit-[0-9a-zA-Z_-]{6,}$/`，空串和 `adunit-xxx` 都判非法 → 不会拿占位 ID 去创建实例 |
| `isConfigured()` | 配置合法才 `init()`，否则只打一条日志后返回 |
| `isRewardedVideoAvailable()` | 返回 `!!this.rewardedVideoAd`，`game.adAvailable` 直接取它 |
| `showRewardedVideoAd()` | 返回 `Promise<boolean>`；`show()` 失败自动 `load()` 重试一次；`pendingResolve` 非空时直接返回 `false` 防连点 |
| `settle(value)` | 统一出口，保证 Promise **必然** resolve（`onClose` 与 `onError` 都走它） |
| 奖励判定 | 只看 `onClose({ isEnded })`，中途关闭一律不给 |
| Banner / 插屏 | 全部移除。本游戏底部是操作条，没有不遮挡的展示位，预加载纯属浪费启动时间 |

**`js/ui/revive-scene.js`**

```js
watchAd(callback) {
  if (!this.adManager || !this.adManager.isRewardedVideoAvailable()) {
    wx.showToast({ title: '广告暂不可用', icon: 'none' }); return
  }
  this.adManager.showRewardedVideoAd().then((ended) => {
    ended ? callback && callback()
          : wx.showToast({ title: '未看完视频，无法复活', icon: 'none' })
  }).catch(() => wx.showToast({ title: '广告加载失败，请稍后再试', icon: 'none' }))
}
```

**`game.js`**
- 新增 `initAds()`，在 `initAudio()` 之后、`initFood()` 之前执行：
  ```js
  this.adManager = new AdManager(AD_UNITS)
  this.adManager.init()
  this.adAvailable = this.adManager.isRewardedVideoAvailable()
  ```
- `onGameOverWatchAd()` 改为先 `canRevive('watchAd')` 预检，再 `showRewardedVideoAd()`，`ended === true` 才 `revive('watchAd', ...)`。

**`local-preview/wechat-adapter.js`**
- 重写 `createRewardedVideoAd` 桩：`onLoad/onClose/onError` 真正被保存，`show()` 后 2 秒才回调 `{ isEnded: true }`，`destroy()` 清 timer。现在本地预览可以完整跑通"点广告 → 等 2 秒 → 复活"。

### 验证

| 断言 | 结果 |
|---|---|
| `isValidAdUnitId('')` = false | ✅ |
| `isValidAdUnitId('adunit-xxx')` = false | ✅ |
| `isValidAdUnitId('adunit-1234567890abcdef')` = true | ✅ |
| 未配置时 `isRewardedVideoAvailable()` = false | ✅ |
| 未配置时 `showRewardedVideoAd()` resolve(false) | ✅ |
| `game.adAvailable === false` 且复活页隐藏广告按钮 | ✅ |
| 配置合法 ID 后 `isRewardedVideoAvailable()` = true | ✅ |
| `onClose({ isEnded: true })` → resolve(true) | ✅ |
| `onClose({ isEnded: false })` → resolve(false) | ✅ |

### 上线动作（需要你在后台操作）

1. 微信公众平台 → 该小游戏 → **流量主** → 开通（需满足累计独立访客 ≥ 1000 等条件）
2. 流量主 → 广告位管理 → 新建 **激励视频** 广告位
3. 把拿到的 `adunit-xxxxxxxxxxxxxxxx` 填进 `js/config.js` 的 `AD_UNITS.rewardedVideo`
4. 重新上传体验版，验证：复活页出现「📺 看视频复活」；看完 → 复活成功；看到一半关掉 → 提示"未看完视频，无法复活"

> 填之前：所有广告入口自动隐藏，复活只剩「吃鱼复活」和「放弃重玩」，**不影响审核与玩法**。
> 所以 B2 **不阻塞提审**，可以现在提交，流量主开通后再发一次版本。

---

## 3. B3 — 缺失资源补齐

### 问题

| 资源 | 原状态 | 后果 |
|---|---|---|
| `images/share-image.png` | **不存在**（`images/` 是空目录） | 分享卡片图裂开 / 回落到系统截图，且控制台报错 |
| `audio/bgm.mp3` | **不存在** | `onError` → `bgm = null`，全程无背景音乐，每次启动刷一条 warning |

### 改动

**`images/share-image.png`（新增，500×400，54KB）**

用 `tools/gen-share-image.py` 生成（PIL，4 倍超采样后 LANCZOS 缩小）：

- 天空渐变 + 气泡 → 冰面 + 网格线
- 三个目标格（黄）+ 两个冰块（蓝菱形），第三个目标空着 —— 一眼看出"把冰块推进目标"
- 企鹅正面像（身体 / 肚皮 / 眼睛 / 嘴 / 腮红 / 脚）
- 标题「企鹅滑冰」带深色描边 + 副标题胶囊「冰上推箱子 · 一滑到底」+ 左下角绿色标签「48 关等你挑战」

尺寸按微信推荐的 **5:4**，500×400 在会话列表和朋友圈卡片里都不会被裁切。

**`audio/bgm.wav`（新增，16 秒循环，500KB）**

用 `tools/gen-bgm.py` 生成（numpy）：

- C 大调五声音阶，和声进行 `C - Am - F - G` 重复两遍，音乐盒音色（4 次谐波 + 指数衰减包络）
- 每小节 4 个八分音符琶音 + 低音铺底 + 高音点缀
- 简易延迟混响（0.125s / 0.25s 两档）
- 归一化到 0.62 峰值（约 -4 dBFS），首尾归零 + 末尾 8ms 淡出 → **循环接缝无爆音**
- 16kHz / 单声道 / 16bit，体积只有 500KB

**`js/utils/audio-manager.js`**

- 背景音乐从 `audioFiles` 里拆出来，改成候选源列表：
  ```js
  this.bgmSources = ['audio/bgm.mp3', 'audio/bgm.wav']
  ```
- 新增 `initBGM()`：某个源 `onError` 就 `destroy()` 并 `bgmSourceIndex++` 换下一个，全部失败才静默关闭。
- 新增 `bgmWanted` 标记：`playBGM/pauseBGM/stopBGM` 维护它，换源后若原本在播会自动续播。
- `destroy()` 现在会真正 `bgm.destroy()` 并把 `bgmSourceIndex` 置为末尾，避免销毁后又被换源逻辑复活。
- 修复一处兼容性问题：续播**不依赖 `onCanplay`**（本地预览的音频桩没有实现该方法，依赖它会直接 `TypeError`）。

**`audio/README.md`**
- 补充 `bgm.wav` / `bgm.mp3` 的优先级说明与重新生成方法。

### 验证

| 断言 | 结果 |
|---|---|
| `images/share-image.png` 存在 | ✅ |
| 是合法 PNG 且尺寸 500×400（读 IHDR） | ✅ |
| `audio/bgm.wav` 存在 | ✅ |
| 体积在 100KB~1MB 之间（实测 500KB） | ✅ |
| `bgmSources[0] === 'audio/bgm.mp3'`、`[1] === 'audio/bgm.wav'` | ✅ |

### 后续替换

拿到正式授权的音乐后，直接把文件命名为 `audio/bgm.mp3` 放进 `audio/`，**不需要改任何代码** —— 候选列表会优先命中 mp3，wav 作为兜底保留。

---

## 4. B4 — 隐私授权流程

### 问题

走查报告 P1 里提到的首启流程缺陷：项目调用了 `wx.getUserInfo` / `wx.setUserCloudStorage` 这类涉及用户信息的接口，但**完全没有接入隐私授权**。

微信自 2023-09-15 起强制要求：未在后台配置《用户隐私保护指引》并完成授权前，这类接口会直接 `fail`。表现就是「排行榜永远空、登录永远失败」，而代码里只会打一行 `console.warn`，非常难排查。

### 改动

**`js/ui/privacy-scene.js`（新增，295 行）**

自绘隐私弹窗，因为小游戏没有 `<button open-type="agreePrivacyAuthorization">` 组件可用，必须自己画：

| 元素 | 说明 |
|---|---|
| 标题 | 「用户隐私保护指引」 |
| 正文 | 逐字 `measureText` 折行，说明只使用昵称/头像/游戏数据，不收集无关信息 |
| 可点链接 | 「查看《用户隐私保护指引》」带下划线，命中区域比文字大 8px，点击调 `wx.openPrivacyContract` |
| 主按钮 | 「同意并继续」→ `resolve({ event: 'agree' })` |
| 次按钮 | 「暂不使用」→ `resolve({ event: 'disagree' })` |
| 兜底 | `show()` 时若已有未决 resolve，先给它 `disagree`，避免 Promise 泄漏 |

**`game.js`**
- 新增 `initPrivacy()`，在 `initAds()` 之后执行：
  ```js
  wx.onNeedPrivacyAuthorization((resolve, eventInfo) => {
    console.log('[Privacy] 需要用户授权:', eventInfo && eventInfo.referrer)
    this.privacyScene.show(resolve)
  })
  ```
- **不做首启强弹**。微信只会在真正调用隐私接口时回调，拒绝后推箱子玩法完全不受影响，只是排行榜/云存档不可用 —— 这是官方推荐的"按需授权"模式，也避免首屏被弹窗打断。
- 触摸分发：`touchStartHandler` / `touchMoveHandler` / `touchEndHandler` 的**第一优先级**都加了隐私弹窗判断，弹窗展示时吞掉所有输入。
- 渲染顺序：隐私弹窗放在成就通知**之后**，是最顶层。

**`local-preview/wechat-adapter.js`**
- 补 `onNeedPrivacyAuthorization` / `openPrivacyContract` / `requirePrivacyAuthorize` 三个桩。
- 提供调试入口：控制台执行 `window.__triggerPrivacy()` 即可手动拉起弹窗验证样式与交互。

### 验证

| 断言 | 结果 |
|---|---|
| `game.privacyScene` 已创建 | ✅ |
| `show(resolve)` 后 `isVisible === true` | ✅ |
| 弹窗展示时向菜单主按钮派发 `touchStart`，`isHovered === false`（输入被吞） | ✅ |
| `handleAgree()` → `resolve({ event: 'agree' })` | ✅ |
| 同意后弹窗关闭 | ✅ |
| `handleDisagree()` → `resolve({ event: 'disagree' })` | ✅ |
| 弹窗展示时 `game.render()` 不抛异常 | ✅ |

### 上线动作（需要你在后台操作）

1. 微信公众平台 → 设置 → 服务内容声明 → **用户隐私保护指引** → 填写并提交审核
2. 声明需要用到的信息类型：**微信昵称、头像**（登录/排行榜）、**游戏数据**（进度/成就/分数）
3. 审核通过后，首次触发排行榜或登录时会自动弹出本弹窗

---

## 5. B5 — 包体上传排除项

### 问题

`project.config.json` 的 `packOptions.ignore` 是空数组，意味着：

- `docs/` 下 12 篇开发文档（约 180KB）会被打进小游戏包
- `local-preview/`（本地预览用的 HTTP server + 适配器）会被上传
- `penguin-skating-design.html`（71KB 设计稿）会被上传
- `open-data/index.html`（本地预览用的开放数据域页面）会跟着 `open-data/` 一起上传
- `audio/generate-audio.html`、`audio/README.md` 等工具文件会被上传

主包上限 4MB，这些内容纯属浪费；更严重的是 `local-preview/server.js` 用了 `require`（CommonJS），混在包里容易引发编译告警。

### 改动

`project.config.json`：

```json
"packOptions": {
  "ignore": [
    { "type": "folder", "value": "docs" },
    { "type": "folder", "value": "local-preview" },
    { "type": "folder", "value": "tools" },
    { "type": "folder", "value": ".workbuddy-ai" },
    { "type": "folder", "value": ".git" },
    { "type": "file", "value": "README.md" },
    { "type": "file", "value": "README.zh-CN.md" },
    { "type": "file", "value": "penguin-skating-design.html" },
    { "type": "file", "value": "project.private.config.json" },
    { "type": "file", "value": "audio/generate-audio.html" },
    { "type": "file", "value": "audio/README.md" },
    { "type": "file", "value": "open-data/index.html" }
  ],
  "include": []
}
```

> `levels/` **不要**排除 —— 关卡 JSON 是运行时必需的。

### 包体估算

| 项 | 大小 |
|---|---|
| `js/` | 265KB |
| `audio/`（含新增 bgm.wav 500KB） | 780KB |
| `levels/` | 14KB |
| `open-data/index.js` | 7KB（`index.html` 已排除） |
| `images/share-image.png` | 56KB |
| `game.js` + `game.json` + `project.config.json` | 37KB |
| **合计（压缩前）** | **约 1.16MB** |

远低于 4MB 主包上限，也低于 20MB 总包上限。

### 验证

| 断言 | 结果 |
|---|---|
| 已排除 `docs` | ✅ |
| 已排除 `local-preview` | ✅ |
| 已排除 `tools` | ✅ |
| 已排除 `penguin-skating-design.html` | ✅ |
| 已排除 `open-data/index.html` | ✅ |

---

## 6. 改动文件清单

### 新增

| 文件 | 规模 | 说明 |
|---|---|---|
| `js/config.js` | 18 行 | 广告位 ID / 版本号配置 |
| `js/ui/privacy-scene.js` | 295 行 | 自绘隐私授权弹窗 |
| `images/share-image.png` | 54KB / 500×400 | 分享卡片图 |
| `audio/bgm.wav` | 500KB / 16s | 循环背景音乐 |
| `tools/gen-share-image.py` | — | 分享图生成脚本（可重跑调整） |
| `tools/gen-bgm.py` | — | BGM 生成脚本（可重跑调整 BPM / 和声） |

### 重写

| 文件 | 变化 |
|---|---|
| `js/utils/ad-manager.js` | 256 → 157 行，移除 banner/插屏，重做激励视频状态机 |
| `js/ui/revive-scene.js` | 417 → 414 行，删除两个分享入口，改接 AdManager |

### 修改

| 文件 | 变化 |
|---|---|
| `game.js` | 新增 `initAds()` / `initPrivacy()`；删除 `onShareReward()`；`onFail` 复活判定；`onReviveSuccess` 接成就；触摸与渲染接入隐私弹窗 |
| `js/utils/revive-manager.js` | 复活方式收敛为 2 种；存档白名单合并 |
| `js/utils/wechat-service.js` | 分享去奖励、去冷却 |
| `js/utils/achievement-manager.js` | 分享成就 → 复活成就；`recordShare` → `recordRevive` |
| `js/utils/settlement-manager.js` | 删除 `recordShare` 与 `shares` 统计 |
| `js/utils/audio-manager.js` | BGM 候选源回退机制 |
| `local-preview/wechat-adapter.js` | 广告桩重写（show 后才回调）+ 隐私授权桩 |
| `project.config.json` | `packOptions.ignore` |
| `audio/README.md` | BGM 优先级说明 |
| `tools/regression/run.mjs` | 新增 [13]~[17] 共 38 项断言 |

---

## 7. 回归清单（87 项全通过）

```
[1]  布局自适应（A5）                     5 项
[2]  关卡坐标 → 棋盘映射（A5）            2 项
[3]  加载关卡与对象尺寸                   5 项
[4]  按最优解 13 步通关                   2 项
[5]  结算统计（A3）                       5 项
[6]  成就通知与奖励（A4）                 4 项
[7]  暂停/返回菜单状态复位（A1）          8 项
[8]  游戏结束页 / 复活页广告入口（A2）    7 项
[9]  结算幂等（A3）                       2 项
[10] 带障碍物关卡的对象映射（A5）         6 项
[11] 排行榜走开放数据域（A6）             3 项
[12] 渲染不抛异常                         1 项
[13] B1 诱导分享已下线                    9 项
[14] B2 激励视频广告接入                  9 项
[15] B3 资源补齐                          5 项
[16] B4 隐私授权                          7 项
[17] B5 包体排除项                        5 项
```

执行命令：

```bash
node --experimental-vm-modules tools/regression/run.mjs .
```

---

## 8. 提审前还需要你做的三件事

这三件**不在代码里**，但会直接决定能不能过审：

| # | 事项 | 位置 | 备注 |
|---|---|---|---|
| 1 | 配置《用户隐私保护指引》 | 公众平台 → 设置 → 服务内容声明 | 声明「微信昵称、头像」+「游戏数据」，审核 1~2 个工作日 |
| 2 | 补齐小游戏类目资质 | 公众平台 → 设置 → 基本设置 → 服务类目 | 选「休闲游戏 > 益智」，需要《计算机软件著作权登记证书》 |
| 3 | ICP 备案 | 公众平台 → 设置 → 基本设置 | 2023-09 起新游强制，无备案无法提审 |

> 详细流程见 `docs/phase12-publish-guide.md` 第 2 章。

---

## 9. 遗留问题（进 C / D 批次）

B 批次只处理"提审会被拦"的问题，以下仍待处理：

| 批次 | 事项 |
|---|---|
| C1 | 各弹层仍是 375×667 硬编码（`drawGlassPanel(ctx, 24, 70, 327, 580)` 这类），小屏会溢出、大屏偏左。本批次只顺手把复活页改成按 `canvas.width` 计算 |
| C2 | 缺 `wx.onShow/onHide/onWindowResize`，切后台回来计时会跳变 |
| C3 | 体力恢复的余数丢失（`food-manager.js`） |
| C4 | `par` 等于最优解，3 星要求"零失误"（走查报告 P1-6） |
| C5 | 第 16 关重复第 8 关，程序化关卡需要扩容 |
| C6 | 排行榜分数"可降"，会被后来的低分覆盖 |
| D1 | 死代码：`js/physics/*`、`js/base/pool.js`、`js/ui/level-select-scene.js`、`open-data/index.html` |
| D2 | `calculateStars()` 在 4 处重复 |
| D3 | 缺 `wx.onError` / `wx.getUpdateManager` |

> 注：`open-data/index.html` 已在 B5 从包体中排除，但文件本身还在（本地预览用），D1 会一并处理。
