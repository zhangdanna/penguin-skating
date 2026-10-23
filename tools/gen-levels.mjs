/**
 * 关卡生成器 + BFS 求解器（C4 / C5）
 *
 * 为什么不用"随机摆盘 + 验证"：3 块冰的随机布局绝大多数无解，
 * 实测平均要试 700+ 次才能撞到一个可解盘面，53 关跑不完。
 *
 * 这里改用**逆向构造**：从"冰块已经在目标里"的终局出发，做随机反向移动
 * （企鹅后撤并把冰块往回拉），得到的盘面必然可解——正解就是这段随机序列的逆序。
 * 然后只用 BFS 算真实最优步数。
 *
 * 移动规则与 game.js 的 tryMove 完全一致：
 *   - 企鹅不能进墙 / 冰窟窿 / 越界；雪堆只减速不阻挡企鹅
 *   - 冰块前方是墙 / 雪堆 / 冰窟窿 / 另一块冰 / 越界 时推不动
 *   - 冰块被推进冰窟窿 = 失败，生成时直接避免
 *   - 所有冰块都落在目标矩形内 = 通关
 *
 * 运行：node tools/gen-levels.mjs [输出路径]
 */

import fs from 'node:fs'
import path from 'node:path'

const COLS = 7
const ROWS = 9
const CELL = 50

const DIRS = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0]
]

const FIRST_GENERATED = 8
const LAST_GENERATED = 60

// ---------- 确定性随机 ----------
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------- 棋盘工具 ----------
const idx = (col, row) => row * COLS + col
const colOf = (cell) => cell % COLS
const rowOf = (cell) => (cell - (cell % COLS)) / COLS
const inside = (col, row) => col >= 0 && col < COLS && row >= 0 && row < ROWS

/** 0 空地 / 1 墙 / 2 冰窟窿 / 3 雪堆 */
function buildGrid(obstacles) {
  const grid = new Uint8Array(COLS * ROWS)
  for (const o of obstacles) {
    grid[idx(o.col, o.row)] = o.type === 'wall' ? 1 : o.type === 'hole' ? 2 : 3
  }
  return grid
}

const inTarget = (target, col, row) =>
  col >= target.col && col < target.col + target.w &&
  row >= target.row && row < target.row + target.h

// ---------- BFS 求解器 ----------
/**
 * 状态用整数编码：p | s0<<6 | s1<<12 | s2<<18
 * @returns {{solvable:boolean, optimal:number, explored:number}}
 */
function solve(level, maxDepth = 120, maxStates = 200000) {
  const grid = buildGrid(level.obstacles)
  const startPenguin = idx(level.penguin.col, level.penguin.row)
  const startStones = level.stones.map(s => idx(s.col, s.row)).sort((a, b) => a - b)

  const encode = (p, stones) =>
    p | (stones[0] << 6) | (stones[1] << 12) | (stones[2] << 18)

  const allInTarget = (stones) => stones.every(s => inTarget(level.target, colOf(s), rowOf(s)))

  if (allInTarget(startStones)) return { solvable: true, optimal: 0, explored: 0 }

  const visited = new Set()
  let frontier = [[startPenguin, startStones, 0]]
  visited.add(encode(startPenguin, startStones))

  while (frontier.length > 0) {
    const next = []

    for (const [penguin, stones, depth] of frontier) {
      if (depth >= maxDepth) continue

      const pcol = colOf(penguin)
      const prow = rowOf(penguin)

      for (let d = 0; d < 4; d++) {
        const dc = DIRS[d][0]
        const dr = DIRS[d][1]
        const ncol = pcol + dc
        const nrow = prow + dr
        if (!inside(ncol, nrow)) continue

        const ncell = idx(ncol, nrow)
        if (grid[ncell] === 1 || grid[ncell] === 2) continue

        const stonePos = stones.indexOf(ncell)

        if (stonePos >= 0) {
          const scol = ncol + dc
          const srow = nrow + dr
          if (!inside(scol, srow)) continue

          const scell = idx(scol, srow)
          if (grid[scell] !== 0) continue
          if (stones.includes(scell)) continue

          const newStones = stones.slice()
          newStones[stonePos] = scell
          newStones.sort((a, b) => a - b)

          const k = encode(ncell, newStones)
          if (visited.has(k)) continue
          visited.add(k)

          if (allInTarget(newStones)) {
            return { solvable: true, optimal: depth + 1, explored: visited.size }
          }

          next.push([ncell, newStones, depth + 1])
        } else {
          const k = encode(ncell, stones)
          if (visited.has(k)) continue
          visited.add(k)
          next.push([ncell, stones, depth + 1])
        }
      }
    }

    if (visited.size > maxStates) return { solvable: false, optimal: -1, explored: visited.size }
    frontier = next
  }

  return { solvable: false, optimal: -1, explored: visited.size }
}

// ---------- 逆向构造 ----------
/**
 * 从终局出发做随机反向移动，得到一个必然可解的盘面
 * 反向移动（撤销一次推箱）：企鹅从 X 走到 X+e，同时把 X-e 的冰块拉到 X
 */
function reverseWalk(rand, target, obstacles, steps) {
  const grid = buildGrid(obstacles)
  const passable = (cell) => grid[cell] === 0 || grid[cell] === 3

  // 冰块初始都在目标格里
  const stones = new Set()
  for (let c = target.col; c < target.col + target.w; c++) {
    for (let r = target.row; r < target.row + target.h; r++) {
      stones.add(idx(c, r))
    }
  }

  // 企鹅站在任意空格
  const free = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = idx(c, r)
      if (passable(cell) && !stones.has(cell)) free.push(cell)
    }
  }
  if (free.length === 0) return null
  let penguin = free[Math.floor(rand() * free.length)]

  // 目标中心（用于"把冰块拉远"的偏好）
  const tc = target.col + (target.w - 1) / 2
  const tr = target.row + (target.h - 1) / 2
  const distToTarget = (cell) =>
    Math.abs(colOf(cell) - tc) + Math.abs(rowOf(cell) - tr)

  for (let step = 0; step < steps; step++) {
    // 给 4 个方向打分：能把冰块拉得更远的优先，避免盘面越走越"贴脸"
    const options = []

    for (let d = 0; d < 4; d++) {
      const dc = DIRS[d][0]
      const dr = DIRS[d][1]

      const pcol = colOf(penguin) + dc
      const prow = rowOf(penguin) + dr
      if (!inside(pcol, prow)) continue

      const newP = idx(pcol, prow)
      if (!passable(newP) || stones.has(newP)) continue

      const backCol = colOf(penguin) - dc
      const backRow = rowOf(penguin) - dr
      const pullCell = inside(backCol, backRow) ? idx(backCol, backRow) : -1
      const pullable = pullCell >= 0 && stones.has(pullCell)

      let score = rand()
      if (pullable) {
        const before = distToTarget(pullCell)
        const after = distToTarget(penguin)
        // 拉远加权重，拉近减权重
        score += after > before ? 3 : -1
      }

      options.push({ d, newP, pullCell, pullable, score })
    }

    if (options.length === 0) break

    options.sort((a, b) => b.score - a.score)
    const chosen = options[0]

    if (chosen.pullable) {
      stones.delete(chosen.pullCell)
      stones.add(penguin)
    }
    penguin = chosen.newP
  }

  const stoneList = [...stones].map(cell => ({ col: colOf(cell), row: rowOf(cell) }))

  return {
    penguin: { col: colOf(penguin), row: rowOf(penguin) },
    stones: stoneList,
    target,
    obstacles
  }
}

// ---------- 盘面构建 ----------
function pickTarget(rand) {
  const horizontal = rand() < 0.6
  const tw = horizontal ? 3 : 1
  const th = horizontal ? 1 : 3

  const col = horizontal
    ? 1 + Math.floor(rand() * (COLS - tw - 1))
    : 1 + Math.floor(rand() * (COLS - 2))
  const row = horizontal
    ? 4 + Math.floor(rand() * (ROWS - th - 4))
    : 4 + Math.floor(rand() * (ROWS - th - 3))

  return { col, row, w: tw, h: th }
}

function pickObstacles(rand, target, count) {
  const taken = new Set()
  for (let c = target.col; c < target.col + target.w; c++) {
    for (let r = target.row; r < target.row + target.h; r++) taken.add(idx(c, r))
  }

  const types = ['wall', 'hole', 'snow']
  const obstacles = []

  for (let i = 0; i < count; i++) {
    let placed = false
    for (let attempt = 0; attempt < 60; attempt++) {
      const c = Math.floor(rand() * COLS)
      const r = 1 + Math.floor(rand() * Math.max(1, target.row - 1))
      const cell = idx(c, r)
      if (taken.has(cell)) continue
      // 目标区正上方一格不放障碍，避免把入口彻底堵死
      if (c >= target.col && c < target.col + target.w && r === target.row - 1) continue

      taken.add(cell)
      obstacles.push({ type: types[Math.floor(rand() * types.length)], col: c, row: r })
      placed = true
      break
    }
    if (!placed) break
  }

  return obstacles
}

function signature(level) {
  const s = level.stones.map(x => `${x.col},${x.row}`).sort().join(';')
  const o = level.obstacles.map(x => `${x.type}${x.col},${x.row}`).sort().join(';')
  return `p${level.penguin.col},${level.penguin.row}|s${s}|t${level.target.col},${level.target.row},${level.target.w}|o${o}`
}

// ---------- 主流程：先建"可解盘面池"，再按最优步数排序分配关卡 ----------
const POOL_TARGET = 96
const LEVEL_COUNT = LAST_GENERATED - FIRST_GENERATED + 1

const pool = []
const seen = new Set()
let seed = 1
let attempts = 0

while (pool.length < POOL_TARGET && attempts < 30000) {
  attempts++

  const rand = mulberry32(seed++ * 2654435761)

  const target = pickTarget(rand)
  const obstacles = pickObstacles(rand, target, 3 + Math.floor(rand() * 2))
  const walkSteps = 60 + Math.floor(rand() * 300)

  const candidate = reverseWalk(rand, target, obstacles, walkSteps)
  if (!candidate || candidate.stones.length !== 3) continue

  // 一开始就通关的盘面不要
  if (candidate.stones.every(s => inTarget(target, s.col, s.row))) continue

  const sig = signature(candidate)
  if (seen.has(sig)) continue

  const result = solve(candidate, 110, 250000)
  if (!result.solvable) continue
  if (result.optimal < 18) continue

  seen.add(sig)
  pool.push({ ...candidate, optimal: result.optimal })

  if (pool.length % 20 === 0) {
    console.log(`  已收集 ${pool.length}/${POOL_TARGET} 个可解盘面（尝试 ${attempts} 次）`)
  }
}

if (pool.length < LEVEL_COUNT) {
  console.error(`盘面池不足：需要 ${LEVEL_COUNT}，只拿到 ${pool.length}`)
  process.exit(1)
}

// 按最优步数升序 → 难度单调递增
pool.sort((a, b) => a.optimal - b.optimal)

// 从池里等距取 LEVEL_COUNT 个，保证难度覆盖整个区间
const picked = []
const usedIdx = new Set()
const step = (pool.length - 1) / (LEVEL_COUNT - 1)
for (let i = 0; i < LEVEL_COUNT; i++) {
  let k = Math.round(i * step)
  while (usedIdx.has(k) && k < pool.length - 1) k++
  while (usedIdx.has(k) && k > 0) k--
  usedIdx.add(k)
  picked.push(pool[k])
}

const levels = []

picked.forEach((chosen, i) => {
  const n = FIRST_GENERATED + i
  const rank = i / (LEVEL_COUNT - 1)
  const difficulty = rank < 0.34 ? 'medium' : rank < 0.7 ? 'hard' : 'expert'
  const name = rank < 0.34 ? '冰墙回廊' : rank < 0.7 ? '裂隙迷阵' : '极寒试炼'

  levels.push({
    id: n,
    baseName: name,
    difficulty,
    optimal: chosen.optimal,
    par: Math.ceil(chosen.optimal * 1.2),
    penguin: { x: chosen.penguin.col * CELL, y: chosen.penguin.row * CELL },
    stones: chosen.stones.map(s => ({ x: s.col * CELL, y: s.row * CELL, size: 40 })),
    target: {
      x: chosen.target.col * CELL,
      y: chosen.target.row * CELL,
      width: chosen.target.w * CELL,
      height: chosen.target.h * CELL
    },
    obstacles: chosen.obstacles.map(o => ({
      type: o.type,
      x: o.col * CELL,
      y: o.row * CELL,
      size: CELL
    }))
  })
})

console.log(`\n  盘面池 ${pool.length} 个，取 ${levels.length} 个`)
console.log(`  第 8 关 optimal=${levels[0].optimal}，第 60 关 optimal=${levels[levels.length - 1].optimal}`)

// ---------- 输出 ----------
const lines = []
lines.push('/**')
lines.push(' * 第 8~60 关（C5 自动生成，请勿手改）')
lines.push(' *')
lines.push(' * 由 tools/gen-levels.mjs 生成：')
lines.push(' *   - 逆向构造：从终局随机反向移动，盘面必然可解')
lines.push(' *   - BFS 求解器计算真实最优步数 optimal')
lines.push(' *   - par = ceil(optimal × 1.2)，3 星不再要求零失误（C4）')
lines.push(' *   - 盘面签名去重，60 关互不重复')
lines.push(' *')
lines.push(' * 需要调整难度时改脚本后重跑：node tools/gen-levels.mjs')
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
  lines.push(`    baseName: '${lv.baseName}',`)
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

const outPath = path.resolve(process.argv[2] || 'js/levels/generated-levels.js')
fs.writeFileSync(outPath, lines.join('\n'), 'utf8')

const opts = levels.map(l => l.optimal)
console.log(`\n✅ 生成 ${levels.length} 关 → ${outPath}`)
console.log(`   最优步数 ${Math.min(...opts)} ~ ${Math.max(...opts)}，总尝试 ${attempts} 次`)
