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
import { IS_WEAPP } from '../env'

/**
 * 关系链授权 scope
 *
 * `wx.getFriendCloudStorage` 是「需要用户授权」的接口，scope 就是它。
 * 没授权时调用不会报错弹窗，而是直接进 fail 回调 —— 表现为「排行榜一直空白」。
 */
const FRIEND_SCOPE = 'scope.WxFriendInteraction'

export default class WechatService {
  constructor() {
    // 是否已初始化分享菜单
    this.shareReady = false
    // 右上角菜单的「转发」是否真的挂上了（showShareMenu 可能被平台拒绝）
    this.shareMenuAvailable = false

    // 主动分享是否已被平台封禁。
    //
    // 真机实测（2026-10-26）：
    //   wx.showShareMenu → { errMsg: 'showShareMenu:ok' }   ← 菜单可用
    //   wx.shareAppMessage → 「小程序违规，不能使用分享功能」 ← 直连被拒
    // 说明右上角「···」→「转发」那条路是通的，只有主域直连这一路被封。
    //
    // 那条违规提示是微信自己弹的系统 toast，开发者拦不住，只能在失败后记住状态，
    // 同一会话内直接走引导，别让玩家每点一次分享就吃一遍负面提示。
    // 故意只存内存：重启游戏会重新尝试一次，账号恢复后自动回到直连。
    this.shareBlocked = false
  }

  /**
   * 初始化
   */
  init() {
    this.initShare()
  }

  /**
   * 初始化分享功能
   *
   * 小游戏主域只能通过右上角菜单触发转发，`showShareMenu` 成功 =
   * 玩家点「···」能看到「转发」。这条链路和 `wx.shareAppMessage` 是两套，
   * 后者被平台限制时前者往往仍然可用，所以分享按钮失败时要退到这里。
   */
  initShare() {
    try {
      wx.showShareMenu({
        withShareTicket: true,
        menus: ['shareAppMessage', 'shareTimeline'],
        success: () => {
          this.shareMenuAvailable = true
        },
        fail: (err) => {
          this.shareMenuAvailable = false
          console.warn('[Share] 分享菜单不可用:', err && err.errMsg)
        }
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
      title: `我在一企推推乐已通关${level}关，获得${stars}颗星！快来挑战吧！`,
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
      title: '一企推推乐 - 超好玩的冰上推箱子游戏！',
      imageUrl: 'images/share-image.png'
    }
  }

  /**
   * 主动分享（纯传播，无任何游戏内奖励）
   *
   * 注意：`wx.shareAppMessage` 属于**受平台策略管控**的接口。
   * 小游戏未发布 / 未完成认证 / 有违规记录 / 开发者工具里调试时，
   * 调用会失败并抛出「小程序违规，不能使用分享功能」这类提示。
   * 这属于账号侧限制，代码改不掉 —— 所以这里必须做失败兜底，
   * 引导玩家走右上角菜单「···」→「转发」，那条路不受这个限制。
   */
  share() {
    if (typeof wx === 'undefined') return

    // 已确认被平台限制：直接引导走右上角菜单，不再去撞那条系统提示
    if (this.shareBlocked) {
      this.showShareGuide()
      return
    }

    if (typeof wx.shareAppMessage !== 'function') {
      this.showShareGuide()
      return
    }

    wx.shareAppMessage({
      ...this.getShareConfig(),
      fail: (err) => {
        const msg = (err && err.errMsg) || ''
        console.warn('[Share] 主动分享失败:', msg)

        // 「小程序违规，不能使用分享功能」属于账号侧封禁，重试不会有结果
        if (msg.indexOf('违规') >= 0 || msg.indexOf('不能使用') >= 0) {
          this.shareBlocked = true
        }
        this.showShareGuide()
      }
    })
  }

  /**
   * 分享兜底引导
   *
   * 右上角菜单能用 → 教玩家点「···」转发（实测 showShareMenu 返回 ok，
   * 即使 shareAppMessage 被拒，这条路仍然可用）；
   * 连菜单都被拒 → 说明是账号侧限制（未发布 / 未认证 / 违规），
   * 直接把原因说清楚，别让玩家以为按钮坏了。
   */
  showShareGuide() {
    const menuOk = this.shareMenuAvailable
    let content

    if (menuOk && this.shareBlocked) {
      content = '微信暂时限制了游戏内的直接分享，但右上角「···」→「转发」仍然可以分享给好友～'
    } else if (menuOk) {
      content = '点击右上角「···」按钮，选择「转发」即可把游戏分享给好友～'
    } else {
      content = '当前小游戏的分享能力暂不可用。\n通常是以下原因：小游戏尚未发布上线、主体未完成微信认证，或账号存在违规记录。请在微信公众平台后台确认后重试。'
    }

    wx.showModal({
      title: '分享给好友',
      content,
      showCancel: false,
      confirmText: '知道了'
    })
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
   * 查询「微信朋友关系」授权状态
   *
   * 排行榜能出数据的前置条件。authSetting 里没有这个 key 表示「还没问过」，
   * 与「拒绝过」要区分处理：没问过 → 直接 wx.authorize 会弹系统框；
   * 拒绝过 → wx.authorize 直接 fail，只能引导去设置页开。
   *
   * @returns {Promise<boolean>}
   */
  checkFriendAuth() {
    return new Promise((resolve) => {
      // 浏览器里 wx 是适配层的 Proxy，getSetting 是个永不回调的空函数，
      // 不先判断环境的话这个 promise 会一直挂着，排行榜卡在空白态
      if (!IS_WEAPP || typeof wx === 'undefined' || typeof wx.getSetting !== 'function') {
        resolve(false)
        return
      }
      wx.getSetting({
        success: (res) => {
          const setting = (res && res.authSetting) || {}
          const raw = setting[FRIEND_SCOPE]
          // 区分「从没问过」（key 不存在）与「明确拒绝过」（key === false）：
          // 前者调 authorize 会弹系统框；后者只会直接 fail，得去设置页。
          // 拒绝后是否主动弹说明也靠这个判断，避免刚被拒就再弹一次。
          this.friendAuthPreviouslyDenied = raw === false
          resolve(raw === true)
        },
        fail: () => resolve(false)
      })
    })
  }

  /**
   * 确保拿到关系链授权（进排行榜前调用）
   *
   * 必须由玩家点击「排行榜」按钮的手势链触发 —— wx.authorize 会弹系统授权框，
   * 没有用户手势的授权请求会被平台静默拒绝。
   *
   * @returns {Promise<boolean>} 是否已授权
   */
  ensureFriendAuth() {
    return this.checkFriendAuth().then((granted) => {
      if (granted) {
        this.friendAuthDenied = false
        return true
      }
      if (!IS_WEAPP || typeof wx === 'undefined' || typeof wx.authorize !== 'function') {
        // H5 预览等环境根本没有授权能力：不是「玩家拒绝」，不能弹引导
        this.friendAuthUnsupported = true
        return false
      }

      return new Promise((resolve) => {
        wx.authorize({
          scope: FRIEND_SCOPE,
          success: () => {
            this.friendAuthDenied = false
            resolve(true)
          },
          fail: (err) => {
            this.friendAuthDenied = true
            console.warn('[Rank] 关系链授权被拒绝:', err && err.errMsg)
            resolve(false)
          }
        })
      })
    })
  }

  /**
   * 引导玩家去设置页重新开启「微信朋友关系」
   *
   * 注意：wx.openSetting 只有在用户**拒绝过**授权后才能打开设置页，
   * 从没问过时调用会失败，所以入口只放在「已拒绝」的空态里。
   *
   * @returns {Promise<boolean>} 是否已开启
   */
  openFriendAuthSetting() {
    return new Promise((resolve) => {
      if (typeof wx === 'undefined' || typeof wx.openSetting !== 'function') {
        resolve(false)
        return
      }
      wx.openSetting({
        success: (res) => {
          const ok = !!(res && res.authSetting && res.authSetting[FRIEND_SCOPE])
          this.friendAuthDenied = !ok
          resolve(ok)
        },
        fail: () => resolve(false)
      })
    })
  }

  /**
   * 获取总星星数
   * 关卡是无限的，所以按"已解锁关卡"遍历，而不是写死 30
   *
   * 口径：每关取**历史最高星**（`bestStars`），与成就系统的「星星按各关
   * 历史最高星累计」保持一致。早期只读 `stars`（最近一次成绩），重玩一关
   * 打得差就会让总星数掉下来，排行榜上的星数会莫名其妙变少。
   */
  getTotalStars() {
    let totalStars = 0
    try {
      const cleared = Math.max(0, (parseInt(this.getCurrentLevel(), 10) || 1) - 1)
      for (let i = 1; i <= cleared; i++) {
        const data = wx.getStorageSync(`level_${i}`)
        if (!data) continue
        const stars = typeof data.bestStars === 'number' ? data.bestStars : data.stars
        if (stars) totalStars += stars
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
   * 本地记录（关卡 / 总星数 / 最高关步数），按「只升不降」合并
   *
   * 排行榜里要显示玩家自己的成绩，但开放数据域的 getFriendCloudStorage
   * **只返回好友、不含自己**，所以自己这一行必须由主域算好传过去。
   *
   * @returns {{level:number, stars:number, moves:number}}
   */
  getLocalRecord() {
    const unlocked = parseInt(this.getCurrentLevel(), 10) || 1
    const cleared = Math.max(0, unlocked - 1)
    const mirror = this.loadCloudRecord()

    return {
      level: Math.max(mirror.level || 0, cleared),
      stars: Math.max(mirror.stars || 0, this.getTotalStars()),
      moves: mirror.moves || 0
    }
  }

  /**
   * 综合分：关卡优先，其次总星数，最后步数越少越高
   *
   * 排序口径见 `open-data/index.js`（好友榜按 level → stars → moves 三级排），
   * 这个编码只是给「后台排行榜配置 / 搜索与社交组件」留的兼容字段。
   *
   * 权重必须是 1e9 / 1e5 / 1：
   *   星数上限是 3 × 关卡（每关最多 3 星），旧版用 10000 / 100 的权重，
   *   星数超过 100 之后就会串位 —— 第 99 关 297 星的玩家会压过第 100 关 3 星
   *   的玩家，也就是「关卡优先」这个约定在高关卡直接失效。
   *   取 stars 权重 1e5（3e5 × level < 1e9 × level 恒成立）、moves 权重 1
   *   之后，任何关卡数下都不会串位。
   *
   * @param {{level:number, stars:number, moves:number}} record
   * @returns {number}
   */
  static computeScore(record) {
    const level = Math.max(0, Math.floor(record.level) || 0)
    const stars = Math.max(0, Math.floor(record.stars) || 0)
    const moves = Math.max(0, Math.floor(record.moves) || 0)
    return level * 1e9 + stars * 1e5 + (99999 - Math.min(moves, 99999))
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
    // moves <= 0 表示「只同步关卡进度，不带步数」（进排行榜时的补同步走这条路），
    // 不能拿 0 去覆盖真实步数，否则分数会虚高
    if (moves > 0) {
      if (level > prev.level) {
        // 刷新了最高关：记录这一关的步数
        bestMoves = moves
      } else if (level === prev.level) {
        // 同一关重打：取更好的一次
        bestMoves = prev.moves > 0 ? Math.min(prev.moves, moves) : moves
      }
      // level < prev.level 时保留旧记录，不回退
    }

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
   * 用本地存档补一次云端上报
   *
   * 场景：玩家在别的设备/别的会话里通关过，但当时的 setUserCloudStorage
   * 因为没网、拒绝授权等原因失败了。进排行榜前补一次，
   * 至少保证「自己」会出现在好友榜里，而不是打开一片空白。
   *
   * 只在本地确有通关记录（unlockedLevel > 1）时才上报。
   * @returns {boolean} 是否发起了上报
   */
  syncLocalRecord() {
    if (typeof wx === 'undefined' || !wx.setUserCloudStorage) return false

    const unlocked = parseInt(this.getCurrentLevel(), 10) || 1
    const clearedLevel = unlocked - 1
    if (clearedLevel <= 0) return false

    this.reportScore(clearedLevel, 0, 0)
    return true
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
