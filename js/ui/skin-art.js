/**
 * 外观绘制（配件 / 展台纹理 / 背景色卡）
 *
 * 为什么单独一个文件：
 *   `theme.js` 已经 1300 行，再塞 4 个配件会变成第二个 achievement-scene。
 *   这里只负责「在企鹅坐标系里画一个配件」，不认识存档、不认识场景。
 *
 * 坐标系约定（与 `drawPenguin` 内部完全一致）：
 *   原点 = 身体中心；头顶 y = -25.5；眼睛 (±5.9, -11.6)；喙尖 y = -3.2；
 *   围巾上沿 y = -4（所以配件**不许压到 -4 以下**，否则会盖住围巾和嘴）。
 *
 * 本文件不 import theme（会形成 theme → skin-art → theme 的循环依赖），
 * 颜色一律写在这里。
 */

const INK = '#152A45'

/** 配件描边统一细一档：企鹅本体线宽 1.5，配件 1.1 才不会喧宾夺主 */
const LINE = 1.1

/**
 * 画一个企鹅配件
 *
 * @param {CanvasRenderingContext2D} ctx - 已经在企鹅坐标系里
 * @param {string} id - `SKIN_ITEMS` 里的 penguin 类 id
 * @returns {boolean} 是否画了东西（未知 id 返回 false，调用方可据此跳过）
 */
export function drawPenguinAccessory(ctx, id) {
  switch (id) {
    case 'hat_winter':
      drawWinterHat(ctx)
      return true
    case 'glasses_round':
      drawRoundGlasses(ctx)
      return true
    case 'headphones':
      drawHeadphones(ctx)
      return true
    case 'hat_santa':
      drawSantaHat(ctx)
      return true
    default:
      return false
  }
}

/**
 * 毛线帽：帽身 + 折边 + 绒球
 *
 * 折边必须压在 -25.5 ~ -20 这条带上 —— 那是头顶最宽的位置，
 * 再往下就滑到脸上了（眼睛在 -11.6）。
 */
function drawWinterHat(ctx) {
  ctx.save()

  // 帽身
  ctx.beginPath()
  ctx.moveTo(-13.6, -23.5)
  ctx.quadraticCurveTo(-14.6, -35.5, 0, -35.5)
  ctx.quadraticCurveTo(14.6, -35.5, 13.6, -23.5)
  ctx.closePath()
  ctx.fillStyle = '#7EC8F0'
  ctx.fill()
  ctx.strokeStyle = '#3E8FB8'
  ctx.lineWidth = LINE
  ctx.stroke()

  // 竖向针织纹（细，不能抢）
  ctx.strokeStyle = 'rgba(62, 143, 184, 0.45)'
  ctx.lineWidth = 0.8
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath()
    ctx.moveTo(i * 6.4, -34)
    ctx.lineTo(i * 6.4, -24.5)
    ctx.stroke()
  }

  // 折边：白色，盖在头顶
  ctx.beginPath()
  ctx.ellipse(0, -24.6, 14.6, 3.4, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()
  ctx.strokeStyle = '#BBD9E8'
  ctx.lineWidth = LINE
  ctx.stroke()

  // 绒球
  ctx.beginPath()
  ctx.arc(0, -37.4, 3.9, 0, Math.PI * 2)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()
  ctx.strokeStyle = '#BBD9E8'
  ctx.lineWidth = LINE
  ctx.stroke()

  ctx.restore()
}

/**
 * 圆墨镜：两片镜片 + 鼻梁 + 镜腿
 *
 * 镜片用半透明深色而不是纯黑：完全遮住眼睛会让「happy / sad」的表情白画。
 */
function drawRoundGlasses(ctx) {
  const eyeX = 5.9
  const eyeY = -11.6
  const r = 5.2

  ctx.save()

  // 镜腿（先画，压在镜片下面）
  ctx.strokeStyle = INK
  ctx.lineWidth = 1.3
  ;[-1, 1].forEach((side) => {
    ctx.beginPath()
    ctx.moveTo(side * (eyeX + r - 0.6), eyeY - 1.2)
    ctx.lineTo(side * 13.4, eyeY - 3.2)
    ctx.stroke()
  })

  // 鼻梁
  ctx.beginPath()
  ctx.moveTo(-1.6, eyeY - 0.6)
  ctx.quadraticCurveTo(0, eyeY - 2.2, 1.6, eyeY - 0.6)
  ctx.stroke()

  // 镜片
  ;[-1, 1].forEach((side) => {
    ctx.beginPath()
    ctx.arc(side * eyeX, eyeY, r, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(31, 58, 95, 0.82)'
    ctx.fill()
    ctx.strokeStyle = INK
    ctx.lineWidth = 1.3
    ctx.stroke()

    // 高光：一小段弧，让镜片有玻璃感
    ctx.beginPath()
    ctx.arc(side * eyeX, eyeY, r - 1.6, Math.PI * 1.15, Math.PI * 1.55)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)'
    ctx.lineWidth = 1.4
    ctx.lineCap = 'round'
    ctx.stroke()
  })

  ctx.restore()
}

/**
 * 耳机：头箍 + 两只耳罩
 *
 * 头箍从头顶绕过去（半径 15，正好落在身体轮廓外沿），
 * 耳罩贴在两侧 -9 的高度 —— 再高会和眼睛抢位置。
 */
function drawHeadphones(ctx) {
  ctx.save()

  // 头箍
  ctx.beginPath()
  ctx.arc(0, -6, 16.4, Math.PI * 1.12, Math.PI * 1.88)
  ctx.strokeStyle = '#8B6BE8'
  ctx.lineWidth = 3.2
  ctx.lineCap = 'round'
  ctx.stroke()

  // 内层浅色，做出厚度
  ctx.beginPath()
  ctx.arc(0, -6, 16.4, Math.PI * 1.12, Math.PI * 1.88)
  ctx.strokeStyle = 'rgba(196, 178, 255, 0.85)'
  ctx.lineWidth = 1.2
  ctx.stroke()

  // 耳罩
  ;[-1, 1].forEach((side) => {
    ctx.beginPath()
    ctx.ellipse(side * 15.6, -6.4, 3.7, 5.2, side * 0.12, 0, Math.PI * 2)
    ctx.fillStyle = '#A78BFA'
    ctx.fill()
    ctx.strokeStyle = '#6E4FCB'
    ctx.lineWidth = LINE
    ctx.stroke()

    ctx.beginPath()
    ctx.ellipse(side * 15.6, -6.4, 1.7, 2.6, side * 0.12, 0, Math.PI * 2)
    ctx.fillStyle = '#6E4FCB'
    ctx.fill()
  })

  ctx.restore()
}

/**
 * 圣诞帽：白毛边 + 红帽身 + 白球（帽尖往右歪）
 *
 * 毛边必须盖住 -26 ~ -20：这是「帽子戴上去」而不是「帽子浮在头上」的关键，
 * 与主题里围巾贴脖子的处理是同一个道理。
 */
function drawSantaHat(ctx) {
  ctx.save()

  // 红帽身：从左下斜向右上
  ctx.beginPath()
  ctx.moveTo(-13.2, -21.5)
  ctx.quadraticCurveTo(-12, -33.5, 3.2, -35.2)
  ctx.quadraticCurveTo(12.4, -36.4, 14.6, -31.4)
  ctx.quadraticCurveTo(9.4, -28.4, 4.2, -25.4)
  ctx.quadraticCurveTo(0.6, -23.2, 0.2, -21.5)
  ctx.closePath()
  ctx.fillStyle = '#E8453C'
  ctx.fill()
  ctx.strokeStyle = '#B62F28'
  ctx.lineWidth = LINE
  ctx.stroke()

  // 白毛边
  ctx.beginPath()
  ctx.ellipse(0, -21.8, 14.4, 3.6, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()
  ctx.strokeStyle = '#D8DEE6'
  ctx.lineWidth = LINE
  ctx.stroke()

  // 帽尖白球
  ctx.beginPath()
  ctx.arc(15.2, -32.4, 3.6, 0, Math.PI * 2)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()
  ctx.strokeStyle = '#D8DEE6'
  ctx.lineWidth = LINE
  ctx.stroke()

  ctx.restore()
}

/**
 * 展台纹理（画在托盘底色之上、虚线框之内）
 *
 * 只加纹理不改底色：底色由 `TRAY_PALETTES` 给，这里负责「贝壳」那种扇骨感。
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} id
 * @param {number} x - 托盘左上角
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} k - 格子缩放系数
 */
export function drawTrayTexture(ctx, id, x, y, w, h, k) {
  if (id !== 'tray_shell' && id !== 'tray_coral') return

  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()

  if (id === 'tray_shell') {
    // 扇骨：从下沿中点放射，透明度压到 0.14，只做「有纹理」的暗示
    ctx.strokeStyle = 'rgba(150, 92, 40, 0.16)'
    ctx.lineWidth = 1.1 * k
    const cx = x + w / 2
    const cy = y + h + 2 * k
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + i * w * 0.22, y - 2 * k)
      ctx.stroke()
    }

    // 珠光层：沿上沿一笔白色柔光，把「珠光暖白」和普通奶油底拉开
    ctx.beginPath()
    ctx.moveTo(x + 6 * k, y + h * 0.26)
    ctx.quadraticCurveTo(x + w * 0.5, y - 5 * k, x + w - 6 * k, y + h * 0.22)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)'
    ctx.lineWidth = 2.4 * k
    ctx.lineCap = 'round'
    ctx.stroke()

    // 珍珠高光：不是两个半透明白点（在浅底上等于没画），而是有落影、
    // 有冷暖渐变的立起来小球。商城预览 k=1、游戏里 k≈0.9，都要看得见。
    ;[[0.17, 0.30, 6.4], [0.83, 0.27, 4.4], [0.78, 0.74, 3]].forEach(([fx, fy, r0], i) => {
      const r = r0 * k
      const px = x + w * fx
      const py = y + h * fy

      ctx.beginPath()
      ctx.ellipse(px, py + r * 0.72, r * 1.05, r * 0.38, 0, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(142, 97, 52, 0.20)'
      ctx.fill()

      const pearl = ctx.createRadialGradient(
        px - r * 0.38, py - r * 0.42, r * 0.08,
        px, py, r
      )
      pearl.addColorStop(0, '#FFFFFF')
      pearl.addColorStop(0.55, i === 0 ? '#FFF7EC' : '#FFF3E2')
      pearl.addColorStop(1, i === 0 ? '#EFCF9E' : '#E8C796')
      ctx.beginPath()
      ctx.arc(px, py, r, 0, Math.PI * 2)
      ctx.fillStyle = pearl
      ctx.fill()
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)'
      ctx.lineWidth = 0.9 * k
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(px - r * 0.32, py - r * 0.36, Math.max(0.8, r * 0.22), 0, Math.PI * 2)
      ctx.fillStyle = '#FFFFFF'
      ctx.fill()
    })
  } else {
    // 珊瑚纹：一串交错的小弧线，像水下的珊瑚枝，压到 0.12 不抢小鱼
    ctx.strokeStyle = 'rgba(150, 46, 18, 0.13)'
    ctx.lineWidth = 1.6 * k
    const step = Math.max(14, w / 6)
    for (let gx = x + step / 2; gx < x + w; gx += step) {
      for (let gy = y + step / 2; gy < y + h; gy += step) {
        ctx.beginPath()
        ctx.arc(gx, gy, step * 0.32, Math.PI * 0.15, Math.PI * 1.15)
        ctx.stroke()
      }
    }
  }
  ctx.restore()
}

/**
 * 背景色卡（商城预览用）
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {{top:string, mid:string, bottom:string}} palette
 * @param {number} [radius]
 */
export function drawBackgroundSwatch(ctx, x, y, w, h, palette, radius = 10) {
  const grad = ctx.createLinearGradient(0, y, 0, y + h)
  if (palette && Array.isArray(palette.stops)) {
    palette.stops.forEach(([offset, color]) => grad.addColorStop(offset, color))
  } else {
    grad.addColorStop(0, palette.top)
    grad.addColorStop(0.5, palette.mid)
    grad.addColorStop(1, palette.bottom)
  }

  const r = Math.min(radius, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()
}

/**
 * 雪花币图标（六瓣雪花）
 *
 * 别用实心圆点代替：一个点读不出「雪花币」，玩家会以为是状态指示灯。
 * 六根辐条 + 末端小枝，12px 下仍能看出是雪花。
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx
 * @param {number} cy
 * @param {number} r - 半径
 * @param {string} [color]
 */
export function drawCoinIcon(ctx, cx, cy, r, color = '#2C9CD6') {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1.2, r * 0.22)
  ctx.lineCap = 'round'

  for (let i = 0; i < 6; i++) {
    ctx.save()
    ctx.rotate((Math.PI / 3) * i)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, -r)
    // 末端小枝：两根斜线，让它在小尺寸下也不至于糊成星号
    ctx.moveTo(0, -r * 0.62)
    ctx.lineTo(-r * 0.3, -r * 0.9)
    ctx.moveTo(0, -r * 0.62)
    ctx.lineTo(r * 0.3, -r * 0.9)
    ctx.stroke()
    ctx.restore()
  }

  ctx.restore()
}
