/**
 * 开放数据域入口
 *
 * 职责：读取好友关系链数据并**只在自己的内容矩形内**绘制排行榜。
 * 主域会把这个画布整屏合成到主域画布上，所以：
 *   - 内容矩形之外的区域必须保持透明，否则会盖住主域的标题与返回按钮
 *   - 不再绘制自己的背景色/标题栏（主域已经画了）
 */

const sharedCanvas = wx.getSharedCanvas()
const ctx = sharedCanvas.getContext('2d')

const systemInfo = wx.getSystemInfoSync()
const screenWidth = systemInfo.windowWidth
const screenHeight = systemInfo.windowHeight

// 共享画布同样要按设备像素比放大，否则合成到主域后排行榜文字会发虚
const dpr = Math.min(systemInfo.pixelRatio > 0 ? systemInfo.pixelRatio : 1, 3)

sharedCanvas.width = Math.round(screenWidth * dpr)
sharedCanvas.height = Math.round(screenHeight * dpr)

// 之后一律用逻辑坐标绘制
ctx.scale(dpr, dpr)

// 主域通过 postMessage 下发的内容区域（含默认值兜底）
let layout = {
  x: 16,
  y: 96,
  width: screenWidth - 32,
  height: screenHeight - 96 - 88
}

// 排行榜数据
let rankList = []
let status = 'idle'   // idle | loading | ready | error

// 视觉样式：与主域糖果海洋馆风格保持一致
const STYLE = {
  headerBg: 'rgba(255, 255, 255, 0.92)',
  rowBg: 'rgba(255, 255, 255, 0.82)',
  rowBgAlt: 'rgba(234, 249, 255, 0.82)',
  text: '#1F3A5F',
  textSoft: '#4A6B8C',
  gold: '#E5A72B',
  silver: '#8FA6B8',
  bronze: '#E07C36',
  mint: '#1FA383',
  font: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif'
}

const ROW_HEIGHT = 46
const HEADER_HEIGHT = 34

// 监听主域消息
wx.onMessage((data) => {
  if (!data || !data.type) return

  switch (data.type) {
    case 'SHOW_RANK':
      if (data.layout && data.layout.width > 0) {
        layout = data.layout
      }
      loadRankData()
      break
    case 'HIDE_RANK':
      clearCanvas()
      status = 'idle'
      break
  }
})

/**
 * 加载排行数据
 */
function loadRankData() {
  status = 'loading'
  clearCanvas()
  drawMessage('加载中...')

  wx.getFriendCloudStorage({
    keyList: ['level', 'moves', 'stars', 'score'],
    success: (res) => {
      rankList = (res.data || [])
        .map(item => {
          const kv = {}
          if (item.KVList) {
            item.KVList.forEach(k => { kv[k.key] = k.value })
          }
          return {
            nickName: item.nickname || '微信用户',
            level: parseInt(kv.level, 10) || 0,
            moves: parseInt(kv.moves, 10) || 0,
            stars: parseInt(kv.stars, 10) || 0,
            score: parseInt(kv.score, 10) || 0
          }
        })
        // 只要玩过的（level > 0），避免 0 分玩家被过滤掉
        .filter(item => item.level > 0)
        .sort((a, b) => b.score - a.score)

      status = 'ready'
      renderRankList()
    },
    fail: (err) => {
      console.error('获取排行数据失败:', err)
      status = 'error'
      clearCanvas()
      drawMessage('排行榜加载失败', '请稍后重试')
    }
  })
}

/**
 * 渲染排行榜
 */
function renderRankList() {
  clearCanvas()

  if (!rankList.length) {
    drawMessage('暂无排行数据', '邀请好友一起挑战吧')
    return
  }

  drawHeader()

  const maxRows = Math.max(1, Math.floor((layout.height - HEADER_HEIGHT - 8) / ROW_HEIGHT))
  const rows = rankList.slice(0, maxRows)

  rows.forEach((item, index) => {
    drawRow(item, index, index * ROW_HEIGHT)
  })
}

/**
 * 清空整块画布（含内容区外的透明区域）
 */
function clearCanvas() {
  ctx.clearRect(0, 0, screenWidth, screenHeight)
}

/**
 * 表头
 */
function drawHeader() {
  const y = layout.y

  roundRect(layout.x, y, layout.width, HEADER_HEIGHT, 12)
  ctx.fillStyle = STYLE.headerBg
  ctx.fill()

  ctx.textBaseline = 'middle'
  ctx.fillStyle = STYLE.textSoft
  ctx.font = `bold 11px ${STYLE.font}`

  ctx.textAlign = 'center'
  ctx.fillText('排名', layout.x + 30, y + HEADER_HEIGHT / 2)

  ctx.textAlign = 'left'
  ctx.fillText('昵称', layout.x + 62, y + HEADER_HEIGHT / 2)

  ctx.textAlign = 'center'
  ctx.fillText('关卡', layout.x + layout.width - 132, y + HEADER_HEIGHT / 2)
  ctx.fillText('星星', layout.x + layout.width - 84, y + HEADER_HEIGHT / 2)

  ctx.textAlign = 'right'
  ctx.fillText('分数', layout.x + layout.width - 14, y + HEADER_HEIGHT / 2)
}

/**
 * 单行排行项
 */
function drawRow(item, index, offsetY) {
  const rank = index + 1
  const y = layout.y + HEADER_HEIGHT + 8 + offsetY
  const rowHeight = ROW_HEIGHT - 8

  roundRect(layout.x, y, layout.width, rowHeight, 12)
  ctx.fillStyle = index % 2 === 0 ? STYLE.rowBg : STYLE.rowBgAlt
  ctx.fill()

  const centerY = y + rowHeight / 2

  // 排名
  let rankColor = STYLE.text
  if (rank === 1) rankColor = STYLE.gold
  else if (rank === 2) rankColor = STYLE.silver
  else if (rank === 3) rankColor = STYLE.bronze

  ctx.textBaseline = 'middle'
  ctx.fillStyle = rankColor
  ctx.font = `bold 18px ${STYLE.font}`
  ctx.textAlign = 'center'
  ctx.fillText(String(rank), layout.x + 30, centerY)

  // 昵称（超长截断）
  const maxNameWidth = layout.width - 62 - 150
  ctx.fillStyle = STYLE.text
  ctx.font = `bold 14px ${STYLE.font}`
  ctx.textAlign = 'left'
  ctx.fillText(ellipsis(item.nickName, maxNameWidth), layout.x + 62, centerY)

  // 关卡
  ctx.fillStyle = STYLE.textSoft
  ctx.font = `12px ${STYLE.font}`
  ctx.textAlign = 'center'
  ctx.fillText(`Lv.${item.level}`, layout.x + layout.width - 132, centerY)

  // 总星数（C6：上报口径改为"累计总星数"，不再是单关 0-3 星）
  ctx.fillStyle = STYLE.gold
  ctx.font = `12px ${STYLE.font}`
  ctx.textAlign = 'center'
  ctx.fillText(`★${item.stars}`, layout.x + layout.width - 84, centerY)

  // 分数
  ctx.fillStyle = STYLE.mint
  ctx.font = `bold 15px ${STYLE.font}`
  ctx.textAlign = 'right'
  ctx.fillText(String(item.score), layout.x + layout.width - 14, centerY)
}

/**
 * 空态 / 加载 / 错误提示
 */
function drawMessage(title, subtitle) {
  const centerX = layout.x + layout.width / 2
  const centerY = layout.y + Math.min(layout.height / 2, 200)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  ctx.fillStyle = STYLE.text
  ctx.font = `bold 17px ${STYLE.font}`
  ctx.fillText(title, centerX, centerY)

  if (subtitle) {
    ctx.fillStyle = STYLE.textSoft
    ctx.font = `13px ${STYLE.font}`
    ctx.fillText(subtitle, centerX, centerY + 28)
  }
}

/**
 * 超长文本截断
 */
function ellipsis(text, maxWidth) {
  const value = String(text || '')
  if (ctx.measureText(value).width <= maxWidth) return value

  let result = value
  while (result.length > 1 && ctx.measureText(result + '...').width > maxWidth) {
    result = result.slice(0, -1)
  }
  return result + '...'
}

/**
 * 圆角矩形路径
 */
function roundRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
