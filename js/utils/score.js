/**
 * 星级与得分口径（D2）
 *
 * 原来这段 if/else 在 5 个地方各写了一遍：
 *   game.js:calculateStars / saveLevelProgress / reportScore
 *   js/ui/result-scene.js:calculateStars
 *   js/utils/food-manager.js:calculateRewards
 * 任何一处改了阈值，其余四处就会悄悄对不上（结算页显示 3 星、
 * 存档写 2 星、排行榜上报 1 星这种问题排查起来极痛苦）。
 * 统一到这里，只保留一份口径。
 */

/** 三星线：步数 ≤ par */
export const THREE_STAR_RATIO = 1
/** 二星线：步数 ≤ par × 1.5 */
export const TWO_STAR_RATIO = 1.5

/**
 * 计算星级
 *
 * G1 之后 par **就是**最优步数（不再是 optimal × 1.2），所以三星线等于
 * 「走出最优解」——一步都不许浪费。二星线仍是 par × 1.5。
 *
 * @param {number} moves - 实际步数
 * @param {number} par - 标准步数（= 最优步数，见 level-manager 的 calcPar）
 * @returns {1|2|3} 星级
 */
export function calcStars(moves, par) {
  // par 非法时退化成 1 星，避免 NaN 传染到存档与排行榜
  const safePar = Number.isFinite(par) && par > 0 ? par : 1
  const safeMoves = Number.isFinite(moves) ? Math.max(0, moves) : 0

  if (safeMoves <= safePar * THREE_STAR_RATIO) return 3
  if (safeMoves <= safePar * TWO_STAR_RATIO) return 2
  return 1
}
