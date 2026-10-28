/**
 * 音频管理器（AudioManager）
 *
 * 设计文档：docs/AUDIO.md
 *
 * 这一版把原来"一个音效一个实例 + stop() 再 play()"的做法换成了四条基础设施：
 *
 *   1. 总线（bus）    master → { music, sfx, ui }，音效和 UI 分两条独立增益，
 *                     UI 点击声永远比玩法音效轻 3dB，不会盖住"推动冰块"的反馈。
 *   2. 声部池（pool） 每个 cue 可并发 1~3 个声部，round-robin 复用。
 *                     原来连续滑动时会 stop() 掉上一声，听感是"咔哒"断音；
 *                     池化后两声可以自然叠住，滑行连打才连贯。
 *   3. 冷却（cooldown）同一 cue 的最小间隔。快速连点/连滑时不会变成机关枪，
 *                     也不会因为超过并发上限把声音吃掉。
 *   4. 闪避（duck）   通关/失败/成就这类长音效播放时，BGM 自动压低再回升，
 *                     混音上叫 ducking，是"音效听得清、音乐不断"的标准做法。
 *
 * 另外三件事必须保持（有回归断言）：
 *   - 所有实例统一走 createAudio()，全项目只有这一处真正创建音频实例；
 *   - obeyMuteSwitch = false（iOS 侧边静音键不该让游戏彻底没声音）；
 *   - 切后台只改状态、绝不碰实例（平台接管音频后任何操作都会 access denied）。
 */
import { SfxCues, BgmConfig, CUE_ALIASES } from './audio-cues'

/** 后台/挂起时不碰实例的开关（见 suspend/resume 注释） */
const RAMP_INTERVAL = 40

export default class AudioManager {
  constructor() {
    // ---- 开关与推子 ----
    this.soundEnabled = true
    this.musicEnabled = true
    this.soundVolume = 1.0
    this.musicVolume = BgmConfig.defaultVolume

    // 总线增益：UI 比玩法轻一档，保证"点按钮"不会盖过"推冰块"
    this.busGain = {
      ui: 0.72,
      sfx: 1.0
    }

    // ---- 声部池 ----
    this.pools = {}          // cue 名 → [{ audio, busy, timer, durMs }]
    this.lastPlayAt = {}     // cue 名 → 上次播放时间戳（冷却用）
    this.voiceCount = 0

    // ---- BGM ----
    this.bgm = null
    // 仓库里只有 bgm.wav。原来首位放的是从没提交过的 audio/bgm.mp3，
    // 每次冷启动必然 404 一条，真机调试台一片红。换素材时把路径补进这个数组。
    this.bgmSources = BgmConfig.sources
    this.bgmSourceIndex = 0
    this.bgmWanted = false
    this.bgmState = 'menu'
    this.bgmVolume = 0          // 当前实际音量（用于淡入淡出插值）
    this.duckFactor = 1
    this.duckTimer = null
    this.rampTimer = null
    this.rampTarget = 0

    // 是否处于后台挂起状态。
    // 平台在 onAppEnterBackground 之后会接管音频能力，此时对 InnerAudioContext
    // 调 play/pause/stop 一律返回 operateAudio:fail:access denied（异步回调，
    // try/catch 抓不到，只能靠不调用规避）。所以后台期间只记录意图，不碰实例。
    this.suspended = false

    // 兼容旧字段：老代码/老测试会读 audioManager.sounds['slide']
    this.sounds = {}
    this.audioFiles = {}
    Object.keys(SfxCues).forEach((key) => {
      this.audioFiles[key] = SfxCues[key].file
    })

    this.init()
  }

  // ================================================================ 初始化

  init() {
    this.loadSettings()
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
   *
   * 每个 cue 只预热 1 个声部，其余声部在真正并发时才按需创建 ——
   * 一次性开 20 多个 InnerAudioContext 在低端机上会明显拖慢启动。
   */
  preloadSounds() {
    // 背景音乐单独处理（需要支持换源回退）
    this.initBGM()

    Object.keys(SfxCues).forEach((key) => {
      const cue = SfxCues[key]
      try {
        const audio = this.createAudio(cue.file)
        audio.volume = this.cueVolume(cue)
        const voice = { audio, busy: false, timer: null, durMs: cue.durMs }
        this.pools[key] = [voice]
        this.sounds[key] = audio
        this.voiceCount++

        audio.onError((err) => {
          console.warn(`[Audio] 音效加载失败: ${cue.file}`, err && err.errMsg)
          this.pools[key] = (this.pools[key] || []).filter((v) => v !== voice)
          if (this.sounds[key] === audio) delete this.sounds[key]
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
    audio.volume = 0

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
        this.rampBgmTo(this.targetBgmVolume(), 600)
      } catch (e) {
        // 忽略
      }
    }
  }

  // ================================================================ 音效

  /**
   * 计算某个 cue 的实际音量
   * 结果 = cue 基础增益 × 总线增益 × 音效推子
   */
  cueVolume(cue, gainScale = 1) {
    const bus = this.busGain[cue.bus] === undefined ? 1 : this.busGain[cue.bus]
    const v = cue.gain * bus * this.soundVolume * gainScale
    return Math.max(0, Math.min(1, v))
  }

  /**
   * 播放一个音效
   *
   * @param {string} name - cue 名（见 js/utils/audio-cues.js），也接受旧名（collision/button）
   * @param {Object} [options]
   * @param {number} [options.rate] - 播放速率（同时改变音高），用于星级逐颗升高
   * @param {number} [options.gain] - 本次播放的额外增益系数
   * @param {boolean} [options.force] - 忽略冷却（剧情关键音用）
   */
  playCue(name, options = {}) {
    const key = CUE_ALIASES[name] || name
    const cue = SfxCues[key]
    if (!cue) {
      console.warn(`[Audio] 未知音效: ${name}`)
      return false
    }
    if (!this.soundEnabled || this.suspended) return false

    // 冷却：同一 cue 的最小间隔，防止连点变机关枪
    const now = Date.now()
    const last = this.lastPlayAt[key] || 0
    if (!options.force && now - last < cue.cooldown) return false
    this.lastPlayAt[key] = now

    const voice = this.acquireVoice(key, cue)
    if (!voice) return false

    try {
      // 池化后仍然要 stop：InnerAudioContext 不会自己回到 0 位置。
      // 区别在于这里是"取一个空闲声部再 stop"，上一声在别的声部里继续放完。
      voice.audio.stop()

      // 音高微扰：同一音效连续播放时给 ±5% 的速率抖动，
      // 避免"哒哒哒"的机械感。不支持 playbackRate 的基础库会静默跳过。
      let rate = options.rate
      if (rate === undefined && cue.rate) {
        rate = cue.rate[0] + Math.random() * (cue.rate[1] - cue.rate[0])
      }
      if (rate !== undefined && 'playbackRate' in voice.audio) {
        try {
          voice.audio.playbackRate = Math.max(0.5, Math.min(2.0, rate))
        } catch (e) {
          // 忽略：部分基础库只读
        }
      }

      voice.audio.volume = this.cueVolume(cue, options.gain === undefined ? 1 : options.gain)
      voice.audio.play()
    } catch (e) {
      console.warn(`[Audio] 音效 ${key} 播放失败:`, e)
      return false
    }

    // 长音效闪避 BGM：通关/失败/成就播放期间音乐让路
    if (cue.duck) {
      this.duck(cue.duck, cue.durMs)
    }
    return true
  }

  /**
   * 取一个可用声部
   * 优先空闲 → 未达上限则新建 → 全忙则复用第一个（不无限开实例）
   */
  acquireVoice(key, cue) {
    const pool = this.pools[key] || (this.pools[key] = [])

    for (let i = 0; i < pool.length; i++) {
      if (!pool[i].busy) return this.markBusy(pool[i])
    }

    if (pool.length < (cue.voices || 1)) {
      try {
        const audio = this.createAudio(cue.file)
        audio.volume = this.cueVolume(cue)
        const voice = { audio, busy: false, timer: null, durMs: cue.durMs }
        pool.push(voice)
        this.voiceCount++
        return this.markBusy(voice)
      } catch (e) {
        console.warn(`[Audio] 声部创建失败: ${key}`, e)
      }
    }

    if (pool.length === 0) return null
    return this.markBusy(pool[0])
  }

  /** 标记声部占用，按 cue 时长自动释放 */
  markBusy(voice) {
    voice.busy = true
    if (voice.timer) clearTimeout(voice.timer)
    const timer = setTimeout(() => {
      voice.busy = false
      voice.timer = null
    }, (voice.durMs || 300) + 40)
    // Node 环境下不让这个定时器拖住进程退出（小游戏/H5 没有 unref，忽略即可）
    if (timer && typeof timer.unref === 'function') timer.unref()
    voice.timer = timer
    return voice
  }

  /** 兼容旧接口：playSound('slide') */
  playSound(name, options) {
    return this.playCue(name, options)
  }

  // ---- 语义化封装（调用处不用记 cue 名） ----

  playSlideSound(options) { return this.playCue('slide', options) }
  playPushSound(options) { return this.playCue('push', options) }
  playCollisionSound(options) { return this.playCue('bump', options) }
  playWinSound(options) { return this.playCue('win', options) }
  playFailSound(options) { return this.playCue('fail', options) }
  playButtonSound(options) { return this.playCue('tap', options) }
  playStarSound(options) { return this.playCue('star', options) }
  playUndoSound(options) { return this.playCue('undo', options) }
  playAchievementSound(options) { return this.playCue('achievement', options) }
  playReviveSound(options) { return this.playCue('revive', options) }
  playLevelStartSound(options) { return this.playCue('levelStart', options) }
  playBackSound(options) { return this.playCue('back', options) }

  // ================================================================ BGM

  /** 当前场景对应的 BGM 目标音量 */
  targetBgmVolume() {
    if (!this.musicEnabled) return 0
    const stateGain = BgmConfig.stateVolume[this.bgmState] === undefined
      ? 1
      : BgmConfig.stateVolume[this.bgmState]
    return Math.max(0, Math.min(1, this.musicVolume * stateGain * this.duckFactor))
  }

  /**
   * BGM 音量斜坡
   *
   * InnerAudioContext 的 volume 是瞬时生效的，直接改会在进关/通关时听到"跳变"。
   * 这里用 40ms 一步的插值把跳变抹成 200~600ms 的过渡。
   */
  rampBgmTo(target, duration = 400) {
    if (!this.bgm) return
    this.rampTarget = target
    if (this.rampTimer) return

    const step = Math.max(1, Math.round(RAMP_INTERVAL / duration * 20)) / 20
    const tick = () => {
      if (!this.bgm) {
        this.rampTimer = null
        return
      }
      const diff = this.rampTarget - this.bgmVolume
      if (Math.abs(diff) <= 0.01) {
        this.bgmVolume = this.rampTarget
        try {
          this.bgm.volume = this.bgmVolume
        } catch (e) { /* 忽略 */ }
        this.rampTimer = null
        return
      }
      this.bgmVolume += diff * step
      try {
        this.bgm.volume = this.bgmVolume
      } catch (e) { /* 忽略 */ }
      this.rampTimer = setTimeout(tick, RAMP_INTERVAL)
      if (this.rampTimer && typeof this.rampTimer.unref === 'function') this.rampTimer.unref()
    }
    this.rampTimer = setTimeout(tick, RAMP_INTERVAL)
    if (this.rampTimer && typeof this.rampTimer.unref === 'function') this.rampTimer.unref()
  }

  /** 切换 BGM 场景状态（menu / game / result），只改音量不改曲目 */
  setBgmState(state) {
    this.bgmState = state
    this.rampBgmTo(this.targetBgmVolume(), 600)
  }

  /**
   * 闪避：把 BGM 压低到 factor 倍，ms 后自动回升
   * 用于通关/失败/成就这类长音效，避免音乐与音效互相糊住
   */
  duck(factor, ms) {
    this.duckFactor = Math.max(0.1, Math.min(1, factor))
    this.rampBgmTo(this.targetBgmVolume(), 180)
    if (this.duckTimer) clearTimeout(this.duckTimer)
    const timer = setTimeout(() => {
      this.duckFactor = 1
      this.duckTimer = null
      this.rampBgmTo(this.targetBgmVolume(), 600)
    }, Math.max(200, ms || 600))
    if (timer && typeof timer.unref === 'function') timer.unref()
    this.duckTimer = timer
  }

  playBGM() {
    this.bgmWanted = true

    if (this.suspended || !this.musicEnabled || !this.bgm) return

    try {
      this.bgm.play()
      this.rampBgmTo(this.targetBgmVolume(), 600)
    } catch (e) {
      console.warn('背景音乐播放失败:', e)
    }
  }

  pauseBGM() {
    this.bgmWanted = false

    if (this.suspended || !this.bgm) return

    try {
      this.bgm.pause()
    } catch (e) {
      console.warn('背景音乐暂停失败:', e)
    }
  }

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

  /** 回到前台：解除挂起并恢复播放 */
  resume() {
    this.suspended = false
    this.playBGM()
  }

  // ================================================================ 设置

  setSoundEnabled(enabled) {
    this.soundEnabled = enabled
    if (!enabled) this.stopAllSfx()
    this.saveSettings()
  }

  setMusicEnabled(enabled) {
    this.musicEnabled = enabled

    if (!enabled) {
      this.pauseBGM()
    } else {
      this.playBGM()
    }

    this.saveSettings()
  }

  /** 音效推子 */
  setSoundVolume(volume) {
    this.soundVolume = Math.max(0, Math.min(1, volume))

    Object.keys(this.pools).forEach((key) => {
      const cue = SfxCues[key]
      if (!cue) return
      this.pools[key].forEach((v) => {
        try {
          v.audio.volume = this.cueVolume(cue)
        } catch (e) { /* 忽略 */ }
      })
    })

    this.saveSettings()
  }

  /** 音乐推子 */
  setMusicVolume(volume) {
    this.musicVolume = Math.max(0, Math.min(1, volume))
    this.rampBgmTo(this.targetBgmVolume(), 200)
    this.saveSettings()
  }

  /** 停掉所有正在播的音效（关音效、重开一局时用） */
  stopAllSfx() {
    Object.keys(this.pools).forEach((key) => {
      this.pools[key].forEach((v) => {
        try {
          v.audio.stop()
        } catch (e) { /* 忽略 */ }
        v.busy = false
        if (v.timer) {
          clearTimeout(v.timer)
          v.timer = null
        }
      })
    })
  }

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

  loadSettings() {
    try {
      const settings = wx.getStorageSync('audioSettings')
      if (settings) {
        this.soundEnabled = settings.soundEnabled !== false
        this.musicEnabled = settings.musicEnabled !== false
        this.soundVolume = typeof settings.soundVolume === 'number' ? settings.soundVolume : 1.0
        this.musicVolume = typeof settings.musicVolume === 'number'
          ? settings.musicVolume
          : BgmConfig.defaultVolume
      }
    } catch (e) {
      console.error('加载音效设置失败:', e)
    }
  }

  getSettings() {
    return {
      soundEnabled: this.soundEnabled,
      musicEnabled: this.musicEnabled,
      soundVolume: this.soundVolume,
      musicVolume: this.musicVolume
    }
  }

  /** 调试用：当前声部统计 */
  getStats() {
    const cues = {}
    Object.keys(this.pools).forEach((key) => {
      cues[key] = {
        voices: this.pools[key].length,
        busy: this.pools[key].filter((v) => v.busy).length
      }
    })
    return {
      cues,
      instances: this.voiceCount + (this.bgm ? 1 : 0),
      bgmState: this.bgmState,
      bgmVolume: Number(this.bgmVolume.toFixed(3)),
      duck: this.duckFactor
    }
  }

  destroy() {
    this.stopAllSfx()
    this.stopBGM()

    if (this.rampTimer) clearTimeout(this.rampTimer)
    if (this.duckTimer) clearTimeout(this.duckTimer)
    this.rampTimer = null
    this.duckTimer = null

    Object.keys(this.pools).forEach((key) => {
      this.pools[key].forEach((v) => {
        try {
          v.audio.destroy()
        } catch (e) { /* 忽略 */ }
      })
    })
    this.pools = {}
    this.sounds = {}

    if (this.bgm) {
      try {
        this.bgm.destroy()
      } catch (e) { /* 忽略 */ }
    }
    this.bgm = null
    this.bgmSourceIndex = this.bgmSources.length
  }
}
