# 第十阶段：游戏结束与结算系统

## 概述

本阶段实现了完整的游戏结束与结算系统，包括游戏失败时的结束界面、结算数据管理、统计信息追踪等功能，为玩家提供更好的反馈和数据追踪。

## 新增模块

### 1. 游戏结束场景 (js/ui/gameover-scene.js)

**功能描述：**
当玩家游戏失败且无法复活时显示的游戏结束界面。

**核心特性：**
- 倒下的企鹅动画效果（带旋转和眼泪）
- 三个操作按钮：
  - 重新挑战：重新开始当前关卡
  - 看广告复活：通过观看广告获得复活机会（如果还有次数）
  - 返回菜单：回到主菜单
- 半透明遮罩效果
- 完整的触摸事件处理

**关键方法：**
```javascript
show()                    // 显示游戏结束界面
hide()                    // 隐藏界面
update()                  // 更新动画（企鹅摇摆、眼泪下落）
render(ctx)               // 渲染界面
onTouchStart(touch)       // 处理按钮点击
```

**视觉元素：**
- 倒下企鹅：旋转90度的企鹅身体，带伤心表情
- 眼泪动画：从眼睛下落的蓝色水滴，带重力效果
- 按钮布局：垂直排列的三个操作按钮

### 2. 结算数据管理器 (js/utils/settlement-manager.js)

**功能描述：**
管理关卡结算数据和玩家统计信息，提供数据持久化。

**核心功能：**

#### 当前关卡数据追踪
```javascript
startLevel(level, difficulty)  // 开始关卡，记录初始状态
recordMove()                   // 记录一次移动
recordRevive()                 // 记录一次复活
completeLevel(moves, time, par) // 完成关卡，计算星级
failLevel()                    // 关卡失败
```

#### 累计统计追踪
- 总游戏次数 (totalGames)
- 通关次数 (totalWins)
- 总步数 (totalMoves)
- 总用时 (totalTime)
- 总星星数 (totalStars)
- 完美通关次数 (perfectGames)
- 最长连胜 (maxStreak)

#### 最佳记录追踪
- 各关卡最快时间 (bestTimes)
- 各关卡最少步数 (bestMoves)

**星级计算规则：**
```javascript
if (moves <= par) return 3           // 完美通关
if (moves <= par * 1.5) return 2     // 良好通关
return 1                              // 普通通关
```

**数据持久化：**
- 使用 `wx.setStorageSync` 保存到本地
- 存储键名：`settlementData`
- 自动保存和加载

### 3. 主逻辑集成 (game.js)

**新增方法：**

#### 初始化
```javascript
initSettlement() {
  this.settlementManager = new SettlementManager()
  this.gameOverScene = new GameOverScene()
  this.gameOverScene.onRestart = () => this.onGameOverRestart()
  this.gameOverScene.onBackToMenu = () => this.onGameOverBackToMenu()
  this.gameOverScene.onWatchAd = () => this.onGameOverWatchAd()
}
```

#### 游戏结束回调
```javascript
onGameOverRestart()      // 重新开始关卡
onGameOverBackToMenu()   // 返回主菜单
onGameOverWatchAd()      // 观看广告复活
```

**集成点：**

1. **关卡加载** (`loadLevel`)
   ```javascript
   this.settlementManager.startLevel(levelNum, difficulty)
   ```

2. **步数记录** (`touchEndHandler`)
   ```javascript
   this.settlementManager.recordMove()
   ```

3. **关卡完成** (`onWin`)
   ```javascript
   this.settlementManager.completeLevel(moves, time, par)
   ```

4. **关卡失败** (`onFail`)
   ```javascript
   this.settlementManager.failLevel()
   this.gameOverScene.show()
   ```

5. **渲染循环** (`render`)
   ```javascript
   if (this.gameOverScene && this.gameOverScene.isVisible) {
     this.gameOverScene.render(this.ctx)
   }
   ```

6. **触摸事件** (所有touch handlers)
   - 优先处理游戏结束场景的触摸事件
   - 在处理其他场景之前检查gameOverScene

## 游戏流程

### 失败流程
```
企鹅掉入冰窟窿
  ↓
检查是否可复活
  ├─ 可复活 → 显示复活选择界面
  └─ 不可复活 → 显示游戏结束界面
       ↓
    玩家选择
       ├─ 重新挑战 → restartLevel()
       ├─ 看广告 → reviveByWatchAd() → onReviveSuccess()
       └─ 返回菜单 → sceneManager.switchTo('menu')
```

### 胜利流程
```
所有冰块到达目标
  ↓
settlementManager.completeLevel()
  ↓
计算星级和奖励
  ↓
保存进度和统计
  ↓
显示结算界面
```

## 数据结构

### 结算数据
```javascript
{
  totalGames: 0,        // 总游戏次数
  totalWins: 0,         // 通关次数
  totalMoves: 0,        // 总步数
  totalTime: 0,         // 总用时（秒）
  totalStars: 0,        // 总星星数
  perfectGames: 0,      // 完美通关次数
  maxStreak: 0,         // 最长连胜
  bestTimes: {},        // 各关卡最佳时间
  bestMoves: {}         // 各关卡最佳步数
}
```

### 当前关卡数据
```javascript
{
  level: 1,             // 关卡编号
  difficulty: 'easy',   // 难度
  moves: 0,             // 当前步数
  revives: 0,           // 复活次数
  startTime: 0,         // 开始时间
  isCompleted: false,   // 是否完成
  isFailed: false       // 是否失败
}
```

## 界面交互

### 游戏结束界面
- **触发条件**：游戏失败且无法复活
- **显示内容**：
  - 半透明黑色遮罩
  - 倒下的企鹅动画
  - "游戏结束"文字
  - 三个操作按钮
- **隐藏条件**：玩家点击任意按钮后

### 按钮功能
1. **重新挑战**
   - 隐藏游戏结束界面
   - 调用 `restartLevel()`
   - 重新开始当前关卡

2. **看广告复活**
   - 检查广告次数
   - 如果可用，执行复活逻辑
   - 恢复企鹅和冰块位置
   - 增加步数惩罚

3. **返回菜单**
   - 隐藏游戏结束界面
   - 切换到主菜单场景

## 音效与反馈

### 游戏失败
- 振动反馈：`wx.vibrateShort({ type: 'heavy' })`
- 失败音效：`audioManager.playFailSound()`

### 复活成功
- 提示：`wx.showToast({ title: '复活成功！', icon: 'success' })`

## 与之前阶段的集成

### 与复活系统（Phase 9）的关系
- 游戏失败时先检查是否可复活
- 如果可复活，显示复活选择界面
- 如果不可复活，显示游戏结束界面
- 游戏结束界面仍提供"看广告复活"选项（如果还有次数）

### 与食物系统（Phase 7）的关系
- 结算管理器追踪食物消耗
- 关卡开始时消耗食物
- 通关时发放食物奖励

### 与成就系统（Phase 8）的关系
- 结算数据用于成就判定
- 通关次数、星星数等触发成就

## 性能优化

1. **按需渲染**：只在 `isVisible` 为 true 时渲染游戏结束界面
2. **数据缓存**：结算数据在内存中缓存，定期持久化
3. **动画优化**：使用简单的三角函数计算动画，避免复杂物理

## 扩展建议

1. **分享功能**
   - 添加"分享续命"按钮
   - 分享到好友或群可获得额外奖励

2. **统计展示**
   - 在个人中心显示详细统计
   - 添加图表展示游戏历史

3. **成就联动**
   - 基于结算数据解锁更多成就
   - 如"累计移动1000步"、"完美通关10次"等

4. **排行榜集成**
   - 将最佳成绩上报到排行榜
   - 显示好友排名

## 测试要点

1. **游戏失败流程**
   - 验证无法复活时正确显示游戏结束界面
   - 验证三个按钮功能正常

2. **数据追踪**
   - 验证步数、时间、星星数正确记录
   - 验证数据持久化正常

3. **复活逻辑**
   - 验证看广告复活后正确恢复游戏状态
   - 验证步数惩罚正确应用

4. **界面渲染**
   - 验证动画流畅
   - 验证触摸事件正确响应

## 总结

第十阶段完成了游戏结束与结算系统，提供了：
- 完整的游戏失败处理流程
- 详细的统计数据追踪
- 友好的游戏结束界面
- 灵活的复活机制

至此，游戏已具备完整的核心功能，包括：
- 冰面滑行物理
- 推箱子玩法
- 关卡系统
- 障碍物系统
- 食物/体力系统
- 成就系统
- 复活机制
- 游戏结束与结算

可以进入后续的优化和发布阶段。
