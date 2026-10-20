import Button from './button'

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
      x: 20,
      y: 20,
      width: 80,
      height: 40,
      text: '返回',
      fontSize: 16,
      bgColor: '#95a5a6',
      hoverColor: '#7f8c8d',
      borderColor: '#707b7c',
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
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
    gradient.addColorStop(0, '#1a5276')
    gradient.addColorStop(1, '#2874a6')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  renderTitle(ctx) {
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 32px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('好友排行榜', canvas.width / 2, 60)
  }

  renderLoading(ctx) {
    ctx.fillStyle = '#ffffff'
    ctx.font = '20px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('加载中...', canvas.width / 2, canvas.height / 2)
  }

  renderNotLogin(ctx) {
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2

    ctx.fillStyle = '#bdc3c7'
    ctx.font = '20px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('请先登录后查看排行榜', centerX, centerY - 20)

    ctx.fillStyle = '#95a5a6'
    ctx.font = '16px Arial'
    ctx.fillText('点击"返回"后进入个人中心登录', centerX, centerY + 20)
  }

  renderEmpty(ctx) {
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2

    ctx.fillStyle = '#bdc3c7'
    ctx.font = '20px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('暂无排行数据', centerX, centerY - 40)

    ctx.fillStyle = '#95a5a6'
    ctx.font = '16px Arial'
    ctx.fillText('快去通关获取分数吧！', centerX, centerY)
    ctx.fillText('邀请好友一起挑战！', centerX, centerY + 30)
  }

  renderRankList(ctx) {
    const startY = 100
    const itemHeight = 70
    const maxItems = 8

    // 绘制表头
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.fillRect(20, startY, canvas.width - 40, 40)

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 14px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('排名', 60, startY + 25)
    ctx.textAlign = 'left'
    ctx.fillText('昵称', 110, startY + 25)
    ctx.textAlign = 'center'
    ctx.fillText('关卡', 250, startY + 25)
    ctx.fillText('星星', 310, startY + 25)
    ctx.textAlign = 'right'
    ctx.fillText('分数', canvas.width - 40, startY + 25)

    // 绘制排行项
    const displayList = this.rankList.slice(0, maxItems)
    displayList.forEach((item, index) => {
      const y = startY + 50 + index * itemHeight
      const rank = index + 1

      // 背景色交替
      ctx.fillStyle = index % 2 === 0 ? 'rgba(52, 152, 219, 0.3)' : 'rgba(41, 128, 185, 0.3)'
      ctx.fillRect(20, y, canvas.width - 40, itemHeight - 10)

      // 排名
      let rankColor = '#ffffff'
      if (rank === 1) rankColor = '#f1c40f'
      else if (rank === 2) rankColor = '#bdc3c7'
      else if (rank === 3) rankColor = '#cd6155'

      ctx.fillStyle = rankColor
      ctx.font = 'bold 24px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(rank.toString(), 60, y + 35)

      // 昵称
      ctx.fillStyle = '#ffffff'
      ctx.font = '16px Arial'
      ctx.textAlign = 'left'
      const nickName = item.nickName || '微信用户'
      const displayName = nickName.length > 8 ? nickName.substring(0, 8) + '...' : nickName
      ctx.fillText(displayName, 110, y + 30)

      // 关卡
      ctx.fillStyle = '#bdc3c7'
      ctx.font = '14px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(`Lv.${item.level}`, 250, y + 35)

      // 星星
      ctx.fillStyle = '#f1c40f'
      ctx.font = '16px Arial'
      const starText = '★'.repeat(item.stars) + '☆'.repeat(3 - item.stars)
      ctx.fillText(starText, 310, y + 35)

      // 分数
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 18px Arial'
      ctx.textAlign = 'right'
      ctx.fillText(item.score.toString(), canvas.width - 40, y + 35)
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
