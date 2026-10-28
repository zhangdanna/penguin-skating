# 微信小游戏审核未通过：黑屏卡死问题分析与修复

> 现象：H5 网页版运行正常，但提交微信审核后被驳回，理由为「游戏卡在此界面无法进一步游戏」，
> 附带的 vConsole 截图显示 `ReferenceError: Can't find variable: canvas`。

> **本文是修复当时（2026-10-26）的记录，结论仍然有效，数字已过期。**
>
> - 回归项数：当时 182 项 → 当前 **318 项**（`npm test`）
> - 上传命令：`upload-weapp.mjs` 用的是**位置参数**，正确写法是
>   `npm run upload -- 1.0.1 "说明"`；本文第五节里的 `--version / --desc` 写法会
>   把 `--version` 当成版本号传进去
> - 本文描述的 `js/env.js` 结构与当前一致；改代码前请一并看
>   [../DEVELOPMENT.md](../DEVELOPMENT.md) 第 1 节（启动链路）与第 3.5 节（生命周期约束）


---

## 一、结论先说

**这是代码问题，不是打包问题。**

打包产物完全正常：`dist-weapp/` 目录结构正确（`game.js` / `game.json` / `project.config.json` /
`js/` / `open-data/` / `images/` / `audio/` 齐全）、体积约 1.6MB（远小于 4MB 上限）、
`compileType` 为 `game`、`openDataContext` 指向有效目录。

真正的问题是：**入口文件使用了一个微信小游戏环境里根本不存在的全局变量 `canvas`**，
导致游戏在模块求值阶段就抛异常，第一帧都没渲染出来 —— 审核员看到的是一片纯黑，
自然判定为"卡住、无法继续游戏"。

---

## 二、证据链

### 1. 报错本身

```
Error: MiniProgramError
ReferenceError
ReferenceError
line:197,column:1683,ReferenceError: Can't find variable: canvas
    at <require(game.js)>
    at runWith (WAGameSubContext.js:1:137814)
    at evaluateScriptFile (WAGame.js:1:213253)
```

关键词：`at <require(game.js)>` —— 说明异常发生在**加载入口文件时**，不是某个按钮点击后。

### 2. 性能面板

截图里 `FPS:60 / drawcall:0 / Vert:0 / Tri:0`。
`drawcall: 0` 意味着**一次绘制都没有提交**，与"启动即崩溃、首帧未渲染"完全吻合。

### 3. 出问题的代码

`game.js` 第 59 行（原第 59 行）：

```js
export default class Main {
  constructor() {
    this.aniId = 0
    this.ctx = canvas.getContext('2d')   // ← canvas 从哪来？
```

继续往下看，`game.js` 末尾：

```js
// 启动游戏
new Main()      // ← 模块求值阶段就执行，直接触发上面的 ReferenceError
```

全项目搜索，`canvas` 这个标识符被大量模块直接读取（都不是自己的变量）：

| 文件 | 用法 |
| --- | --- |
| `game.js` | `canvas.width` / `canvas.height` / `canvas.getContext` |
| `js/ui/theme.js` | `canvas.width` / `canvas.height` |
| `js/ui/layout.js` | `canvas.width` / `canvas.height` |
| `js/ui/game-hud.js` | `canvas.width` / `canvas.height` |
| `js/ui/rank-scene.js` | `canvas.width` / `canvas.height` |
| `js/ui/achievement-scene.js` | `canvas.width` / `canvas.height` |
| `js/ui/food-display.js` | `canvas.width` |
| `js/ui/achievement-notification.js` | `canvas.width` |
| `js/runtime/background.js` | `canvas.width` / `canvas.height` |

**但项目里从来没有创建过这个 `canvas`。**

### 4. 为什么 H5 却是正常的

本地预览的适配层偷偷补上了这个全局变量：

`local-preview/wechat-adapter.js`
```js
const gameCanvas = document.getElementById('gameCanvas')
window.canvas = gameCanvas          // ← 就是这一行救活了 H5
```

`local-preview/game-wrapper.js`
```js
window.canvas = gameCanvas          // ← 又补了一次
import('../game.js')                // ← 然后才加载游戏
```

也就是说：**H5 靠 shim 活着，小游戏环境没有这层 shim，就当场崩了。**
这正是"网页能跑、小游戏黑屏"的经典成因。

### 5. 微信官方文档怎么说

官方新手教程的示例代码是：

```js
canvas = wx.createCanvas();          // 创建 Canvas 画布
ctx = canvas.getContext("2d");
```

注意这里 `canvas` **没有声明关键字**，是靠赋值隐式创建的全局变量。
文档同时说明：

> `wx.createCanvas()` 有一个规则：**首次调用创建的是显示在屏幕上的画布**，
> 之后调用创建的都是离屏画布。
>
> 如果你有引入 weapp-adapter，在 weapp-adapter 中默认会创建一个 Canvas 做为主屏 Canvas。

本项目既没有引入 `weapp-adapter`，也没有自己调 `wx.createCanvas()`，
所以 `canvas` 无处可寻 → `ReferenceError`。

---

## 三、修复方案

### 新增 `js/env.js`：环境引导模块

职责只有一件事：**在小游戏环境里把上屏画布建出来，并挂到全局对象上**。

```js
const globalObjects = collectGlobalObjects()   // GameGlobal / globalThis / window

// 1) 先找现成的画布（H5 预览由适配层提供）
let screenCanvas = null
for (...) {
  if (isCanvasLike(globalObjects[i].canvas)) { screenCanvas = globalObjects[i].canvas; break }
}

// 2) 小游戏：没有就创建（必须是全生命周期第一次 wx.createCanvas()）
if (!screenCanvas && wx.createCanvas) {
  screenCanvas = wx.createCanvas()
}

// 3) 挂回每一个全局对象，裸的 canvas 才能被 js/ui/* 读到
globalObjects.forEach(g => { g.canvas = screenCanvas })
```

三个关键设计点：

1. **必须先复用、后创建**
   H5 包里 `wx.createCanvas()` 返回的是新建的**离屏**画布。
   如果无条件调用，游戏会画到一张不在页面上的画布上 —— 同样是黑屏，只是更难查。

2. **必须保证是第一次调用 `wx.createCanvas()`**
   小游戏里"第一次调用返回上屏画布"是一次性资源。
   如果被 `LayerCache` 抢先调用，上屏画布就变成了离屏缓存，画面永远上不了屏。
   因此 `js/env.js` 必须是 `game.js` 的**第一个 import**。

3. **必须挂到全局对象而不是模块局部变量**
   `js/ui/*` 读的是裸标识符 `canvas`，只有挂在 `GameGlobal`（小游戏全局对象）上才解析得到。

### 修改 `game.js`

```js
// 环境引导必须排在所有 import 之前
import screenCanvas from './js/env'
import Background from './js/runtime/background'
...

constructor() {
  this.aniId = 0

  if (!screenCanvas) {
    console.error('[Boot] 上屏画布缺失，游戏无法启动。请检查 js/env.js 是否被正确导入。')
    this.bootFailed = true
    return
  }
  this.ctx = screenCanvas.getContext('2d')
```

改动只有两处：新增 1 行 import、把 `canvas.getContext` 换成 `screenCanvas.getContext`
并补一个显式兜底。其余 `canvas.width` / `canvas.height` 保持原样 —— 因为 `env.js`
已经把全局变量建好了，全项目 9 个文件、40 多处引用一次性全部修复。

---

## 四、验证

### 1. 三环境模拟（`npm run verify:env`）

```
✅ 微信小游戏：没有全局 canvas → 用 wx.createCanvas() 建上屏画布
✅ H5 预览：已有 window.canvas → 复用它，不去 createCanvas
✅ GameGlobal 环境：挂到 GameGlobal.canvas 上
```

### 2. 离线回归（`npm test`）

新增 10 项断言，覆盖：

- `js/env.js` 存在且确实调用了 `wx.createCanvas()`
- `env.js` 优先复用已有画布（H5 不会黑屏）
- 画布被挂回全局对象
- `game.js` 的第一个 import 就是环境引导
- `game.js` 不再裸读全局 canvas
- **全局 canvas 仍是原画布**（没有另建离屏画布）
- 游戏实例拿到了可用的 2D 上下文

结果：**182 通过 / 0 失败**（修复前 171 项，本次新增 11 项）。
> 当前已增至 318 项，见 `npm test` 输出。

### 3. H5 冒烟

重新构建 `dist-h5/` 后本地起服务，`index.html` / `game.js` / `js/env.js` /
`js/runtime/background.js` 全部 200，页面正常渲染。

---

## 五、重新提交步骤

```bash
# 1. 跑回归，确认全部通过
npm test

# 2. 重新构建小游戏包
npm run build:weapp

# 3. 上传（版本号记得递增，例如 1.0.1）
#    版本号与说明是位置参数，不要写成 --version / --desc
npm run upload -- 1.0.1 "修复真机启动黑屏"

# 4. 到微信公众平台 → 版本管理 → 提交审核
```

> **提交前务必先在真机上验证**：开发者工具 → 预览 → 手机扫码。
> 开发者工具模拟器会提供一些浏览器式的全局对象，很多"只在真机崩"的问题在模拟器里看不出来，
> 这次的 `canvas` 就是典型例子。真机预览时打开 vConsole 看有没有红色报错。

---

## 六、顺带清理

- 删除了构建产物里混入的空目录 `ee6f53a93a637d1d620e29dfa3d552d4/`（开发者工具生成的临时目录）
- `package.json` 补了两个脚本：`npm test`（回归）、`npm run verify:env`（环境模拟）
- 新增 `tools/verify-env.mjs`，可随时复验三种运行环境下的画布创建行为
