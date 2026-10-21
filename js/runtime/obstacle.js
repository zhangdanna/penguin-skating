import Sprite from '../base/sprite'
import {
  COLORS,
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
   * 石头碰撞处理
   * @param {Object} stone - 石头对象
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
    // 石头碰到冰墙停止
    return {
      action: 'stop',
      vx: 0,
      vy: 0
    }
  }

  render(ctx) {
    ctx.save()

    // 底部阴影
    ctx.fillStyle = 'rgba(31, 58, 95, 0.16)'
    ctx.beginPath()
    ctx.ellipse(this.x + this.width / 2, this.y + this.height - 3, this.width * 0.4, 4, 0, 0, Math.PI * 2)
    ctx.fill()

    // 冰砖主体
    const ice = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height)
    ice.addColorStop(0, '#EAFBFF')
    ice.addColorStop(0.55, '#A9E2F8')
    ice.addColorStop(1, '#78C7E8')
    fillRoundRect(ctx, this.x + 2, this.y + 2, this.width - 4, this.height - 4, 8, ice)

    // 砖缝
    ctx.strokeStyle = 'rgba(70, 140, 170, 0.35)'
    ctx.lineWidth = 1.5
    const midY = this.y + this.height / 2
    ctx.beginPath()
    ctx.moveTo(this.x + 4, midY)
    ctx.lineTo(this.x + this.width - 4, midY)
    ctx.moveTo(this.x + this.width / 2, this.y + 4)
    ctx.lineTo(this.x + this.width / 2, midY)
    ctx.moveTo(this.x + this.width * 0.28, midY)
    ctx.lineTo(this.x + this.width * 0.28, this.y + this.height - 4)
    ctx.stroke()

    // 顶部左高光
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(this.x + 8, this.y + 7)
    ctx.lineTo(this.x + this.width - 12, this.y + 7)
    ctx.stroke()

    // 外描边
    roundRectPath(ctx, this.x + 2, this.y + 2, this.width - 4, this.height - 4, 8)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
    ctx.lineWidth = 2
    ctx.stroke()

    // 冰晶闪光
    drawSnowflake(ctx, this.x + this.width - 13, this.y + 14, 5, 'rgba(255, 255, 255, 0.75)', 1.2)

    ctx.restore()
  }
}

/**
 * 冰窟窿类
 * 掉入会导致失败
 */
class IceHole extends Obstacle {
  constructor(x, y, size = 50) {
    super(ObstacleType.HOLE, x, y, size)
    this.warningPulse = 0
    this.warningSpeed = 0.05
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
    // 石头掉入冰窟窿，消失
    return {
      action: 'destroy'
    }
  }

  render(ctx) {
    const centerX = this.x + this.width / 2
    const centerY = this.y + this.height / 2
    const radius = this.width / 2 - 5

    ctx.save()

    // 洞口寒气光晕
    const haze = ctx.createRadialGradient(centerX, centerY, radius, centerX, centerY, radius + 14)
    haze.addColorStop(0, 'rgba(143, 227, 255, 0.55)')
    haze.addColorStop(1, 'rgba(143, 227, 255, 0)')
    ctx.fillStyle = haze
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius + 14, 0, Math.PI * 2)
    ctx.fill()

    // 冰面水洞
    const water = ctx.createRadialGradient(centerX, centerY - 3, 2, centerX, centerY, radius)
    water.addColorStop(0, '#0B3B5E')
    water.addColorStop(0.7, '#14587C')
    water.addColorStop(1, '#2C86AD')
    ctx.fillStyle = water
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    ctx.fill()

    // 水光波纹
    const ripple = 0.5 + Math.sin(this.warningPulse) * 0.5
    ctx.strokeStyle = `rgba(143, 227, 255, ${0.25 + ripple * 0.35})`
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius * (0.45 + ripple * 0.2), 0, Math.PI * 2)
    ctx.stroke()

    // 冰面裂纹
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)'
    ctx.lineWidth = 1.5
    ctx.lineCap = 'round'
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2 + 0.3
      const inner = radius + 1
      const outer = radius + 4 + (i % 3) * 2
      ctx.beginPath()
      ctx.moveTo(centerX + Math.cos(angle) * inner, centerY + Math.sin(angle) * inner)
      ctx.lineTo(centerX + Math.cos(angle) * outer, centerY + Math.sin(angle) * outer)
      ctx.stroke()
    }

    // 洞口边缘
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    ctx.stroke()

    // 警示浮标
    const buoyX = centerX + radius * 0.72
    const buoyY = centerY - radius * 0.75
    ctx.fillStyle = COLORS.coral
    ctx.beginPath()
    ctx.arc(buoyX, buoyY, 4.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = COLORS.white
    ctx.fillRect(buoyX - 4.5, buoyY - 1.2, 9, 2.4)

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
    // 石头卡在雪堆里，停止
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
    ctx.fillStyle = 'rgba(31, 58, 95, 0.12)'
    ctx.beginPath()
    ctx.ellipse(centerX, centerY + this.height / 2 - 4, this.width * 0.42, 6, 0, 0, Math.PI * 2)
    ctx.fill()

    // 蓬松雪堆
    ctx.fillStyle = COLORS.white
    ctx.strokeStyle = 'rgba(180, 225, 245, 0.7)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(centerX, centerY + 5, 16, 0, Math.PI * 2)
    ctx.arc(centerX - 11, centerY + 9, 10, 0, Math.PI * 2)
    ctx.arc(centerX + 11, centerY + 9, 10, 0, Math.PI * 2)
    ctx.arc(centerX, centerY - 5, 12, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    // 雪面冷色阴影
    ctx.fillStyle = 'rgba(190, 235, 255, 0.55)'
    ctx.beginPath()
    ctx.ellipse(centerX, centerY + 12, 15, 5, 0, 0, Math.PI * 2)
    ctx.fill()

    // 雪花闪光
    drawSnowflake(ctx, centerX - 6, centerY - 8, 5, 'rgba(127, 212, 245, 0.85)', 1.2)
    drawSnowflake(ctx, centerX + 8, centerY + 2, 3.5, 'rgba(255, 255, 255, 0.95)', 1)

    ctx.restore()
  }
}
