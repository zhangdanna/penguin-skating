# 音频资源目录

本目录存放游戏所需的所有音频文件。

## 快速生成音效

打开 `generate-audio.html` 文件，点击按钮即可生成并下载所有音效文件。

生成的音效为简单的合成音效，可直接用于游戏测试。

## 需要的音频文件

| 文件名 | 类型 | 时长建议 | 说明 |
|--------|------|----------|------|
| bgm.mp3 | 背景音乐 | 60-120秒 | 轻松愉快的循环音乐 |
| slide.mp3 | 音效 | 0.5-1秒 | 冰面滑动声 |
| push.mp3 | 音效 | 0.3-0.5秒 | 冰块推动声 |
| collision.mp3 | 音效 | 0.2-0.3秒 | 碰撞声 |
| win.mp3 | 音效 | 2-3秒 | 欢快通关音乐 |
| fail.mp3 | 音效 | 1-2秒 | 低沉失败音效 |
| button.mp3 | 音效 | 0.1-0.2秒 | 清脆点击声 |
| star.mp3 | 音效 | 0.3-0.5秒 | 星星获得音效 |

## 免费音频资源网站

### 音效
- **Freesound.org** - https://freesound.org/
  - 搜索关键词：ice slide, push, collision, success, fail
  - 注意查看许可证（选择 Creative Commons 0 的音效）

- **Zapsplat.com** - https://www.zapsplat.com/
  - 免费音效库，分类清晰
  - 游戏音效分类：Game Sounds

- **Mixkit.co** - https://mixkit.co/free-sound-effects/
  - 完全免费，无需注册
  - 高质量音效

- **Pixabay** - https://pixabay.com/sound-effects/
  - 免费商用
  - 搜索：game, success, fail, click

### 背景音乐
- **Pixabay Music** - https://pixabay.com/music/
  - 免费背景音乐
  - 搜索：happy, cute, game, loop

- **Free Music Archive** - https://freemusicarchive.org/
  - 免费音乐库
  - 注意许可证类型

- **Incompetech** - https://incompetech.com/music/
  - Kevin MacLeod 的免费音乐
  - 需要署名

## 推荐搜索关键词

### 背景音乐
- "happy game music"
- "cute loop"
- "penguin theme"
- "winter game"
- "ice skating music"

### 音效
- **滑动**: "ice slide", "glide", "slip"
- **推动**: "push", "move ice block", "heavy push"
- **碰撞**: "hit", "impact", "thud", "knock"
- **通关**: "success", "victory", "level complete", "achievement"
- **失败**: "fail", "error", "wrong", "game over"
- **按钮**: "click", "button", "tap", "ui click"
- **星星**: "star", "coin", "collect", "reward"

## 音频格式要求

- **格式**: MP3
- **比特率**: 128kbps 即可
- **采样率**: 44100Hz
- **声道**: 单声道（音效）或立体声（BGM）

## 音频编辑工具

如需剪辑或转换音频格式，可使用：

- **Audacity** (免费开源) - https://www.audacityteam.org/
- **Online Audio Converter** - https://online-audio-converter.com/
- **FFmpeg** (命令行工具)

## 快速开始

1. 从上述网站下载音频文件
2. 重命名为对应的文件名
3. 放入本目录
4. 在游戏中测试播放

## 注意事项

- 确保使用的音频符合许可证要求
- 商用项目建议使用 CC0 或自有版权音频
- 音效文件尽量小，避免包体过大
- 背景音乐可以循环播放，选择适合循环的曲目
