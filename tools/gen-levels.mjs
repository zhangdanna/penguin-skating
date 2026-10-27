/**
 * 关卡烘焙脚本（G1）
 *
 * 用 js/levels/level-generator.js 生成前 N 关，按最优步数全局排序后写入
 * js/levels/generated-levels.js。排序这一步很关键：各难度档的产出是并行
 * 生成的，直接按生成顺序编号会出现「第 90 关比第 80 关简单」的倒退。
 *
 * N 之后的关卡由 level-manager 在运行时按 levelNum 确定性生成，
 * 用的是同一份生成器代码，所以风格与烘焙关卡一致。
 *
 * 运行：node tools/gen-levels.mjs [关数]
 */

import fs from 'node:fs'
import path from 'node:path'
import {
  generateLevelBoard,
  boardToLevelData,
  boardSignature,
  getBandForLevel
} from '../js/levels/level-generator.js'

const LEVEL_COUNT = Number(process.argv[2]) || 200
const OUT_PATH = path.resolve('js/levels/generated-levels.js')

/**
 * 烘焙段的步数上限
 *
 * 7×9 棋盘的最优步数天花板在 50 附近，但只有少数「运气好」的候选能摸到。
 * 不封顶时排序后最后一关会撞出 47 步，而 201 关之后的运行时生成稳定在
 * 30~45，玩家从第 200 关进第 201 关会明显觉得「变简单了」。
 * 压到 42 之后，烘焙尾段与运行时生成落在同一水位，过渡自然。
 */
const MAX_OPTIMAL = 42

const seen = new Set()
const entries = []
const t0 = Date.now()

console.log(`烘焙 ${LEVEL_COUNT} 关…`)

for (let slot = 1; slot <= LEVEL_COUNT; slot++) {
  const band = getBandForLevel(slot)

  let board = generateLevelBoard(slot, { seen, maxAttempts: 10, maxOptimal: MAX_OPTIMAL })

  // 极少数情况下 10 次候选全部无解（或被上限卡掉），换几个派生 seed 再来
  let retry = 0
  while (!board && retry < 8) {
    retry++
    board = generateLevelBoard(slot * 31 + retry, { seen, maxAttempts: 6, maxOptimal: MAX_OPTIMAL })
  }

  // 上限卡得太死时（高档候选大多超过 42）放开一次，宁可尾段高一点也不能缺关
  if (!board) {
    board = generateLevelBoard(slot, { seen, maxAttempts: 10 })
  }

  if (!board) {
    console.error(`\n第 ${slot} 关生成失败（尝试了 ${10 + 8 * 6} 个候选）`)
    process.exit(1)
  }

  seen.add(boardSignature(board))
  entries.push({ slot, band, board })

  if (slot % 25 === 0) {
    console.log(`  ${slot}/${LEVEL_COUNT}  ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  }
}

// 按最优步数全局排序 → 难度严格单调
entries.sort((a, b) => a.board.optimal - b.board.optimal || a.slot - b.slot)

const levels = entries.map((entry, index) =>
  boardToLevelData(entry.board, index + 1, entry.band)
)

const optList = levels.map(l => l.optimal)
const minOpt = Math.min(...optList)
const maxOpt = Math.max(...optList)

// ---------- 输出 ----------
const lines = []
lines.push('/**')
lines.push(` * 第 1~${LEVEL_COUNT} 关（自动生成，请勿手改）`)
lines.push(' *')
lines.push(' * 由 tools/gen-levels.mjs + js/levels/level-generator.js 生成：')
lines.push(' *   - 逆向构造：从终局反向拉箱，盘面必然可解')
lines.push(' *   - BFS 求解器计算真实最优步数 optimal')
lines.push(` *   - 标准步数 par = optimal（G1：3 星必须走出最优解）`)
lines.push(' *   - 按 optimal 全局排序，难度严格单调；盘面签名全局去重')
lines.push(` *   - ${LEVEL_COUNT} 关之后由 level-manager 运行时确定性生成，关卡无上限`)
lines.push(' *')
lines.push(' * 需要调整难度时改 level-generator.js 的 LEVEL_BANDS 后重跑本脚本')
lines.push(' */')
lines.push('')
lines.push('export const GENERATED_LEVELS = {')

for (const lv of levels) {
  const stones = lv.stones.map(s => `{ x: ${s.x}, y: ${s.y}, size: ${s.size} }`).join(', ')
  const obstacles = lv.obstacles.length === 0
    ? '[]'
    : '[\n      ' + lv.obstacles
      .map(o => `{ type: '${o.type}', x: ${o.x}, y: ${o.y}, size: ${o.size} }`)
      .join(',\n      ') + '\n    ]'

  lines.push(`  ${lv.id}: {`)
  lines.push(`    id: ${lv.id},`)
  lines.push(`    name: '${lv.name}',`)
  lines.push(`    difficulty: '${lv.difficulty}',`)
  lines.push(`    optimal: ${lv.optimal},`)
  lines.push(`    par: ${lv.par},`)
  lines.push(`    penguin: { x: ${lv.penguin.x}, y: ${lv.penguin.y} },`)
  lines.push(`    stones: [${stones}],`)
  lines.push(`    target: { x: ${lv.target.x}, y: ${lv.target.y}, width: ${lv.target.width}, height: ${lv.target.height} },`)
  lines.push(`    obstacles: ${obstacles}`)
  lines.push('  },')
}

lines.push('}')
lines.push('')

fs.writeFileSync(OUT_PATH, lines.join('\n'), 'utf8')

console.log(`\n✅ 生成 ${levels.length} 关 → ${OUT_PATH}`)
console.log(`   最优步数 ${minOpt} ~ ${maxOpt}，耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`)

// 单调性自检
let prev = 0
let bad = 0
for (const lv of levels) {
  if (lv.optimal < prev) bad++
  prev = lv.optimal
}
console.log(`   单调性：${bad === 0 ? '通过' : `有 ${bad} 处倒退`}`)
