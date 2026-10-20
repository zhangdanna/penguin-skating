/**
 * 广告管理器
 * 管理微信小游戏的各种广告类型
 */
export default class AdManager {
  constructor() {
    // 广告实例
    this.rewardedVideoAd = null
    this.bannerAd = null
    this.interstitialAd = null

    // 广告状态
    this.rewardedVideoReady = false
    this.bannerVisible = false

    // 广告单元ID（需要替换为实际的广告单元ID）
    this.adUnitIds = {
      rewardedVideo: 'adunit-xxx',  // 激励视频广告
      banner: 'adunit-yyy',          // Banner广告
      interstitial: 'adunit-zzz'     // 插屏广告
    }

    // 回调
    this.onRewardCallback = null
  }

  /**
   * 初始化广告
   */
  init() {
    this.initRewardedVideoAd()
    this.initBannerAd()
    this.initInterstitialAd()
  }

  /**
   * 初始化激励视频广告
   */
  initRewardedVideoAd() {
    if (!wx.createRewardedVideoAd) {
      console.warn('当前版本不支持激励视频广告')
      return
    }

    this.rewardedVideoAd = wx.createRewardedVideoAd({
      adUnitId: this.adUnitIds.rewardedVideo
    })

    // 监听加载成功
    this.rewardedVideoAd.onLoad(() => {
      console.log('激励视频广告加载成功')
      this.rewardedVideoReady = true
    })

    // 监听加载失败
    this.rewardedVideoAd.onError((err) => {
      console.error('激励视频广告加载失败:', err)
      this.rewardedVideoReady = false
    })

    // 监听关闭
    this.rewardedVideoAd.onClose((res) => {
      this.rewardedVideoReady = false

      if (res && res.isEnded) {
        // 用户完整观看了广告，给予奖励
        console.log('用户完整观看了广告')
        if (this.onRewardCallback) {
          this.onRewardCallback(true)
        }
      } else {
        // 用户中途退出，不给予奖励
        console.log('用户中途退出了广告')
        if (this.onRewardCallback) {
          this.onRewardCallback(false)
        }
      }
    })

    // 预加载
    this.rewardedVideoAd.load().catch(() => {
      console.log('激励视频广告预加载失败')
    })
  }

  /**
   * 初始化Banner广告
   */
  initBannerAd() {
    if (!wx.createBannerAd) {
      console.warn('当前版本不支持Banner广告')
      return
    }

    const systemInfo = wx.getSystemInfoSync()

    this.bannerAd = wx.createBannerAd({
      adUnitId: this.adUnitIds.banner,
      style: {
        left: 0,
        top: systemInfo.windowHeight - 80,
        width: systemInfo.windowWidth
      }
    })

    // 监听加载成功
    this.bannerAd.onLoad(() => {
      console.log('Banner广告加载成功')
    })

    // 监听加载失败
    this.bannerAd.onError((err) => {
      console.error('Banner广告加载失败:', err)
    })

    // 监听尺寸变化
    this.bannerAd.onResize((size) => {
      this.bannerAd.style.left = (systemInfo.windowWidth - size.width) / 2
      this.bannerAd.style.top = systemInfo.windowHeight - size.height
    })
  }

  /**
   * 初始化插屏广告
   */
  initInterstitialAd() {
    if (!wx.createInterstitialAd) {
      console.warn('当前版本不支持插屏广告')
      return
    }

    this.interstitialAd = wx.createInterstitialAd({
      adUnitId: this.adUnitIds.interstitial
    })

    // 监听加载成功
    this.interstitialAd.onLoad(() => {
      console.log('插屏广告加载成功')
    })

    // 监听加载失败
    this.interstitialAd.onError((err) => {
      console.error('插屏广告加载失败:', err)
    })
  }

  /**
   * 显示激励视频广告
   * @param {Function} callback - 奖励回调，参数为是否完整观看
   */
  showRewardedVideoAd(callback) {
    if (!this.rewardedVideoAd) {
      console.warn('激励视频广告未初始化')
      callback && callback(false)
      return
    }

    this.onRewardCallback = callback

    if (this.rewardedVideoReady) {
      this.rewardedVideoAd.show().catch(() => {
        // 显示失败，尝试重新加载
        this.rewardedVideoAd.load().then(() => {
          this.rewardedVideoAd.show()
        }).catch(err => {
          console.error('激励视频广告显示失败:', err)
          callback && callback(false)
        })
      })
    } else {
      // 广告未准备好，尝试加载
      this.rewardedVideoAd.load().then(() => {
        this.rewardedVideoAd.show()
      }).catch(err => {
        console.error('激励视频广告加载失败:', err)
        callback && callback(false)
      })
    }
  }

  /**
   * 显示Banner广告
   */
  showBannerAd() {
    if (!this.bannerAd) {
      console.warn('Banner广告未初始化')
      return
    }

    if (!this.bannerVisible) {
      this.bannerAd.show().then(() => {
        this.bannerVisible = true
        console.log('Banner广告显示成功')
      }).catch(err => {
        console.error('Banner广告显示失败:', err)
      })
    }
  }

  /**
   * 隐藏Banner广告
   */
  hideBannerAd() {
    if (!this.bannerAd) {
      return
    }

    if (this.bannerVisible) {
      this.bannerAd.hide()
      this.bannerVisible = false
      console.log('Banner广告已隐藏')
    }
  }

  /**
   * 显示插屏广告
   */
  showInterstitialAd() {
    if (!this.interstitialAd) {
      console.warn('插屏广告未初始化')
      return
    }

    this.interstitialAd.show().catch(err => {
      console.error('插屏广告显示失败:', err)
    })
  }

  /**
   * 检查激励视频是否可用
   * @returns {boolean}
   */
  isRewardedVideoAvailable() {
    return this.rewardedVideoAd && this.rewardedVideoReady
  }

  /**
   * 销毁广告实例
   */
  destroy() {
    if (this.rewardedVideoAd) {
      this.rewardedVideoAd.destroy()
      this.rewardedVideoAd = null
    }

    if (this.bannerAd) {
      this.bannerAd.destroy()
      this.bannerAd = null
    }

    if (this.interstitialAd) {
      this.interstitialAd.destroy()
      this.interstitialAd = null
    }
  }
}
