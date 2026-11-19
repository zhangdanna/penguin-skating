import Button from './button'
import {
  COLORS,
  drawGlassPanel,
  drawOceanCached,
  drawOceanMotion,
  drawStickerText,
  font
} from './theme'
import { viewport } from '../env'
import { computeBoardLayout } from './layout'

/** 标题面板高度 */
const TITLE_HEIGHT = 46
/** 标题面板 ↔ 排行列表 */
const GAP_TITLE_LIST = 28
/** 排行列表距屏幕底部 */
const LIST_BOTTOM = 88

/**
 * 排行榜场景
 *
 * 关系链数据（wx.getFriendCloudStorage）只能在**开放数据域**中读取，
 * 主域不能直接调用，所以这里只负责：
 *   1. 画背景 / 标题 / 返回按钮
 *   2. 通过 postMessage 通知开放数据域渲染
 *   3. 把开放数据域画布合成到主域（只作为底层，标题与返回按钮在其之上）
 * 排行榜列表本身由 open-data/index.js 绘制。
 */
export default class RankScene {
  constructor(sceneManager, wechatService) {
    this.sceneManager = sceneManager
    this.wechatService = wechatService
    this.buttons = []
    this.isVisible = false

    /** 关系链授权被拒：主域自己画引导面板，不去碰开放数据域 */
    this.authDenied = false
    /** 当前环境没有授权能力（H5 预览）：只显示「请在小游戏中打开」 */
    this.unsupported = false
    /** 拒绝后是否已经主动问过（本会话只问一次，避免反复打扰） */
    this.authPrompted = false
    this.authButton = null

    // 开放数据域
    this.openDataContext = null
    this.sharedCanvas = null

    this.init()
  }

  init() {
    this.buildLayout()
    this.initOpenDataContext()
  }

  /**
   * 计算顶部元素位置
   *
   * 顶部留白直接取对局界面的 HUD 面板 y（computeBoardLayout().hudPanelY），
   * 这样「游戏界面 ↔ 好友排行榜」切来切去时顶部元素不会跳动。
   */
  buildLayout() {
    const vp = viewport()
    const { hudPanelY } = computeBoardLayout(vp)

    this.topY = hudPanelY

    const titleWidth = 180
    this.titlePanel = {
      x: Math.round((vp.width - titleWidth) / 2),
      y: hudPanelY,
      width: titleWidth,
      height: TITLE_HEIGHT
    }

    // 开放数据域的绘制起点：标题面板下方留 28px
    this.listTop = hudPanelY + TITLE_HEIGHT + GAP_TITLE_LIST

    // 重建按钮前先清空，避免 resize 后叠出一堆失效按钮
    this.buttons = []
    this.buttons.push(new Button({
      x: 18,
      y: hudPanelY,
      width: 76,
      height: 36,
      text: '返回',
      fontSize: 15,
      bgColor: COLORS.lavender,
      hoverColor: COLORS.lavenderDeep,
      borderColor: '#7255CC',
      onClick: () => {
        this.sceneManager.switchTo('menu')
      }
    }))

    // 未授权空态里的「去开启」按钮（只有 authDenied 时才渲染与响应）
    this.authButton = new Button({
      x: Math.round(vp.width / 2 - 62),
      y: this.listTop + 148,
      width: 124,
      height: 40,
      text: '去开启',
      fontSize: 15,
      bgColor: COLORS.mint,
      hoverColor: COLORS.mintDeep,
      borderColor: '#17876C',
      onClick: () => this.openAuthSetting()
    })
  }

  /**
   * 打开设置页重新授权
   *
   * 先再试一次 `wx.authorize`：正常情况下拒绝过就会直接 fail，但如果玩家
   * 刚在设置页里打开、本地 authSetting 还是旧值（getSetting 有缓存/延迟），
   * authorize 会直接 success 而不弹框 —— 这样能少跳一次设置页。
   * 失败再走 openSetting，两层层层兜底。
   */
  openAuthSetting() {
    if (!this.wechatService || typeof this.wechatService.openFriendAuthSetting !== 'function') return

    const service = this.wechatService
    const retryAuthorize = typeof service.ensureFriendAuth === 'function'
      ? service.ensureFriendAuth()
      : Promise.resolve(false)

    retryAuthorize.then((granted) => {
      if (!this.isVisible) return

      if (granted) {
        this.authDenied = false
        this.ensureAuthThenRank()
        return
      }

      service.openFriendAuthSetting().then((ok) => {
        if (!this.isVisible) return
        if (ok) {
          this.authDenied = false
          this.ensureAuthThenRank()
        }
      })
    })
  }

  /**
   * 窗口尺寸变化后重建布局
   */
  relayout() {
    this.buildLayout()
    if (this.isVisible && !this.authDenied) this.requestRank()
  }

  /**
   * 初始化开放数据域
   */
  initOpenDataContext() {
    try {
      if (typeof wx === 'undefined' || !wx.getOpenDataContext) {
        console.warn('当前环境不支持开放数据域')
        return
      }
      this.openDataContext = wx.getOpenDataContext()
      this.sharedCanvas = this.openDataContext.canvas
    } catch (e) {
      console.warn('开放数据域初始化失败:', e)
    }
  }

  /**
   * 请求开放数据域渲染排行榜
   */
  requestRank() {
    if (!this.openDataContext) return

    const vp = viewport()
    const top = this.listTop
    const bottom = LIST_BOTTOM

    this.openDataContext.postMessage({
      type: 'SHOW_RANK',
      // 把主域可用的内容区域一并告知，开放数据域只在这个矩形内绘制
      layout: {
        x: 16,
        y: top,
        width: vp.width - 32,
        height: Math.max(120, vp.height - top - bottom)
      },
      // 自己的成绩：getFriendCloudStorage 只返回好友，不含自己，
      // 不传过去的话玩家永远在榜上看不到自己
      self: this.wechatService && this.wechatService.getLocalRecord
        ? this.wechatService.getLocalRecord()
        : null
    })
  }

  /**
   * 先要授权，再拉数据
   *
   * 顺序不能反：wx.getFriendCloudStorage 是「需要 scope.WxFriendInteraction
   * 授权」的接口，未授权时直接进 fail，开放数据域只会画一句「加载失败」。
   * 之前少了这一步，所以排行榜一直是空的。
   */
  ensureAuthThenRank() {
    const service = this.wechatService
    if (!service || typeof service.ensureFriendAuth !== 'function') {
      this.requestRank()
      return
    }

    service.ensureFriendAuth().then((granted) => {
      if (!this.isVisible) return

      if (!granted) {
        // 环境不支持授权（H5）→ 走「请在小游戏中打开」；玩家拒绝 → 走引导面板
        this.unsupported = !!service.friendAuthUnsupported
        this.authDenied = !this.unsupported

        // 就算不看榜，自己的成绩也要留在云端好友才能看到。
        // setUserCloudStorage 不需要关系链授权，拒绝授权不影响上报。
        if (!this.unsupported && typeof service.syncLocalRecord === 'function') {
          service.syncLocalRecord()
        }

        // 拒绝态不要只留一张空面板让玩家自己找按钮：
        // 直接把「去开启」弹出来，省掉一次点击。
        // 但只在「之前就拒绝过」时弹 —— 玩家刚刚点掉系统框里的「拒绝」，
        // 马上再弹一个我们自己的框就是纠缠，等下次进来再说。
        if (this.authDenied && service.friendAuthPreviouslyDenied) this.promptAuthOnce()
        return
      }

      this.authDenied = false
      this.unsupported = false
      this.requestRank()

      // 本地存档补一次上报，等云端落库后再刷一次列表
      if (service.syncLocalRecord()) {
        setTimeout(() => {
          if (this.isVisible) this.requestRank()
        }, 1000)
      }
    })
  }

  /**
   * 拒绝授权后主动弹一次说明
   *
   * 微信规则：玩家拒绝过某个 scope 之后，`wx.authorize` 不再弹系统框、
   * 直接 fail，只能去 `wx.openSetting` 里手动打开。这一步绕不过去，
   * 但可以不让玩家"进到一个空页面、再自己找按钮" —— 直接问。
   *
   * 只弹一次：本会话内重复进排行榜不再打扰，面板上的「去开启」按钮仍在。
   */
  promptAuthOnce() {
    if (this.authPrompted) return
    this.authPrompted = true

    if (typeof wx === 'undefined' || typeof wx.showModal !== 'function') return

    wx.showModal({
      title: '开启好友排行榜',
      content: '排行榜需要读取好友的通关进度，要授权「微信朋友关系」。\n只用于排行，不会读取聊天等其它信息。',
      confirmText: '去开启',
      cancelText: '算了',
      success: (res) => {
        if (!res || !res.confirm || !this.isVisible) return
        this.openAuthSetting()
      }
    })
  }

  show() {
    this.isVisible = true
    this.authDenied = false
    this.unsupported = false

    this.ensureAuthThenRank()
  }

  hide() {
    this.isVisible = false

    if (this.openDataContext) {
      this.openDataContext.postMessage({ type: 'HIDE_RANK' })
    }
  }

  onEnter() {
    this.show()
  }

  onExit() {
    this.hide()
  }

  update() {
    // 无需主域更新
  }

  render(ctx) {
    if (!this.isVisible) return

    this.renderBackground(ctx)

    // 开放数据域画布先画，标题与返回按钮后画，保证按钮永远在可见层
    if (this.authDenied) {
      this.renderAuthDenied(ctx)
    } else if (this.unsupported) {
      this.renderFallback(ctx)
    } else {
      this.renderSharedCanvas(ctx)
    }

    this.renderTitle(ctx)
    this.buttons[0].render(ctx)

    if (this.authDenied && this.authButton) {
      this.authButton.render(ctx)
    }
  }

  /**
   * 未授权空态
   *
   * 不能只写一句「加载失败」：玩家不知道失败原因，也不知道怎么修。
   * 这里把「缺什么授权 / 用来做什么 / 去哪开」三件事说清楚，并给一个按钮。
   */
  renderAuthDenied(ctx) {
    const vp = viewport()
    const x = 24
    const width = vp.width - 48
    const y = this.listTop + 8
    const height = 196

    drawGlassPanel(ctx, x, y, width, height, 22, {
      fill: 'rgba(255, 249, 238, 0.96)'
    })

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    ctx.fillStyle = COLORS.navy
    ctx.font = font(16)
    ctx.fillText('开启好友排行榜', vp.width / 2, y + 38)

    ctx.fillStyle = COLORS.navySoft
    ctx.font = font(12, 'normal')
    ctx.fillText('需要授权「微信朋友关系」', vp.width / 2, y + 72)
    ctx.fillText('只用于读取好友的通关进度，', vp.width / 2, y + 96)
    ctx.fillText('不会读取聊天等其它信息', vp.width / 2, y + 116)
  }

  renderBackground(ctx) {
    // D7：静态层走共享离屏缓存，只重绘动态层
    drawOceanCached(ctx)
    drawOceanMotion(ctx, Date.now() / 1000)
  }

  /**
   * 合成开放数据域画布
   */
  renderSharedCanvas(ctx) {
    if (!this.sharedCanvas) {
      this.renderFallback(ctx)
      return
    }

    try {
      const vp = viewport()
      ctx.drawImage(this.sharedCanvas, 0, 0, vp.width, vp.height)
    } catch (e) {
      console.warn('绘制开放数据域画布失败:', e)
      this.renderFallback(ctx)
    }
  }

  renderFallback(ctx) {
    const vp = viewport()

    drawGlassPanel(ctx, 40, 210, vp.width - 80, 150, 24, {
      fill: 'rgba(255, 249, 238, 0.95)'
    })

    ctx.fillStyle = COLORS.navy
    ctx.font = font(16)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('排行榜暂不可用', vp.width / 2, 268)

    ctx.fillStyle = COLORS.navySoft
    ctx.font = font(12, 'normal')
    ctx.fillText('请在微信小游戏中打开', vp.width / 2, 300)
  }

  renderTitle(ctx) {
    const { x, y, width, height } = this.titlePanel

    drawGlassPanel(ctx, x, y, width, height, 23, {
      fill: 'rgba(255, 255, 255, 0.86)'
    })
    drawStickerText(ctx, '好友排行榜', x + width / 2, y + height / 2, {
      size: 21,
      color: COLORS.navy,
      strokeWidth: 0
    })
  }

  onTouchStart(touch) {
    if (!this.isVisible) return

    if (this.authDenied) {
      if (this.authButton) this.authButton.onTouchStart(touch)
      this.buttons.forEach(btn => btn.onTouchStart(touch))
      return
    }

    this.buttons.forEach(btn => btn.onTouchStart(touch))
  }

  onTouchMove(touch) {
    if (!this.isVisible) return

    const buttons = this.authDenied && this.authButton
      ? [...this.buttons, this.authButton]
      : this.buttons

    buttons.forEach(btn => {
      btn.isHovered = btn.contains(touch.clientX, touch.clientY)
    })
  }

  onTouchEnd(touch) {
    if (!this.isVisible) return

    if (this.authDenied && this.authButton) {
      this.authButton.onTouchEnd(touch)
    }

    this.buttons.forEach(btn => btn.onTouchEnd(touch))
  }
}
