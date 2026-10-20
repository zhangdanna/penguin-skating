# 企鹅滑冰 - 第三阶段：障碍物系统

## 阶段目标

实现三种障碍物类型，丰富游戏玩法：
- 冰墙（Wall）：不可通过的障碍物
- 冰窟窿（Hole）：掉入会导致游戏失败
- 雪堆（Snow）：减速区域

## 新增文件

```
penguin-skating-game/
├── js/
│   └── runtime/
│       └── obstacle.js          # 障碍物系统（基类+工厂+三种障碍物）
└── levels/
    ├── level4.json              # 冰墙迷宫
    ├── level5.json              # 危险冰窟
    ├── level6.json              # 雪地减速
    └── level7.json              # 综合挑战
```

## 更新文件

| 文件 | 变更 |
|------|------|
| `game.js` | 添加障碍物数组、碰撞检测、渲染、失败处理 |
| `js/levels/level-manager.js` | 添加4-7关内置关卡数据，maxLevel更新为7 |

## 模块说明

### 1. 障碍物系统 (obstacle.js)

#### 障碍物基类 (Obstacle)

**属性**：
| 属性 | 类型 | 说明 |
|------|------|------|
| `type` | string | 障碍物类型 |
| `x`, `y` | number | 位置坐标 |
| `width`, `height` | number | 尺寸 |
| `visible` | boolean | 是否可见 |

**方法**：
| 方法 | 说明 |
|------|------|
| `onPenguinCollide(penguin)` | 企鹅碰撞处理，返回处理结果 |
| `onStoneCollide(stone)` | 石头碰撞处理，返回处理结果 |
| `update()` | 更新状态 |
| `render(ctx)` | 渲染障碍物 |

#### 障碍物工厂 (ObstacleFactory)

**静态方法**：
| 方法 | 说明 |
|------|------|
| `create(config)` | 根据配置创建障碍物实例 |
| `createFromLevelData(data)` | 从关卡数据批量创建障碍物 |

#### 冰墙 (IceWall)

**特性**：
- 不可通过
- 企鹅碰到会停止
- 石头碰到会停止
- 蓝色半透明外观，带冰晶纹理

**碰撞结果**：
```javascript
// 企鹅碰撞
{ action: 'stop', vx: 0, vy: 0 }

// 石头碰撞
{ action: 'stop', vx: 0, vy: 0 }
```

**视觉表现**：
- 蓝色半透明主体
- 对角线冰晶纹理
- 白色高光效果
- 深色边框

#### 冰窟窿 (IceHole)

**特性**：
- 企鹅掉入会导致游戏失败
- 石头掉入会消失
- 红色脉冲警示效果
- 黑色窟窿外观

**碰撞结果**：
```javascript
// 企鹅碰撞
{ action: 'fail', reason: '掉入冰窟窿' }

// 石头碰撞
{ action: 'destroy' }
```

**视觉表现**：
- 黑色圆形窟窿
- 径向渐变效果
- 红色脉冲警示光环
- 周围裂纹效果

**动画**：
- `warningPulse`：警示脉冲相位
- `warningSpeed`：脉冲速度（0.05）

#### 雪堆 (SnowPile)

**特性**：
- 企鹅经过会减速50%
- 石头会卡住停止
- 白色蓬松外观

**碰撞结果**：
```javascript
// 企鹅碰撞
{ action: 'slow', friction: 0.95, speedMultiplier: 0.5 }

// 石头碰撞
{ action: 'stuck', vx: 0, vy: 0 }
```

**视觉表现**：
- 多个白色圆形组合
- 雪花点缀
- 高光效果
- 底部阴影

### 2. 关卡数据格式

新增 `obstacles` 字段：

```json
{
  "id": 4,
  "name": "冰墙迷宫",
  "penguin": { "x": 50, "y": 50 },
  "stones": [{ "x": 200, "y": 150, "size": 40 }],
  "target": { "x": 300, "y": 400, "width": 50, "height": 50 },
  "obstacles": [
    { "type": "wall", "x": 100, "y": 100, "size": 50 },
    { "type": "hole", "x": 200, "y": 250, "size": 50 },
    { "type": "snow", "x": 150, "y": 300, "size": 50 }
  ],
  "par": 5
}
```

### 3. 碰撞处理流程

```
游戏更新
  ↓
更新障碍物状态
  ↓
检测企鹅与障碍物碰撞
  ↓
调用 obstacle.onPenguinCollide()
  ↓
根据 action 处理：
  ├─ stop: 企鹅停止，分离对象
  ├─ fail: 游戏失败
  └─ slow: 企鹅减速
  ↓
检测石头与障碍物碰撞
  ↓
调用 obstacle.onStoneCollide()
  ↓
根据 action 处理：
  ├─ stop: 石头停止，分离对象
  ├─ destroy: 移除石头
  └─ stuck: 石头停止
```

## 新增关卡

| 关卡 | 名称 | 障碍物类型 | 难度 |
|------|------|-----------|------|
| 4 | 冰墙迷宫 | 冰墙×6 | ⭐⭐ |
| 5 | 危险冰窟 | 冰窟窿×3 | ⭐⭐⭐ |
| 6 | 雪地减速 | 雪堆×5 | ⭐⭐ |
| 7 | 综合挑战 | 冰墙×2 + 冰窟窿×2 + 雪堆×2 | ⭐⭐⭐⭐ |

## 游戏状态扩展

新增 `fail` 状态：

| 状态 | 说明 |
|------|------|
| `menu` | 主菜单 |
| `levelSelect` | 关卡选择 |
| `playing` | 游戏中 |
| `paused` | 暂停 |
| `win` | 通关 |
| `fail` | 失败（新增） |

## 失败处理

```javascript
onFail(reason) {
  console.log(`游戏失败: ${reason}`)
  wx.vibrateShort({ type: 'heavy' })

  // 2秒后重新开始
  setTimeout(() => {
    this.restartLevel()
  }, 2000)
}
```

## 渲染顺序

```
1. 背景
2. 目标区域
3. 障碍物（新增）
4. 石头
5. 企鹅
6. HUD
7. 失败提示（新增）
```

## 当前状态

- [x] 障碍物基类
- [x] 障碍物工厂
- [x] 冰墙实现
- [x] 冰窟窿实现
- [x] 雪堆实现
- [x] 碰撞检测集成
- [x] 关卡数据更新
- [x] 4个新关卡
- [x] 失败状态处理
- [x] 障碍物渲染

## 下一阶段计划

### 第四阶段：音效系统
- [ ] 背景音乐
- [ ] 滑动音效
- [ ] 碰撞音效
- [ ] 通关音效
- [ ] 失败音效

### 待实现功能
- [ ] 微信登录
- [ ] 广告接入
- [ ] 排行榜
- [ ] 食物/体力系统
- [ ] 道具商店
- [ ] 更多关卡
