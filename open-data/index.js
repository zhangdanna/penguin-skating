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
let selfRecord = null
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
/** 底部「我的成绩」固定行 */
const SELF_HEIGHT = 44

// 监听主域消息
wx.onMessage((data) => {
  if (!data || !data.type) return

  switch (data.type) {
    case 'SHOW_RANK':
      if (data.layout && data.layout.width > 0) {
        layout = data.layout
      }
      selfRecord = data.self || null
      loadRankData()
      break
    case 'HIDE_RANK':
      clearCanvas()
      status = 'idle'
      break
  }
})

/**
 * 排行榜排序口径
 *
 *   1. 通关关卡（高 → 低）—— 主口径，进度就是实力
 *   2. 总星数（多 → 少）—— 同进度比质量
 *   3. 最高关步数（少 → 多）—— 前两项都相同时比效率
 *
 * 不按 `score` 单值排序：关卡无上限、星数上限是 3×关卡，任何固定权重
 * 的编码在关卡够高时都会串位。三级比较永远不会溢出。
 */
function compareRank(a, b) {
  if (b.level !== a.level) return b.level - a.level
  if (b.stars !== a.stars) return b.stars - a.stars

  // moves = 0 表示还没记录过步数，排在有记录的后面
  const am = a.moves > 0 ? a.moves : Number.MAX_SAFE_INTEGER
  const bm = b.moves > 0 ? b.moves : Number.MAX_SAFE_INTEGER
  return am - bm
}

/**
 * 加载排行数据
 */
function loadRankData() {
  status = 'loading'
  clearCanvas()
  drawMessage('加载中...')

  wx.getFriendCloudStorage({
    keyList: ['level', 'moves', 'stars'],
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
            stars: parseInt(kv.stars, 10) || 0
          }
        })
        // 只要玩过的（level > 0），避免 0 分玩家被过滤掉
        .filter(item => item.level > 0)
        .sort(compareRank)

      status = 'ready'
      renderRankList()
    },
    fail: (err) => {
      const msg = (err && err.errMsg) || ''
      console.warn('获取排行数据失败:', msg)
      status = 'error'
      clearCanvas()

      // 未授权和网络失败要分开说：前者玩家能自己修，后者只能重试
      if (/auth|deny|denied|permission|scope/i.test(msg)) {
        drawMessage('还没有开启好友排行', '需要授权「微信朋友关系」后才能看到好友成绩')
      } else {
        drawMessage('排行榜加载失败', '请稍后重试')
      }
    }
  })
}

/**
 * 渲染排行榜
 */
function renderRankList() {
  clearCanvas()

  if (!rankList.length) {
    drawMessage('还没有好友上榜', '通关后成绩会自动同步，快邀请好友一起挑战')
    drawSelfRow()
    return
  }

  drawHeader()

  // 底部固定留出「我的成绩」一行
  const maxRows = Math.max(
    1,
    Math.floor((layout.height - HEADER_HEIGHT - 8 - SELF_HEIGHT - 10) / ROW_HEIGHT)
  )
  const rows = rankList.slice(0, maxRows)

  rows.forEach((item, index) => {
    drawRow(item, index, index * ROW_HEIGHT)
  })

  drawSelfRow()
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
  ctx.fillText('关卡', layout.x + layout.width - 122, y + HEADER_HEIGHT / 2)
  ctx.fillText('星星', layout.x + layout.width - 74, y + HEADER_HEIGHT / 2)

  ctx.textAlign = 'right'
  ctx.fillText('步数', layout.x + layout.width - 14, y + HEADER_HEIGHT / 2)
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
  ctx.fillText(`Lv.${item.level}`, layout.x + layout.width - 122, centerY)

  // 总星数（口径：各关历史最高星之和）
  ctx.fillStyle = STYLE.gold
  ctx.font = `12px ${STYLE.font}`
  ctx.textAlign = 'center'
  ctx.fillText(`★${item.stars}`, layout.x + layout.width - 74, centerY)

  // 最高关步数（越少越好，没记录就显示 -）
  ctx.fillStyle = STYLE.mint
  ctx.font = `bold 14px ${STYLE.font}`
  ctx.textAlign = 'right'
  ctx.fillText(item.moves > 0 ? String(item.moves) : '-', layout.x + layout.width - 14, centerY)
}

/**
 * 底部「我的成绩」
 *
 * getFriendCloudStorage 只返回好友，不含自己；主域把自己的记录一并传进来，
 * 固定钉在列表底部，玩家打开排行榜至少能看到自己的进度。
 */
function drawSelfRow() {
  if (!selfRecord || !selfRecord.level) return

  const y = layout.y + layout.height - SELF_HEIGHT
  const height = SELF_HEIGHT - 6

  roundRect(layout.x, y, layout.width, height, 12)
  ctx.fillStyle = 'rgba(47, 191, 155, 0.16)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(47, 191, 155, 0.55)'
  ctx.lineWidth = 1.4
  ctx.stroke()

  const centerY = y + height / 2

  // 「我」标签
  roundRect(layout.x + 12, centerY - 11, 34, 22, 11)
  ctx.fillStyle = STYLE.mint
  ctx.fill()
  ctx.fillStyle = '#FFFFFF'
  ctx.font = `bold 12px ${STYLE.font}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('我', layout.x + 29, centerY)

  ctx.fillStyle = STYLE.text
  ctx.font = `bold 13px ${STYLE.font}`
  ctx.textAlign = 'left'
  ctx.fillText('我的成绩', layout.x + 56, centerY)

  // 在好友里的名次：自己不在 getFriendCloudStorage 的返回里，
  // 只能按「比我强的有几个」算出来
  const rank = selfRankAmongFriends()
  if (rank > 0) {
    ctx.fillStyle = STYLE.textSoft
    ctx.font = `11px ${STYLE.font}`
    ctx.fillText(`· 第${rank}名`, layout.x + 56 + 58, centerY)
  }

  ctx.fillStyle = STYLE.textSoft
  ctx.font = `12px ${STYLE.font}`
  ctx.textAlign = 'center'
  ctx.fillText(`Lv.${selfRecord.level}`, layout.x + layout.width - 122, centerY)

  ctx.fillStyle = STYLE.gold
  ctx.fillText(`★${selfRecord.stars || 0}`, layout.x + layout.width - 74, centerY)

  ctx.fillStyle = STYLE.mint
  ctx.font = `bold 14px ${STYLE.font}`
  ctx.textAlign = 'right'
  ctx.fillText(selfRecord.moves > 0 ? String(selfRecord.moves) : '-', layout.x + layout.width - 14, centerY)
}

/**
 * 自己在好友里的名次
 *
 * getFriendCloudStorage 不含自己，只能数「比我排得靠前的有几个」。
 * 一个好友都没玩过时返回 1（自己就是第一）。
 */
function selfRankAmongFriends() {
  if (!selfRecord || !selfRecord.level) return 0

  let better = 0
  rankList.forEach((item) => {
    if (compareRank(item, selfRecord) < 0) better++
  })
  return better + 1
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
