/**
 * 微信服务管理器
 * 管理微信登录、用户信息、分享等功能
 */
export default class WechatService {
  constructor() {
    // 用户信息
    this.userInfo = null
    this.isLogin = false
    this.openId = null

    // 回调
    this.onLoginSuccess = null
    this.onLoginFail = null

    // 分享奖励
    this.onShareReward = null
    this.lastShareTime = 0
    this.shareCooldown = 60000 // 分享冷却时间（1分钟）
  }

  /**
   * 初始化微信服务
   */
  init() {
    // 检查登录状态
    this.checkLoginStatus()

    // 监听分享
    this.initShare()
  }

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    const savedUser = wx.getStorageSync('userInfo')
    if (savedUser) {
      this.userInfo = savedUser
      this.isLogin = true
      console.log('用户已登录:', this.userInfo.nickName)
    }
  }

  /**
   * 微信登录
   * @returns {Promise<Object>} 登录结果
   */
  login() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (res) => {
          if (res.code) {
            // 这里应该发送code到后端换取openId和session_key
            // 简化版：直接使用code作为标识
            this.openId = res.code
            console.log('登录成功，code:', res.code)

            // 获取用户信息
            this.getUserInfo().then(userInfo => {
              this.userInfo = userInfo
              this.isLogin = true

              // 保存用户信息
              wx.setStorageSync('userInfo', userInfo)
              wx.setStorageSync('openId', this.openId)

              resolve({ success: true, userInfo, openId: this.openId })
            }).catch(err => {
              // 即使获取用户信息失败，也认为登录成功
              resolve({ success: true, openId: this.openId })
            })
          } else {
            console.error('登录失败:', res.errMsg)
            reject({ success: false, error: res.errMsg })
          }
        },
        fail: (err) => {
          console.error('登录失败:', err)
          reject({ success: false, error: err })
        }
      })
    })
  }

  /**
   * 获取用户信息
   * @returns {Promise<Object>} 用户信息
   */
  getUserInfo() {
    return new Promise((resolve, reject) => {
      wx.getUserInfo({
        success: (res) => {
          const userInfo = {
            nickName: res.userInfo.nickName,
            avatarUrl: res.userInfo.avatarUrl,
            gender: res.userInfo.gender,
            country: res.userInfo.country,
            province: res.userInfo.province,
            city: res.userInfo.city
          }
          resolve(userInfo)
        },
        fail: (err) => {
          console.warn('获取用户信息失败:', err)
          // 返回默认用户信息
          resolve({
            nickName: '微信用户',
            avatarUrl: '',
            gender: 0
          })
        }
      })
    })
  }

  /**
   * 获取用户信息（新版API，需要按钮触发）
   * @param {Object} event - 按钮事件
   * @returns {Promise<Object>} 用户信息
   */
  getUserProfile() {
    return new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: '用于完善用户资料',
        success: (res) => {
          const userInfo = {
            nickName: res.userInfo.nickName,
            avatarUrl: res.userInfo.avatarUrl,
            gender: res.userInfo.gender
          }
          this.userInfo = userInfo
          wx.setStorageSync('userInfo', userInfo)
          resolve(userInfo)
        },
        fail: (err) => {
          console.warn('获取用户信息失败:', err)
          reject(err)
        }
      })
    })
  }

  /**
   * 初始化分享功能
   */
  initShare() {
    // 设置默认分享内容
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })

    // 监听分享
    wx.onShareAppMessage(() => {
      return this.getShareConfig()
    })

    wx.onShareTimeline(() => {
      return this.getTimelineShareConfig()
    })
  }

  /**
   * 获取分享配置
   * @returns {Object} 分享配置
   */
  getShareConfig() {
    const level = this.getCurrentLevel()
    const stars = this.getTotalStars()

    return {
      title: `我在企鹅滑冰已通关${level}关，获得${stars}颗星！快来挑战吧！`,
      imageUrl: 'images/share-image.png', // 分享图片
      query: `from=share&level=${level}`
    }
  }

  /**
   * 获取朋友圈分享配置
   * @returns {Object} 分享配置
   */
  getTimelineShareConfig() {
    return {
      title: '企鹅滑冰 - 超好玩的冰上推箱子游戏！',
      imageUrl: 'images/share-image.png'
    }
  }

  /**
   * 主动分享（带奖励）
   */
  share() {
    const now = Date.now()
    if (now - this.lastShareTime < this.shareCooldown) {
      const remaining = Math.ceil((this.shareCooldown - (now - this.lastShareTime)) / 1000)
      wx.showToast({
        title: `分享冷却中(${remaining}秒)`,
        icon: 'none'
      })
      return false
    }

    wx.shareAppMessage({
      ...this.getShareConfig(),
      success: (res) => {
        this.lastShareTime = now
        console.log('分享成功')
        // 触发分享奖励
        if (this.onShareReward) {
          this.onShareReward()
        }
      },
      fail: (err) => {
        console.log('分享取消或失败')
      }
    })
    return true
  }

  /**
   * 设置分享奖励回调
   */
  setShareRewardCallback(callback) {
    this.onShareReward = callback
  }

  /**
   * 检查是否可以分享
   */
  canShare() {
    const now = Date.now()
    return now - this.lastShareTime >= this.shareCooldown
  }

  /**
   * 获取分享冷却时间
   */
  getShareCooldownRemaining() {
    const now = Date.now()
    const remaining = this.shareCooldown - (now - this.lastShareTime)
    return Math.max(0, Math.ceil(remaining / 1000))
  }

  /**
   * 获取当前关卡
   */
  getCurrentLevel() {
    try {
      const progress = wx.getStorageSync('gameProgress')
      return progress ? progress.unlockedLevel || 1 : 1
    } catch (e) {
      return 1
    }
  }

  /**
   * 获取总星星数
   */
  getTotalStars() {
    let totalStars = 0
    try {
      for (let i = 1; i <= 30; i++) {
        const data = wx.getStorageSync(`level_${i}`)
        if (data && data.stars) {
          totalStars += data.stars
        }
      }
    } catch (e) {
      console.error('获取星星数失败:', e)
    }
    return totalStars
  }

  /**
   * 上报分数到排行榜
   * @param {number} level - 关卡编号
   * @param {number} moves - 步数
   * @param {number} stars - 星星数
   */
  reportScore(level, moves, stars) {
    if (!this.isLogin) {
      console.warn('用户未登录，无法上报分数')
      return
    }

    // 上报到开放数据域
    wx.setUserCloudStorage({
      KVList: [
        { key: 'level', value: level.toString() },
        { key: 'moves', value: moves.toString() },
        { key: 'stars', value: stars.toString() },
        { key: 'score', value: (stars * 1000 - moves * 10).toString() }
      ],
      success: () => {
        console.log('分数上报成功')
      },
      fail: (err) => {
        console.error('分数上报失败:', err)
      }
    })
  }

  /**
   * 获取好友排行
   * @returns {Promise<Array>} 排行数据
   */
  getFriendRank() {
    return new Promise((resolve, reject) => {
      wx.getFriendCloudStorage({
        keyList: ['level', 'moves', 'stars', 'score'],
        success: (res) => {
          // 按分数排序
          const rankList = res.data
            .map(item => {
              const kv = {}
              item.KVList.forEach(k => {
                kv[k.key] = k.value
              })
              return {
                nickName: item.nickname,
                avatarUrl: item.avatarUrl,
                level: parseInt(kv.level) || 0,
                moves: parseInt(kv.moves) || 0,
                stars: parseInt(kv.stars) || 0,
                score: parseInt(kv.score) || 0
              }
            })
            .sort((a, b) => b.score - a.score)

          resolve(rankList)
        },
        fail: (err) => {
          console.error('获取好友排行失败:', err)
          reject(err)
        }
      })
    })
  }

  /**
   * 退出小程序
   */
  exitMiniProgram() {
    wx.exitMiniProgram({
      fail: (err) => {
        console.error('退出失败:', err)
      }
    })
  }

  /**
   * 显示模态对话框
   * @param {Object} options - 配置项
   * @returns {Promise<Object>} 用户选择
   */
  showModal(options) {
    return new Promise((resolve) => {
      wx.showModal({
        title: options.title || '提示',
        content: options.content || '',
        showCancel: options.showCancel !== false,
        confirmText: options.confirmText || '确定',
        cancelText: options.cancelText || '取消',
        success: (res) => {
          resolve(res)
        }
      })
    })
  }

  /**
   * 显示提示
   * @param {string} title - 提示内容
   */
  showToast(title) {
    wx.showToast({
      title: title,
      icon: 'none',
      duration: 2000
    })
  }

  /**
   * 显示加载
   * @param {string} title - 加载提示
   */
  showLoading(title = '加载中...') {
    wx.showLoading({
      title: title,
      mask: true
    })
  }

  /**
   * 隐藏加载
   */
  hideLoading() {
    wx.hideLoading()
  }
}
