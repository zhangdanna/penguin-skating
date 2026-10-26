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
  }

  /**
   * 窗口尺寸变化后重建布局
   */
  relayout() {
    this.buildLayout()
    if (this.isVisible) this.requestRank()
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
      }
    })
  }

  show() {
    this.isVisible = true

    // 先出列表，同时补一次自己的成绩上报 ——
    // 之前只有「通关那一刻」才上报，一旦那次失败（断网 / 拒绝授权），
    // 玩家自己都不会出现在好友榜里，打开就是一片空白。
    this.requestRank()

    if (this.wechatService && this.wechatService.syncLocalRecord()) {
      // setUserCloudStorage 是异步的，等云端落库后再刷一次
      setTimeout(() => {
        if (this.isVisible) this.requestRank()
      }, 1000)
    }
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
    this.renderSharedCanvas(ctx)

    this.renderTitle(ctx)
    this.buttons[0].render(ctx)
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

    this.buttons.forEach(btn => btn.onTouchStart(touch))
  }

  onTouchMove(touch) {
    if (!this.isVisible) return

    this.buttons.forEach(btn => {
      btn.isHovered = btn.contains(touch.clientX, touch.clientY)
    })
  }

  onTouchEnd(touch) {
    if (!this.isVisible) return

    this.buttons.forEach(btn => btn.onTouchEnd(touch))
  }
}
