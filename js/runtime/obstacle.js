import Sprite from '../base/sprite'
import {
  drawSnowflake,
  fillRoundRect,
  roundRectPath
} from '../ui/theme'

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
   * @param {Array} obstaclesData - 障碍物数据数组
   * @returns {Array<Obstacle>} 障碍物实例数组
   */
  static createFromLevelData(obstaclesData) {
    if (!obstaclesData || !Array.isArray(obstaclesData)) {
      return []
    }

    return obstaclesData
      .map(data => this.create(data))
      .filter(obstacle => obstacle !== null)
  }
}

/**
 * 冰墙类
 * 不可通过的障碍物
 * 每格独立绘制一块冰砖，参考 4.png 的圆角冰砖造型
 */
class IceWall extends Obstacle {
  constructor(x, y, size = 50) {
    super(ObstacleType.WALL, x, y, size)
    this.color = '#87CEEB'
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
    const bx = x + 3          // 冰砖左边界
    const by = y + 2          // 冰砖上边界
    const bw = w - 6
    const bh = h - 8
    const radius = 10
    const thickness = 4       // 底部厚度

    ctx.save()

    // 落地阴影
    ctx.fillStyle = 'rgba(28, 96, 128, 0.16)'
    ctx.beginPath()
    ctx.ellipse(x + w / 2, by + bh + thickness + 1, w * 0.36, 4.5, 0, 0, Math.PI * 2)
    ctx.fill()

    // 底部厚度（先画一层向下偏移的冰砖）
    const sideGrad = ctx.createLinearGradient(0, by + bh, 0, by + bh + thickness + 2)
    sideGrad.addColorStop(0, '#8FCCE6')
    sideGrad.addColorStop(1, '#63B2D8')
    fillRoundRect(ctx, bx + 2, by + thickness, bw - 4, bh, radius, sideGrad)

    // 冰砖外框（斜面）
    const base = ctx.createLinearGradient(bx, by, bx + bw, by + bh)
    base.addColorStop(0, '#D6F2FE')
    base.addColorStop(0.5, '#B4E4F6')
    base.addColorStop(1, '#8CCBE5')
    fillRoundRect(ctx, bx, by, bw, bh, radius, base)

    // 冰砖内面
    const ix = bx + 4
    const iy = by + 4
    const iw = bw - 9
    const ih = bh - 10
    const inner = ctx.createLinearGradient(0, iy, 0, iy + ih)
    inner.addColorStop(0, '#F6FDFF')
    inner.addColorStop(0.55, '#E0F5FF')
    inner.addColorStop(1, '#BEE7FA')
    fillRoundRect(ctx, ix, iy, iw, ih, radius - 3, inner)

    // 顶部高光边
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(ix + 7, iy + 1)
    ctx.lineTo(ix + iw - 9, iy + 1)
    ctx.stroke()

    // 底部内侧暗边，强化冰砖厚度
    ctx.strokeStyle = 'rgba(96, 164, 194, 0.25)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(ix + 6, iy + ih - 1)
    ctx.lineTo(ix + iw - 6, iy + ih - 1)
    ctx.stroke()

    // 冰砖内部纹路：斜向冰纹 + 气泡
    ctx.save()
    roundRectPath(ctx, ix, iy, iw, ih, radius - 3)
    ctx.clip()

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(ix + iw * 0.2, iy + ih * 0.72)
    ctx.lineTo(ix + iw * 0.46, iy + ih * 0.42)
    ctx.lineTo(ix + iw * 0.34, iy + ih * 0.22)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(112, 182, 210, 0.35)'
    ctx.lineWidth = 1.1
    ctx.stroke()

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.beginPath()
    ctx.arc(ix + iw * 0.7, iy + ih * 0.66, 2, 0, Math.PI * 2)
    ctx.arc(ix + iw * 0.82, iy + ih * 0.45, 1.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    drawSnowflake(ctx, ix + iw * 0.68, iy + ih * 0.28, 4, 'rgba(255, 255, 255, 0.6)', 1)

    // 外轮廓：浅冰蓝描边，不使用深色黑边
    roundRectPath(ctx, bx, by, bw, bh, radius)
    ctx.strokeStyle = 'rgba(150, 212, 238, 0.95)'
    ctx.lineWidth = 1.6
    ctx.stroke()

    // 顶部最亮边
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(bx + 8, by + 1)
    ctx.lineTo(bx + bw - 9, by + 1)
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
