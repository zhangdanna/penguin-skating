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
  // 深金：浅黄底上的文字色。黄底配黄字对比度只有 1.9，成就奖励标签必须用这个
  yellowInk: '#B98A12',
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

  // 气泡：玻璃质感（半透明填充 + 细边 + 高光点）
  for (let i = 0; i < 12; i++) {
    const r = 2 + (i % 4) * 1.4
    const drift = Math.sin(time * 0.6 + i) * 14
    const x = ((i * 67.3 + drift) % (width + 40)) - 20
    const y = height - ((time * (18 + (i % 5) * 6) + i * 53) % (height + 90))
    ctx.save()
    ctx.beginPath()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.10)'
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.beginPath()
    ctx.ellipse(x - r * 0.32, y - r * 0.32, r * 0.22, r * 0.28, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  // 几串微小气泡
  for (let i = 0; i < 5; i++) {
    const bx = ((i * 120 + time * 9) % (width + 20)) - 10
    const by = height - ((time * 26 + i * 70) % (height + 60))
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.beginPath()
    ctx.arc(bx, by, 1.3, 0, Math.PI * 2)
    ctx.fill()
  }

  // 两条游动的小鱼（在展台后方穿行，被棋盘遮挡一部分，更自然）
  const faX = ((time * 22 + 60) % (width + 140)) - 70
  const faY = height * 0.26 + Math.sin(time * 0.9) * 10
  drawFish(ctx, faX, faY, 13, '#FF9F5A', '#E07C36', time * 6, false)

  const fbX = width - (((time * 16 + 200) % (width + 140)) - 70)
  const fbY = height * 0.46 + Math.sin(time * 1.1 + 1) * 12
  drawFish(ctx, fbX, fbY, 10, '#FFD24A', '#E5A72B', time * 7 + 1, true)

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

  // 海星与贝壳（落在沙面上）
  drawStarfish(ctx, width * 0.12, height - 28, 15, '#FF9F5A')
  drawStarfish(ctx, width * 0.88, height - 24, 12, '#FF7FB0')
  drawStarfish(ctx, width * 0.5, height - 34, 10, '#FFC94A')
  drawShell(ctx, width * 0.4, height - 18, 26, '#FFE3B0')
  drawShell(ctx, width * 0.7, height - 16, 22, '#FFD0DC')
  ctx.restore()
}

/**
 * 海草摇摆（动态层）
 * 参考图中的几种造型：波浪飘带 / 羽状小叶 / 手指扇形 / 细密灌木丛，
 * 全部从沙面长出、随水流轻摆，比单根线条更接近真实海草
 */
function drawSeaweed(ctx, time, width, height) {
  const baseY = height - 8
  const PAL = [
    { dark: 'rgba(31, 163, 131, 0.82)', light: 'rgba(126, 228, 192, 0.82)' },
    { dark: 'rgba(86, 182, 92, 0.82)', light: 'rgba(168, 228, 132, 0.82)' },
    { dark: 'rgba(47, 191, 155, 0.8)', light: 'rgba(186, 242, 206, 0.8)' }
  ]
  const specimens = [
    { xf: 0.03, type: 'feather', h: 160, ph: 1.2, pal: 1 },
    { xf: 0.16, type: 'ribbon', h: 100, ph: 0.0, pal: 0 },
    { xf: 0.3, type: 'bushy', h: 158, ph: 1.7, pal: 1 },
    { xf: 0.42, type: 'ribbon', h: 108, ph: 0.6, pal: 2 },
    { xf: 0.54, type: 'feather', h: 112, ph: 2.6, pal: 0 },
    { xf: 0.66, type: 'bushy', h: 98, ph: 2.2, pal: 2 },
    { xf: 0.81, type: 'ribbon', h: 122, ph: 2.9, pal: 0 },
    { xf: 0.97, type: 'feather', h: 164, ph: 0.4, pal: 2 }
  ]

  ctx.save()
  for (const s of specimens) {
    const x = width * s.xf
    const p = PAL[s.pal]
    const grad = ctx.createLinearGradient(0, baseY, 0, baseY - s.h)
    grad.addColorStop(0, p.dark)
    grad.addColorStop(1, p.light)
    if (s.type === 'ribbon') drawRibbonClump(ctx, x, baseY, s.h, s.ph, time, grad)
    else if (s.type === 'feather') drawFeatherClump(ctx, x, baseY, s.h, s.ph, time, p)
    else if (s.type === 'finger') drawFingerFan(ctx, x, baseY, s.h, s.ph, time, p)
    else drawBushyClump(ctx, x, baseY, s.h, s.ph, time, grad)
  }
  ctx.restore()
}

/** 波浪飘带丛：2~3 片长飘带，边缘随波起伏 */
function drawRibbonClump(ctx, x, y, h, phase, time, grad) {
  const blades = 3
  for (let b = 0; b < blades; b++) {
    const off = (b - (blades - 1) / 2) * 9
    const bh = h * (1 - Math.abs(b - (blades - 1) / 2) * 0.14)
    drawRibbon(ctx, x + off, y, bh, phase + b * 0.9, time, grad, 6.5)
  }
}

/** 单条波浪飘带：中心线正弦摆动 + 由宽到窄收口 */
function drawRibbon(ctx, x, y, h, phase, time, grad, baseW) {
  const seg = 12
  const amp = 8 + h * 0.06
  const pts = []
  for (let i = 0; i <= seg; i++) {
    const t = i / seg
    const sway = Math.sin(time * 1.25 + phase + t * 2.6) * amp * t
    pts.push([x + sway, y - h * t, baseW * (1 - t * 0.62)])
  }
  ctx.beginPath()
  ctx.moveTo(pts[0][0] - pts[0][2], pts[0][1])
  for (let i = 1; i <= seg; i++) ctx.lineTo(pts[i][0] - pts[i][2], pts[i][1])
  const tip = pts[seg]
  ctx.quadraticCurveTo(tip[0], tip[1] - tip[2] * 0.9, tip[0] + tip[2], tip[1])
  for (let i = seg; i >= 0; i--) ctx.lineTo(pts[i][0] + pts[i][2], pts[i][1])
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()
  // 中脉高光
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i <= seg; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.stroke()
}

/** 羽状海草丛：2 根主茎，两侧密排小叶 */
function drawFeatherClump(ctx, x, y, h, phase, time, pal) {
  const stems = 2
  for (let s = 0; s < stems; s++) {
    const off = (s - (stems - 1) / 2) * 10
    const sh = h * (1 - Math.abs(s - (stems - 1) / 2) * 0.18)
    drawFeather(ctx, x + off, y, sh, phase + s * 1.3, time, pal)
  }
}

/** 单根羽状海草：弯曲主茎 + 左右交替圆叶 */
function drawFeather(ctx, x, y, h, phase, time, pal) {
  const amp = 5 + h * 0.045
  const stemAt = (t) => x + Math.sin(time * 1.1 + phase + t * 2.2) * amp * t

  ctx.strokeStyle = pal.dark
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x, y)
  for (let i = 1; i <= 12; i++) {
    const t = i / 12
    ctx.lineTo(stemAt(t), y - h * t)
  }
  ctx.stroke()

  const leaves = 6
  ctx.fillStyle = pal.light
  for (let i = 0; i < leaves; i++) {
    const t = 0.16 + (i / (leaves - 1)) * 0.8
    const cx = stemAt(t)
    const cy = y - h * t
    const lw = 4 * (1 - t * 0.4)
    const lh = 7.4 * (1 - t * 0.35)
    const wobble = Math.sin(time * 1.2 + phase + i) * 0.12
    drawLeaflet(ctx, cx - lw * 0.5, cy, lw, lh, -0.7 + wobble)
    drawLeaflet(ctx, cx + lw * 0.5, cy, lw, lh, 0.7 + wobble)
  }
}

/** 单张小叶（以基部为支点向上生长的椭圆） */
function drawLeaflet(ctx, x, y, w, h, angle) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.beginPath()
  ctx.ellipse(0, -h * 0.5, w, h * 0.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** 手指扇形丛：几片钝头厚叶从同一点向上散开 */
function drawFingerFan(ctx, x, y, h, phase, time, pal) {
  const fingers = 5
  for (let i = 0; i < fingers; i++) {
    const t = i / (fingers - 1) - 0.5
    const len = h * (1 - Math.abs(t) * 0.4)
    const angle = t * 0.95 + Math.sin(time * 1.2 + phase + i * 0.7) * 0.1
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)
    ctx.beginPath()
    ctx.moveTo(-3.6, 0)
    ctx.quadraticCurveTo(-4.6, -len * 0.6, -2.4, -len)
    ctx.quadraticCurveTo(0, -len - 3, 2.4, -len)
    ctx.quadraticCurveTo(4.6, -len * 0.6, 3.6, 0)
    ctx.closePath()
    ctx.fillStyle = pal.light
    ctx.fill()
    ctx.strokeStyle = pal.dark
    ctx.lineWidth = 0.8
    ctx.stroke()
    ctx.restore()
  }
}

/** 细密灌木丛：多根细长叶簇生，末梢各自轻摆 */
function drawBushyClump(ctx, x, y, h, phase, time, grad) {
  const fronds = 10
  ctx.save()
  ctx.strokeStyle = grad
  ctx.lineCap = 'round'
  for (let i = 0; i < fronds; i++) {
    const spread = i / (fronds - 1) - 0.5
    const len = h * (0.55 + 0.45 * Math.cos(spread * 1.5))
    const sway = Math.sin(time * 1.3 + phase + i * 0.5) * (3 + len * 0.05)
    const bx = x + spread * 11
    ctx.lineWidth = 1.9
    ctx.beginPath()
    ctx.moveTo(bx, y)
    ctx.quadraticCurveTo(
      bx + spread * h * 0.25 + sway * 0.5,
      y - len * 0.6,
      bx + spread * h * 0.55 + sway,
      y - len
    )
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

/**
 * 卡通小鱼（带摆尾、背鳍、侧鳍、眼睛，可朝左翻转）
 * @param {number} phase 摆动相位，传入随时间变化的值即「游动」
 * @param {boolean} flip 是否朝左（默认朝右）
 */
function drawFish(ctx, x, y, size, body, fin, phase = 0, flip = false) {
  ctx.save()
  ctx.translate(x, y)
  if (flip) ctx.scale(-1, 1)
  const wag = Math.sin(phase) * 0.4

  // 尾巴（随摆动左右摆）
  ctx.save()
  ctx.translate(-size * 0.85, 0)
  ctx.rotate(wag)
  ctx.fillStyle = fin
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(-size * 0.75, -size * 0.55, -size * 0.95, -size * 0.18)
  ctx.lineTo(-size * 0.95, size * 0.18)
  ctx.quadraticCurveTo(-size * 0.75, size * 0.55, 0, 0)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  // 身体（顶部高光渐变）
  const g = ctx.createLinearGradient(0, -size * 0.6, 0, size * 0.6)
  g.addColorStop(0, 'rgba(255, 255, 255, 0.4)')
  g.addColorStop(0.45, body)
  g.addColorStop(1, body)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(0, 0, size, size * 0.58, 0, 0, Math.PI * 2)
  ctx.fill()

  // 背鳍
  ctx.fillStyle = fin
  ctx.beginPath()
  ctx.moveTo(-size * 0.15, -size * 0.5)
  ctx.quadraticCurveTo(size * 0.1, -size * 1.0, size * 0.42, -size * 0.46)
  ctx.closePath()
  ctx.fill()

  // 侧鳍
  ctx.beginPath()
  ctx.moveTo(0, size * 0.12)
  ctx.quadraticCurveTo(size * 0.32, size * 0.5, size * 0.46, size * 0.16)
  ctx.closePath()
  ctx.fill()

  // 眼睛
  ctx.fillStyle = '#FFFFFF'
  ctx.beginPath()
  ctx.arc(size * 0.52, -size * 0.12, size * 0.17, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#1F3A5F'
  ctx.beginPath()
  ctx.arc(size * 0.55, -size * 0.12, size * 0.085, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

/** 海星：五瓣径向渐变 + 边缘暗描 + 凸起小点 */
function drawStarfish(ctx, x, y, R, color) {
  ctx.save()
  ctx.translate(x, y)
  const grad = ctx.createRadialGradient(0, 0, R * 0.15, 0, 0, R)
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.55)')
  grad.addColorStop(1, color)
  ctx.fillStyle = grad
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? R : R * 0.45
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const px = Math.cos(a) * r
    const py = Math.sin(a) * r
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(31, 58, 95, 0.18)'
  ctx.lineWidth = 1
  ctx.stroke()
  // 凸起小点
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)'
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5
    ctx.beginPath()
    ctx.arc(Math.cos(a) * R * 0.52, Math.sin(a) * R * 0.52, R * 0.07, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** 扇贝：扇形外壳 + 扇骨 + 顶部高光 */
function drawShell(ctx, x, y, w, color) {
  ctx.save()
  ctx.translate(x, y)
  const R = w * 0.62
  const startA = Math.PI * 1.15
  const endA = Math.PI * 1.85
  const grad = ctx.createLinearGradient(0, -R, 0, 0)
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.65)')
  grad.addColorStop(1, color)
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(Math.cos(startA) * R, Math.sin(startA) * R)
  ctx.arc(0, 0, R, startA, endA, false)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(31, 58, 95, 0.16)'
  ctx.lineWidth = 1
  ctx.stroke()
  // 扇骨
  ctx.strokeStyle = 'rgba(31, 58, 95, 0.14)'
  const ribs = 7
  for (let i = 0; i <= ribs; i++) {
    const a = startA + ((endA - startA) * i) / ribs
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R)
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * 卡通企鹅（贴纸风）
 *
 * 设计坐标系：身体中心为原点，整体高约 47.5（头顶 -25.5 → 脚底 22）。
 * 对局里格子 50px、scale = 1 时，企鹅正好占满一格。
 *
 * 全项目（对局 / 菜单 / 失败页 / 复活页 / 成就卡）都走这一个函数，
 * 「全局形象一致」是结构上保证的 —— 不要在任何场景里另画一只企鹅。
 *
 * 造型要点（改比例只改这里的字面量）：
 *   - 身体是**一颗完整的蛋**，头身不分家，不再是「圆头 + 椭圆身」两个色块
 *   - 两块**独立的眼白**，中间留一条黑缝直通头顶（不是一整片白脸）
 *   - 围巾**黄色、绕在脖子上**（y -4 ~ 1.8），不能掉到肚子上
 *   - 脚是**三趾蹼足**，腮红在脸颊两侧
 *
 * @param {Object} options
 * @param {number}  [options.angle=0]          整体旋转（弧度）
 * @param {string}  [options.direction='down'] 朝向 up/down/left/right，只影响瞳孔偏移
 * @param {boolean} [options.sad=false]        旧接口，等价于 mood:'sad'
 * @param {string}  [options.mood='idle']      idle / happy / sad
 * @param {string}  [options.pose='stand']     stand / wave / cheer / slide / peek / hold / sleep
 * @param {string}  [options.prop=null]        道具：trophy / medal / crown / fish / star /
 *                                             snowflake / lightning / heart / target /
 *                                             bubbles / zzz / confetti
 * @param {boolean} [options.scarf=true]       是否戴围巾
 */
export function drawPenguin(ctx, cx, cy, scale = 1, options = {}) {
  const {
    angle = 0,
    direction = 'down',
    sad = false,
    mood: moodOption,
    pose = 'stand',
    prop = null,
    scarf = true
  } = options

  const mood = sad ? 'sad' : (moodOption || 'idle')

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(angle)
  ctx.scale(scale, scale)

  // ---- 姿态：以脚底为支点整体倾斜 / 压扁 ----
  const groundY = 22
  /** peek 的整体下沉量：身体要沉到冰堆后面，只露出上半身 */
  const PEEK_DROP = 15
  let poseAngle = 0
  let squashY = 1
  let drop = 0
  if (pose === 'slide') {
    poseAngle = -0.72
    squashY = 0.88
  } else if (pose === 'sleep') {
    poseAngle = 0.1
    squashY = 0.9
  } else if (pose === 'peek') {
    drop = PEEK_DROP
  }
  ctx.translate(0, groundY)
  ctx.rotate(poseAngle)
  ctx.scale(1, squashY)
  ctx.translate(0, -groundY + drop)

  // ---- 地面阴影 ----
  if (pose === 'stand' || pose === 'wave' || pose === 'cheer' || pose === 'hold') {
    ctx.fillStyle = 'rgba(31, 58, 95, 0.16)'
    ctx.beginPath()
    ctx.ellipse(0, groundY + 3, 15, 3.8, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // ---- 翅膀（先画，压在身体后面）----
  drawPenguinFlipper(ctx, -1, pose)
  drawPenguinFlipper(ctx, 1, pose)

  // ---- 身体：一颗完整的蛋 ----
  ctx.beginPath()
  ctx.moveTo(0, -25.5)
  ctx.bezierCurveTo(10, -25.5, 14.5, -20, 14.5, -12)
  ctx.bezierCurveTo(14.5, -7, 17.5, -2.5, 17.5, 5)
  ctx.bezierCurveTo(17.5, 15.5, 10, 22, 0, 22)
  ctx.bezierCurveTo(-10, 22, -17.5, 15.5, -17.5, 5)
  ctx.bezierCurveTo(-17.5, -2.5, -14.5, -7, -14.5, -12)
  ctx.bezierCurveTo(-14.5, -20, -10, -25.5, 0, -25.5)
  ctx.closePath()
  ctx.fillStyle = COLORS.navy
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = COLORS.navyDeep
  ctx.lineJoin = 'round'
  ctx.stroke()

  // ---- 白肚皮：上沿 -4.6，正好托住下巴 ----
  ctx.beginPath()
  ctx.ellipse(0, 7, 12.9, 11.6, 0, 0, Math.PI * 2)
  ctx.fillStyle = COLORS.cream
  ctx.fill()

  // ---- 脚：三趾蹼足 ----
  ;[-1, 1].forEach(side => {
    const fx = side * 6.8
    ctx.fillStyle = COLORS.orange
    ctx.beginPath()
    ctx.ellipse(fx - 3, 21.6, 2.6, 1.9, side * -0.12, 0, Math.PI * 2)
    ctx.ellipse(fx, 22.5, 2.8, 2.1, 0, 0, Math.PI * 2)
    ctx.ellipse(fx + 3, 21.6, 2.6, 1.9, side * 0.12, 0, Math.PI * 2)
    ctx.fill()
  })

  // ---- 围巾：黄色，绕在脖子上（不是肚子）----
  if (scarf) {
    // 主环。上沿 -4 正好压在喙尖 (-3.2) 与脸颊 (-4.1) 下方，
    // 再往下就滑到肚子上、再往上会顶掉嘴巴。
    fillRoundRect(ctx, -13.2, -4, 26.4, 5.8, 2.9, COLORS.yellow)
    // 深黄描边：黄围巾和橙色喙同属暖色，不描边会糊成一块
    roundRectPath(ctx, -13.2, -4, 26.4, 5.8, 2.9)
    ctx.strokeStyle = COLORS.yellowDeep
    ctx.lineWidth = 0.9
    ctx.stroke()

    // 打结（放在围巾右端，巾角从结上垂下去）
    fillRoundRect(ctx, 8.4, -3.6, 6.4, 6.2, 2.6, COLORS.yellowDeep)

    // 垂下的巾角：从右侧贴着身子垂下，上宽下窄、末端收圆。
    // 别放在正中间 —— 正对嘴巴的一根竖条会被看成舌头。
    ctx.save()
    ctx.translate(11.6, 1.8)
    ctx.rotate(0.24)
    ctx.beginPath()
    ctx.moveTo(-2.4, 0)
    ctx.lineTo(2.4, 0)
    ctx.lineTo(1.8, 8.4)
    ctx.quadraticCurveTo(0, 10.2, -1.8, 8.4)
    ctx.closePath()
    ctx.fillStyle = COLORS.yellowDeep
    ctx.fill()
    ctx.restore()
  }

  // ---- 眼睛 ----
  drawPenguinEyes(ctx, mood, direction)

  // ---- 腮红 ----
  ctx.fillStyle = 'rgba(255, 150, 190, 0.78)'
  ;[-1, 1].forEach(side => {
    ctx.beginPath()
    ctx.ellipse(side * 12.6, -6.2, 3.1, 2.1, 0, 0, Math.PI * 2)
    ctx.fill()
  })

  // ---- 嘴 ----
  drawPenguinBeak(ctx, mood)

  // ---- hold 姿态：肚皮前面两只小手 ----
  if (pose === 'hold') {
    ctx.fillStyle = '#1A3352'
    ;[-1, 1].forEach(side => {
      ctx.beginPath()
      ctx.ellipse(side * 6.2, 9.5, 2.6, 3.4, side * 0.5, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  // ---- 道具 ----
  if (prop) drawPenguinProp(ctx, prop)

  ctx.restore()

  // ---- 姿态装饰：不跟随身体的倾斜 / 压扁 ----
  if (pose === 'peek' || pose === 'slide') {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(angle)
    ctx.scale(scale, scale)
    if (pose === 'peek') {
      // 冰堆必须跟着身体一起下沉，否则它停在原来的 y=12~25，
      // 正好横在下沉后的身体中部，看着像套了个游泳圈（而不是「躲在冰堆后面」）
      ctx.translate(0, PEEK_DROP)
      drawPenguinPeekDecor(ctx)
    } else {
      drawPenguinSlideDecor(ctx)
    }
    ctx.restore()
  }
}

/**
 * 翅膀：从肩膀沿角度生长
 * 注意 rotate 的负号 —— 正号会把翅膀转进身体里，看上去像没有翅膀
 */
function drawPenguinFlipper(ctx, side, pose) {
  let raise = 0
  if (pose === 'cheer') raise = 2.05
  if (pose === 'wave' && side === 1) raise = 1.95

  ctx.save()
  ctx.translate(side * 13.8, -5)
  ctx.rotate(-side * (0.16 + raise))
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.bezierCurveTo(side * 4.6, 0.8, side * 6.6, 7.5, side * 4.8, 14.5)
  ctx.bezierCurveTo(side * 3.8, 18.5, side * 0.2, 18.5, side * -0.4, 14.5)
  ctx.bezierCurveTo(side * -1.3, 8, side * -1.5, 2, 0, 0)
  ctx.closePath()
  ctx.fillStyle = '#1A3352'
  ctx.fill()
  ctx.strokeStyle = '#12263D'
  ctx.lineWidth = 1.1
  ctx.stroke()
  ctx.restore()
}

/**
 * 眼睛：idle 大瞳孔 / happy 弯成 ∩ / sad 垂眼皮 + 泪滴
 */
function drawPenguinEyes(ctx, mood, direction) {
  const eyeX = 5.9
  const eyeY = -11.6

  if (mood === 'happy') {
    ;[-1, 1].forEach(side => {
      ctx.save()
      ctx.translate(side * eyeX, eyeY)
      ctx.rotate(side * 0.15)
      ctx.beginPath()
      ctx.ellipse(0, 0, 5.8, 6.4, 0, 0, Math.PI * 2)
      ctx.fillStyle = COLORS.white
      ctx.fill()
      // 弯成 ∩ 的笑眼
      ctx.beginPath()
      ctx.arc(0, 1.8, 3.6, Math.PI * 1.08, Math.PI * 1.92)
      ctx.strokeStyle = COLORS.navyDeep
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.stroke()
      ctx.restore()
    })
    return
  }

  if (mood === 'sad') {
    ;[-1, 1].forEach(side => {
      ctx.save()
      ctx.translate(side * eyeX, eyeY)
      ctx.rotate(side * 0.15)
      ctx.beginPath()
      ctx.ellipse(0, 0, 5.8, 6.4, 0, 0, Math.PI * 2)
      ctx.clip()
      ctx.fillStyle = COLORS.white
      ctx.fillRect(-7, -8, 14, 16)
      // 瞳孔下移
      ctx.beginPath()
      ctx.arc(0, 2.1, 3.4, 0, Math.PI * 2)
      ctx.fillStyle = COLORS.navyDeep
      ctx.fill()
      ctx.beginPath()
      ctx.arc(-1.1, 0.9, 1.2, 0, Math.PI * 2)
      ctx.fillStyle = COLORS.white
      ctx.fill()
      // 下垂眼皮：只盖住上缘，盖多了会变成「怒眉」
      ctx.beginPath()
      ctx.moveTo(-7, -8)
      ctx.lineTo(7, -8)
      ctx.lineTo(7, -3.4)
      ctx.quadraticCurveTo(0, -5.4, -7, -2.6)
      ctx.closePath()
      ctx.fillStyle = COLORS.navy
      ctx.fill()
      ctx.restore()
    })
    // 泪滴
    ctx.fillStyle = 'rgba(91, 200, 245, 0.92)'
    ctx.beginPath()
    ctx.moveTo(-eyeX - 0.2, eyeY + 6.4)
    ctx.quadraticCurveTo(-eyeX - 2.9, eyeY + 11.6, -eyeX - 0.2, eyeY + 12.2)
    ctx.quadraticCurveTo(-eyeX + 2.5, eyeY + 11.6, -eyeX - 0.2, eyeY + 6.4)
    ctx.fill()
    return
  }

  // idle：大瞳孔 + 双高光，瞳孔按朝向偏移
  const offset = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[direction] || [0, 0]
  ;[-1, 1].forEach(side => {
    ctx.save()
    ctx.translate(side * eyeX, eyeY)
    ctx.rotate(side * 0.15)
    ctx.beginPath()
    ctx.ellipse(0, 0, 5.8, 6.4, 0, 0, Math.PI * 2)
    ctx.fillStyle = COLORS.white
    ctx.fill()
    ctx.restore()

    const px = side * eyeX + offset[0] * 0.9
    const py = eyeY + 0.6 + offset[1] * 0.9
    ctx.beginPath()
    ctx.arc(px, py, 3.5, 0, Math.PI * 2)
    ctx.fillStyle = COLORS.navyDeep
    ctx.fill()
    ctx.beginPath()
    ctx.arc(px - 1.2, py - 1.5, 1.35, 0, Math.PI * 2)
    ctx.fillStyle = COLORS.white
    ctx.fill()
    ctx.beginPath()
    ctx.arc(px + 1.25, py + 1.05, 0.62, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
    ctx.fill()
  })
}

/**
 * 嘴：happy 张嘴露舌 / sad 嘴角向下 / idle 微笑
 */
function drawPenguinBeak(ctx, mood) {
  if (mood === 'happy') {
    ctx.beginPath()
    ctx.moveTo(-4.3, -7.6)
    ctx.quadraticCurveTo(0, -9.1, 4.3, -7.6)
    ctx.quadraticCurveTo(2.6, -4.4, 0, -4)
    ctx.quadraticCurveTo(-2.6, -4.4, -4.3, -7.6)
    ctx.closePath()
    ctx.fillStyle = COLORS.orange
    ctx.fill()

    // 口腔 + 舌头
    ctx.beginPath()
    ctx.ellipse(0, -4.7, 2.9, 2.1, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#C0392B'
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(0, -3.9, 1.7, 1.1, 0, 0, Math.PI * 2)
    ctx.fillStyle = COLORS.pink
    ctx.fill()
    return
  }

  ctx.beginPath()
  ctx.moveTo(-4.3, -7.6)
  ctx.quadraticCurveTo(0, -9.1, 4.3, -7.6)
  ctx.quadraticCurveTo(2.5, -3.9, 0, -3.2)
  ctx.quadraticCurveTo(-2.5, -3.9, -4.3, -7.6)
  ctx.closePath()
  ctx.fillStyle = COLORS.orange
  ctx.fill()

  // 嘴缝：sad 向下弯，其余微笑
  ctx.strokeStyle = COLORS.orangeDeep
  ctx.lineWidth = 1
  ctx.lineCap = 'round'
  ctx.beginPath()
  if (mood === 'sad') {
    ctx.moveTo(-2.4, -4.6)
    ctx.quadraticCurveTo(0, -5.8, 2.4, -4.6)
  } else {
    ctx.moveTo(-2.6, -5.9)
    ctx.quadraticCurveTo(0, -4.8, 2.6, -5.9)
  }
  ctx.stroke()
}

/**
 * 成就卡道具
 */
function drawPenguinProp(ctx, prop) {
  switch (prop) {
    case 'crown':
      ctx.beginPath()
      ctx.moveTo(-7.5, -24.5)
      ctx.lineTo(-7.5, -30.5)
      ctx.lineTo(-3.6, -27.6)
      ctx.lineTo(0, -32.2)
      ctx.lineTo(3.6, -27.6)
      ctx.lineTo(7.5, -30.5)
      ctx.lineTo(7.5, -24.5)
      ctx.closePath()
      ctx.fillStyle = COLORS.yellow
      ctx.fill()
      ctx.strokeStyle = COLORS.yellowDeep
      ctx.lineWidth = 0.9
      ctx.lineJoin = 'round'
      ctx.stroke()
      break

    case 'medal':
      // 绶带
      ctx.strokeStyle = COLORS.pinkDeep
      ctx.lineWidth = 2.4
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(-4.2, 0.5)
      ctx.lineTo(0, 5.2)
      ctx.lineTo(4.2, 0.5)
      ctx.stroke()
      // 圆牌
      ctx.beginPath()
      ctx.arc(0, 8.6, 4.4, 0, Math.PI * 2)
      ctx.fillStyle = COLORS.yellow
      ctx.fill()
      ctx.strokeStyle = COLORS.yellowDeep
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(0, 8.6, 2.1, 0, Math.PI * 2)
      ctx.fillStyle = '#FFF3C4'
      ctx.fill()
      break

    case 'trophy':
      ctx.beginPath()
      ctx.moveTo(-4.6, 6.5)
      ctx.lineTo(4.6, 6.5)
      ctx.quadraticCurveTo(4.2, 14.5, 0, 14.5)
      ctx.quadraticCurveTo(-4.2, 14.5, -4.6, 6.5)
      ctx.closePath()
      ctx.fillStyle = COLORS.yellow
      ctx.fill()
      ctx.strokeStyle = COLORS.yellowDeep
      ctx.lineWidth = 0.9
      ctx.stroke()
      ctx.fillStyle = COLORS.yellowDeep
      fillRoundRect(ctx, -1.1, 14.2, 2.2, 3.2, 1, COLORS.yellowDeep)
      fillRoundRect(ctx, -3.6, 17, 7.2, 2, 1, COLORS.yellowDeep)
      break

    case 'fish':
      ctx.fillStyle = '#7FD4F5'
      ctx.beginPath()
      ctx.ellipse(0, 10, 5.4, 3.1, -0.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(4.6, 10)
      ctx.lineTo(8.4, 7.4)
      ctx.lineTo(8.4, 12.6)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = COLORS.navyDeep
      ctx.beginPath()
      ctx.arc(-3.1, 9.2, 0.8, 0, Math.PI * 2)
      ctx.fill()
      break

    case 'star':
      drawStar(ctx, 0, 9.5, 5.6, COLORS.yellow, { stroke: COLORS.yellowDeep, lineWidth: 0.8 })
      break

    case 'snowflake':
      ctx.strokeStyle = '#8FD9F7'
      ctx.lineWidth = 1.4
      ctx.lineCap = 'round'
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3
        ctx.beginPath()
        ctx.moveTo(0, 10)
        ctx.lineTo(Math.cos(a) * 5.4, 10 + Math.sin(a) * 5.4)
        ctx.stroke()
      }
      break

    case 'lightning':
      ctx.beginPath()
      ctx.moveTo(-1.5, 2)
      ctx.lineTo(4.5, 2)
      ctx.lineTo(0.5, 8.5)
      ctx.lineTo(4, 8.5)
      ctx.lineTo(-3, 18)
      ctx.lineTo(-0.5, 10.5)
      ctx.lineTo(-4, 10.5)
      ctx.closePath()
      ctx.fillStyle = COLORS.yellow
      ctx.fill()
      ctx.strokeStyle = COLORS.yellowDeep
      ctx.lineWidth = 0.8
      ctx.lineJoin = 'round'
      ctx.stroke()
      break

    case 'heart':
      ctx.fillStyle = '#FF6F9C'
      ctx.beginPath()
      ctx.moveTo(0, 14.5)
      ctx.bezierCurveTo(-7.5, 9.5, -6, 3.5, -2.6, 3.5)
      ctx.bezierCurveTo(-0.9, 3.5, 0, 5, 0, 5)
      ctx.bezierCurveTo(0, 5, 0.9, 3.5, 2.6, 3.5)
      ctx.bezierCurveTo(6, 3.5, 7.5, 9.5, 0, 14.5)
      ctx.fill()
      break

    case 'target':
      ctx.beginPath()
      ctx.arc(0, 10, 5.6, 0, Math.PI * 2)
      ctx.fillStyle = COLORS.white
      ctx.fill()
      ctx.strokeStyle = COLORS.coral
      ctx.lineWidth = 1.6
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(0, 10, 3.2, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(0, 10, 1.1, 0, Math.PI * 2)
      ctx.fillStyle = COLORS.coral
      ctx.fill()
      break

    case 'bubbles':
      ctx.strokeStyle = 'rgba(120, 200, 240, 0.85)'
      ctx.lineWidth = 1.1
      ;[[-9, -4, 3.2], [-13, -10, 2.2], [-6, -12, 1.6]].forEach(bubble => {
        ctx.beginPath()
        ctx.arc(bubble[0], bubble[1], bubble[2], 0, Math.PI * 2)
        ctx.stroke()
      })
      break

    case 'zzz':
      ctx.fillStyle = COLORS.lavenderDeep
      ctx.font = 'bold 7px sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText('z', 13, -18)
      ctx.font = 'bold 9px sans-serif'
      ctx.fillText('z', 17, -24)
      ctx.font = 'bold 11px sans-serif'
      ctx.fillText('Z', 22, -31)
      break

    case 'confetti': {
      const bits = [
        [-16, -20, 0.6, COLORS.pink], [15, -24, -0.4, COLORS.yellow], [-13, -8, 1.1, COLORS.mint],
        [17, -10, -0.9, COLORS.lavender], [-19, 2, 0.3, COLORS.yellow], [19, 4, -1.2, COLORS.pink]
      ]
      bits.forEach(bit => {
        ctx.save()
        ctx.translate(bit[0], bit[1])
        ctx.rotate(bit[2])
        ctx.fillStyle = bit[3]
        ctx.fillRect(-1.5, -1, 3, 2)
        ctx.restore()
      })
      break
    }
  }
}

/** peek：冰堆挡住下半身，只露头和一只扶着冰堆的翅膀 */
function drawPenguinPeekDecor(ctx) {
  // 冰堆：宽 50（身体最宽 35），比原来的 62 收窄一圈。
  // 62 宽在卡片里左右各比身体多出 40+ px，看着像端了个大盘子
  fillRoundRect(ctx, -25, 10, 50, 15, 7, '#CFEFFF')
  roundRectPath(ctx, -25, 10, 50, 15, 7)
  ctx.strokeStyle = '#9FD9F5'
  ctx.lineWidth = 1.2
  ctx.stroke()

  // 顶上一撮积雪，避免整块看着像一根直条
  ;[[-8, 10, 9, 3], [9, 10.5, 7, 2.6]].forEach(([x, y, rx, ry]) => {
    ctx.beginPath()
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#E8F8FF'
    ctx.fill()
  })

  ctx.save()
  ctx.translate(14, 7)
  ctx.rotate(-2)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.bezierCurveTo(4.6, 0.8, 6.6, 7.5, 4.8, 14.5)
  ctx.bezierCurveTo(3.8, 18.5, 0.2, 18.5, -0.4, 14.5)
  ctx.bezierCurveTo(-1.3, 8, -1.5, 2, 0, 0)
  ctx.closePath()
  ctx.fillStyle = '#1A3352'
  ctx.fill()
  ctx.strokeStyle = '#12263D'
  ctx.lineWidth = 1.1
  ctx.stroke()
  ctx.restore()
}

/** slide：身后三道雪痕 */
function drawPenguinSlideDecor(ctx) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.lineWidth = 2.2
  ctx.lineCap = 'round'
  ;[[12, 6], [17, 12], [22, 18]].forEach(point => {
    ctx.beginPath()
    ctx.moveTo(point[0], point[1])
    ctx.lineTo(point[0] + 9, point[1])
    ctx.stroke()
  })
}
