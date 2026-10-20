/**
 * 按钮组件
 * 可点击的UI按钮
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
    this.borderRadius = config.borderRadius || 8

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

    ctx.save()

    // 绘制按钮背景
    const bgColor = this.isHovered ? this.hoverColor : this.bgColor
    ctx.fillStyle = bgColor
    this.roundRect(ctx, this.x, this.y, this.width, this.height, this.borderRadius)
    ctx.fill()

    // 绘制边框
    ctx.strokeStyle = this.borderColor
    ctx.lineWidth = 2
    this.roundRect(ctx, this.x, this.y, this.width, this.height, this.borderRadius)
    ctx.stroke()

    // 绘制文字
    ctx.fillStyle = this.textColor
    ctx.font = `${this.fontSize}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(this.text, this.x + this.width / 2, this.y + this.height / 2)

    ctx.restore()
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
