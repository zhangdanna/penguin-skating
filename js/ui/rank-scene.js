import Button from './button'
import {
  COLORS,
  drawGlassPanel,
  drawOceanBackdrop,
  drawStickerText,
  fillRoundRect,
  font
} from './theme'

/**
 * 排行榜场景
 * 显示好友排行榜
 */
export default class RankScene {
  constructor(sceneManager, wechatService) {
    this.sceneManager = sceneManager
    this.wechatService = wechatService
    this.buttons = []
    this.isVisible = false
    this.rankList = []
    this.isLoading = false

    // 开放数据域canvas
    this.sharedCanvas = null
    this.openDataContext = null

    this.init()
  }

  init() {
    // 返回按钮
    this.buttons.push(new Button({
      x: 18,
      y: 22,
      width: 76,
      height: 36,
      text: '返回',
      fontSize: 15,
      bgColor: COLORS.lavender,
      hoverColor: COLORS.lavenderDeep,
      borderColor: '#7255CC',
      onClick: () => {
        this.hide()
        this.sceneManager.switchTo('menu')
      }
    }))

    // 初始化开放数据域
    this.initOpenDataContext()
  }

  initOpenDataContext() {
    try {
      this.openDataContext = wx.getOpenDataContext()
      this.sharedCanvas = this.openDataContext.canvas
    } catch (e) {
      console.warn('开放数据域初始化失败:', e)
    }
  }

  async loadRankData() {
    if (!this.wechatService.isLogin) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }

    this.isLoading = true

    try {
      // 通知开放数据域显示排行榜
      if (this.openDataContext) {
        this.openDataContext.postMessage({
          type: 'SHOW_RANK'
        })
      }

      // 同时获取好友排行数据
      this.rankList = await this.wechatService.getFriendRank()
    } catch (e) {
      console.error('加载排行数据失败:', e)
      this.rankList = []
    }

    this.isLoading = false
  }

  show() {
    this.isVisible = true
    this.loadRankData()
  }

  hide() {
    this.isVisible = false

    // 通知开放数据域隐藏
    if (this.openDataContext) {
      this.openDataContext.postMessage({
        type: 'HIDE_RANK'
      })
    }
  }

  onEnter() {
    this.show()
  }

  onExit() {
    this.hide()
  }

  update() {
    // 更新逻辑
  }

  render(ctx) {
    if (!this.isVisible) return

    // 绘制背景
    this.renderBackground(ctx)

    // 绘制标题
    this.renderTitle(ctx)

    // 绘制返回按钮
    this.buttons[0].render(ctx)

    // 绘制排行榜内容
    if (this.isLoading) {
      this.renderLoading(ctx)
    } else if (!this.wechatService.isLogin) {
      this.renderNotLogin(ctx)
    } else if (this.rankList.length === 0) {
      this.renderEmpty(ctx)
    } else {
      this.renderRankList(ctx)
    }

    // 绘制开放数据域canvas（如果可用）
    if (this.sharedCanvas) {
      try {
        ctx.drawImage(this.sharedCanvas, 0, 0, canvas.width, canvas.height)
      } catch (e) {
        // 忽略绘制错误
      }
    }
  }

  renderBackground(ctx) {
    drawOceanBackdrop(ctx, Date.now() / 1000)
  }

  renderTitle(ctx) {
    drawGlassPanel(ctx, 97, 22, 180, 46, 23, {
      fill: 'rgba(255, 255, 255, 0.86)'
    })
    drawStickerText(ctx, '好友排行榜', canvas.width / 2, 46, {
      size: 21,
      color: COLORS.navy,
      strokeWidth: 0
    })
  }

  renderLoading(ctx) {
    drawStickerText(ctx, '加载中...', canvas.width / 2, canvas.height / 2, {
      size: 20,
      color: COLORS.white,
      strokeWidth: 4
    })
  }

  renderNotLogin(ctx) {
    const centerX = canvas.width / 2

    drawGlassPanel(ctx, 40, 210, 295, 150, 24, {
      fill: 'rgba(255, 249, 238, 0.95)'
    })

    ctx.fillStyle = COLORS.navy
    ctx.font = font(18)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('请先登录后查看排行榜', centerX, 268)

    ctx.fillStyle = COLORS.navySoft
    ctx.font = font(13, 'normal')
    ctx.fillText('点击"返回"后进入个人中心登录', centerX, 304)
  }

  renderEmpty(ctx) {
    const centerX = canvas.width / 2

    drawGlassPanel(ctx, 40, 190, 295, 190, 24, {
      fill: 'rgba(255, 249, 238, 0.95)'
    })

    ctx.fillStyle = COLORS.navy
    ctx.font = font(18)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('暂无排行数据', centerX, 250)

    ctx.fillStyle = COLORS.navySoft
    ctx.font = font(13, 'normal')
    ctx.fillText('快去通关获取分数吧！', centerX, 290)
    ctx.fillText('邀请好友一起挑战！', centerX, 316)
  }

  renderRankList(ctx) {
    const startY = 96
    const itemHeight = 64
    const maxItems = 8
    const listWidth = canvas.width - 40

    // 表头
    fillRoundRect(ctx, 20, startY, listWidth, 38, 14, 'rgba(255, 255, 255, 0.85)')

    ctx.fillStyle = COLORS.navySoft
    ctx.font = font(12)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('排名', 56, startY + 19)
    ctx.textAlign = 'left'
    ctx.fillText('昵称', 104, startY + 19)
    ctx.textAlign = 'center'
    ctx.fillText('关卡', 256, startY + 19)
    ctx.fillText('星星', 312, startY + 19)
    ctx.textAlign = 'right'
    ctx.fillText('分数', canvas.width - 38, startY + 19)

    // 排行项
    const displayList = this.rankList.slice(0, maxItems)
    displayList.forEach((item, index) => {
      const y = startY + 46 + index * itemHeight
      const rank = index + 1
      const rowHeight = itemHeight - 8

      // 奶油卡片行
      fillRoundRect(
        ctx,
        20,
        y,
        listWidth,
        rowHeight,
        14,
        index % 2 === 0 ? 'rgba(255, 255, 255, 0.82)' : 'rgba(234, 249, 255, 0.82)'
      )

      // 排名
      let rankColor = COLORS.navy
      if (rank === 1) rankColor = COLORS.yellowDeep
      else if (rank === 2) rankColor = '#8FA6B8'
      else if (rank === 3) rankColor = COLORS.orangeDeep

      ctx.fillStyle = rankColor
      ctx.font = font(22)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(rank.toString(), 56, y + rowHeight / 2)

      // 昵称
      ctx.fillStyle = COLORS.navy
      ctx.font = font(15)
      ctx.textAlign = 'left'
      const nickName = item.nickName || '微信用户'
      const displayName = nickName.length > 8 ? nickName.substring(0, 8) + '...' : nickName
      ctx.fillText(displayName, 104, y + rowHeight / 2)

      // 关卡
      ctx.fillStyle = COLORS.navySoft
      ctx.font = font(13, 'normal')
      ctx.textAlign = 'center'
      ctx.fillText(`Lv.${item.level}`, 256, y + rowHeight / 2)

      // 星星
      ctx.fillStyle = COLORS.yellowDeep
      ctx.font = font(14)
      const starText = '★'.repeat(item.stars) + '☆'.repeat(3 - item.stars)
      ctx.fillText(starText, 312, y + rowHeight / 2)

      // 分数
      ctx.fillStyle = COLORS.mintDeep
      ctx.font = font(16)
      ctx.textAlign = 'right'
      ctx.fillText(item.score.toString(), canvas.width - 38, y + rowHeight / 2)
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
