import Sprite from '../base/sprite'

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

    // 绘制冰墙主体
    ctx.fillStyle = 'rgba(135, 206, 235, 0.8)'
    ctx.fillRect(this.x, this.y, this.width, this.height)

    // 绘制冰晶纹理
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.lineWidth = 1

    // 对角线纹理
    ctx.beginPath()
    ctx.moveTo(this.x + 10, this.y + 10)
    ctx.lineTo(this.x + this.width - 10, this.y + this.height - 10)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(this.x + this.width - 10, this.y + 10)
    ctx.lineTo(this.x + 10, this.y + this.height - 10)
    ctx.stroke()

    // 边框
    ctx.strokeStyle = 'rgba(100, 180, 220, 0.9)'
    ctx.lineWidth = 2
    ctx.strokeRect(this.x, this.y, this.width, this.height)

    // 高光效果
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.fillRect(this.x + 5, this.y + 5, this.width / 3, this.height / 3)

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
    ctx.save()

    const centerX = this.x + this.width / 2
    const centerY = this.y + this.height / 2
    const radius = this.width / 2 - 5

    // 绘制黑色窟窿
    ctx.fillStyle = '#1a1a1a'
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    ctx.fill()

    // 绘制内部渐变
    const gradient = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, radius
    )
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.9)')
    gradient.addColorStop(0.7, 'rgba(20, 20, 20, 0.7)')
    gradient.addColorStop(1, 'rgba(40, 40, 40, 0.5)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    ctx.fill()

    // 绘制警示红光
    const alpha = (Math.sin(this.warningPulse) + 1) / 2 * 0.6
    ctx.strokeStyle = `rgba(255, 50, 50, ${alpha})`
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius + 2, 0, Math.PI * 2)
    ctx.stroke()

    // 绘制裂纹
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)'
    ctx.lineWidth = 1
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2
      const x1 = centerX + Math.cos(angle) * (radius - 5)
      const y1 = centerY + Math.sin(angle) * (radius - 5)
      const x2 = centerX + Math.cos(angle) * (radius + 8)
      const y2 = centerY + Math.sin(angle) * (radius + 8)
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    }

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
    ctx.save()

    const centerX = this.x + this.width / 2
    const centerY = this.y + this.height / 2

    // 绘制雪堆阴影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
    ctx.beginPath()
    ctx.ellipse(centerX + 2, centerY + this.height / 2 - 5, this.width / 2 - 2, 8, 0, 0, Math.PI * 2)
    ctx.fill()

    // 绘制雪堆主体（多个圆形组合）
    ctx.fillStyle = '#ffffff'

    // 底部大雪球
    ctx.beginPath()
    ctx.arc(centerX, centerY + 5, 18, 0, Math.PI * 2)
    ctx.fill()

    // 左下小雪球
    ctx.beginPath()
    ctx.arc(centerX - 12, centerY + 10, 12, 0, Math.PI * 2)
    ctx.fill()

    // 右下小雪球
    ctx.beginPath()
    ctx.arc(centerX + 12, centerY + 10, 12, 0, Math.PI * 2)
    ctx.fill()

    // 顶部雪球
    ctx.beginPath()
    ctx.arc(centerX, centerY - 5, 14, 0, Math.PI * 2)
    ctx.fill()

    // 绘制雪花点缀
    ctx.fillStyle = 'rgba(200, 220, 255, 0.8)'
    const snowflakes = [
      { x: -8, y: -2, size: 2 },
      { x: 5, y: 8, size: 1.5 },
      { x: -3, y: 12, size: 1 },
      { x: 10, y: -3, size: 1.5 }
    ]

    snowflakes.forEach(flake => {
      ctx.beginPath()
      ctx.arc(centerX + flake.x, centerY + flake.y, flake.size, 0, Math.PI * 2)
      ctx.fill()
    })

    // 绘制高光
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.beginPath()
    ctx.arc(centerX - 5, centerY - 8, 4, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }
}
