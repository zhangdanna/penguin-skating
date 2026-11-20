/**
 * 关卡进度口径（唯一来源）
 *
 * 玩家反馈「不知道一共有多少关」。根因是关卡系统是两段式：
 *   1 ~ 200 关 由 tools/gen-levels.mjs 烘焙（人工调过难度曲线的主线）
 *   201 关起   由 level-manager 按关卡号确定性生成（同一关永远同一盘面）
 *
 * 之前所有界面只写「第 12 关」，没有分母，玩家无法判断自己走了多远。
 * 现在统一成：
 *   主线内 → 「第 12 关」，配「共 200 关」
 *   主线外 → 「无尽 · 第 3 关」（200 关全通后继续，不设上限）
 *
 * HUD / 结算页 / 首页都从这里取文案和进度，别各写一份数字 ——
 * 改主线关数时只改一处，否则三个页面会显示三个不同的总数。
 */

/** 主线关卡数。真实值由 game.js 用 levelManager.getCampaignSize() 覆盖 */
export const DEFAULT_MAINLINE_TOTAL = 200

function toPositiveInt(value, fallback) {
  const n = Math.floor(Number(value))
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/**
 * 计算某关在主线里的位置
 *
 * @param {number} level - 关卡号
 * @param {number} [total] - 主线总关数
 * @returns {{
 *   level:number, total:number, endless:boolean, endlessLevel:number,
 *   cleared:number, ratio:number
 * }}
 *        endless 为 true 时 ratio 恒为 1（主线已走完），endlessLevel 从 1 开始
 */
export function getLevelProgress(level, total = DEFAULT_MAINLINE_TOTAL) {
  const n = toPositiveInt(level, 1)
  const cap = toPositiveInt(total, DEFAULT_MAINLINE_TOTAL)
  const endless = n > cap

  return {
    level: n,
    total: cap,
    endless,
    endlessLevel: endless ? n - cap : 0,
    // 已通关关数：当前关还没过，所以是 level - 1
    cleared: Math.max(0, Math.min(cap, n - 1)),
    ratio: endless ? 1 : Math.min(1, n / cap)
  }
}

/**
 * 关卡标题（HUD / 结算徽章共用）
 * @returns {string} 「第 12 关」/「无尽 · 第 3 关」
 */
export function formatLevelBadge(level, total) {
  const p = getLevelProgress(level, total)
  return p.endless ? `无尽 · 第 ${p.endlessLevel} 关` : `第 ${p.level} 关`
}

/**
 * 关卡总数说明（结算页徽章后缀 / 首页进度）
 * @returns {string} 「共 200 关」/「主线 200 关已通关」
 */
export function formatLevelTotal(level, total) {
  const p = getLevelProgress(level, total)
  return p.endless ? `主线 ${p.total} 关已通关` : `共 ${p.total} 关`
}

/**
 * 首页进度文案
 * @returns {string} 「已通关 11 关 · 共 200 关」/「主线 200 关已通关 · 无尽第 3 关」
 */
export function formatLevelProgressText(level, total) {
  const p = getLevelProgress(level, total)
  if (p.endless) {
    return `主线 ${p.total} 关已通关 · 无尽第 ${p.endlessLevel} 关`
  }
  return `已通关 ${p.cleared} 关 · 共 ${p.total} 关`
}
