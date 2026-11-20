import Sprite from '../base/sprite'
import { font, roundRectPath } from '../ui/theme'
import { drawTrayTexture } from '../ui/skin-art'
import { getCurrentTrayPalette, getCurrentTrayId } from '../utils/skin-manager'

/**
 * 目标区域（鱼形展台）
 *
 * 视觉目标：一眼能和「可以推的冰块」区分开。
 *
 * 旧版是「和冰块同色系的浅蓝发光方框 + 一条 9px 的小鱼」，实测两个问题：
 *   1. 底色与棋盘格子几乎同色，整块区域读成「一格地板」；
 *   2. 小鱼太小（9×6），被当成装饰图案，不是「把东西放这里」的指令。
 *
 * 现在改成暖色展台：
 *   - 整块矩形铺一层奶油色底板 + 珊瑚色**虚线**外框（虚线 = 凹槽 / 待填位）
 *   - 中间放大 1.5 倍的小鱼 + 呼吸光晕，单格目标额外带「目标」二字
 *   - 冰块就位后光晕熄灭、鱼不再浮动，避免和冰块的绿色对勾抢视觉
 *
 * 冷蓝棋盘 + 暖橙展台的对比是这套方案的骨架，别把底板改回蓝色。
 */

/**
 * 默认展台：奶油渐变 + 琥珀金边
 *
 * 曾经默认就是珊瑚色，导致买了「珊瑚托盘」皮肤后画面几乎没变（用户原话：
 * 「当前默认就是珊瑚托盘吧」）。默认必须更中性、更淡，皮肤才有升级感。
 * 三档递进：默认金边奶油 → 珊瑚（浓橙红 + 珊瑚纹理）→ 贝壳（珠光暖白）。
 * 仍然是暖色 R>G>B —— 冷色底板会被读成冰面，回归会拦。
 */
const PLATE_TOP = '#FFF6E6'
const PLATE_BOTTOM = '#F7DFB4'
/** 琥珀金描边（比皮肤的珊瑚/焦糖都更淡） */
const PLATE_EDGE = 'rgba(201, 146, 58, 0.88)'
/** 底板投影 */
const PLATE_SHADOW = 'rgba(201, 146, 58, 0.14)'

/**
 * 小鱼成长阶段
 *
 * 设计意图：冰块本来就是「喂」给鱼的，所以目标区的小鱼随关卡长大，
 * 而不是每过一段就换一种物种 —— 换物种会让玩家怀疑规则变了（"这个带刺的
 * 圈是什么？"），成长只是进度感，判定逻辑一个字都不动。
 *
 * 三条硬约束（破了就退回"找不到目标"的老问题）：
 *   1. 只在暖色系里演化，绝不变蓝/绿；虚线展台底板全阶段统一
 *   2. 轮廓优先于细节：统一深棕描边，28px 的小格上先保住外形
 *   3. 光晕随阶段偏金，但亮度不超过冰块
 *
 * `scale` 是体型系数（相对 40px 基准），`halo` 是光晕的 rgb 三元组。
 */
const STAGES = [
  {
    name: '鱼苗',
    body: '#FFC286',
    fin: '#F0A055',
    edge: 'rgba(186, 110, 40, 0.95)',
    halo: '255, 190, 130',
    scale: 0.72
  },
  {
    name: '小鱼',
    body: '#FFB067',
    fin: '#F08B3C',
    edge: 'rgba(190, 92, 24, 0.95)',
    halo: '255, 176, 103',
    scale: 1
  },
  {
    name: '河豚',
    body: '#FF9E6B',
    fin: '#E8804A',
    edge: 'rgba(180, 84, 36, 0.95)',
    halo: '255, 158, 107',
    scale: 1.02
  },
  {
    name: '剑鱼',
    body: '#FF8B5C',
    fin: '#DE6C3C',
    edge: 'rgba(170, 72, 30, 0.95)',
    halo: '255, 139, 92',
    scale: 1.02
  },
  {
    name: '神仙鱼',
    body: '#FFAF3D',
    fin: '#FFC85C',
    edge: 'rgba(150, 86, 16, 0.95)',
    halo: '255, 196, 90',
    scale: 1
  }
]

/** 画在鱼身上的白色高光 / 肚皮 */
const FISH_BELLY = 'rgba(255, 255, 255, 0.7)'

/** 「目标」二字的颜色 */
const LABEL_INK = '#A9561A'

/**
 * 难度档 → 成长阶段
 *
 * 跟 `LEVEL_BANDS` 的 difficulty 一一对应，所以第 6 关（easy）开始鱼会变大一号。
 * 用 difficulty 而不是关卡号：难度档是关卡的既有属性，201 关之后的运行时
 * 生成关也带这个字段，不用再写一套区间判断。
 *
 * @param {string} difficulty
 * @returns {number} 0~4
 */
export function stageForDifficulty(difficulty) {
  switch (difficulty) {
    case 'tutorial': return 0
    case 'easy': return 1
    case 'medium': return 2
    case 'hard': return 3
    case 'expert': return 4
    default: return 1
  }
}

/** 阶段总数，供调用方做边界断言 */
export const TARGET_STAGE_COUNT = STAGES.length

export default class Target extends Sprite {
  constructor(config) {
    super(config.x, config.y, config.width || 50, config.height || 50)

    // 目标区域由若干格子组成，容纳所有需要送达的冰块
    this.cellSize = config.cellSize || 50
    this.cols = Math.max(1, Math.round(this.width / this.cellSize))
    this.rows = Math.max(1, Math.round(this.height / this.cellSize))

    // 成长阶段（0~4），越靠后的关卡鱼越大、颜色越浓
    this.stage = Math.max(0, Math.min(STAGES.length - 1, config.stage || 0))

    // 呼吸动画相位
    this.pulse = 0
    this.pulseSpeed = 0.05
  }

  /**
   * 更新动画
   */
  update() {
    this.pulse = (this.pulse + this.pulseSpeed) % (Math.PI * 2)
  }

  /**
   * 检测冰块是否在目标内
   * @param {Object} stone - 冰块对象
   * @returns {boolean} 是否在目标内
   */
  contains(stone) {
    const stoneCenterX = stone.x + stone.width / 2
    const stoneCenterY = stone.y + stone.height / 2

    return stoneCenterX >= this.x &&
           stoneCenterX <= this.x + this.width &&
           stoneCenterY >= this.y &&
           stoneCenterY <= this.y + this.height
  }

  /**
   * 渲染目标区域
   * @param {CanvasRenderingContext2D} ctx - 画布上下文
   * @param {Array} [stones] - 冰块列表，用于判断哪些格子已经填上
   */
  render(ctx, stones) {
    const k = this.cellSize / 50
    const pulse = (Math.sin(this.pulse) + 1) / 2

    this.renderPlate(ctx, k, pulse)

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const centerX = this.x + col * this.cellSize + this.cellSize / 2
        const centerY = this.y + row * this.cellSize + this.cellSize / 2
        const occupied = this.hasStoneAt(stones, centerX, centerY)

        if (!occupied) this.renderHalo(ctx, centerX, centerY, k, pulse)

        // 鱼在格子里轻微浮动；已就位时定住
        const bob = occupied ? 0 : Math.sin(this.pulse + (row + col) * 0.4) * 1.2 * k
        // 单格目标才有「目标」二字，多格时每格都写字会糊成一片
        const single = this.cols === 1 && this.rows === 1
        const fishY = centerY + bob - (single ? 3.5 * k : 0)

        drawFish(
          ctx,
          centerX,
          fishY,
          1.45 * k,
          occupied,
          this.stage,
          this.pulse + (row + col) * 0.4,
          this.cols * this.rows > 1
        )

        if (single) this.renderLabel(ctx, centerX, centerY, k)
      }
    }
  }

  /**
   * 展台底板：整块矩形一次画完
   *
   * 不能逐格画圆角方框 —— 2×1 / 3×1 的目标会被读成「三个独立格子」，
   * 玩家以为每格要各放一块冰，实际上整块区域是一个展台。
   */
  renderPlate(ctx, k, pulse) {
    const inset = 2.5 * k
    const x = this.x + inset
    const y = this.y + inset
    const w = this.width - inset * 2
    const h = this.height - inset * 2
    const radius = Math.min(13 * k, w / 2, h / 2)

    ctx.save()

    // 展台皮肤：只换配色 + 纹理，**永远是暖色**（TRAY_PALETTES 里每一档都满足 R>G>B）。
    // 默认（没穿皮肤）仍然用本文件顶部的 PLATE_*，别把这两组常量删了。
    const skin = getCurrentTrayPalette()

    // 投影：向下偏移的浅色底，不用 shadowBlur（全项目禁用）
    roundRectPath(ctx, x, y + 2.5 * k, w, h, radius)
    ctx.fillStyle = skin ? skin.shadow : PLATE_SHADOW
    ctx.fill()

    const grad = ctx.createLinearGradient(0, y, 0, y + h)
    grad.addColorStop(0, skin ? skin.top : PLATE_TOP)
    grad.addColorStop(1, skin ? skin.bottom : PLATE_BOTTOM)
    roundRectPath(ctx, x, y, w, h, radius)
    ctx.fillStyle = grad
    ctx.fill()

    // 内圈白线，糖果感
    roundRectPath(ctx, x + 3 * k, y + 3 * k, w - 6 * k, h - 6 * k, Math.max(1, radius - 3 * k))
    ctx.strokeStyle = skin ? skin.inner : 'rgba(255, 255, 255, 0.9)'
    ctx.lineWidth = 1.6 * k
    ctx.stroke()

    // 纹理画在白线之后、虚线之前：只做「有材质」的暗示，不许盖住虚线框
    if (skin) drawTrayTexture(ctx, getCurrentTrayId(), x, y, w, h, k)

    // 外圈珊瑚虚线：虚线读作「待填的凹槽」，实线会被读成一块可以推的方块
    // 线宽和 dash 都比第一版细一档：2.4px + 6/4.5 的虚线放大看像警示胶带
    ctx.setLineDash([5 * k, 3.6 * k])
    ctx.lineDashOffset = -this.pulse * 2.4 * k
    roundRectPath(ctx, x, y, w, h, radius)
    ctx.strokeStyle = skin ? skin.edge : PLATE_EDGE
    ctx.lineWidth = 2 * k
    ctx.stroke()
    ctx.setLineDash([])

    ctx.restore()
  }

  /**
   * 呼吸光晕：告诉玩家「这里是活的、有东西要放进来」
   *
   * 颜色跟着成长阶段偏金，暗示「展台在升级」，但亮度始终低于冰块的白，
   * 不会盖住盘面。
   */
  renderHalo(ctx, centerX, centerY, k, pulse) {
    const haloColor = STAGES[this.stage].halo
    const radius = this.cellSize * 0.62
    const halo = ctx.createRadialGradient(centerX, centerY, 2 * k, centerX, centerY, radius)
    halo.addColorStop(0, `rgba(${haloColor}, ${0.3 + pulse * 0.16})`)
    halo.addColorStop(1, `rgba(${haloColor}, 0)`)

    ctx.save()
    ctx.fillStyle = halo
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  /**
   * 「目标」标签（仅单格目标）
   */
  renderLabel(ctx, centerX, centerY, k) {
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = font(9 * k, 'bold')
    ctx.lineWidth = 3 * k
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.strokeText('目标', centerX, centerY + 13.5 * k)
    ctx.fillStyle = LABEL_INK
    ctx.fillText('目标', centerX, centerY + 13.5 * k)
    ctx.restore()
  }

  /**
   * 这一格是否已经有冰块（按冰块中心判定）
   */
  hasStoneAt(stones, centerX, centerY) {
    if (!stones || !stones.length) return false
    const tolerance = this.cellSize * 0.5
    return stones.some(stone => {
      const sx = stone.x + stone.width / 2
      const sy = stone.y + stone.height / 2
      return Math.abs(sx - centerX) < tolerance && Math.abs(sy - centerY) < tolerance
    })
  }
}

/**
 * 绘制目标小鱼（按成长阶段变形）
 *
 * 所有阶段共享一套语言：头朝右、统一深棕描边、白色肚皮、同一套眼睛。
 * 差异只在体型、鳍形、尾形和身上的花纹 —— 玩家看到的是「同一条鱼长大了」，
 * 而不是「换了个东西」。
 *
 * @param {number} scale - 以 40px 格子为基准的缩放（调用方传 1.45 × 格子系数）
 * @param {boolean} dim - 冰块已就位：压暗 + 闭眼（吃饱了）
 * @param {number} stage - 成长阶段 0~4
 * @param {number} [phase] - 摆尾相位（每个格子错开，避免整排鱼同步甩尾）
 * @param {boolean} [compact] - 多格目标：整体缩一档
 *        2×1 / 3×1 时每格一条鱼，神仙鱼那种上下长鳍会顶到相邻格，
 *        三条鱼连起来像一排锯齿。缩到 0.9 就能让相邻的鱼留出缝。
 */
function drawFish(ctx, cx, cy, scale, dim, stage, phase, compact) {
  const index = Math.max(0, Math.min(STAGES.length - 1, stage || 0))
  const s = STAGES[index]

  // 摆尾：已就位时定住，其余时候轻轻甩
  const wiggle = dim ? 0 : Math.sin((phase || 0) * 1.6) * 0.1
  // 只有神仙鱼的长飘鳍会横向外扩到相邻格，其余阶段多格时不用缩
  const fit = compact && index === 4 ? 0.9 : 1

  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(scale * s.scale * fit, scale * s.scale * fit)
  if (dim) ctx.globalAlpha = 0.55
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  drawTail(ctx, index, s, wiggle)
  drawFins(ctx, index, s)
  drawBody(ctx, index, s)
  drawMarkings(ctx, index, s)
  drawEye(ctx, index, s, dim)

  ctx.restore()
}

/**
 * 尾巴：鱼苗是短三角，河豚是小扇，剑鱼是大 V，神仙鱼是短翘尾
 */
function drawTail(ctx, index, s, wiggle) {
  ctx.save()
  // 以尾柄为轴摆动，幅度很小，只为了「活着」
  ctx.translate(-5, 0)
  ctx.rotate(wiggle)
  ctx.translate(5, 0)

  ctx.beginPath()

  if (index === 2) {
    // 河豚：小扇形
    ctx.moveTo(-6.5, 0)
    ctx.quadraticCurveTo(-10, -5.5, -11.5, -4)
    ctx.quadraticCurveTo(-10, 0, -11.5, 4)
    ctx.quadraticCurveTo(-10, 5.5, -6.5, 0)
    ctx.closePath()
  } else if (index === 3) {
    // 剑鱼：深叉大 V
    ctx.moveTo(-6.6, 0)
    ctx.lineTo(-13.6, -7.4)
    ctx.quadraticCurveTo(-10.4, 0, -13.6, 7.4)
    ctx.closePath()
  } else if (index === 4) {
    // 神仙鱼：短翘尾
    ctx.moveTo(-6.5, 0)
    ctx.lineTo(-12, -5)
    ctx.quadraticCurveTo(-10, 0, -12, 5)
    ctx.closePath()
  } else if (index === 0) {
    // 鱼苗：小短尾
    ctx.moveTo(-5.5, 0)
    ctx.lineTo(-10, -4)
    ctx.quadraticCurveTo(-8.8, 0, -10, 4)
    ctx.closePath()
  } else {
    // 小鱼：原来的造型
    ctx.moveTo(-6, 0)
    ctx.lineTo(-12, -5.5)
    ctx.quadraticCurveTo(-10.5, 0, -12, 5.5)
    ctx.closePath()
  }

  ctx.fillStyle = s.body
  ctx.strokeStyle = s.edge
  ctx.lineWidth = 1.6
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

/**
 * 背鳍 / 腹鳍 / 河豚的刺
 *
 * 所有鳍一律「填色 + 深棕描边」：奶油底很浅，只填不描的浅金色鳍
 * 在 44px 的格子上完全看不见 —— 实测神仙鱼的长飘鳍会消失，整条鱼
 * 退化成一个圆豆子，几个阶段的造型差异就白做了。
 */
function drawFins(ctx, index, s) {
  ctx.fillStyle = s.fin
  ctx.strokeStyle = s.edge
  ctx.lineWidth = 1.3

  if (index === 0) {
    // 鱼苗：一点点背鳍
    ctx.beginPath()
    ctx.moveTo(-1, -5.4)
    ctx.quadraticCurveTo(0.5, -8, 3, -5.6)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    return
  }

  if (index === 2) {
    // 河豚：三根短刺（上 / 右上 / 下）
    const spikes = [
      [[-1, -8.2], [0.4, -11.9], [2, -7.9]],
      [[5.2, -6.2], [8.8, -9], [7.1, -4.4]],
      [[0.5, 8.2], [1.8, 11.7], [3.2, 7.9]]
    ]
    spikes.forEach(([a, tip, b]) => {
      ctx.beginPath()
      ctx.moveTo(a[0], a[1])
      ctx.lineTo(tip[0], tip[1])
      ctx.lineTo(b[0], b[1])
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    })
    return
  }

  if (index === 3) {
    // 剑鱼：高背鳍 + 小腹鳍
    ctx.beginPath()
    ctx.moveTo(-2.5, -4.6)
    ctx.lineTo(1.5, -11.2)
    ctx.lineTo(6.5, -4.2)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(-1, 4.4)
    ctx.lineTo(-3.5, 8.6)
    ctx.lineTo(2.5, 4.8)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    return
  }

  if (index === 4) {
    // 神仙鱼：上下拉长的飘鳍（这个阶段唯一的辨识点，必须够长）
    ctx.beginPath()
    ctx.moveTo(-5.2, -6.2)
    ctx.quadraticCurveTo(-5.6, -12.6, -10.2, -14.5)
    ctx.quadraticCurveTo(-2, -11, 6.2, -6.8)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(-5.2, 6.2)
    ctx.quadraticCurveTo(-5.6, 12.6, -10.2, 14.5)
    ctx.quadraticCurveTo(-2, 11, 6.2, 6.8)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    return
  }

  // 小鱼：原来的背鳍
  ctx.beginPath()
  ctx.moveTo(-1, -5.5)
  ctx.quadraticCurveTo(1.5, -9.5, 4.5, -6)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

/**
 * 身体：鱼苗圆胖、河豚近圆、剑鱼细长、神仙鱼侧扁高身
 */
function drawBody(ctx, index, s) {
  const shapes = [
    [1, 0, 8.2, 6.4],    // 0 鱼苗：圆胖
    [1, 0, 9.5, 6.2],    // 1 小鱼
    [0, 0, 8.8, 8.4],    // 2 河豚：接近圆
    [0.5, 0, 10.2, 5.9], // 3 剑鱼：细长（5.2 太扁，配尖吻会读成虾）
    [0, 0, 7.6, 8.6]     // 4 神仙鱼：侧扁高身
  ]
  const [x, y, rx, ry] = shapes[index] || shapes[1]

  // 剑鱼的尖吻单独画，其余用椭圆
  if (index === 3) {
    ctx.beginPath()
    ctx.moveTo(9.6, -1.4)
    ctx.lineTo(13.2, -1.9)
    ctx.lineTo(9.6, 1.8)
    ctx.closePath()
    ctx.fillStyle = s.body
    ctx.fill()
    ctx.strokeStyle = s.edge
    ctx.lineWidth = 1.4
    ctx.stroke()
  }

  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  ctx.fillStyle = s.body
  ctx.fill()
  ctx.strokeStyle = s.edge
  ctx.lineWidth = 1.6
  ctx.stroke()

  // 肚皮高光
  ctx.beginPath()
  ctx.ellipse(x + 0.5, ry * 0.34, rx * 0.62, ry * 0.4, 0, 0, Math.PI * 2)
  ctx.fillStyle = FISH_BELLY
  ctx.fill()
}

/**
 * 身上的花纹：只在后两个阶段出现（小格子上细节越多越糊）
 */
function drawMarkings(ctx, index, s) {
  if (index === 4) {
    // 神仙鱼：两条竖纹
    const stripes = [-2.2, 2.4]
    ctx.strokeStyle = 'rgba(150, 86, 16, 0.5)'
    ctx.lineWidth = 1.8
    stripes.forEach((x) => {
      ctx.beginPath()
      ctx.moveTo(x, -6.6)
      ctx.quadraticCurveTo(x + 1.4, 0, x, 6.6)
      ctx.stroke()
    })
    return
  }

  if (index === 2) {
    // 河豚：几个小圆点，读成"鼓起来的刺座"
    const dots = [[-3, -3.5], [-3.4, 2.6], [1.4, -5.4]]
    ctx.fillStyle = 'rgba(180, 84, 36, 0.35)'
    dots.forEach(([x, y]) => {
      ctx.beginPath()
      ctx.arc(x, y, 0.9, 0, Math.PI * 2)
      ctx.fill()
    })
  }
}

/**
 * 眼睛：dim 时画成闭眼弧线（吃饱了），比单纯压暗更讲故事
 */
function drawEye(ctx, index, s, dim) {
  const eyes = [
    [5.0, -1.8, 2.1], // 鱼苗：大眼（幼态）
    [5.2, -1.6, 1.9],
    [4.4, -2.2, 2.2], // 河豚
    [6.0, -1.4, 1.7], // 剑鱼
    [4.2, -2.4, 1.8]  // 神仙鱼
  ]
  const [ex, ey, r] = eyes[index] || eyes[1]

  if (dim) {
    ctx.beginPath()
    ctx.arc(ex, ey, r * 0.95, Math.PI * 0.15, Math.PI * 0.85)
    ctx.strokeStyle = '#152A45'
    ctx.lineWidth = 1.3
    ctx.stroke()
    return
  }

  ctx.beginPath()
  ctx.arc(ex, ey, r, 0, Math.PI * 2)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()

  ctx.beginPath()
  ctx.arc(ex + r * 0.22, ey, r * 0.52, 0, Math.PI * 2)
  ctx.fillStyle = '#152A45'
  ctx.fill()
}
