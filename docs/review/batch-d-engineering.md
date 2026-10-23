# D 批次修复记录 — 工程化清理

> 对应走查报告：`docs/phase11-pre-release-review.md` 第 9 节「批次 D」
> 执行日期：2026-10-22
> 范围：D1~D7（死代码、重复逻辑、错误兜底、仓库卫生、操作手感、渲染性能）
> 代码改动：新增 3 个文件（`js/utils/score.js`、`js/utils/layer-cache.js`、`.gitignore`）+ 删除 5 个文件（493 行）+ 重写 3 个（README × 2、`background.js`）+ 修改 12 个
> 回归结果：**171 / 171 通过**（A 49 + B 38 + C 49 + D 35）

---

## 0. 批次概览

| 编号 | 问题 | 状态 | 影响文件 |
|---|---|---|---|
| D1 | 死代码：`js/physics/*`、`js/base/pool.js`、`js/ui/level-select-scene.js`、`open-data/index.html` | ✅ 已删（493 行） | 见下 |
| D2 | `calcStars()` 在 6 处重复实现 | ✅ 已修 | `js/utils/score.js`(新)、`game.js`、`result-scene.js`、`food-manager.js`、`achievement-manager.js` |
| D3 | 无全局错误兜底、无热更新检查 | ✅ 已修 | `game.js` |
| D4 | README 描述着物理引擎/关卡选择/登录/分享奖励等已不存在的能力 | ✅ 已重写 | `README.md`、`README.zh-CN.md` |
| D5 | 缺 `.gitignore`；`libVersion` 两份配置不一致 | ✅ 已修 | `.gitignore`(新)、`project.config.json` |
| D6 | 冰块硬编码像素偏移不随格子缩放；滑动阈值 10px 太灵敏 | ✅ 已修 | `js/runtime/stone.js`、`js/runtime/penguin.js` |
| D7 | 每帧重画 63 块瓷砖 + 3 处 `shadowBlur` | ✅ 已修 | `js/utils/layer-cache.js`(新)、`js/runtime/background.js`、`js/runtime/target.js`、`js/ui/theme.js`、`js/ui/food-display.js`、`menu-scene.js`、`rank-scene.js` |

**一句话结论**：A~C 三个批次解决的是「能不能跑、能不能过审、好不好玩」，D 批次解决的是「以后还敢不敢改」。删掉 493 行没人调用的代码、把 6 份重复的星级规则合成 1 份、把 README 从幻想改回事实、把每帧 190 次路径绘制压到 1 次 drawImage。

---

## 1. D1 — 死代码清理

### 删除清单

| 文件 | 行数 | 说明 |
|---|---|---|
| `js/physics/physics.js` | 93 | 冰面物理引擎，改用按格移动（`tryMove`）后已无人调用 |
| `js/physics/collision.js` | 54 | 同上 |
| `js/base/pool.js` | 63 | 对象池，全项目零引用 |
| `js/ui/level-select-scene.js` | 273 | 关卡选择页，关卡改为线性推进后废弃 |
| `open-data/index.html` | 10 | 早期调试页面，`game.json` 的 `openDataContext` 只用同目录的 `index.js` |

**合计 493 行**。

### 做法

删除前逐个 grep 确认零引用：

```
grep -rn "physics\|base/pool\|level-select-scene" --include=*.js .
```

唯一命中是 `level-manager.js` 里的局部变量 `pool`（排序用的数组），与 `js/base/pool.js` 无关。

删除后同步清理了两处**指向已删文件**的配置：

- `project.config.json` 的 `packOptions.ignore` 里删掉 `open-data/index.html` 这一项（文件都没了，还留着会让人以为它存在）
- 回归测试 B5 的断言从「已排除 open-data/index.html」改成「已排除 README.md」

---

## 2. D2 — 星级口径统一

### 问题

同一套 `if (moves <= par) 3 else if (moves <= par * 1.5) 2 else 1` 在 6 个地方各写了一遍：

| 位置 | 用途 |
|---|---|
| `game.js: calculateStars()` | 通关结算 |
| `game.js: saveLevelProgress()` | 写存档 |
| `game.js: reportScore()` | 上报排行榜 |
| `js/ui/result-scene.js: calculateStars()` | 结算页显示 |
| `js/utils/food-manager.js: calculateRewards()` | 算通关基础奖励 |
| `js/utils/achievement-manager.js: recordWin()` | 判定「精准操作」成就 |

这不是假想风险 —— 只要有一处改了阈值，就会出现「结算页显示 3 星、存档写 2 星、排行榜上报 1 星」这种极难排查的问题，而且「精准操作」成就的达成条件和界面上显示的 3 星会悄悄脱钩。

### 改动

新增 `js/utils/score.js`：

```js
export const THREE_STAR_RATIO = 1
export const TWO_STAR_RATIO = 1.5

export function calcStars(moves, par) {
  // par 非法时退化成 1 星，避免 NaN 传染到存档与排行榜
  const safePar = Number.isFinite(par) && par > 0 ? par : 1
  const safeMoves = Number.isFinite(moves) ? Math.max(0, moves) : 0

  if (safeMoves <= safePar * THREE_STAR_RATIO) return 3
  if (safeMoves <= safePar * TWO_STAR_RATIO) return 2
  return 1
}
```

6 处全部改为调用它。`achievement-manager` 的 `if (moves <= par)` 也换成 `calcStars(moves, par) === 3` —— 语义完全一致，但从此「精准操作」成就和界面 3 星永远同源。

`safePar` / `safeMoves` 的兜底是必要的：`getLevel()` 在关卡号越界时返回 `undefined`，原来的代码会算 `moves <= undefined` → `false` → 1 星，而 `NaN` 参与乘法会污染存档里的 `stars` 字段。

### 验证

```
✅ 步数 = par → 3 星
✅ 步数 = par×1.5 → 2 星
✅ 步数 > par×1.5 → 1 星
✅ 少于 par 仍是 3 星
✅ 非法参数不产生 NaN，仍返回 1~3 的整数星级
✅ 星级阈值只在 score.js 定义（D2）
```

最后一条是**静态扫描**：遍历 `js/` 下所有源码，检查 `TWO_STAR_RATIO` / `par * 1.5` 只出现在 `score.js` 一个文件里。以后谁再复制一份，测试直接挂。

---

## 3. D3 — 全局错误兜底与热更新

### 问题

小游戏里未捕获异常不会弹任何提示，只会让画面静默卡死 —— 玩家看到的是「点了没反应」，然后退出。线上没有任何线索可查。

另外小游戏默认会缓存旧包，不发版就永远跑老代码；发了版如果不主动检查更新，玩家可能几天都还在旧版本上。

### 改动

**`initErrorHandler()`**

```js
wx.onError((error) => {
  console.error('[Error] 未捕获异常:', error && (error.message || error), error && error.stack)

  if (this.errorRecovered) return     // 只自动复位一次
  this.errorRecovered = true

  try {
    this.clearOverlays()
    this.backToMenu()
    wx.showToast({ title: '出现异常，已返回菜单', icon: 'none' })
  } catch (e) {
    console.error('[Error] 异常复位失败:', e)   // 兜底里不能再抛
  }
})

wx.onUnhandledRejection((res) => {
  console.error('[Error] 未处理的 Promise 拒绝:', res && res.reason)
})
```

`errorRecovered` 这个一次性开关是关键：如果异常出在渲染循环里，`onError` 会每帧触发一次，不加限制就会变成「无限 backToMenu」—— 比原问题更糟。

**`initUpdateManager()`**

```js
updateManager.onUpdateReady(() => {
  wx.showModal({
    title: '发现新版本',
    content: '新版本已准备好，重启后生效',
    showCancel: false,
    confirmText: '立即重启',
    success: (res) => { if (res.confirm) updateManager.applyUpdate() }
  })
})
```

`onUpdateFailed` 也给了一句明确提示（「请退出小游戏后重新进入」），避免下载失败时玩家完全无感。

两个方法都用 `typeof wx.xxx === 'function'` 判断存在性 —— 老基础库没有这些接口，不能直接调。

### 验证

```
✅ 已实现全局错误兜底
✅ 已实现热更新检查
✅ 错误自动复位有一次性开关（errorRecovered）
✅ 注册了 wx.onError
✅ 注册了 wx.onUnhandledRejection
✅ 注册了 wx.getUpdateManager
```

---

## 4. D4 — README 重写

### 问题

原 README（中英各 267 行）描述的是一个**不存在的项目**：

| README 写的 | 实际情况 |
|---|---|
| 「冰面物理模拟，真实的滑行和摩擦效果」 | 没有物理引擎，是按格移动（一次滑动一格） |
| 物理参数表（摩擦 0.98 / 最大速度 8 / 推力 5 / 力传递 50%） | `js/physics/` 已删除，这些参数不存在 |
| 「关卡选择页，带星级」 | `level-select-scene.js` 已删除 |
| 「微信登录集成」 | `login-scene.js` 已删除，无账号体系 |
| 「分享到好友/群，分享得奖励」 | 分享已彻底去奖励（B1 合规整改） |
| 「广告接入（当前是占位）」 | 已接真实激励视频，未配置广告位时整链关闭 |
| 「在 `levels/` 里新建 JSON 加关卡」 | `levels/` 目录已删除，关卡数据在 `level-manager.js` |
| 项目结构里的 `pool.js` / `physics/` / `level-select-scene.js` / `login-scene.js` | 全部已删除 |
| 「All 10 phases completed」 | phase1~10 文档描述的是历史实现，其中部分能力已被移除 |

### 改动

按实际实现重写中英两份 README，重点补上这些原来完全没写的：

- **按格移动的玩法说明**（一次滑动一格、冰块推不动时不计步数、冰窟窿的两种失败情况）
- **障碍物行为表**（冰墙 / 冰窟窿 / 雪堆的实际效果，包括「冰块不能推上雪堆」这个隐性规则）
- **关卡体系**：60 关怎么来的、`par = ceil(optimal × 1.2)`、生成算法为什么用逆向构造而不是随机摆盘
- **星级与食物数值表**（原来只有一个「食物系统」的名词）
- **配置说明**：`js/config.js` 的广告位怎么填、留空的后果、`libVersion` 的最低要求
- **开发指引**：怎么跑回归、改 UI 坐标必须用 `stage()` 而不能写 `canvas.width / 2`、加场景要实现 `relayout()`
- **已知限制**：无后端、生成关可玩性、广告未配置时的体验、本地预览画布固定 375×667

`docs/phase1` ~ `phase10` 保留（它们是开发过程记录），但在 README 里明确标注「描述的是当时的实现，部分内容已在后续批次移除」，避免读者当成现状。

---

## 5. D5 — 仓库卫生

### 问题

1. 没有 `.gitignore`，`project.private.config.json`（含本机路径与编译模式）被提交进了仓库 —— 换一台机器拉代码就会覆盖别人的本地配置。
2. `project.config.json` 的 `libVersion` 是 `2.25.0`，而 `project.private.config.json` 是 `3.17.4`。私有配置在 IDE 里覆盖生效，所以**本机开发用的是 3.17.4，打包/别人机器上是 2.25.0** —— 而 B4 接入的 `wx.onNeedPrivacyAuthorization` 需要基础库 ≥ 2.32.3，2.25.0 上这个接口根本不存在，隐私弹窗会静默失效。

### 改动

**新增 `.gitignore`**，并在里面写清一个容易踩的坑：

```gitignore
project.private.config.json
.workbuddy-ai/
node_modules/
.DS_Store
...

# 注意：docs/ local-preview/ tools/ 是开发期资料，需要入库，
# 只是通过 project.config.json 的 packOptions.ignore 排除在上传包之外，
# 所以这里不要把它们加进 .gitignore。
```

「入库但不打包」和「不入库」是两件事，混在一起就会导致新克隆的仓库缺文档。

`git rm --cached project.private.config.json` 把它从索引里移除（本地文件保留）。

**统一 `libVersion` 到 `3.17.4`**，与私有配置一致，也满足隐私授权接口的最低要求。

### 验证

```
✅ .gitignore 已创建
✅ .gitignore 排除了 project.private.config.json
✅ .gitignore 排除了 .workbuddy-ai/ 与 node_modules/
✅ .gitignore 没有误排除 docs / tools / local-preview
✅ libVersion 与私有配置一致（3.17.4）
✅ 包体排除项不再包含已删除的 open-data/index.html
```

第三条（没有误排除 docs/tools/local-preview）是防止后来人「顺手」把开发资料也 ignore 掉。

---

## 6. D6 — 操作手感

### 6.1 滑动阈值 10px → 24px

```js
// 修改前
if (distance > 10) { ... }
```

10px 大致是一根头发丝在屏幕上的宽度级别的位移。手指按住屏幕时的轻微抖动（尤其是单手滑屏、拇指落点）就会被判成一次滑动 —— 玩家想点底部「暂停」按钮，结果企鹅先走了一步。

改成 24px：约等于一个指尖的抖动范围，同时仍明显小于一格（42~56px），滑一格不需要刻意拉长距离。

### 6.2 方向锁定

```js
// 修改前：每次 touchmove 都重算方向
if (distance > 10) {
  this.direction = this.getDirection(Math.atan2(dy, dx))
  this.swiped = true
}

// 修改后：一旦越过阈值就锁定
if (this.swiped) return
if (distance >= SWIPE_THRESHOLD) {
  this.swipeDirection = this.getDirection(Math.atan2(dy, dx))
  this.direction = this.swipeDirection
  this.swiped = true
}
```

原来手指划出去再轻微回摆，方向会被改掉。推箱子是「一步错要重来」的游戏，一个意料之外的方向反转可能直接毁掉整局。

### 6.3 冰块按格子缩放并居中

原实现只让**菱形本体**跟着格子缩放，阴影、裂纹、高光、描边宽度全是写死的像素：

```js
const size = Math.min(this.width, this.height) * 0.464   // 会缩放
ctx.ellipse(cx, cy + 20, 15, 4.5, ...)                    // 不缩放
ctx.moveTo(cx - 13, cy - 7)                               // 不缩放
ctx.lineWidth = 2.2                                       // 不缩放
```

在 42px 格子上，阴影椭圆落在格子最底边之外；在 56px 格子上，裂纹比菱形本体小一圈，看起来像冰块上贴了一张小贴纸。

改为以 40px 冰块为设计基准，所有偏移乘 `k = 格子 / 40`：

```js
const k = Math.min(this.width, this.height) / 40
const size = 18.56 * k          // = 0.464 × 格子，与原值完全一致
const thickness = 4 * k
const cy = centerY - thickness / 2   // 菱形 + 底部厚度整体上移，视觉重心落在格子中心
```

`cy` 的调整解决的是「居中」：原来菱形画在格子中心、厚度层画在中心下方 4px，视觉重心整体偏下 2px。现在整体上移 `thickness / 2`，重心回到格子中心；落地阴影仍贴在格子底部（用未偏移的 `centerY`），不会跟着飘。

### 验证

```
✅ 8px 手指抖动不算滑动（阈值 24px）
✅ 40px 右滑 → right
✅ 60px 上滑 → up
✅ 方向一旦判定就锁定（先右后上仍为 right）
✅ 纯点击不产生移动
```

---

## 7. D7 — 渲染性能

### 问题

对局界面每帧要做：

- `drawOceanBackdrop`：水体渐变 + 玻璃反光 + 3 道光束 + 14 个气泡 + 2 条鱼 + 沙底曲线 + 4 株珊瑚 + 7 根海草
- `renderBoard`：1 次 `shadowBlur = 18` 的底座 + **63 块瓷砖**，每块 3 次路径操作（填充 + 高光描边 + 边框描边）≈ **190 次路径绘制**
- `target.render`：每个目标格 1 次 `shadowBlur = 6~14`

这些内容里**绝大部分每帧完全一样**。`shadowBlur` 尤其贵 —— 它要求对整块绘制区域做高斯模糊，在低端机上是单帧最大的开销。

### 改动

**新增 `js/utils/layer-cache.js`（离屏静态层缓存）**

```js
render(ctx, key, width, height, draw) {
  if (!this.isReady()) return false          // 环境不支持，调用方自行绘制

  if (this.key !== key || this.canvas.width !== width || this.canvas.height !== height) {
    this.canvas.width = width                // 改尺寸会重置上下文，必须整层重画
    this.canvas.height = height
    this.key = key
    this.ctx.clearRect(0, 0, width, height)
    draw(this.ctx)
  }

  ctx.drawImage(this.canvas, 0, 0, width, height)
  return true
}
```

返回 `false` 表示环境不支持离屏画布，调用方回落到逐帧绘制 —— 保证任何环境都不会白屏。

**`js/ui/theme.js`：海洋背景拆成静态层 / 动态层**

| 函数 | 内容 | 是否缓存 |
|---|---|---|
| `drawOceanBase(ctx)` | 水体渐变、玻璃反光、沙底曲线、4 株珊瑚 | ✅ |
| `drawOceanMotion(ctx, time)` | 3 道光束、14 个气泡、2 条鱼、7 根海草 | ❌ 每帧 |

原来的 `drawOceanBackdrop` 包装函数在改造完成后**已无调用方，直接删除**（不再留一个「兼容用」的死函数）。

**`js/ui/theme.js: drawOceanCached(ctx)`：三个界面共用一张离屏画布**

菜单、排行榜、对局用的是同一张海洋背景，如果各建各的缓存，等于同一个画面在显存里存 3 份。所以把缓存实例提到 `theme.js` 模块级：

```js
const oceanLayer = new LayerCache('ocean-static')

export function drawOceanCached(ctx) {
  const cached = oceanLayer.render(
    ctx, `ocean@${canvas.width}x${canvas.height}`,
    canvas.width, canvas.height,
    (layerCtx) => drawOceanBase(layerCtx)
  )
  if (!cached) drawOceanBase(ctx)   // 环境不支持离屏画布时回落
}
```

场景切换时背景完全一样，key 不变就一次 `drawImage` 都不用重建。

**`js/runtime/background.js`**

- 海洋静态层改调 `drawOceanCached(ctx)`，不再自己持有实例
- `boardLayer`：缓存「底座 + 63 块瓷砖 + 外框」，key 为 `列x行@格子:原点`，resize 或换关卡自动重建
- 闪光点保留每帧绘制（它们本来就该闪）

底座投影从 `shadowBlur = 18` 改成两层半透明圆角矩形。

**`js/runtime/target.js`**：目标格辉光从 `shadowBlur = 6 + pulse*8` 改成「外层半透明粗描边 + 内层实色描边」，`lineWidth` 随 `pulse` 变化仍保留呼吸感。

**`js/ui/theme.js: drawGlassPanel`**：面板投影从 `shadowBlur = 16` 改成 3 层递进放大的半透明圆角矩形（`globalAlpha = 0.34` × 阴影色自身的 0.18 ≈ 0.06/层，三层叠加约 0.17，与原 0.18 基本一致）。

**`js/ui/food-display.js`**：奖励飘字从 `shadowBlur = 5` 改成先画一次向下偏移 1.5px 的深色文字。

**`menu-scene.js` / `rank-scene.js`** 同样改为 `drawOceanCached(ctx)` —— 这两个是玩家停留时间最长的静态页面，收益同样明显，且与对局共用同一份缓存。

### 效果

对局界面每帧的路径绘制从 **≈190 次 + 2 次高斯模糊** 降到 **2 次 drawImage（海洋静态层 + 棋盘层）+ 12 条闪光线段**。

### 验证

```
✅ 源码中不再有 shadowBlur（D7）
✅ 背景使用离屏层缓存
✅ 海洋静态层由 theme.js 统一缓存（三个界面共用一张离屏画布）
✅ 菜单 / 排行榜 / 对局都走共享海洋缓存，且不再各建一张
✅ 棋盘静态部分已抽成独立方法
✅ 海洋背景已拆成静态层 / 动态层
✅ LayerCache 同 key 只绘制一次
✅ LayerCache key 变化触发重建
✅ LayerCache 尺寸不变时不重建
```

「源码中不再有 shadowBlur」是静态扫描断言，不是靠人工检查。

---

## 8. 浏览器实机走查

Chrome 跑完整流程确认改造没有破坏画面：

| 场景 | 结果 |
|---|---|
| 主菜单 | 静态层（水色/玻璃反光/沙底珊瑚）与动态层（光束/气泡/鱼/海草）叠加正常，无错位 |
| 对局第 1 关 | 棋盘 63 块瓷砖完整、底座投影柔和、冰块在格子内居中、闪光点仍在闪 |
| 滑动一步 | 企鹅移动到相邻格、步数 +1（80px 滑动在 24px 阈值下正常触发） |
| 暂停面板 | 玻璃面板投影层次正常，无生硬边缘 |
| 排行榜 | 背景静态层 + 动态层正常 |

另外专门跑了一遍**跨场景切换**（菜单 → 对局 → 返回菜单 → 排行榜），验证共享海洋缓存在复用时不串画面、不错位：四个界面背景一致，`key` 未变时未触发重建，`drawImage` 直接命中。

帧耗时实测（桌面 Chrome）：菜单 16.67ms / 对局 16.67ms，均锁 60fps —— 桌面环境本来就有富余，这个数字只能证明没有回归，**真实收益需要真机测**。

---

## 9. 回归测试变动

从 136 项扩到 **171 项**，新增 `[19] D 批次` 共 35 项。分三类：

**行为断言**（驱动真实代码）
- `calcStars` 的 5 个边界值
- 企鹅滑动阈值与方向锁定（5 项）
- `LayerCache` 的缓存命中 / 失效 / 尺寸不变（3 项）

**静态扫描断言**（读源码正则匹配）
- 死代码文件已删除、无 import 指向已删模块
- 星级阈值只在 `score.js` 定义
- 源码中不再有 `.shadowBlur =`
- 背景使用了 `LayerCache`、静态部分已抽方法、海洋背景已拆分
- `game.js` 注册了 `onError` / `onUnhandledRejection` / `getUpdateManager`

**配置一致性断言**
- `.gitignore` 存在且排除了 `project.private.config.json` / `.workbuddy-ai/` / `node_modules/`
- `.gitignore` 没有误排除 `docs` / `tools` / `local-preview`
- `libVersion` 与 `project.private.config.json` 一致
- `packOptions.ignore` 不再包含已删除的 `open-data/index.html`

静态扫描这一类断言的价值在于**防回退**：以后有人再复制一份星级规则、再写一个 `shadowBlur`、或者把 docs 加进 `.gitignore`，测试会直接拦住。

同时修正了 1 项因 D1 失效的旧断言（B5 的「已排除 open-data/index.html」）。

**顺手修了回归加载器本身的一个坑**：原来的写法是「创建模块 → 递归 `link()` 子模块 → `evaluate()`」。`link()` 是异步的，父模块在等子模块时状态会停在 `linking`；此时若另一个兄弟模块也 import 同一个文件，拿到的就是一个没 link 完的模块，V8 直接抛 `request for '...' is from a module not been linked`。

这个坑在 `theme.js` 之前是个叶子节点（没有任何 import）所以从没暴露过 —— D7 给它加了 `import LayerCache` 之后立刻炸了。改成三段式：静态解析 import 建整图 → 按依赖顺序 `link` → 按依赖顺序 `evaluate`。以后任何模块加 import 都不会再触发。

---

## 10. 验收自查

### 工程化

- [x] 死代码清零，无悬空 import
- [x] 星级口径单点定义
- [x] 全局异常有日志 + 一次性复位
- [x] 热更新有提示
- [x] 仓库有 `.gitignore`，私有配置不再入库
- [x] `libVersion` 统一到 3.17.4（满足隐私接口 ≥ 2.32.3 的要求）

### 手感与性能

- [x] 手指抖动不再误触发移动
- [x] 方向锁定，不会中途反转
- [x] 冰块在 42 / 50 / 56px 格子上都居中且比例一致
- [x] 源码零 `shadowBlur`
- [x] 静态层走离屏缓存

### 待人工验证（无法离线断言）

- [x] **iOS 静音键**：`AudioManager.createAudio()` 统一设 `obeyMuteSwitch = false`，侧边静音键打开后游戏仍有声音
- [ ] **真机帧率**：`shadowBlur` 的移除在低端安卓上的实际收益，需要用开发者工具的「性能」面板或真机 trace 对比
- [x] **离屏画布内存**：海洋静态层三场景共用 1 张，对局另加棋盘层 1 张，全局共 2 张全屏离屏画布（375×667×4B × 2 ≈ 2MB），相比最初每场景各建一张省下约 2MB
- [ ] **`onError` 自动复位**：真机上模拟一次异常，确认不会反复弹 toast
- [ ] **热更新流程**：发一版新包，确认 `onUpdateReady` 弹窗与 `applyUpdate()` 生效

### 走查中新发现的遗留项（不在 D 批次范围内）

- **`audio/bgm.mp3` 不存在**：`audio-manager.js` 的 `bgmSources` 是 `['audio/bgm.mp3', 'audio/bgm.wav']`，优先 mp3 回落 wav，而仓库里只有 `bgm.wav`。回退逻辑本身是对的，但每次启动都会先打一条 404。上线前二选一：把正式 mp3 放进 `audio/`，或把这个候选源删掉。
- **H5 预览的 `InnerAudioContext` 不触发 `onError`**：`local-preview/wechat-adapter.js` 里模拟的音频对象不会因为文件不存在而报错，所以浏览器预览时 mp3 → wav 的回退不会发生，本地是静音的。真机不受影响。
- 顺带补齐了预览适配器的 `wx.onError` / `wx.onUnhandledRejection` / `wx.getUpdateManager`：原来走 Proxy 兜底会打印 6 条「API未实现」警告，现在能真正把浏览器错误转给游戏的兜底逻辑，本地调试也能验证 D3。

---

## 11. 四批次总结

| 批次 | 主题 | 解决的问题 | 回归项 |
|---|---|---|---|
| A | 稳定性 | 崩溃、死锁、状态残留、结算幂等、成就奖励丢失、排行榜空白 | 49 |
| B | 合规 | 诱导分享、模拟广告、缺失资源、隐私授权、包体过大 | 38 |
| C | 体验与数值 | 屏幕适配、前后台生命周期、食物经济、3 星不可达、60 关重复 | 49 |
| D | 工程化 | 死代码、重复逻辑、错误兜底、仓库卫生、手感、渲染性能 | 32 |
| | | | **171** |

四个批次累计删除约 800 行死代码（D1 的 493 行 + C5 删掉的 `levels/*.json` + C8 删掉的 `login-scene.js`），新增 6 个模块（`layout` / `score` / `layer-cache` / `config` / `privacy-scene` / `generated-levels`），回归从 0 建到 171 项。

### 仍未解决的

1. **无后端**：账号体系、全服排行榜、云存档同步都缺后端支持。要做的话最小路径是接微信云开发（`wx.cloud`），`code2session` 与数据库都能省掉自建服务器。
2. **生成关可玩性**：BFS 只保证可解与最少步数，视觉引导弱于手工关。上线后建议按真实通关率挑几关手工调。
3. **关卡数量上限**：60 关之后是循环 + 镜像，玩家能感知到重复。要扩到 100+ 关需要放宽 `optimal >= 18` 的过滤条件重新生成。
4. **真机性能数据缺失**：D7 的收益目前只有「路径绘制次数从 190 降到 1」这个静态指标，缺少真机帧率对比。
