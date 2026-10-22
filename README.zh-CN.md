# 企鹅滑冰

[English](./README.md) | 简体中文

一款微信小游戏，玩家需要引导企鹅在冰面上滑行，将冰块推到目标区域。

## 特性

### 核心玩法
- 冰面物理模拟，真实的滑行和摩擦效果
- 触摸操作：滑动选择方向，松开滑行
- 推箱子玩法：将冰块推到目标区域
- 多个关卡，难度递增（7个内置关卡 + 程序化生成）
- 企鹅、冰块和边界的碰撞检测

### 障碍物系统
- 冰墙：阻挡移动并反弹
- 冰窟窿：企鹅掉入即失败
- 雪堆：减慢移动速度
- 关卡动态配置障碍物

### UI系统
- 带企鹅动画的主菜单
- 带星级评定的关卡选择
- 暂停/恢复功能
- 通关结算界面（含奖励）
- 游戏结束界面（含复活选项）
- 游戏内HUD（步数、时间、关卡信息）

### 进度系统
- 食物/体力系统（鱼🐟、虾🦐、鱿鱼🦑、金鱼🐠）
- 成就系统（20+成就可解锁）
- 复活机制（分享好友/群、看广告、消耗食物）
- 星级评定系统（每关1-3星）
- 本地存档系统

### 社交功能
- 微信登录集成
- 排行榜（开放数据域）
- 分享到好友和群
- 分享奖励

### 音效系统
- 背景音乐（占位符）
- 推动、碰撞、滑行、胜利、失败音效
- 带音量控制的音效管理器

### 游戏统计
- 结算管理器追踪所有游戏数据
- 每关最佳时间和步数
- 总游戏次数、通关次数、连胜记录
- 完美通关追踪

## 技术栈

- **平台**：微信小游戏
- **渲染**：Canvas 2D
- **物理**：自研冰面物理引擎
- **语言**：JavaScript (ES6+)
- **框架**：微信小游戏 API

## 快速开始

### 环境要求

- 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)

### 本地运行

1. 克隆仓库：
   ```bash
   git clone <repository-url>
   cd penguin-skating-game
   ```

2. 打开微信开发者工具

3. 导入项目：
   - 点击"导入项目"
   - 选择 `penguin-skating-game` 目录
   - 输入 AppID（测试可选择"测试号"）

4. 点击"编译"运行游戏

## 项目结构

```
penguin-skating-game/
├── game.js                      # 游戏入口
├── game.json                    # 小游戏配置
├── project.config.json          # 项目配置
├── js/
│   ├── base/                    # 基础类
│   │   ├── sprite.js           # 精灵基类
│   │   └── pool.js             # 对象池
│   ├── runtime/                 # 游戏运行时对象
│   │   ├── penguin.js          # 企鹅（玩家角色）
│   │   ├── stone.js            # 可推动的冰块
│   │   ├── target.js           # 目标区域
│   │   ├── background.js       # 冰面背景
│   │   └── obstacle.js         # 障碍物（冰墙、冰窟窿、雪堆）
│   ├── physics/                 # 物理系统
│   │   ├── physics.js          # 物理引擎
│   │   └── collision.js        # 碰撞检测
│   ├── levels/                  # 关卡管理
│   │   └── level-manager.js    # 关卡加载器和管理器
│   ├── ui/                      # UI组件
│   │   ├── scene-manager.js    # 场景管理
│   │   ├── menu-scene.js       # 主菜单
│   │   ├── level-select-scene.js # 关卡选择
│   │   ├── pause-scene.js      # 暂停界面
│   │   ├── result-scene.js     # 通关结算
│   │   ├── gameover-scene.js   # 游戏结束
│   │   ├── login-scene.js      # 登录界面
│   │   ├── rank-scene.js       # 排行榜
│   │   ├── achievement-scene.js # 成就展示
│   │   ├── achievement-notification.js # 成就弹窗
│   │   ├── revive-scene.js     # 复活选项
│   │   ├── game-hud.js         # 游戏HUD
│   │   ├── food-display.js     # 食物计数器
│   │   └── button.js           # 可复用按钮组件
│   └── utils/                   # 工具管理器
│       ├── audio-manager.js    # 音效和音乐
│       ├── wechat-service.js   # 微信API集成
│       ├── food-manager.js     # 食物/体力系统
│       ├── achievement-manager.js # 成就追踪
│       ├── revive-manager.js   # 复活系统
│       ├── settlement-manager.js # 游戏统计
│       └── ad-manager.js       # 广告管理
├── levels/                      # 关卡数据（JSON）
│   ├── level1.json ~ level7.json
├── audio/                       # 音效文件（占位符）
└── docs/                        # 阶段文档
    ├── phase1-core-prototype.md
    ├── phase2-ui-system.md
    ├── phase3-obstacle-system.md
    ├── phase4-audio-system.md
    ├── phase5-wechat-integration.md
    ├── phase6-login-rank.md
    ├── phase7-food-system.md
    ├── phase8-achievement-share.md
    ├── phase9-revive-system.md
    └── phase10-gameover-settlement.md
```

## 操作说明

1. **滑动屏幕**选择滑行方向
2. **松开手指**让企鹅向该方向滑行
3. **推动冰块**通过滑向冰块
4. **通关条件**将所有冰块推到绿色目标区域内

## 物理参数

| 参数 | 值 | 说明 |
|------|-----|------|
| 冰面摩擦 | 0.98 | 企鹅滑行摩擦系数 |
| 冰块摩擦 | 0.92 | 冰块滑行摩擦系数 |
| 最大速度 | 8 | 最大滑行速度 |
| 推动力 | 5 | 对冰块施加的推力 |
| 推力传递 | 50% | 传递给冰块的推力比例 |

## 配置说明

### game.json

```json
{
  "deviceOrientation": "portrait",
  "showStatusBar": false
}
```

### project.config.json

将 `appid` 字段更新为你的微信小游戏 AppID：

```json
{
  "appid": "your-appid-here"
}
```

## 开发指南

### 添加新关卡

在 `levels/` 目录下创建新的 JSON 文件：

```json
{
  "id": 4,
  "name": "关卡名称",
  "penguin": { "x": 50, "y": 50 },
  "stones": [
    { "x": 200, "y": 150, "size": 40 }
  ],
  "target": { "x": 300, "y": 400, "width": 50, "height": 50 },
  "par": 5
}
```

### 代码结构

- **基础类** (`js/base/`)：游戏对象的可复用基类
- **运行时对象** (`js/runtime/`)：游戏实体（企鹅、冰块等）
- **物理系统** (`js/physics/`)：物理模拟和碰撞检测
- **关卡系统** (`js/levels/`)：关卡加载和管理

## 文档

### 阶段文档
- [第一阶段：核心原型](./docs/phase1-core-prototype.md) - 基础玩法和物理
- [第二阶段：UI系统](./docs/phase2-ui-system.md) - 菜单、关卡选择、暂停、结算界面
- [第三阶段：障碍物系统](./docs/phase3-obstacle-system.md) - 冰墙、冰窟窿、雪堆
- [第四阶段：音效系统](./docs/phase4-audio-system.md) - 音效和音乐
- [第五阶段：微信集成](./docs/phase5-wechat-integration.md) - 微信API设置
- [第六阶段：登录与排行榜](./docs/phase6-login-rank.md) - 用户登录和排行榜
- [第七阶段：食物系统](./docs/phase7-food-system.md) - 体力和奖励
- [第八阶段：成就与分享](./docs/phase8-achievement-share.md) - 成就和分享
- [第九阶段：复活系统](./docs/phase9-revive-system.md) - 复活机制
- [第十阶段：游戏结束与结算](./docs/phase10-gameover-settlement.md) - 统计和游戏结束

## 当前状态

✅ **全部10个阶段已完成！** 游戏功能完整，包含：
- 核心玩法机制
- 完整UI系统
- 障碍物系统
- 音效系统
- 微信集成
- 登录和排行榜
- 食物/体力系统
- 成就系统
- 复活机制
- 游戏统计追踪

## 开发计划

### 已完成
- [x] UI系统（主菜单、关卡选择、暂停界面）
- [x] 障碍物系统（冰墙、冰窟窿、雪堆）
- [x] 音效和音乐（占位符音频文件）
- [x] 本地存储（关卡进度）
- [x] 微信登录和排行榜
- [x] 食物/体力系统
- [x] 成就系统
- [x] 复活机制
- [x] 游戏统计

### 未来增强
- [ ] 替换占位符音频为真实音效文件
- [ ] 添加更多关卡（当前7关 + 程序化生成）
- [ ] 实现真实广告集成（当前为占位符）
- [ ] 添加每日挑战
- [ ] 实现道具商店（能力增强）
- [ ] 添加更多成就
- [ ] 社交功能增强（好友挑战）
- [ ] 大关卡性能优化

## 许可证

MIT

## 贡献

欢迎贡献！请随时提交 Pull Request。
