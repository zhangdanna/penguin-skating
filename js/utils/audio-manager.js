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
      slide: 'audio/slide.wav',
      push: 'audio/push.wav',
      collision: 'audio/collision.wav',
      win: 'audio/win.wav',
      fail: 'audio/fail.wav',
      button: 'audio/button.wav',
      star: 'audio/star.wav'
    }

    // 背景音乐候选源：仓库里只有 bgm.wav。
    // 原来第一位放的是 audio/bgm.mp3，但该文件从没提交过，每次启动必然 404 一条，
    // 真机调试台上一片红。要换成 mp3 素材时把路径补进这个数组即可。
    this.bgmSources = ['audio/bgm.wav']
    this.bgmSourceIndex = 0

    // 是否"希望"播放背景音乐（用于换源后自动续播）
    this.bgmWanted = false

    // 是否处于后台挂起状态。
    // 平台在 onAppEnterBackground 之后会接管音频能力，此时对 InnerAudioContext
    // 调 play/pause/stop 一律返回 operateAudio:fail:access denied（异步回调，
    // try/catch 抓不到，只能靠不调用规避）。所以后台期间只记录意图，不碰实例。
    this.suspended = false

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
   * 创建音频实例（统一处理 iOS 静音键）
   *
   * 微信默认 obeyMuteSwitch = true：iOS 打开侧边静音键后游戏一点声音都没有，
   * 玩家会当成 Bug 来报。游戏音效统一改为不受静音键影响。
   * @param {string} src - 音频路径
   */
  createAudio(src) {
    const audio = wx.createInnerAudioContext()
    // 老基础库可能没有这个属性，赋值失败也不影响播放
    try {
      audio.obeyMuteSwitch = false
    } catch (e) {
      // 忽略：不支持该属性的环境保持默认行为
    }
    audio.src = src
    return audio
  }

  /**
   * 预加载音效
   */
  preloadSounds() {
    // 背景音乐单独处理（需要支持换源回退）
    this.initBGM()

    Object.keys(this.audioFiles).forEach(key => {
      try {
        const audio = this.createAudio(this.audioFiles[key])
        audio.volume = this.soundVolume
        this.sounds[key] = audio

        audio.onError((err) => {
          console.warn(`[Audio] 音效加载失败: ${this.audioFiles[key]}`, err && err.errMsg)
          delete this.sounds[key]
        })
      } catch (e) {
        console.warn(`[Audio] 音效初始化失败: ${key}`, e)
      }
    })
  }

  /**
   * 初始化背景音乐
   * 依次尝试 bgmSources，某个源加载失败就自动换下一个，全部失败则静默关闭 BGM
   */
  initBGM() {
    const src = this.bgmSources[this.bgmSourceIndex]

    if (!src) {
      this.bgm = null
      console.warn('[Audio] 没有可用的背景音乐资源，BGM 已关闭')
      return
    }

    let audio
    try {
      audio = this.createAudio(src)
    } catch (e) {
      console.warn('[Audio] 创建背景音乐实例失败:', e)
      this.bgm = null
      return
    }

    audio.loop = true
    audio.volume = this.musicVolume

    audio.onError((err) => {
      const msg = (err && err.errMsg) || ''

      // 关键：切后台时音频实例的一切操作都会被平台拒绝，onError 也会收到
      // operateAudio:fail:access denied。这跟资源本身没关系，如果按"加载失败"
      // 处理去换源，候选源会被后台状态挨个耗尽，最后 bgm 变成 null ——
      // 回前台后 playBGM() 直接 return，BGM 就再也响不了了。
      if (msg.indexOf('access denied') >= 0) {
        console.log('[Audio] 后台状态下音频被拒绝，忽略:', msg)
        return
      }

      console.warn(`[Audio] 背景音乐加载失败: ${src}`, msg)

      try {
        audio.destroy()
      } catch (e) {
        // 忽略
      }

      if (this.bgm === audio) this.bgm = null

      // 换下一个候选源重试
      this.bgmSourceIndex++
      this.initBGM()
    })

    // 换源后若原本正在播放，自动续播（不依赖 onCanplay，兼容本地预览桩）
    this.bgm = audio

    if (this.bgmWanted && this.musicEnabled) {
      try {
        audio.play()
      } catch (e) {
        // 忽略
      }
    }
  }

  /**
   * 播放背景音乐
   */
  playBGM() {
    this.bgmWanted = true

    if (this.suspended || !this.musicEnabled || !this.bgm) return

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
    this.bgmWanted = false

    if (this.suspended || !this.bgm) return

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
    this.bgmWanted = false

    if (this.suspended || !this.bgm) return

    try {
      this.bgm.stop()
    } catch (e) {
      console.warn('背景音乐停止失败:', e)
    }
  }

  /**
   * 切到后台：只记录意图，不动音频实例
   *
   * 平台进入后台后已经统一接管了音频，此处再调 pause() 只会换来一条
   * `operateAudio:fail:access denied` 红字（真机调试台可见），功能上毫无收益。
   */
  suspend() {
    this.suspended = true
    this.bgmWanted = false
  }

  /**
   * 回到前台：解除挂起并恢复播放
   */
  resume() {
    this.suspended = false
    this.playBGM()
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

    if (this.bgm) {
      try {
        this.bgm.destroy()
      } catch (e) {
        // 忽略
      }
    }
    this.bgm = null
    this.bgmSourceIndex = this.bgmSources.length
  }
}
