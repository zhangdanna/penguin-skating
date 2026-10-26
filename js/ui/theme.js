/**
 * 视觉主题：糖果海洋馆
 * 统一色板与 Canvas 绘制工具，供游戏场景和 UI 场景复用
 */

import LayerCache from '../utils/layer-cache'
import { viewport } from '../env'

/**
 * 菜单 / 排行榜 / 对局三个界面用的是同一张海洋背景，
 * 共用一份离屏静态层，避免各持一张全屏画布（一张 ≈ 1MB）。
 */
const oceanLayer = new LayerCache('ocean-static')

export const COLORS = {
  cream: '#FFF9EE',
  paper: '#FFFFFF',
  iceLight: '#EAF9FF',
  ice: '#BEEBFF',
  iceDeep: '#7FD4F5',
  water: '#5BC8F5',
  waterDeep: '#2C9CD6',
  navy: '#1F3A5F',
  navyDeep: '#152A45',
  navySoft: '#4A6B8C',
  pink: '#FF7FB0',
  pinkDeep: '#E85F97',
  mint: '#2FBF9B',
  mintDeep: '#1FA383',
  lavender: '#A78BFA',
  lavenderDeep: '#8B6BE8',
  yellow: '#FFC94A',
  yellowDeep: '#E5A72B',
  orange: '#FF9F5A',
  orangeDeep: '#E07C36',
  coral: '#FF7A6B',
  white: '#FFFFFF',
  line: 'rgba(31, 58, 95, 0.16)'
}

export const FONT_FAMILY = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif'

/**
 * 生成字体声明
 */
export function font(size, weight = 'bold') {
  return `${weight} ${size}px ${FONT_FAMILY}`
}

/**
 * 圆角矩形路径
 */
export function roundRectPath(ctx, x, y, width, height, radius) {
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

export function fillRoundRect(ctx, x, y, width, height, radius, fillStyle) {
  ctx.fillStyle = fillStyle
  roundRectPath(ctx, x, y, width, height, radius)
  ctx.fill()
}

export function strokeRoundRect(ctx, x, y, width, height, radius, strokeStyle, lineWidth = 2) {
  ctx.strokeStyle = strokeStyle
  ctx.lineWidth = lineWidth
  roundRectPath(ctx, x, y, width, height, radius)
  ctx.stroke()
}

/**
 * 贴纸感文字：深色描边 + 实色填充
 */
export function drawStickerText(ctx, text, x, y, options = {}) {
  const {
    size = 20,
    color = COLORS.white,
    stroke = COLORS.navyDeep,
    strokeWidth = 4,
    align = 'center',
    baseline = 'middle',
    weight = 'bold'
  } = options

  ctx.save()
  ctx.font = font(size, weight)
  ctx.textAlign = align
  ctx.textBaseline = baseline
  ctx.lineJoin = 'round'

  if (strokeWidth > 0) {
    ctx.lineWidth = strokeWidth
    ctx.strokeStyle = stroke
    ctx.strokeText(text, x, y)
  }

  ctx.fillStyle = color
  ctx.fillText(text, x, y)
  ctx.restore()
}

/**
 * 五角星
 */
export function drawStar(ctx, cx, cy, radius, color, options = {}) {
  const { rotation = -Math.PI / 2, stroke = null, lineWidth = 2 } = options

  ctx.save()
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.45
    const angle = rotation + (i * Math.PI) / 5
    const x = cx + Math.cos(angle) * r
    const y = cy + Math.sin(angle) * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = lineWidth
    ctx.lineJoin = 'round'
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * 雪花
 */
export function drawSnowflake(ctx, cx, cy, radius, color = COLORS.white, lineWidth = 1.5) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(x, y)
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * 玻璃/亚克力面板
 */
export function drawGlassPanel(ctx, x, y, width, height, radius = 20, options = {}) {
  const {
    fill = 'rgba(255, 255, 255, 0.9)',
    stroke = 'rgba(255, 255, 255, 0.95)',
    shadow = 'rgba(31, 58, 95, 0.18)',
    lineWidth = 2
  } = options

  ctx.save()
  // D7：原来用 shadowBlur = 16 做大面板投影，低端机上这是每帧最贵的一笔；
  // 改成 3 层递进放大的半透明圆角矩形，视觉接近但不需要高斯模糊
  ctx.globalAlpha = 0.34
  for (let i = 3; i >= 1; i--) {
    const spread = i * 5
    fillRoundRect(
      ctx,
      x - spread / 2,
      y + 6 + spread / 2,
      width + spread,
      height + spread,
      radius + spread / 2,
      shadow
    )
  }
  ctx.restore()

  fillRoundRect(ctx, x, y, width, height, radius, fill)

  strokeRoundRect(ctx, x, y, width, height, radius, stroke, lineWidth)

  // 顶部高光条
  ctx.save()
  ctx.globalAlpha = 0.55
  const gloss = ctx.createLinearGradient(0, y, 0, y + height * 0.5)
  gloss.addColorStop(0, 'rgba(255, 255, 255, 0.85)')
  gloss.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = gloss
  roundRectPath(ctx, x + 3, y + 3, width - 6, height * 0.48, radius - 3)
  ctx.fill()
  ctx.restore()
}

/**
 * 深蓝半透明遮罩（用于弹层）
 */
export function drawOverlay(ctx, alpha = 0.55) {
  const vp = viewport()
  ctx.fillStyle = `rgba(9, 45, 72, ${alpha})`
  ctx.fillRect(0, 0, vp.width, vp.height)
}

/**
 * 糖果按钮（圆胖、厚投影、顶部高光）
 */
export function drawCandyButton(ctx, x, y, width, height, options = {}) {
  const {
    color = COLORS.mint,
    shadowColor = COLORS.mintDeep,
    radius = height / 2,
    pressed = false
  } = options

  const offsetY = pressed ? 2 : 0

  ctx.save()
  // 底部厚投影
  fillRoundRect(ctx, x, y + 4, width, height, radius, shadowColor)
  // 主体
  const gradient = ctx.createLinearGradient(0, y, 0, y + height)
  gradient.addColorStop(0, color)
  gradient.addColorStop(1, shadowColor)
  fillRoundRect(ctx, x, y + offsetY, width, height - (pressed ? 2 : 0), radius, gradient)
  // 顶部高光
  ctx.globalAlpha = 0.4
  fillRoundRect(ctx, x + 7, y + offsetY + 5, width - 14, height * 0.36, radius * 0.6, COLORS.white)
  ctx.restore()
}

/**
 * 海洋静态层（带离屏缓存）
 *
 * 菜单、排行榜、对局三个界面用的是同一张背景，共用一份缓存，
 * 避免每个场景各占一张全屏离屏画布。
 */
export function drawOceanCached(ctx) {
  const { width, height } = viewport()
  const cached = oceanLayer.render(
    ctx, `ocean@${width}x${height}`, width, height,
    (layerCtx) => drawOceanBase(layerCtx)
  )
  if (!cached) drawOceanBase(ctx)
}

/**
 * 静态层：水体渐变 + 顶部玻璃反光 + 沙底与珊瑚
 * 与时间无关，可以一次性画进离屏 canvas
 */
export function drawOceanBase(ctx) {
  const { width, height } = viewport()

  // 水体渐变
  const water = ctx.createLinearGradient(0, 0, 0, height)
  water.addColorStop(0, '#C9F4FF')
  water.addColorStop(0.45, '#7FD8F7')
  water.addColorStop(1, '#2C9CD6')
  ctx.fillStyle = water
  ctx.fillRect(0, 0, width, height)

  // 顶部玻璃反光
  const glass = ctx.createLinearGradient(0, 0, 0, height * 0.35)
  glass.addColorStop(0, 'rgba(255, 255, 255, 0.55)')
  glass.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = glass
  ctx.fillRect(0, 0, width, height * 0.35)

  drawSeaFloorBase(ctx, width, height)
}

/**
 * 动态层：光束 + 气泡 + 鱼群 + 海草摇摆
 */
export function drawOceanMotion(ctx, time) {
  const { width, height } = viewport()

  // 光束
  ctx.save()
  ctx.globalAlpha = 0.16
  ctx.fillStyle = COLORS.white
  for (let i = 0; i < 3; i++) {
    const sway = Math.sin(time * 0.3 + i * 1.7) * 18
    const startX = width * (0.18 + i * 0.3) + sway
    ctx.beginPath()
    ctx.moveTo(startX, -20)
    ctx.lineTo(startX + 70, -20)
    ctx.lineTo(startX + 170, height * 0.75)
    ctx.lineTo(startX + 20, height * 0.75)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()

  // 气泡
  for (let i = 0; i < 14; i++) {
    const r = 2 + (i % 4)
    const x = ((i * 67 + Math.sin(time * 0.5 + i) * 12) % (width + 20)) - 10
    const y = height - ((time * (16 + (i % 5) * 5) + i * 53) % (height + 80))
    ctx.beginPath()
    ctx.fillStyle = `rgba(255, 255, 255, ${0.16 + (i % 3) * 0.08})`
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // 远处小鱼剪影
  for (let i = 0; i < 2; i++) {
    const x = ((time * (14 + i * 8) + i * 260) % (width + 160)) - 80
    const y = height * (0.22 + i * 0.16) + Math.sin(time * 0.8 + i) * 8
    drawFish(ctx, x, y, 9 + i * 3, 'rgba(255, 255, 255, 0.35)')
  }

  drawSeaweed(ctx, time, width, height)
}

/**
 * 沙底与珊瑚（静态层）
 */
function drawSeaFloorBase(ctx, width, height) {
  const baseY = height - 104

  ctx.save()
  // 沙地
  ctx.beginPath()
  ctx.moveTo(0, height)
  ctx.lineTo(0, baseY + 14)
  ctx.quadraticCurveTo(width * 0.18, baseY - 18, width * 0.38, baseY - 2)
  ctx.quadraticCurveTo(width * 0.6, baseY + 14, width * 0.78, baseY - 6)
  ctx.quadraticCurveTo(width * 0.9, baseY - 20, width, baseY + 2)
  ctx.lineTo(width, height)
  ctx.closePath()
  ctx.fillStyle = 'rgba(255, 235, 200, 0.9)'
  ctx.fill()

  // 沙地高光
  ctx.beginPath()
  ctx.moveTo(0, baseY + 20)
  ctx.quadraticCurveTo(width * 0.3, baseY + 4, width * 0.55, baseY + 14)
  ctx.quadraticCurveTo(width * 0.8, baseY + 24, width, baseY + 10)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.lineWidth = 2
  ctx.stroke()

  // 珊瑚
  drawCoral(ctx, width * 0.08, height - 18, 26, COLORS.pink)
  drawCoral(ctx, width * 0.27, height - 10, 18, COLORS.orange)
  drawCoral(ctx, width * 0.72, height - 14, 22, COLORS.lavender)
  drawCoral(ctx, width * 0.93, height - 20, 16, COLORS.mint)
  ctx.restore()
}

/**
 * 海草摇摆（动态层）
 */
function drawSeaweed(ctx, time, width, height) {
  const grassCount = 7

  ctx.save()
  for (let i = 0; i < grassCount; i++) {
    const x = width * (0.04 + i * 0.15)
    const sway = Math.sin(time * 1.2 + i) * 6
    const grassHeight = 58 + (i % 3) * 24
    ctx.beginPath()
    ctx.moveTo(x, height - 8)
    ctx.quadraticCurveTo(
      x + sway,
      height - 8 - grassHeight * 0.55,
      x + sway * 1.6,
      height - 8 - grassHeight
    )
    ctx.strokeStyle = `rgba(47, 191, 155, ${0.42 + (i % 2) * 0.14})`
    ctx.lineWidth = 4 + (i % 2)
    ctx.lineCap = 'round'
    ctx.stroke()
  }
  ctx.restore()
}

function drawCoral(ctx, x, y, size, color) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x, y - size)
  ctx.moveTo(x, y - size * 0.6)
  ctx.lineTo(x - size * 0.45, y - size * 1.1)
  ctx.moveTo(x, y - size * 0.8)
  ctx.lineTo(x + size * 0.45, y - size * 1.25)
  ctx.stroke()
  ctx.restore()
}

function drawFish(ctx, x, y, size, color) {
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(x, y, size, size * 0.55, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x + size * 0.8, y)
  ctx.lineTo(x + size * 1.5, y - size * 0.5)
  ctx.lineTo(x + size * 1.5, y + size * 0.5)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/**
 * 卡通企鹅（贴纸风）
 * @param {Object} options - { angle, direction, sad }
 */
export function drawPenguin(ctx, cx, cy, scale = 1, options = {}) {
  const { angle = 0, direction = 'down', sad = false } = options

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(angle)
  ctx.scale(scale, scale)

  // 地面阴影
  ctx.fillStyle = 'rgba(31, 58, 95, 0.18)'
  ctx.beginPath()
  ctx.ellipse(0, 27, 16, 4.5, 0, 0, Math.PI * 2)
  ctx.fill()

  // 身体
  ctx.fillStyle = COLORS.navy
  ctx.strokeStyle = COLORS.navyDeep
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.ellipse(0, 6, 15, 18, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // 白肚子
  ctx.fillStyle = COLORS.cream
  ctx.beginPath()
  ctx.ellipse(0, 9, 10, 13, 0, 0, Math.PI * 2)
  ctx.fill()

  // 翅膀
  ctx.fillStyle = '#16304F'
  ctx.beginPath()
  ctx.ellipse(-13.5, 7, 4.5, 10, -0.25, 0, Math.PI * 2)
  ctx.ellipse(13.5, 7, 4.5, 10, 0.25, 0, Math.PI * 2)
  ctx.fill()

  // 脚
  ctx.fillStyle = COLORS.orange
  ctx.beginPath()
  ctx.ellipse(-6, 22, 5, 3, 0, 0, Math.PI * 2)
  ctx.ellipse(6, 22, 5, 3, 0, 0, Math.PI * 2)
  ctx.fill()

  // 围巾
  ctx.fillStyle = COLORS.pink
  fillRoundRect(ctx, -12, -5, 24, 7, 3.5, COLORS.pink)
  fillRoundRect(ctx, 8, -1, 6, 13, 3, COLORS.pinkDeep)

  // 头
  ctx.fillStyle = COLORS.navy
  ctx.strokeStyle = COLORS.navyDeep
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.arc(0, -11, 12, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // 腮红
  ctx.fillStyle = 'rgba(255, 127, 176, 0.55)'
  ctx.beginPath()
  ctx.arc(-7.5, -7, 2.6, 0, Math.PI * 2)
  ctx.arc(7.5, -7, 2.6, 0, Math.PI * 2)
  ctx.fill()

  if (sad) {
    // X_X 眼睛
    ctx.strokeStyle = COLORS.white
    ctx.lineWidth = 1.6
    ctx.lineCap = 'round'
    ;[-4, 4].forEach(ex => {
      ctx.beginPath()
      ctx.moveTo(ex - 2.2, -15)
      ctx.lineTo(ex + 2.2, -11.5)
      ctx.moveTo(ex + 2.2, -15)
      ctx.lineTo(ex - 2.2, -11.5)
      ctx.stroke()
    })
  } else {
    const eyeOffset = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[direction] || [0, 0]

    // 眼白
    ctx.fillStyle = COLORS.white
    ctx.beginPath()
    ctx.arc(-4, -12, 3.2, 0, Math.PI * 2)
    ctx.arc(4, -12, 3.2, 0, Math.PI * 2)
    ctx.fill()

    // 瞳孔
    ctx.fillStyle = COLORS.navyDeep
    ctx.beginPath()
    ctx.arc(-4 + eyeOffset[0], -12 + eyeOffset[1], 1.8, 0, Math.PI * 2)
    ctx.arc(4 + eyeOffset[0], -12 + eyeOffset[1], 1.8, 0, Math.PI * 2)
    ctx.fill()

    // 眼睛高光
    ctx.fillStyle = COLORS.white
    ctx.beginPath()
    ctx.arc(-4.6 + eyeOffset[0] * 0.6, -12.8 + eyeOffset[1] * 0.6, 0.8, 0, Math.PI * 2)
    ctx.arc(3.4 + eyeOffset[0] * 0.6, -12.8 + eyeOffset[1] * 0.6, 0.8, 0, Math.PI * 2)
    ctx.fill()
  }

  // 嘴巴
  ctx.fillStyle = COLORS.orange
  ctx.beginPath()
  if (sad) {
    ctx.moveTo(-3, -5)
    ctx.lineTo(3, -5)
    ctx.lineTo(0, -8)
  } else {
    ctx.moveTo(0, -8)
    ctx.lineTo(-3.5, -4.5)
    ctx.lineTo(3.5, -4.5)
  }
  ctx.closePath()
  ctx.fill()

  ctx.restore()
}
