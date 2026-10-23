# 企鹅滑冰 · Penguin Skating

[English](./README.md) | 简体中文

一款微信小游戏：控制企鹅在冰面上按格移动，把冰块推到目标区域。

棋盘 7 列 × 9 行，**每滑动一次移动一格**；冰块前方有阻挡就推不动，冰块被推进冰窟窿或企鹅掉进去都算失败。全部冰块进入目标区即通关。

---

## 玩法

1. 在屏幕上向某个方向滑动 → 企鹅朝该方向移动**一格**
2. 撞上冰块时会把它一起推走一格（推不动时只有碰撞反馈，不计步数）
3. 把所有冰块推进目标区（鱼形展台）即通关
4. 星级：步数 ≤ 标准步数 → 3 星；≤ 标准 × 1.5 → 2 星；其余 1 星

### 障碍物

| 类型 | 效果 |
|---|---|
| 冰墙 `wall` | 挡住企鹅与冰块 |
| 冰窟窿 `hole` | 企鹅掉入 → 立即失败；冰块掉入 → 关卡无法完成，同样失败 |
| 雪堆 `snow` | 移动变慢（补间 120ms → 220ms），且冰块无法被推上雪堆 |

---

## 特性

**玩法与内容**
- 60 关战役：7 关手工设计 + 53 关程序化生成（全部经 BFS 求解器验证可解）
- 难度按最优步数单调递增，第 1 关 13 步 → 第 60 关 39 步
- 标准步数 `par = ceil(最优步数 × 1.2)`，3 星不再要求零失误
- 第 61 关起按 60 关循环，奇数轮水平镜像

**成长系统**
- 食物（体力）：鱼 🐟 / 虾 🦐 / 鱿鱼 🦑 / 金鱼 🐠，按关卡难度消耗 0~5 点
- 自然恢复：每 5 分钟 +1，上限 30，退出后按真实时间结算（余数保留）
- 成就：19 个，涵盖通关数、星级、连续通关、复活、食物收集等维度
- 复活：看激励视频（每日 5 次）或消耗食物

**社交与平台**
- 好友排行榜：走开放数据域（`open-data/`），主域只负责渲染
- 上报口径「只升不降」：最高关卡 + 累计总星数 + 该关最佳步数
- 分享：纯传播，**不挂任何奖励**（合规要求）
- 隐私授权：`wx.onNeedPrivacyAuthorization` + 自绘弹窗，按需触发

**体验与工程**
- 设计稿坐标系（375×667）+ 等比缩放，一套坐标适配 320~768 宽的全部屏幕
- 前后台生命周期：切后台自动暂停、停 BGM，回来不跳计时
- 窗口 resize 重算棋盘与全部 UI 按钮
- 静态层离屏缓存（海洋背景 / 棋盘瓷砖 / 玻璃面板投影），无 `shadowBlur`
- 离线回归测试 171 项，覆盖布局、计时、经济、关卡、排行榜、渲染

---

## 快速开始

### 方式一：微信开发者工具（真机 / 模拟器）

1. 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 「导入项目」→ 选择本目录
3. 填入自己的小游戏 AppID（或选「测试号」）
4. 点「编译」运行

> `project.config.json` 里 `compileType` 为 `game`，`libVersion` 为 `3.17.4`。
> 隐私授权接口需要基础库 **≥ 2.32.3**。

### 方式二：浏览器本地预览

```bash
node local-preview/server.js
# 打开 http://localhost:8080/local-preview/index.html
```

`local-preview/wechat-adapter.js` 把 `wx.*` 接口适配到浏览器：画布固定 375×667，
触摸映射到鼠标事件，`visibilitychange` 模拟前后台切换，广告与隐私授权为桩实现。

---

## 项目结构

```
penguin-skating-game/
├── game.js                       # 入口：主循环、状态机、关卡装载、生命周期
├── game.json                     # 小游戏配置（竖屏、开放数据域）
├── project.config.json           # 开发者工具配置（含包体排除项）
├── js/
│   ├── config.js                 # 广告位、版本号等可配置项
│   ├── base/
│   │   └── sprite.js             # 精灵基类（位置/尺寸/补间）
│   ├── runtime/                  # 棋盘上的实体
│   │   ├── penguin.js            # 企鹅（滑动判定 + 渲染）
│   │   ├── stone.js              # 可推动的冰块
│   │   ├── target.js             # 目标区域
│   │   ├── obstacle.js           # 障碍物工厂（冰墙/冰窟窿/雪堆）
│   │   └── background.js         # 海洋馆背景 + 浮冰棋盘（静态层缓存）
│   ├── levels/
│   │   ├── level-manager.js      # 关卡编排（手工 + 生成，单一数据源）
│   │   └── generated-levels.js   # 第 8~60 关（由 tools/gen-levels.mjs 生成）
│   ├── ui/
│   │   ├── layout.js             # 设计稿坐标系 + 等比缩放
│   │   ├── theme.js              # 配色、字体、面板/按钮/背景绘制原语
│   │   ├── scene-manager.js      # 场景栈
│   │   ├── game-scene.js         # 对局场景（壳，逻辑在 game.js）
│   │   ├── menu-scene.js         # 主菜单
│   │   ├── pause-scene.js        # 暂停
│   │   ├── result-scene.js       # 通关结算
│   │   ├── gameover-scene.js     # 游戏结束
│   │   ├── revive-scene.js       # 复活选择
│   │   ├── rank-scene.js         # 排行榜（合成开放数据域画布）
│   │   ├── achievement-scene.js  # 成就列表
│   │   ├── achievement-notification.js  # 成就解锁弹窗
│   │   ├── privacy-scene.js      # 隐私授权弹窗
│   │   ├── game-hud.js           # 对局 HUD（关卡/步数/计时/操作条）
│   │   ├── food-display.js       # 食物数量与奖励动画
│   │   └── button.js             # 按钮组件
│   └── utils/
│       ├── audio-manager.js      # BGM + 音效，音效开关持久化
│       ├── ad-manager.js         # 激励视频（未配置广告位则整链关闭）
│       ├── wechat-service.js     # 分享 / 云存档 / 排行榜上报
│       ├── food-manager.js       # 食物经济与自然恢复
│       ├── achievement-manager.js# 成就判定与统计
│       ├── revive-manager.js     # 复活次数与每日限额
│       ├── settlement-manager.js # 单局结算与累计统计
│       ├── score.js              # 星级口径（唯一实现）
│       └── layer-cache.js        # 离屏静态层缓存
├── open-data/
│   └── index.js                  # 开放数据域：好友排行榜绘制
├── audio/                        # bgm.wav + 6 个音效
├── images/
│   └── share-image.png           # 分享卡片图 500×400
├── tools/
│   ├── gen-levels.mjs            # 关卡生成器（逆向构造 + BFS 求解）
│   ├── gen-share-image.py        # 分享图生成
│   ├── gen-bgm.py                # BGM 生成
│   └── regression/run.mjs        # 离线回归测试
├── local-preview/                # 浏览器预览（不打包）
└── docs/                         # 设计与走查文档（不打包）
```

---

## 关卡与数值

### 关卡数据

关卡不再从 `levels/*.json` 读取 —— 数据在 `js/levels/level-manager.js` 里：

- `HANDCRAFTED_LEVELS`：7 关手工设计，带 `originalId` 与实测 `optimal`
- `GENERATED_LEVELS`：53 关程序化生成（`js/levels/generated-levels.js`）
- 两者合并后**按 `optimal` 升序排序**，重新编号 1..60

### 生成算法

`tools/gen-levels.mjs` 用**逆向构造**而不是随机摆盘（随机摆盘 3 块冰的可解率约 0.2%，实测平均 700+ 次才撞到一个可解盘面）：

1. 从终局出发（冰块已在目标区里），此时盘面必然已解
2. 随机反向移动（企鹅后撤 + 拉冰），推箱子每步可逆，所以反向走出的盘面必然可解
3. 给反向走法打分：走完「冰块到目标的曼哈顿距离变大」+3 分、变小 −1 分，加权随机 —— 否则冰块越走越贴脸，难度不足
4. 用 BFS 算真实最优步数 `optimal`（整数状态编码 `p | s0<<6 | s1<<12 | s2<<18`）
5. 生成 96 个 `optimal ≥ 18` 的盘面池，按 `optimal` 排序后等距取 53 个

调整难度改脚本后重跑：

```bash
node tools/gen-levels.mjs
```

### 星级

口径在 `js/utils/score.js`，全项目唯一实现（`calcStars(moves, par)`）：

| 星级 | 条件 |
|---|---|
| ★★★ | 步数 ≤ par |
| ★★☆ | 步数 ≤ par × 1.5 |
| ★☆☆ | 其余 |

### 食物

| 食物 | 价值 | 来源 |
|---|---|---|
| 🐟 鱼 | 1 | 通关奖励、自然恢复、看广告 |
| 🦐 虾 | 3 | 时间奖励 |
| 🦑 鱿鱼 | 10 | 时间奖励、连续通关 |
| 🐠 金鱼 | 50 | 极速通关、连续通关 10 场 |

关卡消耗：教程 0 / 简单 1 / 中等 2 / 困难 3 / 专家 5。自然恢复每 5 分钟 +1，上限 30。

---

## 配置

### 广告位（`js/config.js`）

```js
export const AD_UNITS = {
  rewardedVideo: ''   // 留空 = 关闭广告链路，所有广告入口自动隐藏
}
```

填入真实广告位（`adunit-` 开头的 16 位以上 ID）后，复活页与「食物不足」弹窗的看视频入口才会出现。留空不影响玩法与过审。

### AppID（`project.config.json`）

```json
{ "appid": "your-appid-here" }
```

`project.private.config.json` 是开发者工具的本机配置，已在 `.gitignore` 中排除。

### 包体排除

`project.config.json` 的 `packOptions.ignore` 已排除 `docs/`、`local-preview/`、`tools/`、`.workbuddy-ai/`、README 与设计稿。这些目录需要入库，但不进上传包。

---

## 开发

### 跑回归测试

```bash
node --experimental-vm-modules tools/regression/run.mjs .
```

离线跑真实模块（`vm.SourceTextModule`），带可控时钟与触摸链路模拟，覆盖 171 项断言：
布局自适应、关卡坐标映射、暂停/返回状态复位、结算幂等、成就奖励、合规项、
广告桩、隐私授权、包体排除项、设计稿坐标系、前后台计时、食物经济、关卡唯一性、排行榜口径。

### 改 UI 坐标

所有覆盖层场景按 **375×667 设计稿坐标**书写：

```js
import { CENTER_X, stage } from './layout'

render(ctx) {
  drawOverlay(ctx, 0.6)        // 遮罩用真实像素铺满
  const s = stage()
  ctx.save()
  s.apply(ctx)                 // 之后全部用设计稿坐标
  // ...
  ctx.restore()
}

onTouchStart(touch) {
  const t = stage().unproject(touch)   // 屏幕坐标 → 设计稿坐标
}
```

**不要在场景里写 `canvas.width / 2`** —— 回归里有「按钮坐标与画布尺寸无关」的不变量断言会挂掉。

### 加一个 UI 场景

实现 `render / update / onTouchStart / onTouchMove / onTouchEnd`，注册到 `sceneManager`，
并提供 `relayout()` 供窗口尺寸变化时重排（注意 `relayout()` 会重建按钮对象，回调要放在构造函数里或先存后恢复）。

---

## 已知限制

- **无后端**：没有 `code2session`，因此没有账号体系；排行榜靠 `wx.setUserCloudStorage` 自带的 openid 绑定，只能看好友榜
- **生成关的可玩性**：BFS 只保证「可解」与「最少步数」，不保证「一眼看出怎么推」，视觉引导弱于手工关
- **广告位未配置时**：所有广告入口隐藏，「食物不足」时只能等自然恢复
- **本地预览画布固定 375×667**：改浏览器窗口只能验证 CSS 缩放，验证不了 320 逻辑像素下的布局（那部分由离线回归覆盖）

---

## 文档

| 文档 | 内容 |
|---|---|
| [发布前走查报告](./docs/phase11-pre-release-review.md) | 技术与功能走查（P0/P1/P2 分级 + 修改清单） |
| [发布操作手册](./docs/phase12-publish-guide.md) | 微信小游戏 + H5 发布步骤 |
| [A 批次：稳定性](./docs/review/batch-a-stability.md) | 崩溃、死锁、状态复位 |
| [B 批次：合规](./docs/review/batch-b-compliance.md) | 诱导分享、模拟广告、隐私授权、包体 |
| [C 批次：体验与数值](./docs/review/batch-c-experience.md) | 屏幕适配、生命周期、食物经济、关卡体系 |
| [D 批次：工程化](./docs/review/batch-d-engineering.md) | 死代码、重复逻辑、错误兜底、性能 |

`docs/phase1` ~ `phase10` 是分阶段开发记录，描述的是当时的实现，部分内容（物理引擎、关卡选择页、登录）已在后续批次移除。

---

## License

MIT
