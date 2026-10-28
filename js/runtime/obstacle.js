import Sprite from '../base/sprite'
import { drawSnowflake } from '../ui/theme'

/**
 * 障碍物基类
 * 所有障碍物的父类
 */
export default class Obstacle extends Sprite {
  constructor(type, x, y, size = 50) {
    super(x, y, size, size)
    this.type = type
    this.visible = true
  }

  /**
   * 企鹅碰撞处理
   * @param {Object} penguin - 企鹅对象
   * @returns {Object} 处理结果
   */
  onPenguinCollide(penguin) {
    // 子类实现
    return { action: 'none' }
  }

  /**
   * 冰块碰撞处理
   * @param {Object} stone - 冰块对象
   * @returns {Object} 处理结果
   */
  onStoneCollide(stone) {
    // 子类实现
    return { action: 'none' }
  }

  /**
   * 更新障碍物状态
   */
  update() {
    // 子类实现
  }

  /**
   * 渲染障碍物
   * @param {CanvasRenderingContext2D} ctx - 画布上下文
   */
  render(ctx) {
    // 子类实现
  }
}

/**
 * 障碍物类型枚举
 */
export const ObstacleType = {
  WALL: 'wall',           // 冰墙
  HOLE: 'hole',           // 冰窟窿
  SNOW: 'snow'            // 雪堆
}

/**
 * 障碍物工厂
 * 根据类型创建障碍物
 */
export class ObstacleFactory {
  /**
   * 创建障碍物
   * @param {Object} config - 障碍物配置
   * @returns {Obstacle} 障碍物实例
   */
  static create(config) {
    const { type, x, y, size } = config

    switch (type) {
      case ObstacleType.WALL:
        return new IceWall(x, y, size)
      case ObstacleType.HOLE:
        return new IceHole(x, y, size)
      case ObstacleType.SNOW:
        return new SnowPile(x, y, size)
      default:
        console.warn(`未知的障碍物类型: ${type}`)
        return null
    }
  }

  /**
   * 从关卡数据创建障碍物数组
   *
   * 创建完会再补一遍冰墙的连通信息：相邻的墙格共享边，绘制时只在
   * 「暴露边」做圆角与描边。少了这一步，一排 3 格墙会被画成三个独立
   * 的蓝色方块，玩家读不出「这是一堵墙」。
   *
   * 连通关系**只能用格子坐标算**（数据里的 col / row）。不能拿
   * `x / size` 反算：调用方会先把关卡坐标转成棋盘像素，中间加了
   * boardOffsetX，除出来不是整数，四舍五入会整体偏一格。
   * 数据里没带 col / row 时宁可不连（退化成独立方块），也不猜。
   *
   * @param {Array} obstaclesData - 障碍物数据数组，可带 col / row
   * @returns {Array<Obstacle>} 障碍物实例数组
   */
  static createFromLevelData(obstaclesData) {
    if (!obstaclesData || !Array.isArray(obstaclesData)) {
      return []
    }

    const list = []
    const cells = []

    obstaclesData.forEach(data => {
      const obstacle = this.create(data)
      if (!obstacle) return
      list.push(obstacle)
      cells.push(
        typeof data.col === 'number' && typeof data.row === 'number'
          ? `${data.col}:${data.row}`
          : null
      )
    })

    const wallCells = new Set()
    list.forEach((obstacle, i) => {
      if (obstacle.type === ObstacleType.WALL && cells[i]) wallCells.add(cells[i])
    })

    list.forEach((obstacle, i) => {
      if (obstacle.type !== ObstacleType.WALL || !cells[i]) return
      const [col, row] = cells[i].split(':').map(Number)
      obstacle.setWallLinks({
        up: wallCells.has(`${col}:${row - 1}`),
        down: wallCells.has(`${col}:${row + 1}`),
        left: wallCells.has(`${col - 1}:${row}`),
        right: wallCells.has(`${col + 1}:${row}`)
      })
    })

    return list
  }
}

/**
 * 冰墙类
 * 不可通过的障碍物
 *
 * 视觉目标：一眼读成「一堵晶莹的冰墙」，而不是「被涂成蓝色的格子」。
 * 三条硬约束：
 *   1. 主体明度必须明显低于白冰面。冰面是 rgba(255,255,255,0.66) 叠浅蓝
 *      （≈#DCEEF7），墙身一旦接近白色，上半截就会化进棋盘，只剩一条底边。
 *      但也不能压太深 —— 压到墨蓝就变成石板，冰的「透」全丢了。
 *   2. 相邻墙格不描边、不做圆角 —— 一段墙必须拼成一条完整轮廓。
 *   3. 色相要和冰窟窿拉开。洞是近黑的深蓝（凹），墙是中明度的青蓝 + 白霜冠
 *      （凸），两者靠明度和「有没有白色霜边」区分，不靠形状。
 *
 * 描边口径（2026-10-28 调浅）：冰的通透感靠亮高光 + 透光渐变，
 * 不靠深色描边硬抠轮廓。深海军蓝描边会直接把冰读成塑料块。
 */
class IceWall extends Obstacle {
  constructor(x, y, size = 50) {
    super(ObstacleType.WALL, x, y, size)
    this.color = '#7FC4E0'
    // 上下左右是否连着别的墙格。由 ObstacleFactory.createFromLevelData 注入。
    this.links = { up: false, down: false, left: false, right: false }
  }

  /**
   * 设置相邻墙格
   * @param {{up:boolean,down:boolean,left:boolean,right:boolean}} links
   */
  setWallLinks(links) {
    this.links = links
  }

  onPenguinCollide(penguin) {
    // 企鹅碰到冰墙停止
    return {
      action: 'stop',
      vx: 0,
      vy: 0
    }
  }

  onStoneCollide(stone) {
    // 冰块碰到冰墙停止
    return {
      action: 'stop',
      vx: 0,
      vy: 0
    }
  }

  render(ctx) {
    const { x, y, width: w, height: h } = this
    const L = this.links
    const radius = 9
    const cx = x + w / 2

    ctx.save()

    // ① 落地投影：只画在一段墙的最底下一格。
    //    每格都画的话，墙身里会叠出一排横向暗纹，像贴了一堆小卡片。
    //    投影也调淡了：原来 0.3 的近黑蓝会在墙脚下积出一圈脏边。
    if (!L.down) {
      ctx.fillStyle = 'rgba(16, 58, 86, 0.22)'
      ctx.beginPath()
      ctx.ellipse(cx, y + h - 1.5, w * 0.46, 4.6, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    // ② 主体：中浅冰蓝，明度压在冰面之下一档就够，不再往墨蓝里压
    wallPath(ctx, x, y, w, h, radius, L)
    const body = ctx.createLinearGradient(0, y, 0, y + h)
    body.addColorStop(0, '#A9E1F4')
    body.addColorStop(0.45, '#7FC4E0')
    body.addColorStop(1, '#5AA6C8')
    ctx.fillStyle = body
    ctx.fill()

    // ③ 内部细节（裁到墙体轮廓内，避免纹理溢出圆角）
    ctx.save()
    wallPath(ctx, x, y, w, h, radius, L)
    ctx.clip()

    // 底部正面厚度：给出「这块东西是有高度的」最直接的信号。
    // 别调回 #1F5C7E / #123F58 —— 那两档近黑的海军蓝是「石头感」的主要来源，
    // 冰砖的侧面应该是「折射后偏深一点的同一块冰」，不是另一个材质。
    if (!L.down) {
      const faceH = 11
      const face = ctx.createLinearGradient(0, y + h - faceH, 0, y + h)
      face.addColorStop(0, '#4E93B8')
      face.addColorStop(1, '#3E82A8')
      ctx.fillStyle = face
      ctx.fillRect(x, y + h - faceH, w, faceH)

      ctx.strokeStyle = 'rgba(60, 120, 155, 0.45)'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(x, y + h - faceH)
      ctx.lineTo(x + w, y + h - faceH)
      ctx.stroke()
    }

    // 顶部霜冠：整段墙的顶面。冰窟窿永远不会有的特征，靠它一眼区分墙和洞
    if (!L.up) {
      const cap = ctx.createLinearGradient(0, y, 0, y + 7)
      cap.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
      cap.addColorStop(1, 'rgba(255, 255, 255, 0.10)')
      ctx.fillStyle = cap
      ctx.fillRect(x, y, w, 7)
    }

    // 冰纹：白色打底 + 浅蓝压边，深底浅底都能立住
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(x + w * 0.18, y + h * 0.72)
    ctx.lineTo(x + w * 0.44, y + h * 0.44)
    ctx.lineTo(x + w * 0.3, y + h * 0.22)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.62)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.strokeStyle = 'rgba(60, 120, 155, 0.26)'
    ctx.lineWidth = 0.8
    ctx.stroke()

    // 气泡
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)'
    ctx.beginPath()
    ctx.arc(x + w * 0.72, y + h * 0.6, 2, 0, Math.PI * 2)
    ctx.arc(x + w * 0.83, y + h * 0.4, 1.3, 0, Math.PI * 2)
    ctx.fill()

    // 砖缝：只在接缝侧画，淡到不抢主体，但能看出墙是一块块砌起来的
    ctx.strokeStyle = 'rgba(70, 130, 165, 0.22)'
    ctx.lineWidth = 1
    if (L.up) {
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + w, y)
      ctx.stroke()
    }
    if (L.left) {
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x, y + h)
      ctx.stroke()
    }
    ctx.restore()

    // ④ 霜花：压在主体上，白色才立得住
    drawSnowflake(ctx, x + w * 0.7, y + h * 0.3, 4, 'rgba(255, 255, 255, 0.85)', 1.05)

    // ⑤ 外缘描边：只描暴露边。接缝处不描，一段墙才是一条完整轮廓，
    //    不会退化成「一排蓝色小方块」。
    //    颜色是中浅冰蓝，不是海军蓝 —— 冰的轮廓应该是「光在冰棱上的折射边」，
    //    深色硬边会把整块冰读成塑料/石板。辨识度交给下面那条白霜线。
    exposedEdgePath(ctx, x, y, w, h, radius, L)
    ctx.strokeStyle = 'rgba(74, 138, 176, 0.78)'
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.stroke()

    // ⑥ 内侧白霜线：贴着外缘再收 2px。
    //    描边调浅之后，这条白线是「墙在浅冰面上跳出来」的主力，
    //    不要为了柔和把它再压回 0.4 以下，否则整堵墙会糊回棋盘里。
    exposedEdgePath(ctx, x + 2, y + 2, w - 4, h - 4, Math.max(2, radius - 2), L)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.66)'
    ctx.lineWidth = 1.4
    ctx.stroke()

    ctx.restore()
  }
}

/**
 * 冰窟窿类
 * 掉入会导致失败
 * 视觉上是一处不规则碎裂的冰面破洞
 */
class IceHole extends Obstacle {
  constructor(x, y, size = 50) {
    super(ObstacleType.HOLE, x, y, size)
    this.warningPulse = 0
    this.warningSpeed = 0.05
    this.shape = this.createShape()
    this.cracks = this.createCracks()
    this.shards = this.createShards()
  }

  /**
   * 生成不规则的破洞轮廓（确定性抖动，避免每帧变化）
   */
  createShape() {
    const count = 12
    const points = []
    for (let i = 0; i < count; i++) {
      const noise = Math.abs(Math.sin(i * 12.9898 + 4.1) * 43758.5453 % 1)
      points.push({
        angle: (i / count) * Math.PI * 2,
        radius: 0.86 + noise * 0.16
      })
    }
    return points
  }

  /**
   * 生成从洞口向外扩散的折线裂纹
   */
  createCracks() {
    const cracks = []
    const count = 9
    for (let i = 0; i < count; i++) {
      const baseAngle = (i / count) * Math.PI * 2 + 0.18
      const points = []
      for (let step = 1; step <= 3; step++) {
        points.push({
          dist: 0.75 + step * 0.13 + (i % 2) * 0.02,
          angle: baseAngle + Math.sin(i * 5.3 + step * 2.7) * 0.09
        })
      }
      cracks.push({ points, branchAt: i % 3 === 0 })
    }
    return cracks
  }

  /**
   * 洞沿的碎冰碴
   */
  createShards() {
    return [0.5, 2.4, 3.8, 5.5].map((angle, i) => ({
      angle,
      halfWidth: 3 + (i % 2) * 1.5,
      length: 4 + (i % 3)
    }))
  }

  update() {
    // 更新警示脉冲
    this.warningPulse = (this.warningPulse + this.warningSpeed) % (Math.PI * 2)
  }

  onPenguinCollide(penguin) {
    // 企鹅掉入冰窟窿，游戏失败
    return {
      action: 'fail',
      reason: '掉入冰窟窿'
    }
  }

  onStoneCollide(stone) {
    // 冰块掉入冰窟窿，消失
    return {
      action: 'destroy'
    }
  }

  render(ctx) {
    const centerX = this.x + this.width / 2
    const centerY = this.y + this.height / 2
    const radius = this.width / 2 - 5
    const shape = this.shape
    const pulse = (Math.sin(this.warningPulse) + 1) / 2

    ctx.save()

    // 洞口寒气
    ctx.save()
    ctx.globalAlpha = 0.35 + pulse * 0.2
    const haze = ctx.createRadialGradient(centerX, centerY, radius * 0.9, centerX, centerY, radius + 12)
    haze.addColorStop(0, 'rgba(206, 244, 255, 0.5)')
    haze.addColorStop(1, 'rgba(206, 244, 255, 0)')
    ctx.fillStyle = haze
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius + 12, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // 洞外冰面裂纹（压在寒气之上，保持清晰）
    this.renderCracks(ctx, centerX, centerY, radius)

    // 洞内海水
    const water = ctx.createRadialGradient(centerX, centerY - 4, 2, centerX, centerY, radius * 1.02)
    water.addColorStop(0, '#052E43')
    water.addColorStop(0.55, '#0A4A63')
    water.addColorStop(1, '#10637D')
    polygonPath(ctx, centerX, centerY, shape, radius)
    ctx.fillStyle = water
    ctx.fill()

    // 洞内上缘压暗 + 水面微光
    ctx.save()
    polygonPath(ctx, centerX, centerY, shape, radius)
    ctx.clip()

    const depth = ctx.createLinearGradient(0, centerY - radius, 0, centerY + radius * 0.4)
    depth.addColorStop(0, 'rgba(0, 22, 34, 0.55)')
    depth.addColorStop(1, 'rgba(0, 22, 34, 0)')
    ctx.fillStyle = depth
    ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2)

    ctx.globalAlpha = 0.25 + pulse * 0.2
    ctx.strokeStyle = '#8FE3FF'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.ellipse(centerX + radius * 0.08, centerY + radius * 0.34, radius * 0.42, radius * 0.16, -0.2, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()

    // 碎裂冰沿：亮白边 + 内侧暗边，让洞口清晰立起来
    polygonPath(ctx, centerX, centerY, shape, radius)
    ctx.strokeStyle = 'rgba(244, 253, 255, 0.95)'
    ctx.lineWidth = 3
    ctx.stroke()

    polygonPath(ctx, centerX, centerY, shape, radius, 0.94)
    ctx.strokeStyle = 'rgba(3, 34, 48, 0.45)'
    ctx.lineWidth = 1.4
    ctx.stroke()

    // 洞沿碎冰碴
    this.shards.forEach(shard => {
      const px = centerX + Math.cos(shard.angle) * radius * 0.98
      const py = centerY + Math.sin(shard.angle) * radius * 0.98
      const tipX = centerX + Math.cos(shard.angle) * (radius + shard.length)
      const tipY = centerY + Math.sin(shard.angle) * (radius + shard.length)
      const nx = Math.cos(shard.angle + Math.PI / 2) * shard.halfWidth
      const ny = Math.sin(shard.angle + Math.PI / 2) * shard.halfWidth

      ctx.beginPath()
      ctx.moveTo(px + nx, py + ny)
      ctx.lineTo(tipX, tipY)
      ctx.lineTo(px - nx, py - ny)
      ctx.closePath()
      ctx.fillStyle = '#EAFBFF'
      ctx.fill()
      ctx.strokeStyle = 'rgba(92, 158, 188, 0.5)'
      ctx.lineWidth = 1
      ctx.stroke()
    })

    ctx.restore()
  }

  /**
   * 绘制辐射状冰面裂纹
   */
  renderCracks(ctx, centerX, centerY, radius) {
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    this.cracks.forEach(crack => {
      ctx.beginPath()
      crack.points.forEach((point, index) => {
        const x = centerX + Math.cos(point.angle) * radius * point.dist
        const y = centerY + Math.sin(point.angle) * radius * point.dist
        if (index === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })

      // 霜白底线 + 冰蓝裂纹，保证在浅色冰面上也看得清
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
      ctx.lineWidth = 2.6
      ctx.stroke()
      ctx.strokeStyle = 'rgba(92, 158, 188, 0.6)'
      ctx.lineWidth = 1.1
      ctx.stroke()

      if (crack.branchAt) {
        const last = crack.points[crack.points.length - 1]
        const bx = centerX + Math.cos(last.angle) * radius * last.dist
        const by = centerY + Math.sin(last.angle) * radius * last.dist
        const branchAngle = last.angle + 0.6

        ctx.beginPath()
        ctx.moveTo(bx, by)
        ctx.lineTo(bx + Math.cos(branchAngle) * radius * 0.22, by + Math.sin(branchAngle) * radius * 0.22)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.strokeStyle = 'rgba(92, 158, 188, 0.55)'
        ctx.lineWidth = 1
        ctx.stroke()
      }
    })

    ctx.restore()
  }
}

/**
 * 雪堆类
 * 减速区域
 */
class SnowPile extends Obstacle {
  constructor(x, y, size = 50) {
    super(ObstacleType.SNOW, x, y, size)
    this.slowFactor = 0.5  // 减速系数
  }

  onPenguinCollide(penguin) {
    // 企鹅经过雪堆减速
    return {
      action: 'slow',
      friction: 0.95,  // 增加摩擦
      speedMultiplier: this.slowFactor
    }
  }

  onStoneCollide(stone) {
    // 冰块卡在雪堆里，停止
    return {
      action: 'stuck',
      vx: 0,
      vy: 0
    }
  }

  render(ctx) {
    const centerX = this.x + this.width / 2
    const centerY = this.y + this.height / 2

    ctx.save()

    // 底部阴影
    ctx.fillStyle = 'rgba(24, 70, 100, 0.18)'
    ctx.beginPath()
    ctx.ellipse(centerX, centerY + 16, this.width * 0.4, 6, 0, 0, Math.PI * 2)
    ctx.fill()

    // 雪堆轮廓
    const mound = () => {
      ctx.beginPath()
      ctx.moveTo(centerX - 19, centerY + 15)
      ctx.quadraticCurveTo(centerX - 23, centerY - 2, centerX - 11, centerY - 10)
      ctx.quadraticCurveTo(centerX - 1, centerY - 19, centerX + 9, centerY - 11)
      ctx.quadraticCurveTo(centerX + 23, centerY - 4, centerX + 19, centerY + 15)
      ctx.closePath()
    }

    const snow = ctx.createLinearGradient(0, centerY - 20, 0, centerY + 16)
    snow.addColorStop(0, '#FFFFFF')
    snow.addColorStop(0.5, '#E9F7FF')
    snow.addColorStop(1, '#A9D6EC')
    mound()
    ctx.fillStyle = snow
    ctx.fill()

    // 轮廓描边：冷蓝色，避免和白色冰面融在一起
    mound()
    ctx.strokeStyle = 'rgba(58, 120, 156, 0.95)'
    ctx.lineWidth = 2.2
    ctx.stroke()

    // 底部冷色阴影（贴着雪堆轮廓裁切）
    ctx.save()
    mound()
    ctx.clip()
    const shade = ctx.createLinearGradient(0, centerY + 2, 0, centerY + 16)
    shade.addColorStop(0, 'rgba(104, 172, 204, 0)')
    shade.addColorStop(1, 'rgba(104, 172, 204, 0.55)')
    ctx.fillStyle = shade
    ctx.fillRect(centerX - 24, centerY + 2, 48, 14)
    ctx.restore()

    // 顶部高光
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(centerX - 12, centerY - 7)
    ctx.quadraticCurveTo(centerX - 3, centerY - 14, centerX + 7, centerY - 8)
    ctx.stroke()

    // 冰晶：冷蓝色描边，让雪堆在浅色冰面上更易辨认
    drawSnowflake(ctx, centerX - 7, centerY + 1, 5.5, 'rgba(66, 140, 176, 0.85)', 1.3)
    drawSnowflake(ctx, centerX + 8, centerY - 4, 3.5, 'rgba(66, 140, 176, 0.7)', 1.1)

    // 几粒雪沫
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.beginPath()
    ctx.arc(centerX + 12, centerY + 8, 2, 0, Math.PI * 2)
    ctx.arc(centerX - 13, centerY + 9, 1.6, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }
}

/**
 * 按给定轮廓点绘制不规则多边形
 */
function polygonPath(ctx, cx, cy, points, radius, scale = 1) {
  ctx.beginPath()
  points.forEach((point, index) => {
    const x = cx + Math.cos(point.angle) * radius * point.radius * scale
    const y = cy + Math.sin(point.angle) * radius * point.radius * scale
    if (index === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.closePath()
}

/**
 * 冰墙轮廓
 *
 * 只在「没有邻居」的那一侧做圆角，接缝侧保持直角。这样一段连续的墙
 * 拼起来是一条完整轮廓，而不是每格缩成一个小圆角方块。
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r - 圆角半径
 * @param {{up:boolean,down:boolean,left:boolean,right:boolean}} L
 */
function wallPath(ctx, x, y, w, h, r, L) {
  const tl = (!L.up && !L.left) ? r : 0
  const tr = (!L.up && !L.right) ? r : 0
  const br = (!L.down && !L.right) ? r : 0
  const bl = (!L.down && !L.left) ? r : 0

  ctx.beginPath()
  ctx.moveTo(x + tl, y)
  ctx.lineTo(x + w - tr, y)
  if (tr > 0) ctx.quadraticCurveTo(x + w, y, x + w, y + tr)
  ctx.lineTo(x + w, y + h - br)
  if (br > 0) ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h)
  ctx.lineTo(x + bl, y + h)
  if (bl > 0) ctx.quadraticCurveTo(x, y + h, x, y + h - bl)
  ctx.lineTo(x, y + tl)
  if (tl > 0) ctx.quadraticCurveTo(x, y, x + tl, y)
  ctx.closePath()
}

/**
 * 只包含「暴露边」的描边路径
 *
 * 与 wallPath 的区别：接缝侧的边**不进 path**。用它描边，一段墙只会
 * 在四周有一圈轮廓，内部接缝处不会叠出两倍粗的线。
 *
 * 每段边用独立子路径起笔（moveTo），坐标首尾重合，视觉上仍是连续轮廓。
 */
function exposedEdgePath(ctx, x, y, w, h, r, L) {
  const tl = (!L.up && !L.left) ? r : 0
  const tr = (!L.up && !L.right) ? r : 0
  const br = (!L.down && !L.right) ? r : 0
  const bl = (!L.down && !L.left) ? r : 0

  ctx.beginPath()

  if (!L.up) {
    ctx.moveTo(x + tl, y)
    ctx.lineTo(x + w - tr, y)
  }
  if (tr > 0) {
    ctx.moveTo(x + w - tr, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + tr)
  }

  if (!L.right) {
    ctx.moveTo(x + w, y + tr)
    ctx.lineTo(x + w, y + h - br)
  }
  if (br > 0) {
    ctx.moveTo(x + w, y + h - br)
    ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h)
  }

  if (!L.down) {
    ctx.moveTo(x + w - br, y + h)
    ctx.lineTo(x + bl, y + h)
  }
  if (bl > 0) {
    ctx.moveTo(x + bl, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - bl)
  }

  if (!L.left) {
    ctx.moveTo(x, y + h - bl)
    ctx.lineTo(x, y + tl)
  }
  if (tl > 0) {
    ctx.moveTo(x, y + tl)
    ctx.quadraticCurveTo(x, y, x + tl, y)
  }
}
