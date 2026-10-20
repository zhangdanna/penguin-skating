/**
 * 碰撞检测系统
 * 提供AABB碰撞检测和碰撞响应
 */

/**
 * 检测两个矩形是否碰撞
 * @param {Object} a - 第一个矩形 {x, y, width, height}
 * @param {Object} b - 第二个矩形 {x, y, width, height}
 * @returns {boolean} 是否碰撞
 */
export function checkAABB(a, b) {
  return a.x < b.x + b.width &&
         a.x + a.width > b.x &&
         a.y < b.y + b.height &&
         a.y + a.height > b.y
}

/**
 * 检测点是否在矩形内
 * @param {number} x - 点x坐标
 * @param {number} y - 点y坐标
 * @param {Object} rect - 矩形 {x, y, width, height}
 * @returns {boolean} 是否在矩形内
 */
export function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.width &&
         y >= rect.y && y <= rect.y + rect.height
}

/**
 * 计算碰撞法线方向
 * @param {Object} a - 第一个矩形
 * @param {Object} b - 第二个矩形
 * @returns {Object} 法线方向 {nx, ny}
 */
export function getCollisionNormal(a, b) {
  const overlapX = Math.min(a.x + a.width - b.x, b.x + b.width - a.x)
  const overlapY = Math.min(a.y + a.height - b.y, b.y + b.height - a.y)

  if (overlapX < overlapY) {
    // 水平碰撞
    return {
      nx: a.x < b.x ? -1 : 1,
      ny: 0
    }
  } else {
    // 垂直碰撞
    return {
      nx: 0,
      ny: a.y < b.y ? -1 : 1
    }
  }
}
