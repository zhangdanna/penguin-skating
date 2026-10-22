# 企鹅滑冰 - 第七阶段：食物/体力系统

## 阶段目标

实现食物作为体力值的消耗与获取系统：
- 食物管理器
- 关卡消耗食物
- 通关获得食物奖励
- 食物自然恢复
- 食物显示UI

## 新增文件

```
penguin-skating-game/
├── js/
│   ├── utils/
│   │   └── food-manager.js     # 食物管理器
│   └── ui/
│       └── food-display.js     # 食物显示组件
```

## 更新文件

| 文件 | 变更 |
|------|------|
| `game.js` | 添加食物系统初始化、消耗检查、奖励发放 |
| `js/ui/result-scene.js` | 添加奖励显示 |

## 模块说明

### 1. 食物管理器 (food-manager.js)

#### 食物类型

| 类型 | 图标 | 价值 | 说明 |
|------|------|------|------|
| 鱼 | 🐟 | 1 | 基础食物 |
| 虾 | 🦐 | 3 | 中级食物 |
| 鱿鱼 | 🦑 | 10 | 高级食物 |
| 金鱼 | 🐠 | 50 | 稀有食物 |

#### 关卡消耗

| 难度 | 消耗 | 说明 |
|------|------|------|
| 教程 | 0 | 免费 |
| 简单 | 1🐟 | 初级关卡 |
| 中等 | 2🐟 | 中级关卡 |
| 困难 | 3🐟 | 高级关卡 |
| 专家 | 5🐟 | 专家关卡 |

#### 奖励规则

**通关基础奖励**：
| 星级 | 奖励 |
|------|------|
| 3星 | 3🐟 |
| 2星 | 2🐟 |
| 1星 | 1🐟 |

**连续通关奖励**：
| 连续次数 | 奖励 |
|----------|------|
| 3次 | 1🐟 |
| 5次 | 1🦐 |
| 10次 | 1🦑 |
| 50次 | 1🐠 |

**时间挑战奖励**（根据关卡难度调整）：

时间阈值会根据关卡编号动态调整：
- 难度系数 = 1 + (关卡编号 - 1) × 0.3
- 时间倍率：1-3关 ×1.0，4-6关 ×1.3，7+关 ×1.6

| 关卡范围 | 金鱼奖励 | 鱿鱼奖励 | 鱼奖励 |
|----------|----------|----------|--------|
| 1-3关 | ≤5秒 | ≤10秒 | ≤30秒 |
| 4-6关 | ≤8秒 | ≤17秒 | ≤51秒 |
| 7+关 | ≤12秒 | ≤26秒 | ≤78秒 |

示例：第7关，金鱼奖励阈值为 5 × 1.6 × (1 + 6×0.3) = 12秒

#### 自然恢复

- 恢复速率：每5分钟恢复1🐟
- 最大上限：30🐟（按价值计算）
- 离线期间也会恢复

#### 主要方法

| 方法 | 说明 |
|------|------|
| `getTotalFood()` | 获取总食物价值 |
| `hasEnoughFood(cost)` | 检查是否有足够食物 |
| `consumeFood(cost)` | 消耗食物 |
| `addFood(type, amount)` | 添加食物 |
| `getLevelCost(difficulty)` | 获取关卡消耗 |
| `calculateRewards(level, moves, par, time)` | 计算通关奖励 |
| `giveRewards(rewards)` | 发放奖励 |
| `checkRecovery()` | 检查自然恢复 |
| `getNextRecoveryTime()` | 获取下次恢复时间 |

### 2. 食物显示组件 (food-display.js)

#### 功能

| 功能 | 说明 |
|------|------|
| 显示食物数量 | 显示各种食物的数量 |
| 显示总价值 | 显示总食物价值 |
| 显示恢复时间 | 显示下次恢复倒计时 |
| 奖励动画 | 通关时显示获得的奖励 |

#### 界面布局

```
┌─────────────────┐
│ 🐟×10  🦐×2    │
│ 总计: 16        │
│ +1🐟 04:32      │
└─────────────────┘
```

#### 主要方法

| 方法 | 说明 |
|------|------|
| `setPosition(x, y)` | 设置位置 |
| `setVisible(visible)` | 显示/隐藏 |
| `showRewardAnimation(rewards)` | 显示奖励动画 |
| `update()` | 更新 |
| `render(ctx)` | 渲染 |

### 3. 游戏主逻辑更新 (game.js)

#### 初始化

```javascript
init() {
  this.initWechat()
  this.initAudio()
  this.initFood()  // 新增
  this.initUI()
  // ...
}

initFood() {
  this.foodManager = new FoodManager()
  this.foodDisplay = new FoodDisplay(this.foodManager)
}
```

#### 关卡消耗检查

```javascript
async loadLevel(levelNum) {
  const levelData = await this.levelManager.loadLevel(levelNum)
  
  // 检查并消耗食物
  const cost = this.foodManager.getLevelCost(difficulty)
  
  if (cost > 0 && !this.foodManager.hasEnoughFood(cost)) {
    // 提示食物不足
    wx.showModal({
      title: '食物不足',
      content: `需要 ${cost}🐟 才能开始关卡`,
      // ...
    })
    return
  }
  
  // 消耗食物
  this.foodManager.consumeFood(cost)
  
  // 继续加载关卡...
}
```

#### 通关奖励

```javascript
onWin() {
  // ... 其他逻辑
  
  // 计算并发放食物奖励
  const rewards = this.foodManager.calculateRewards(level, moves, par, time)
  this.foodManager.giveRewards(rewards)
  
  // 显示奖励动画
  this.foodDisplay.showRewardAnimation(rewards)
  
  // 更新结算界面
  this.resultScene.setRewards(rewards)
}
```

### 4. 结算界面更新 (result-scene.js)

#### 新增方法

| 方法 | 说明 |
|------|------|
| `setRewards(rewards)` | 设置奖励数据 |
| `renderRewards(ctx)` | 渲染奖励信息 |

#### 奖励显示

```
通关成功！
   ★★★
关卡 1
步数: 3 / 标准: 3
用时: 00:15

获得奖励
🐟 × 3
🦐 × 1
```

## 数据流

### 食物消耗流程

```
用户选择关卡
    ↓
检查食物是否足够
    ↓
┌─ 是 → 消耗食物 → 开始关卡
└─ 否 → 提示不足 → 显示广告选项
```

### 食物获取流程

```
用户通关
    ↓
计算星级
    ↓
计算基础奖励
    ↓
计算连续通关奖励
    ↓
计算时间奖励
    ↓
发放奖励
    ↓
显示奖励动画
```

### 自然恢复流程

```
游戏启动/关卡结束
    ↓
检查上次恢复时间
    ↓
计算经过时间
    ↓
计算可恢复次数
    ↓
恢复食物
    ↓
更新恢复时间
```

## 数据存储

### playerFood（食物数据）

```javascript
{
  fish: 10,      // 鱼数量
  shrimp: 2,     // 虾数量
  squid: 1,      // 鱿鱼数量
  goldfish: 0    // 金鱼数量
}
```

### lastRecoveryTime（恢复时间）

```javascript
1792482298000  // 时间戳
```

## 当前状态

- [x] 食物管理器
- [x] 食物消耗逻辑
- [x] 食物获取逻辑
- [x] 自然恢复机制
- [x] 食物显示UI
- [x] 奖励动画
- [x] 结算界面奖励显示
- [ ] 道具商店（未来增强）
- [x] 看广告获取食物 - 第九阶段实现

## 项目完成总结

### 十个阶段全部完成

| 阶段 | 功能 | 状态 |
|------|------|------|
| 第一阶段 | 核心玩法原型 | ✅ |
| 第二阶段 | UI系统 | ✅ |
| 第三阶段 | 障碍物系统 | ✅ |
| 第四阶段 | 音效系统 | ✅ |
| 第五阶段 | 微信功能集成 | ✅ |
| 第六阶段 | 登录与排行榜UI | ✅ |
| 第七阶段 | 食物/体力系统 | ✅ |
| 第八阶段 | 成就与分享系统 | ✅ |
| 第九阶段 | 复活机制 | ✅ |
| 第十阶段 | 游戏结束与结算 | ✅ |

### 完整功能列表

- ✅ 企鹅冰面滑行物理
- ✅ 冰块推动机制
- ✅ 7个精心设计的关卡
- ✅ 完整UI系统
- ✅ 三种障碍物
- ✅ 音效系统
- ✅ 星级评价系统
- ✅ 进度保存
- ✅ 微信登录
- ✅ 分享功能
- ✅ 好友排行榜
- ✅ 广告系统框架
- ✅ 个人中心界面
- ✅ 分数自动上报
- ✅ 食物/体力系统
- ✅ 通关奖励系统
- ✅ 自然恢复机制
- ✅ 成就系统（20+成就）
- ✅ 复活机制（4种方式）
- ✅ 游戏结束界面
- ✅ 完整统计追踪
