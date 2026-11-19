/**
 * 广告管理器（B2）
 *
 * 设计原则：
 * 1. 只有配置了合法广告位 ID 才创建实例，未开通流量主时整条链路静默关闭；
 * 2. 只做激励视频。Banner / 插屏在本游戏里没有合适的展示位（会遮挡底部操作条），
 *    不做无意义的预加载；
 * 3. 是否发放奖励只看 onClose 的 `isEnded`，中途关闭一律不给；
 * 4. `showRewardedVideoAd()` 返回 Promise<boolean>，调用方无需关心回调时序；
 * 5. **致命错误要自断**：广告位不存在 / 未开通流量主时平台会回错误码，
 *    此时必须把实例销毁并通知外部收回入口 —— 否则玩家看到的是「点了没反应」的死按钮。
 */

/**
 * 致命错误码 → 原因标签
 *
 * 含义以微信广告错误码文档为准（不同基础库版本的描述略有出入，这里只取两类
 * 「再试也没用」的：广告位本身有问题）。其余错误（无合适素材、网络抖动、组件被回收）
 * 都按「本次失败」处理，保留入口等下次重试。
 */
const FATAL_AD_ERROR_CODES = {
  1002: 'ad-unit-closed',   // 广告单元已关闭
  1008: 'ad-unit-not-found' // 广告单元不存在 / 未开通流量主
}

export default class AdManager {
  constructor(adUnits = {}) {
    this.adUnitId = (adUnits && adUnits.rewardedVideo) || ''
    this.rewardedVideoAd = null

    // 当前是否已加载完成
    this.ready = false

    // 正在等待结果的 resolve（同一时刻只允许一次播放）
    this.pendingResolve = null

    // 是否已因致命错误永久关闭（关闭后不再创建、不再重试）
    this.invalid = false
    this.invalidReason = ''

    // 致命错误回调：由调用方（game.js）用来收回广告入口
    this.onInvalid = null
  }

  /**
   * 从平台错误对象里取出数字错误码
   * @param {*} err
   * @returns {number} 取不到时返回 0
   */
  static readErrCode(err) {
    if (!err) return 0
    const raw = err.errCode != null ? err.errCode : err.code
    const code = parseInt(raw, 10)
    return Number.isFinite(code) ? code : 0
  }

  /**
   * 广告位 ID 是否形如 adunit-xxxx（长度足够，非占位符）
   * @param {string} id
   * @returns {boolean}
   */
  static isValidAdUnitId(id) {
    return typeof id === 'string' && /^adunit-[0-9a-zA-Z_-]{6,}$/.test(id)
  }

  /**
   * 是否已配置广告位
   * @returns {boolean}
   */
  isConfigured() {
    return AdManager.isValidAdUnitId(this.adUnitId)
  }

  /**
   * 是否已因致命错误永久关闭
   * @returns {boolean}
   */
  isInvalid() {
    return this.invalid
  }

  /**
   * 初始化：未配置或基础库不支持时直接跳过
   */
  init() {
    if (this.invalid) return

    if (!this.isConfigured()) {
      console.log('[Ad] 未配置激励视频广告位，广告相关入口将隐藏')
      return
    }

    if (typeof wx === 'undefined' || !wx.createRewardedVideoAd) {
      console.warn('[Ad] 当前基础库不支持激励视频广告')
      return
    }

    try {
      this.rewardedVideoAd = wx.createRewardedVideoAd({ adUnitId: this.adUnitId })
    } catch (e) {
      console.warn('[Ad] 创建激励视频实例失败:', e)
      this.rewardedVideoAd = null
      return
    }

    this.rewardedVideoAd.onLoad(() => {
      this.ready = true
    })

    this.rewardedVideoAd.onError((err) => {
      this.ready = false
      const code = AdManager.readErrCode(err)
      const fatal = FATAL_AD_ERROR_CODES[code]
      console.warn(`[Ad] 激励视频出错: ${err && err.errMsg} (code=${code})`)

      if (fatal) {
        // 广告位本身有问题，重试也不会好：销毁实例 + 通知外部收回入口
        this.disable(fatal)
        return
      }

      // 无合适素材 / 网络抖动等：只结束本次请求，入口保留，下次还能再试
      this.settle(false)
    })

    this.rewardedVideoAd.onClose((res) => {
      this.ready = false
      const ended = !!(res && res.isEnded)
      if (!ended) {
        console.log('[Ad] 用户中途关闭激励视频，不发放奖励')
      }
      this.settle(ended)
      // 提前预拉下一条，缩短下次点击的等待
      this.preload()
    })

    this.preload()
  }

  /**
   * 预加载
   * @returns {Promise<void>}
   */
  preload() {
    if (!this.rewardedVideoAd || this.invalid) return Promise.resolve()

    return this.rewardedVideoAd.load()
      .then(() => { this.ready = true })
      .catch(() => { this.ready = false })
  }

  /**
   * 是否有可用的激励视频（决定入口是否展示）
   * @returns {boolean}
   */
  isRewardedVideoAvailable() {
    return !this.invalid && !!this.rewardedVideoAd
  }

  /**
   * 永久关闭：广告位不可用时收回入口，之后不再创建/重试
   *
   * 幂等 —— 平台可能连续回多个致命错误，`onInvalid` 只触发一次。
   * @param {string} reason 原因标签（ad-unit-not-found / ad-unit-closed）
   */
  disable(reason) {
    if (this.invalid) return

    this.invalid = true
    this.invalidReason = reason || 'ad-unavailable'
    this.ready = false

    // 先给等待中的播放请求一个「没看完」的结论，避免 Promise 永远挂着
    this.settle(false)

    const ad = this.rewardedVideoAd
    this.rewardedVideoAd = null
    if (ad) {
      try {
        ad.destroy()
      } catch (e) {
        // 部分基础库无 destroy / 实例已被平台回收，忽略
      }
    }

    if (typeof this.onInvalid === 'function') {
      try {
        this.onInvalid(this.invalidReason)
      } catch (e) {
        console.warn('[Ad] onInvalid 回调异常:', e)
      }
    }
  }

  /**
   * 结束一次播放请求
   * @param {boolean} value
   */
  settle(value) {
    const resolve = this.pendingResolve
    this.pendingResolve = null
    if (resolve) resolve(value)
  }

  /**
   * 播放激励视频
   * @returns {Promise<boolean>} 是否完整观看（true 才应发放奖励）
   */
  showRewardedVideoAd() {
    if (this.invalid || !this.rewardedVideoAd) return Promise.resolve(false)
    // 上一次播放尚未结束，直接忽略重复点击
    if (this.pendingResolve) return Promise.resolve(false)

    return new Promise((resolve) => {
      this.pendingResolve = resolve

      this.rewardedVideoAd.show().catch(() => {
        // show 失败通常是素材未就绪，重新拉一次再试
        return this.rewardedVideoAd.load()
          .then(() => this.rewardedVideoAd.show())
          .catch((err) => {
            console.warn('[Ad] 激励视频展示失败:', err && err.errMsg)
            this.settle(false)
          })
      })
    })
  }

  /**
   * 销毁
   */
  destroy() {
    this.settle(false)

    if (this.rewardedVideoAd) {
      try {
        this.rewardedVideoAd.destroy()
      } catch (e) {
        // 部分基础库无 destroy，忽略
      }
      this.rewardedVideoAd = null
    }
    this.ready = false
  }
}
