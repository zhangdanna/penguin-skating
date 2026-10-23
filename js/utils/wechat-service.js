/**
 * 微信服务管理器
 *
 * C8 说明：登录体系采用「轻量方案」。
 * 本项目没有后端，`wx.login` 拿到的 code 无处可换（缺 code2session），
 * 且 `wx.getUserInfo` 自 2022 年起已不再返回真实昵称/头像。
 * 因此移除伪登录入口与相关方法，只保留真正需要的能力：
 *   - 分享（纯传播，无奖励）
 *   - 好友排行榜数据上报（wx.setUserCloudStorage，绑定 openid，无需登录）
 */
export default class WechatService {
  constructor() {
    // 是否已初始化分享菜单
    this.shareReady = false
  }

  /**
   * 初始化
   */
  init() {
    this.initShare()
  }

  /**
   * 初始化分享功能
   */
  initShare() {
    try {
      wx.showShareMenu({
        withShareTicket: true,
        menus: ['shareAppMessage', 'shareTimeline']
      })

      wx.onShareAppMessage(() => this.getShareConfig())
      wx.onShareTimeline(() => this.getTimelineShareConfig())
      this.shareReady = true
    } catch (e) {
      console.warn('[Share] 分享菜单初始化失败:', e)
    }
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
      imageUrl: 'images/share-image.png',
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
   * 主动分享（纯传播，无任何游戏内奖励）
   */
  share() {
    wx.shareAppMessage(this.getShareConfig())
  }

  /**
   * 检查是否可以分享（分享已无冷却限制）
   * @returns {boolean}
   */
  canShare() {
    return true
  }

  /**
   * 获取当前关卡（已解锁的最高关）
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
   * 关卡是无限的，所以按"已解锁关卡"遍历，而不是写死 30
   */
  getTotalStars() {
    let totalStars = 0
    try {
      const cleared = Math.max(0, (parseInt(this.getCurrentLevel(), 10) || 1) - 1)
      for (let i = 1; i <= cleared; i++) {
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
   * 读取本地的云端记录镜像（用于"只升不降"比较）
   * @returns {{level:number, stars:number, moves:number}}
   */
  loadCloudRecord() {
    try {
      const saved = wx.getStorageSync('cloudRecord')
      if (saved && typeof saved === 'object') {
        return {
          level: parseInt(saved.level, 10) || 0,
          stars: parseInt(saved.stars, 10) || 0,
          moves: parseInt(saved.moves, 10) || 0
        }
      }
    } catch (e) {
      console.warn('[Rank] 读取云端记录镜像失败:', e)
    }
    return { level: 0, stars: 0, moves: 0 }
  }

  /**
   * 保存云端记录镜像
   * @param {{level:number, stars:number, moves:number}} record
   */
  saveCloudRecord(record) {
    try {
      wx.setStorageSync('cloudRecord', record)
    } catch (e) {
      console.warn('[Rank] 保存云端记录镜像失败:', e)
    }
  }

  /**
   * 综合分：关卡优先，其次总星数，最后步数越少越高
   * @param {{level:number, stars:number, moves:number}} record
   * @returns {number}
   */
  static computeScore(record) {
    const level = Math.max(0, record.level)
    const stars = Math.max(0, record.stars)
    const moves = Math.max(0, record.moves)
    const moveBonus = Math.max(0, 99 - Math.min(moves, 99))
    return level * 10000 + stars * 100 + moveBonus
  }

  /**
   * 上报分数到好友排行榜
   *
   * C6：改为"只升不降"——重玩低关卡或打出更差成绩都不会把已有记录覆盖掉。
   * 三项指标各自的单调性：
   *   level 只增（最高通关关卡）
   *   stars 只增（总星数）
   *   moves 只减（仅在刷新最高关时记录该关最佳步数）
   *
   * @param {number} level - 本次通关的关卡编号
   * @param {number} moves - 本次步数
   * @param {number} stars - 本次星级（保留参数，实际以总星数为准）
   */
  reportScore(level, moves, stars) {
    const prev = this.loadCloudRecord()
    const totalStars = Math.max(prev.stars, this.getTotalStars())

    let bestMoves = prev.moves
    if (level > prev.level) {
      // 刷新了最高关：记录这一关的步数
      bestMoves = moves
    } else if (level === prev.level) {
      // 同一关重打：取更好的一次
      bestMoves = prev.moves > 0 ? Math.min(prev.moves, moves) : moves
    }
    // level < prev.level 时保留旧记录，不回退

    const next = {
      level: Math.max(prev.level, level),
      stars: totalStars,
      moves: bestMoves
    }

    const score = WechatService.computeScore(next)

    wx.setUserCloudStorage({
      KVList: [
        { key: 'level', value: String(next.level) },
        { key: 'stars', value: String(next.stars) },
        { key: 'moves', value: String(next.moves) },
        { key: 'score', value: String(score) }
      ],
      success: () => {
        this.saveCloudRecord(next)
      },
      fail: (err) => {
        console.warn('[Rank] 分数上报失败:', err && err.errMsg)
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
        success: (res) => resolve(res)
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
