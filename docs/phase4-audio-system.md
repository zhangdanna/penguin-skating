# 企鹅滑冰 - 第四阶段：音效系统

## 阶段目标

实现完整的音效系统，包括：
- 背景音乐（BGM）
- 滑动音效
- 推动/碰撞音效
- 通关/失败音效
- 音效设置管理

## 新增文件

```
penguin-skating-game/
├── js/
│   └── utils/
│       └── audio-manager.js      # 音效管理器
└── audio/                        # 音频资源目录（需手动添加）
    ├── bgm.mp3                   # 背景音乐
    ├── slide.mp3                 # 滑动音效
    ├── push.mp3                  # 推动音效
    ├── collision.mp3             # 碰撞音效
    ├── win.mp3                   # 通关音效
    ├── fail.mp3                  # 失败音效
    ├── button.mp3                # 按钮点击音效
    └── star.mp3                  # 星星音效
```

## 更新文件

| 文件 | 变更 |
|------|------|
| `game.js` | 集成音效管理器，添加音效触发 |

## 模块说明

### 音效管理器 (audio-manager.js)

#### 核心功能

| 功能 | 说明 |
|------|------|
| 背景音乐 | 循环播放，可暂停/停止 |
| 音效播放 | 短音效，支持快速连续播放 |
| 音量控制 | 独立控制音效/音乐音量 |
| 开关控制 | 可单独开关音效/音乐 |
| 设置保存 | 自动保存用户设置 |

#### 属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `soundEnabled` | boolean | true | 音效开关 |
| `musicEnabled` | boolean | true | 音乐开关 |
| `soundVolume` | number | 1.0 | 音效音量（0-1） |
| `musicVolume` | number | 0.5 | 音乐音量（0-1） |

#### 方法

**播放控制**：
| 方法 | 说明 |
|------|------|
| `playBGM()` | 播放背景音乐 |
| `pauseBGM()` | 暂停背景音乐 |
| `stopBGM()` | 停止背景音乐 |
| `playSound(name)` | 播放指定音效 |

**快捷音效方法**：
| 方法 | 说明 |
|------|------|
| `playSlideSound()` | 播放滑动音效 |
| `playPushSound()` | 播放推动音效 |
| `playCollisionSound()` | 播放碰撞音效 |
| `playWinSound()` | 播放通关音效 |
| `playFailSound()` | 播放失败音效 |
| `playButtonSound()` | 播放按钮点击音效 |
| `playStarSound()` | 播放星星音效 |

**设置控制**：
| 方法 | 说明 |
|------|------|
| `setSoundEnabled(enabled)` | 设置音效开关 |
| `setMusicEnabled(enabled)` | 设置音乐开关 |
| `setSoundVolume(volume)` | 设置音效音量 |
| `setMusicVolume(volume)` | 设置音乐音量 |
| `getSettings()` | 获取当前设置 |
| `saveSettings()` | 保存设置 |
| `loadSettings()` | 加载设置 |

**生命周期**：
| 方法 | 说明 |
|------|------|
| `init()` | 初始化 |
| `preloadSounds()` | 预加载音效 |
| `destroy()` | 销毁，释放资源 |

#### 音效文件配置

```javascript
const audioFiles = {
  bgm: 'audio/bgm.mp3',        // 背景音乐
  slide: 'audio/slide.mp3',    // 滑动
  push: 'audio/push.mp3',      // 推动
  collision: 'audio/collision.mp3',  // 碰撞
  win: 'audio/win.mp3',        // 通关
  fail: 'audio/fail.mp3',      // 失败
  button: 'audio/button.mp3',  // 按钮
  star: 'audio/star.mp3'       // 星星
}
```

## 音效触发时机

| 事件 | 音效 | 触发位置 |
|------|------|----------|
| 游戏启动 | BGM | `init()` |
| 企鹅滑动 | slide | `touchEndHandler()` |
| 企鹅推动石头 | push | `checkCollisions()` |
| 石头碰撞 | collision | `checkCollisions()` |
| 通关 | win | `onWin()` |
| 失败 | fail | `onFail()` |

## 数据存储

### audioSettings（音效设置）

```javascript
{
  soundEnabled: true,      // 音效开关
  musicEnabled: true,      // 音乐开关
  soundVolume: 1.0,        // 音效音量
  musicVolume: 0.5         // 音乐音量
}
```

## 音频资源准备

### 音效规格建议

| 音效 | 时长 | 格式 | 说明 |
|------|------|------|------|
| bgm | 60-120秒 | MP3 | 循环播放，轻松愉快 |
| slide | 0.5-1秒 | MP3 | 冰面滑动声 |
| push | 0.3-0.5秒 | MP3 | 石头推动声 |
| collision | 0.2-0.3秒 | MP3 | 碰撞声 |
| win | 2-3秒 | MP3 | 欢快通关音乐 |
| fail | 1-2秒 | MP3 | 低沉失败音效 |
| button | 0.1-0.2秒 | MP3 | 清脆点击声 |
| star | 0.3-0.5秒 | MP3 | 星星获得音效 |

### 推荐音效来源

- **免费音效网站**：
  - Freesound.org
  - Zapsplat.com
  - Mixkit.co
  - Pixabay.com/music

- **关键词建议**：
  - BGM: "happy", "cute", "game", "loop"
  - Slide: "ice", "slide", "glide"
  - Push: "push", "move", "stone"
  - Collision: "hit", "impact", "thud"
  - Win: "success", "victory", "complete"
  - Fail: "fail", "error", "wrong"

## 集成到游戏

### 初始化

```javascript
// game.js
init() {
  this.initAudio()
  // ...
  this.audioManager.playBGM()
}

initAudio() {
  this.audioManager = new AudioManager()
}
```

### 触发音效

```javascript
// 滑动时
this.audioManager.playSlideSound()

// 推动石头时
this.audioManager.playPushSound()

// 碰撞时
this.audioManager.playCollisionSound()

// 通关时
this.audioManager.playWinSound()

// 失败时
this.audioManager.playFailSound()
```

## 设置界面（待实现）

可在设置界面中添加：

```javascript
// 音效开关
<Switch 
  checked={soundEnabled} 
  onChange={(e) => audioManager.setSoundEnabled(e.detail.value)} 
/>

// 音乐开关
<Switch 
  checked={musicEnabled} 
  onChange={(e) => audioManager.setMusicEnabled(e.detail.value)} 
/>

// 音量滑块
<Slider 
  value={soundVolume * 100} 
  onChange={(e) => audioManager.setSoundVolume(e.detail.value / 100)} 
/>
```

## 当前状态

- [x] 音效管理器
- [x] 背景音乐播放
- [x] 滑动音效
- [x] 推动音效
- [x] 碰撞音效
- [x] 通关音效
- [x] 失败音效
- [x] 音效设置管理
- [x] 集成到游戏逻辑
- [ ] 音频资源文件（需手动添加）
- [ ] 设置界面UI

## 下一阶段计划

### 第五阶段：微信功能集成
- [ ] 微信登录
- [ ] 用户信息获取
- [ ] 排行榜（开放数据域）
- [ ] 分享功能
- [ ] 广告接入

### 待实现功能
- [ ] 食物/体力系统
- [ ] 道具商店
- [ ] 更多关卡
- [ ] 每日挑战
- [ ] 成就系统
