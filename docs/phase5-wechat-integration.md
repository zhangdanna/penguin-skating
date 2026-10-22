# 企鹅滑冰 - 第五阶段：微信功能集成

## 阶段目标

实现微信小游戏原生功能：
- 微信登录与用户信息
- 好友排行榜（开放数据域）
- 分享功能
- 广告接入（激励视频、Banner、插屏）

## 新增文件

```
penguin-skating-game/
├── js/
│   └── utils/
│       ├── wechat-service.js     # 微信服务管理器
│       └── ad-manager.js         # 广告管理器
└── open-data/                    # 开放数据域（排行榜）
    ├── index.js                  # 排行榜渲染逻辑
    └── index.html                # 开放数据域入口
```

## 更新文件

| 文件 | 变更 |
|------|------|
| `game.json` | 添加 `openDataContext` 配置 |

## 模块说明

### 1. 微信服务管理器 (wechat-service.js)

#### 核心功能

| 功能 | 说明 |
|------|------|
| 微信登录 | `wx.login` 获取code |
| 用户信息 | `wx.getUserInfo` / `wx.getUserProfile` |
| 分享功能 | 监听分享、主动分享 |
| 分数上报 | `wx.setUserCloudStorage` |
| 好友排行 | `wx.getFriendCloudStorage` |
| UI交互 | 模态框、提示、加载 |

#### 主要方法

**登录相关**：
| 方法 | 说明 |
|------|------|
| `login()` | 微信登录，返回Promise |
| `getUserInfo()` | 获取用户信息 |
| `getUserProfile()` | 新版API获取用户信息 |
| `checkLoginStatus()` | 检查登录状态 |

**分享相关**：
| 方法 | 说明 |
|------|------|
| `initShare()` | 初始化分享功能 |
| `share()` | 主动分享 |
| `getShareConfig()` | 获取分享配置 |
| `getTimelineShareConfig()` | 获取朋友圈分享配置 |

**排行榜相关**：
| 方法 | 说明 |
|------|------|
| `reportScore(level, moves, stars)` | 上报分数 |
| `getFriendRank()` | 获取好友排行 |

**UI交互**：
| 方法 | 说明 |
|------|------|
| `showModal(options)` | 显示模态对话框 |
| `showToast(title)` | 显示提示 |
| `showLoading(title)` | 显示加载 |
| `hideLoading()` | 隐藏加载 |
| `exitMiniProgram()` | 退出小程序 |

#### 数据存储

```javascript
// userInfo（用户信息）
{
  nickName: '用户昵称',
  avatarUrl: '头像URL',
  gender: 1
}

// openId（用户标识）
'xxx-xxx-xxx'
```

### 2. 广告管理器 (ad-manager.js)

#### 广告类型

| 类型 | 说明 | 使用场景 |
|------|------|----------|
| 激励视频 | 用户主动观看，获得奖励 | 复活、获取道具 |
| Banner | 底部横幅广告 | 游戏界面底部 |
| 插屏 | 弹窗广告 | 关卡切换时 |

#### 主要方法

| 方法 | 说明 |
|------|------|
| `init()` | 初始化所有广告 |
| `showRewardedVideoAd(callback)` | 显示激励视频，callback返回是否完整观看 |
| `showBannerAd()` | 显示Banner广告 |
| `hideBannerAd()` | 隐藏Banner广告 |
| `showInterstitialAd()` | 显示插屏广告 |
| `isRewardedVideoAvailable()` | 检查激励视频是否可用 |
| `destroy()` | 销毁广告实例 |

#### 广告配置

```javascript
const adUnitIds = {
  rewardedVideo: 'adunit-xxx',  // 激励视频广告单元ID
  banner: 'adunit-yyy',          // Banner广告单元ID
  interstitial: 'adunit-zzz'     // 插屏广告单元ID
}
```

**注意**：需要在微信小游戏管理后台创建广告单元，并替换上述ID。

### 3. 开放数据域 (open-data/)

#### 概述

开放数据域是微信提供的独立运行环境，用于访问好友关系链数据。主域与开放数据域通过 `postMessage` 通信。

#### 通信协议

**主域 → 开放数据域**：
```javascript
// 显示排行榜
wx.postMessage({ type: 'SHOW_RANK' })

// 隐藏排行榜
wx.postMessage({ type: 'HIDE_RANK' })

// 翻页
wx.postMessage({ type: 'NEXT_PAGE' })
wx.postMessage({ type: 'PREV_PAGE' })
```

**开放数据域接收**：
```javascript
wx.onMessage((data) => {
  switch (data.type) {
    case 'SHOW_RANK':
      loadRankData()
      break
    // ...
  }
})
```

#### 排行榜渲染

- 背景：深蓝色渐变
- 排名：前三名金银铜色
- 信息：昵称、关卡、星星、分数
- 分页：每页10条

#### 分数计算公式

```javascript
score = stars * 1000 - moves * 10
```

## 配置说明

### game.json

```json
{
  "deviceOrientation": "portrait",
  "showStatusBar": false,
  "openDataContext": "open-data"
}
```

## 使用示例

### 登录

```javascript
// 初始化
const wechatService = new WechatService()
wechatService.init()

// 登录
wechatService.login().then(result => {
  if (result.success) {
    console.log('登录成功', result.userInfo)
  }
})
```

### 分享

```javascript
// 主动分享
wechatService.share()

// 自动监听分享（已自动初始化）
```

### 上报分数

```javascript
// 通关后上报
wechatService.reportScore(level, moves, stars)
```

### 显示排行榜

```javascript
// 在主域中显示开放数据域canvas
const openDataContext = wx.getOpenDataContext()
const sharedCanvas = openDataContext.canvas

// 通知开放数据域显示排行榜
openDataContext.postMessage({ type: 'SHOW_RANK' })

// 渲染sharedCanvas到主canvas
ctx.drawImage(sharedCanvas, 0, 0)
```

### 广告

```javascript
// 初始化
const adManager = new AdManager()
adManager.init()

// 显示激励视频
adManager.showRewardedVideoAd((success) => {
  if (success) {
    // 用户完整观看，给予奖励
    console.log('获得奖励')
  } else {
    // 用户中途退出
    console.log('未获得奖励')
  }
})

// 显示/隐藏Banner
adManager.showBannerAd()
adManager.hideBannerAd()
```

## 广告单元申请

1. 登录 [微信小游戏管理后台](https://mp.weixin.qq.com/)
2. 进入"流量主" → "广告单元管理"
3. 创建广告单元：
   - 激励视频广告
   - Banner广告
   - 插屏广告
4. 获取广告单元ID，替换代码中的占位符

## 当前状态

- [x] 微信登录
- [x] 用户信息获取
- [x] 分享功能
- [x] 分数上报
- [x] 好友排行榜（开放数据域）
- [x] 激励视频广告
- [x] Banner广告
- [x] 插屏广告
- [ ] 广告单元ID配置（需手动）
- [ ] 排行榜UI集成到游戏

## 项目完成总结

### 已实现功能

| 阶段 | 功能 | 状态 |
|------|------|------|
| 第一阶段 | 核心玩法原型 | ✅ |
| 第二阶段 | UI系统 | ✅ |
| 第三阶段 | 障碍物系统 | ✅ |
| 第四阶段 | 音效系统 | ✅ |
| 第五阶段 | 微信功能集成 | ✅ |

### 完整功能列表

- ✅ 企鹅冰面滑行物理
- ✅ 冰块推动机制
- ✅ 7个精心设计的关卡
- ✅ 完整UI系统（菜单、关卡选择、暂停、结算）
- ✅ 三种障碍物（冰墙、冰窟窿、雪堆）
- ✅ 音效系统（BGM、滑动、碰撞、通关、失败）
- ✅ 星级评价系统
- ✅ 进度保存
- ✅ 微信登录
- ✅ 分享功能
- ✅ 好友排行榜
- ✅ 广告系统

### 待完善功能

- ⏳ 更多关卡（可扩展至100+）
- ⏳ 食物/体力系统
- ⏳ 道具商店
- ⏳ 每日挑战
- ⏳ 成就系统
- ⏳ 设置界面
- ⏳ 音频资源文件

### 发布前检查清单

- [ ] 替换广告单元ID
- [ ] 添加音频资源文件
- [ ] 添加分享图片
- [ ] 测试所有功能
- [ ] 性能优化
- [ ] 提交审核
