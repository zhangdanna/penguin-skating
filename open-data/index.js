/**
 * 开放数据域入口
 * 用于渲染排行榜等需要访问开放数据的功能
 */

const sharedCanvas = wx.getSharedCanvas()
const ctx = sharedCanvas.getContext('2d')

// 获取屏幕信息
const systemInfo = wx.getSystemInfoSync()
const screenWidth = systemInfo.windowWidth
const screenHeight = systemInfo.windowHeight

// 排行榜数据
let rankList = []
let currentPage = 0
const pageSize = 10

// 样式配置
const styles = {
  bg: '#1a5276',
  titleBg: '#2874a6',
  itemBg: '#3498db',
  itemBgAlt: '#2980b9',
  text: '#ffffff',
  textSecondary: '#bdc3c7',
  gold: '#f1c40f',
  silver: '#bdc3c7',
  bronze: '#cd6155',
  buttonBg: '#27ae60',
  buttonHover: '#229954'
}

// 监听主域消息
wx.onMessage((data) => {
  switch (data.type) {
    case 'SHOW_RANK':
      loadRankData()
      break
    case 'HIDE_RANK':
      clearCanvas()
      break
    case 'NEXT_PAGE':
      currentPage++
      renderRankList()
      break
    case 'PREV_PAGE':
      if (currentPage > 0) {
        currentPage--
        renderRankList()
      }
      break
  }
})

/**
 * 加载排行数据
 */
function loadRankData() {
  wx.getFriendCloudStorage({
    keyList: ['level', 'moves', 'stars', 'score'],
    success: (res) => {
      // 解析数据
      rankList = res.data
        .map(item => {
          const kv = {}
          if (item.KVList) {
            item.KVList.forEach(k => {
              kv[k.key] = k.value
            })
          }
          return {
            nickName: item.nickname || '微信用户',
            avatarUrl: item.avatarUrl || '',
            level: parseInt(kv.level) || 0,
            moves: parseInt(kv.moves) || 0,
            stars: parseInt(kv.stars) || 0,
            score: parseInt(kv.score) || 0
          }
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)

      currentPage = 0
      renderRankList()
    },
    fail: (err) => {
      console.error('获取排行数据失败:', err)
      renderError()
    }
  })
}

/**
 * 渲染排行榜
 */
function renderRankList() {
  clearCanvas()

  // 绘制背景
  drawBackground()

  // 绘制标题
  drawTitle()

  // 绘制排行列表
  const startIdx = currentPage * pageSize
  const endIdx = Math.min(startIdx + pageSize, rankList.length)
  const pageData = rankList.slice(startIdx, endIdx)

  if (pageData.length === 0) {
    drawEmpty()
  } else {
    drawRankItems(pageData, startIdx)
  }

  // 绘制分页按钮
  drawPagination()
}

/**
 * 清空画布
 */
function clearCanvas() {
  ctx.clearRect(0, 0, sharedCanvas.width, sharedCanvas.height)
}

/**
 * 绘制背景
 */
function drawBackground() {
  ctx.fillStyle = styles.bg
  ctx.fillRect(0, 0, screenWidth, screenHeight)
}

/**
 * 绘制标题
 */
function drawTitle() {
  // 标题背景
  ctx.fillStyle = styles.titleBg
  ctx.fillRect(0, 0, screenWidth, 80)

  // 标题文字
  ctx.fillStyle = styles.text
  ctx.font = 'bold 28px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('好友排行榜', screenWidth / 2, 40)
}

/**
 * 绘制排行项
 */
function drawRankItems(items, startIdx) {
  const itemHeight = 70
  const startY = 100

  items.forEach((item, index) => {
    const rank = startIdx + index + 1
    const y = startY + index * itemHeight

    // 背景色交替
    ctx.fillStyle = index % 2 === 0 ? styles.itemBg : styles.itemBgAlt
    ctx.fillRect(20, y, screenWidth - 40, itemHeight - 10)

    // 排名
    let rankColor = styles.text
    if (rank === 1) rankColor = styles.gold
    else if (rank === 2) rankColor = styles.silver
    else if (rank === 3) rankColor = styles.bronze

    ctx.fillStyle = rankColor
    ctx.font = 'bold 24px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(rank.toString(), 50, y + 30)

    // 昵称
    ctx.fillStyle = styles.text
    ctx.font = '18px Arial'
    ctx.textAlign = 'left'
    ctx.fillText(item.nickName, 90, y + 25)

    // 关卡和星星
    ctx.fillStyle = styles.textSecondary
    ctx.font = '14px Arial'
    ctx.fillText(`关卡 ${item.level}`, 90, y + 50)

    // 星星
    const starText = '★'.repeat(item.stars) + '☆'.repeat(3 - item.stars)
    ctx.fillStyle = styles.gold
    ctx.fillText(starText, 180, y + 50)

    // 分数
    ctx.fillStyle = styles.text
    ctx.font = 'bold 20px Arial'
    ctx.textAlign = 'right'
    ctx.fillText(item.score.toString(), screenWidth - 40, y + 30)
  })
}

/**
 * 绘制空状态
 */
function drawEmpty() {
  ctx.fillStyle = styles.textSecondary
  ctx.font = '20px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('暂无排行数据', screenWidth / 2, screenHeight / 2)
  ctx.fillText('快去邀请好友一起玩吧！', screenWidth / 2, screenHeight / 2 + 40)
}

/**
 * 绘制分页
 */
function drawPagination() {
  const totalPages = Math.ceil(rankList.length / pageSize)
  const y = screenHeight - 60

  // 上一页按钮
  if (currentPage > 0) {
    ctx.fillStyle = styles.buttonBg
    ctx.fillRect(50, y, 100, 40)
    ctx.fillStyle = styles.text
    ctx.font = '16px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('上一页', 100, y + 20)
  }

  // 页码
  ctx.fillStyle = styles.text
  ctx.font = '16px Arial'
  ctx.textAlign = 'center'
  ctx.fillText(`${currentPage + 1} / ${totalPages || 1}`, screenWidth / 2, y + 20)

  // 下一页按钮
  if (currentPage < totalPages - 1) {
    ctx.fillStyle = styles.buttonBg
    ctx.fillRect(screenWidth - 150, y, 100, 40)
    ctx.fillStyle = styles.text
    ctx.font = '16px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('下一页', screenWidth - 100, y + 20)
  }
}

/**
 * 绘制错误状态
 */
function renderError() {
  clearCanvas()
  drawBackground()

  ctx.fillStyle = styles.text
  ctx.font = '20px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('加载失败，请稍后重试', screenWidth / 2, screenHeight / 2)
}

// 初始渲染
clearCanvas()
drawBackground()
ctx.fillStyle = styles.text
ctx.font = '20px Arial'
ctx.textAlign = 'center'
ctx.textBaseline = 'middle'
ctx.fillText('加载中...', screenWidth / 2, screenHeight / 2)
