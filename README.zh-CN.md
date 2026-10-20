# 企鹅滑冰

[English](./README.md) | 简体中文

一款微信小游戏，玩家需要引导企鹅在冰面上滑行，将石头推到目标区域。

## 特性

- 冰面物理模拟，真实的滑行和摩擦效果
- 触摸操作：滑动选择方向，松开滑行
- 多个关卡，难度递增
- 企鹅、石头和边界的碰撞检测
- 精美的冰面主题图形和动画效果

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
├── game.js                 # 游戏入口
├── game.json               # 小游戏配置
├── project.config.json     # 项目配置
├── js/
│   ├── base/               # 基础类
│   │   ├── sprite.js       # 精灵基类
│   │   └── pool.js         # 对象池
│   ├── runtime/            # 游戏运行时对象
│   │   ├── penguin.js      # 企鹅（玩家角色）
│   │   ├── stone.js        # 可推动的石头
│   │   ├── target.js       # 目标区域
│   │   └── background.js   # 冰面背景
│   ├── physics/            # 物理系统
│   │   ├── physics.js      # 物理引擎
│   │   └── collision.js    # 碰撞检测
│   └── levels/             # 关卡管理
│       └── level-manager.js
└── levels/                 # 关卡数据（JSON）
    ├── level1.json
    ├── level2.json
    └── level3.json
```

## 操作说明

1. **滑动屏幕**选择滑行方向
2. **松开手指**让企鹅向该方向滑行
3. **推动石头**通过滑向石头
4. **通关条件**将所有石头推到绿色目标区域内

## 物理参数

| 参数 | 值 | 说明 |
|------|-----|------|
| 冰面摩擦 | 0.98 | 企鹅滑行摩擦系数 |
| 石头摩擦 | 0.92 | 石头滑行摩擦系数 |
| 最大速度 | 8 | 最大滑行速度 |
| 推动力 | 5 | 对石头施加的推力 |
| 推力传递 | 50% | 传递给石头的推力比例 |

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
- **运行时对象** (`js/runtime/`)：游戏实体（企鹅、石头等）
- **物理系统** (`js/physics/`)：物理模拟和碰撞检测
- **关卡系统** (`js/levels/`)：关卡加载和管理

## 文档

- [第一阶段：核心原型](./docs/phase1-core-prototype.md) - 详细模块文档

## 开发计划

- [ ] UI 系统（主菜单、关卡选择、暂停界面）
- [ ] 障碍物系统（冰墙、冰窟窿、雪堆）
- [ ] 音效和音乐
- [ ] 本地存储（关卡进度）
- [ ] 微信登录和排行榜
- [ ] 广告接入
- [ ] 食物/体力系统

## 许可证

MIT

## 贡献

欢迎贡献！请随时提交 Pull Request。
