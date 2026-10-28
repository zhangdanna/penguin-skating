import { COLORS, drawCandyButton, drawStickerText } from './theme'

/**
 * 全局点击音钩子
 *
 * 全项目 20 多个按钮都由 Button 渲染，在构造函数里塞回调太啰嗦，
 * 在场景的 onTouchStart 里各写一遍又会漏。所以在这里开一个模块级钩子，
 * 由 game.js 在 initUI() 里注入一次：
 *
 *   setButtonTapSound(() => audioManager.playButtonSound())
 *
 * 只在「按下且命中」时触发（不是抬起），手指一落就有反馈，手感更实。
 */
let tapSound = null

export function setButtonTapSound(fn) {
  tapSound = typeof fn === 'function' ? fn : null
}

/**
 * 按钮组件
 * 可点击的UI按钮（糖果胶囊风）
 */
export default class Button {
  constructor(config) {
    this.x = config.x || 0
    this.y = config.y || 0
    this.width = config.width || 150
    this.height = config.height || 50
    this.text = config.text || ''
    this.fontSize = config.fontSize || 20
    this.textColor = config.textColor || '#ffffff'
    this.bgColor = config.bgColor || '#4a90d9'
    this.hoverColor = config.hoverColor || '#357abd'
    this.borderColor = config.borderColor || '#2c5282'
    this.borderRadius = config.borderRadius || 25

    this.isHovered = false
    this.isVisible = true
    this.isEnabled = true

    // 点击回调
    this.onClick = config.onClick || null
  }

  /**
   * 检测点是否在按钮内
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @returns {boolean}
   */
  contains(x, y) {
    return x >= this.x && x <= this.x + this.width &&
           y >= this.y && y <= this.y + this.height
  }

  /**
   * 处理触摸开始
   * @param {Object} touch - 触摸事件
   */
  onTouchStart(touch) {
    if (!this.isVisible || !this.isEnabled) return false

    if (this.contains(touch.clientX, touch.clientY)) {
      this.isHovered = true
      // 点击音在「按下」时给，不等抬起 —— 触觉反馈越早越像实体按钮
      if (tapSound) {
        try {
          tapSound()
        } catch (e) {
          // 音频异常绝不能影响按钮本身
        }
      }
      return true
    }
    return false
  }

  /**
   * 处理触摸结束
   * @param {Object} touch - 触摸事件
   */
  onTouchEnd(touch) {
    if (!this.isVisible || !this.isEnabled) return false

    const wasHovered = this.isHovered
    this.isHovered = false

    if (wasHovered && this.contains(touch.clientX, touch.clientY)) {
      if (this.onClick) {
        this.onClick()
      }
      return true
    }
    return false
  }

  /**
   * 渲染按钮
   * @param {CanvasRenderingContext2D} ctx - 画布上下文
   */
  render(ctx) {
    if (!this.isVisible) return

    const pressed = this.isHovered
    const offsetY = pressed ? 2 : 0

    // 糖果胶囊按钮
    drawCandyButton(ctx, this.x, this.y, this.width, this.height, {
      color: pressed ? this.hoverColor : this.bgColor,
      shadowColor: this.borderColor,
      radius: Math.min(this.borderRadius, this.height / 2),
      pressed
    })

    // 贴纸感文字
    drawStickerText(ctx, this.text, this.x + this.width / 2, this.y + this.height / 2 + offsetY, {
      size: this.fontSize,
      color: this.textColor,
      stroke: COLORS.navyDeep,
      strokeWidth: 3
    })
  }

  /**
   * 绘制圆角矩形
   */
  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + width - radius, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
    ctx.lineTo(x + width, y + height - radius)
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    ctx.lineTo(x + radius, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
    ctx.lineTo(x, y + radius)
    ctx.quadraticCurveTo(x, y, x + radius, y)
    ctx.closePath()
  }

  /**
   * 设置按钮文本
   * @param {string} text - 按钮文本
   */
  setText(text) {
    this.text = text
  }

  /**
   * 设置按钮是否可用
   * @param {boolean} enabled - 是否可用
   */
  setEnabled(enabled) {
    this.isEnabled = enabled
  }

  /**
   * 设置按钮是否可见
   * @param {boolean} visible - 是否可见
   */
  setVisible(visible) {
    this.isVisible = visible
  }
}
