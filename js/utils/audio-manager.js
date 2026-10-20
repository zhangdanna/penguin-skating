/**
 * 音效管理器
 * 管理游戏中的所有音效和音乐
 */
export default class AudioManager {
  constructor() {
    // 音效开关状态
    this.soundEnabled = true
    this.musicEnabled = true

    // 音量设置
    this.soundVolume = 1.0
    this.musicVolume = 0.5

    // 音频实例
    this.bgm = null
    this.sounds = {}

    // 音效文件路径（支持 mp3 和 wav 格式）
    this.audioFiles = {
      bgm: 'audio/bgm.mp3',
      slide: 'audio/slide.wav',
      push: 'audio/push.wav',
      collision: 'audio/collision.wav',
      win: 'audio/win.wav',
      fail: 'audio/fail.wav',
      button: 'audio/button.wav',
      star: 'audio/star.wav'
    }

    // 初始化
    this.init()
  }

  /**
   * 初始化音频管理器
   */
  init() {
    // 加载设置
    this.loadSettings()

    // 预加载音效
    this.preloadSounds()
  }

  /**
   * 预加载音效
   */
  preloadSounds() {
    Object.keys(this.audioFiles).forEach(key => {
      try {
        if (key === 'bgm') {
          // 背景音乐单独处理
          this.bgm = wx.createInnerAudioContext()
          this.bgm.src = this.audioFiles.bgm
          this.bgm.loop = true
          this.bgm.volume = this.musicVolume

          this.bgm.onError((err) => {
            console.warn(`背景音乐加载失败: ${this.audioFiles.bgm}`, err)
            this.bgm = null
          })
        } else {
          // 音效
          const audio = wx.createInnerAudioContext()
          audio.src = this.audioFiles[key]
          audio.volume = this.soundVolume
          this.sounds[key] = audio

          audio.onError((err) => {
            console.warn(`音效加载失败: ${this.audioFiles[key]}`, err)
            delete this.sounds[key]
          })
        }
      } catch (e) {
        console.warn(`音频初始化失败: ${key}`, e)
      }
    })
  }

  /**
   * 播放背景音乐
   */
  playBGM() {
    if (!this.musicEnabled || !this.bgm) return

    try {
      this.bgm.play()
    } catch (e) {
      console.warn('背景音乐播放失败:', e)
    }
  }

  /**
   * 暂停背景音乐
   */
  pauseBGM() {
    if (!this.bgm) return

    try {
      this.bgm.pause()
    } catch (e) {
      console.warn('背景音乐暂停失败:', e)
    }
  }

  /**
   * 停止背景音乐
   */
  stopBGM() {
    if (!this.bgm) return

    try {
      this.bgm.stop()
    } catch (e) {
      console.warn('背景音乐停止失败:', e)
    }
  }

  /**
   * 播放音效
   * @param {string} name - 音效名称
   */
  playSound(name) {
    if (!this.soundEnabled) return

    const audio = this.sounds[name]
    if (!audio) {
      console.warn(`音效 ${name} 不存在`)
      return
    }

    try {
      // 停止当前播放，重新开始
      audio.stop()
      audio.play()
    } catch (e) {
      console.warn(`音效 ${name} 播放失败:`, e)
    }
  }

  /**
   * 播放滑动音效
   */
  playSlideSound() {
    this.playSound('slide')
  }

  /**
   * 播放推动音效
   */
  playPushSound() {
    this.playSound('push')
  }

  /**
   * 播放碰撞音效
   */
  playCollisionSound() {
    this.playSound('collision')
  }

  /**
   * 播放通关音效
   */
  playWinSound() {
    this.playSound('win')
  }

  /**
   * 播放失败音效
   */
  playFailSound() {
    this.playSound('fail')
  }

  /**
   * 播放按钮点击音效
   */
  playButtonSound() {
    this.playSound('button')
  }

  /**
   * 播放星星音效
   */
  playStarSound() {
    this.playSound('star')
  }

  /**
   * 切换音效开关
   * @param {boolean} enabled - 是否开启
   */
  setSoundEnabled(enabled) {
    this.soundEnabled = enabled
    this.saveSettings()
  }

  /**
   * 切换音乐开关
   * @param {boolean} enabled - 是否开启
   */
  setMusicEnabled(enabled) {
    this.musicEnabled = enabled

    if (!enabled) {
      this.pauseBGM()
    } else {
      this.playBGM()
    }

    this.saveSettings()
  }

  /**
   * 设置音效音量
   * @param {number} volume - 音量（0-1）
   */
  setSoundVolume(volume) {
    this.soundVolume = Math.max(0, Math.min(1, volume))

    // 更新所有音效音量
    Object.values(this.sounds).forEach(audio => {
      audio.volume = this.soundVolume
    })

    this.saveSettings()
  }

  /**
   * 设置音乐音量
   * @param {number} volume - 音量（0-1）
   */
  setMusicVolume(volume) {
    this.musicVolume = Math.max(0, Math.min(1, volume))

    if (this.bgm) {
      this.bgm.volume = this.musicVolume
    }

    this.saveSettings()
  }

  /**
   * 保存设置到本地存储
   */
  saveSettings() {
    try {
      wx.setStorageSync('audioSettings', {
        soundEnabled: this.soundEnabled,
        musicEnabled: this.musicEnabled,
        soundVolume: this.soundVolume,
        musicVolume: this.musicVolume
      })
    } catch (e) {
      console.error('保存音效设置失败:', e)
    }
  }

  /**
   * 从本地存储加载设置
   */
  loadSettings() {
    try {
      const settings = wx.getStorageSync('audioSettings')
      if (settings) {
        this.soundEnabled = settings.soundEnabled !== false
        this.musicEnabled = settings.musicEnabled !== false
        this.soundVolume = settings.soundVolume || 1.0
        this.musicVolume = settings.musicVolume || 0.5
      }
    } catch (e) {
      console.error('加载音效设置失败:', e)
    }
  }

  /**
   * 获取当前设置
   * @returns {Object} 设置对象
   */
  getSettings() {
    return {
      soundEnabled: this.soundEnabled,
      musicEnabled: this.musicEnabled,
      soundVolume: this.soundVolume,
      musicVolume: this.musicVolume
    }
  }

  /**
   * 销毁音频管理器
   */
  destroy() {
    // 停止所有音效
    this.stopBGM()
    Object.values(this.sounds).forEach(audio => {
      try {
        audio.stop()
        audio.destroy()
      } catch (e) {
        // 忽略
      }
    })

    this.sounds = {}
    this.bgm = null
  }
}
