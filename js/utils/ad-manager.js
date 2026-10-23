/**
 * 广告管理器（B2）
 *
 * 设计原则：
 * 1. 只有配置了合法广告位 ID 才创建实例，未开通流量主时整条链路静默关闭；
 * 2. 只做激励视频。Banner / 插屏在本游戏里没有合适的展示位（会遮挡底部操作条），
 *    不做无意义的预加载；
 * 3. 是否发放奖励只看 onClose 的 `isEnded`，中途关闭一律不给；
 * 4. `showRewardedVideoAd()` 返回 Promise<boolean>，调用方无需关心回调时序。
 */
export default class AdManager {
  constructor(adUnits = {}) {
    this.adUnitId = (adUnits && adUnits.rewardedVideo) || ''
    this.rewardedVideoAd = null

    // 当前是否已加载完成
    this.ready = false

    // 正在等待结果的 resolve（同一时刻只允许一次播放）
    this.pendingResolve = null
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
   * 初始化：未配置或基础库不支持时直接跳过
   */
  init() {
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
      console.warn('[Ad] 激励视频出错:', err && err.errMsg)
      // 若错误发生在播放过程中，按"未完成观看"结束本次请求
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
    if (!this.rewardedVideoAd) return Promise.resolve()

    return this.rewardedVideoAd.load()
      .then(() => { this.ready = true })
      .catch(() => { this.ready = false })
  }

  /**
   * 是否有可用的激励视频（决定入口是否展示）
   * @returns {boolean}
   */
  isRewardedVideoAvailable() {
    return !!this.rewardedVideoAd
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
    if (!this.rewardedVideoAd) return Promise.resolve(false)
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
