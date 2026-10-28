/**
 * 关卡生成器 + BFS 求解器（离线烘焙与运行时生成共用）
 *
 * 设计目标（G1 难度重做）：
 *   1. 标准步数 = 最优步数（par 不再 ×1.2），3 星必须走出最优解；
 *   2. 难度按「关卡号 → 难度档」严格递增，且不再镜像循环；
 *   3. 关卡无上限：1~200 由 tools/gen-levels.mjs 烘焙，201 起运行时按
 *      levelNum 确定性生成（同关永远同一盘面，可复现、可存档）。
 *
 * 为什么用「逆向构造」而不是「随机摆盘 + 验证」：
 *   3 块冰的随机布局绝大多数无解，实测平均要试 700+ 次才撞到一个可解盘面。
 *   逆向构造从「冰块已经在目标里」的终局出发做随机反向移动，得到的盘面
 *   必然可解——正解就是这段随机序列的逆序。再用 BFS 求真实最优步数。
 *
 * 移动规则与 game.js 的 tryMove 严格一致：
 *   - 企鹅不能进墙 / 冰窟窿 / 越界；雪堆只减速不阻挡企鹅
 *   - 冰块前方是墙 / 雪堆 / 冰窟窿 / 另一块冰 / 越界 时推不动
 *   - 冰块被推进冰窟窿 = 失败
 *   - 所有冰块都落在目标矩形内 = 通关
 */

export const COLS = 7
export const ROWS = 9
export const CELL_SIZE = 50

/** BFS 状态编码里最多塞 3 块冰（p|s0<<6|s1<<12|s2<<18，24 bit，安全） */
export const MAX_STONES = 3

/** 编码哨兵：不足 3 块冰时补这个值，63 超出合法格号 0..62 */
const SENTINEL = 63

const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]]
/** DIRS 对应的方向名，供 withSolution 回放用 */
const DIR_NAMES = ['up', 'down', 'left', 'right']

const idx = (col, row) => row * COLS + col
const colOf = (cell) => cell % COLS
const rowOf = (cell) => (cell - (cell % COLS)) / COLS
const inside = (col, row) => col >= 0 && col < COLS && row >= 0 && row < ROWS
const randInt = (rand, min, max) => min + Math.floor(rand() * (max - min + 1))

/**
 * 难度分档
 *
 * `optimal` 是该档最优步数的目标区间 [lo, hi)，档内按关卡进度从 lo 线性
 * 爬到 hi。区间首尾相接（前档 hi === 后档 lo），保证跨档时最优步数不倒退。
 *
 * 各档的「狠度」靠四件事叠加，而不只是堆步数：
 *   - stones：冰块数（1→2→3），多块冰要排序，规划深度陡增
 *   - target：目标格数恰好等于冰块数时最难（1×3 配 3 冰必须精确填满）
 *   - walls：墙段走廊化，强制绕后，制造「推错一格就死局」
 *   - holes/snows：冰窟窿贴推进线，雪堆是冰块禁区（单向边界）
 */
export const LEVEL_BANDS = [
  {
    from: 1,
    upTo: 6,
    stones: 1,
    target: [1, 1],
    walls: [1, 3],
    holes: [0, 0],
    snows: [0, 1],
    optimal: [4, 10],
    difficulty: 'tutorial',
    names: ['初学滑冰', '企鹅起步', '第一块冰']
  },
  {
    from: 7,
    upTo: 15,
    stones: 2,
    target: [2, 1],
    walls: [3, 6],
    holes: [0, 2],
    snows: [0, 2],
    optimal: [10, 16],
    difficulty: 'easy',
    names: ['双石入洞', '并排推进', '冰面漫步']
  },
  {
    from: 16,
    upTo: 30,
    stones: 2,
    target: [2, 1],
    walls: [6, 9],
    holes: [1, 3],
    snows: [1, 2],
    optimal: [16, 23],
    difficulty: 'medium',
    names: ['冰墙回廊', '窄道推进', '裂隙迷阵']
  },
  {
    from: 31,
    upTo: 50,
    stones: 3,
    target: [3, 1],
    walls: [7, 10],
    holes: [2, 3],
    snows: [1, 2],
    optimal: [23, 30],
    difficulty: 'hard',
    names: ['三冰排序', '冰窟险径', '一线生机']
  },
  {
    from: 51,
    upTo: 80,
    stones: 3,
    target: [3, 1],
    walls: [9, 12],
    holes: [2, 4],
    snows: [2, 3],
    optimal: [30, 37],
    difficulty: 'expert',
    names: ['极寒试炼', '死角回廊', '冰原困局']
  },
  {
    from: 81,
    upTo: 120,
    stones: 3,
    // 竖排 3 格：和 1×3 横排交替，避免中后期目标形状千篇一律。
    // 注意格数必须严格等于 stones，否则会出现「3 个目标点只有 2 块冰」
    target: [1, 3],
    walls: [10, 13],
    holes: [3, 4],
    snows: [2, 3],
    optimal: [37, 44],
    difficulty: 'expert',
    names: ['冰封深渊', '永冻长廊', '绝境推演']
  },
  {
    from: 121,
    upTo: Infinity,
    stones: 3,
    target: [3, 1],
    walls: [11, 14],
    holes: [3, 5],
    snows: [2, 4],
    optimal: [38, 50],
    difficulty: 'expert',
    names: ['永冻荒原', '极地深渊', '无尽寒潮']
  }
]

/**
 * 取关卡对应的难度档
 * @param {number} levelNum
 * @returns {Object}
 */
export function getBandForLevel(levelNum) {
  const n = Math.max(1, Math.floor(levelNum) || 1)
  for (let i = 0; i < LEVEL_BANDS.length; i++) {
    if (n < LEVEL_BANDS[i].upTo) return LEVEL_BANDS[i]
  }
  return LEVEL_BANDS[LEVEL_BANDS.length - 1]
}

/**
 * 关卡在所属难度档内的进度（0~1）
 * 无尽档用 80 关为分母，跑满后恒定 1（步数不再膨胀，否则后期单关要几百步）
 */
export function getBandProgress(levelNum) {
  const band = getBandForLevel(levelNum)
  const span = band.upTo === Infinity ? 80 : band.upTo - band.from
  if (span <= 0) return 1
  return Math.min(1, Math.max(0, (levelNum - band.from) / span))
}

/**
 * 无尽档的额外加压
 *
 * 7×9 棋盘的最优步数天花板在 50 附近，步数饱和之后继续堆墙只会把可用
 * 空间挤没、optimal 反而下降。这里改为加冰窟窿：不改变最优步数，但把
 * 推进路线切得更碎——推错一格就掉洞重来，操作精度要求随关卡号持续上升。
 *
 * @param {number} levelNum
 * @returns {number} 额外冰窟窿数量（每 40 关 +1，上限 +4）
 */
function overflowHoles(levelNum) {
  if (levelNum < 121) return 0
  return Math.min(4, Math.floor((levelNum - 121) / 40))
}

// ---------- 确定性随机 ----------
export function mulberry32(seed) {
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
/** 0 空地 / 1 墙 / 2 冰窟窿 / 3 雪堆 */
function buildGrid(obstacles) {
  const grid = new Uint8Array(COLS * ROWS)
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i]
    grid[idx(o.col, o.row)] = o.type === 'wall' ? 1 : o.type === 'hole' ? 2 : 3
  }
  return grid
}

const inRect = (rect, col, row) =>
  col >= rect.col && col < rect.col + rect.w &&
  row >= rect.row && row < rect.row + rect.h

function pickN(rand, arr, n) {
  const copy = arr.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = copy[i]
    copy[i] = copy[j]
    copy[j] = tmp
  }
  return copy.slice(0, n)
}

// ---------- BFS 求解器 ----------
/**
 * @param {Object} board - { penguin, stones, target, obstacles }（格子坐标）
 * @param {Object} [options] - { maxStates, maxDepth, withSolution }
 *        withSolution 会额外返回 `solution`（方向名数组），供回归测试
 *        按最优解真实回放；默认关闭，省掉每个状态的父指针开销。
 * @returns {{solvable:boolean, optimal:number, explored:number, solution?:string[]}}
 */
export function solveBoard(board, options = {}) {
  const maxStates = options.maxStates || 120000
  const maxDepth = options.maxDepth || 240
  const withSolution = !!options.withSolution

  const grid = buildGrid(board.obstacles)
  const target = board.target
  const inTarget = (cell) => inRect(target, colOf(cell), rowOf(cell))

  const startP = idx(board.penguin.col, board.penguin.row)
  const startS = board.stones.map(s => idx(s.col, s.row)).sort((a, b) => a - b)
  while (startS.length < MAX_STONES) startS.push(SENTINEL)

  const encode = (p, st) => p | (st[0] << 6) | (st[1] << 12) | (st[2] << 18)
  const allIn = (st) => {
    for (let i = 0; i < st.length; i++) {
      if (st[i] !== SENTINEL && !inTarget(st[i])) return false
    }
    return true
  }

  const startKey = encode(startP, startS)
  if (allIn(startS)) {
    const empty = { solvable: true, optimal: 0, explored: 0 }
    if (withSolution) empty.solution = []
    return empty
  }

  /** 回溯父指针还原方向序列 */
  const tracePath = (key) => {
    const dirs = []
    let cur = key
    while (parent.has(cur)) {
      const node = parent.get(cur)
      if (!node) break
      dirs.push(DIR_NAMES[node.dir])
      cur = node.prev
    }
    return dirs.reverse()
  }

  const parent = withSolution ? new Map() : null
  if (withSolution) parent.set(startKey, null)

  const visited = new Set()
  visited.add(startKey)
  let frontier = [[startP, startS, 0, startKey]]

  while (frontier.length > 0) {
    const next = []

    for (let f = 0; f < frontier.length; f++) {
      const p = frontier[f][0]
      const st = frontier[f][1]
      const depth = frontier[f][2]
      const curKey = frontier[f][3]
      if (depth >= maxDepth) continue

      const pc = colOf(p)
      const pr = rowOf(p)

      for (let k = 0; k < 4; k++) {
        const nc = pc + DIRS[k][0]
        const nr = pr + DIRS[k][1]
        if (!inside(nc, nr)) continue

        const ncell = idx(nc, nr)
        if (grid[ncell] === 1 || grid[ncell] === 2) continue

        const sp = st.indexOf(ncell)

        if (sp >= 0) {
          const sc = nc + DIRS[k][0]
          const sr = nr + DIRS[k][1]
          if (!inside(sc, sr)) continue

          const scell = idx(sc, sr)
          // 冰块只能进纯空地：墙 / 冰窟窿 / 雪堆都推不动
          if (grid[scell] !== 0) continue
          if (st.indexOf(scell) >= 0) continue

          const ns = st.slice()
          ns[sp] = scell
          ns.sort((a, b) => a - b)

          const key = encode(ncell, ns)
          if (visited.has(key)) continue
          visited.add(key)
          if (withSolution) parent.set(key, { prev: curKey, dir: k })

          if (allIn(ns)) {
            const result = { solvable: true, optimal: depth + 1, explored: visited.size }
            if (withSolution) result.solution = tracePath(key)
            return result
          }
          next.push([ncell, ns, depth + 1, key])
        } else {
          const key = encode(ncell, st)
          if (visited.has(key)) continue
          visited.add(key)
          if (withSolution) parent.set(key, { prev: curKey, dir: k })
          next.push([ncell, st, depth + 1, key])
        }

        if (visited.size > maxStates) {
          return { solvable: false, optimal: -1, explored: visited.size }
        }
      }
    }

    frontier = next
  }

  return { solvable: false, optimal: -1, explored: visited.size }
}

// ---------- 盘面构造 ----------
function pickTarget(rand, size) {
  const tw = size[0]
  const th = size[1]
  // 四周各留 1 格，否则冰块没有推入空间
  const maxCol = COLS - tw - 1
  const maxRow = ROWS - th - 1
  if (maxCol < 1 || maxRow < 1) return null

  // 行偏好下半区：目标越靠下，冰块能拉出去的距离越长，最优步数才上得去
  const rowLo = Math.min(maxRow, Math.max(1, maxRow - 4))

  // 七成概率贴左右边：目标贴角时冰块必须从对角推回来，推进距离最长
  let col
  if (rand() < 0.7) {
    col = rand() < 0.5 ? 1 : maxCol
  } else {
    col = 1 + Math.floor(rand() * maxCol)
  }

  return {
    col,
    row: rowLo + Math.floor(rand() * (maxRow - rowLo + 1)),
    w: tw,
    h: th
  }
}

/**
 * 摆障碍
 * 墙按「墙段」放（2~4 格连成一段），自然形成走廊；
 * 冰窟窿与雪堆只放在目标区之外。
 */
function placeObstacles(rand, target, band, extraHoles) {
  const occupied = new Set()
  for (let c = target.col; c < target.col + target.w; c++) {
    for (let r = target.row; r < target.row + target.h; r++) {
      occupied.add(idx(c, r))
    }
  }

  const obstacles = []

  // ① 墙段
  const wallQuota = randInt(rand, band.walls[0], band.walls[1])
  let placedWalls = 0
  let guard = 0

  while (placedWalls < wallQuota && guard < 240) {
    guard++
    const horizontal = rand() < 0.5
    const len = Math.min(wallQuota - placedWalls, 2 + Math.floor(rand() * 3))
    const c0 = Math.floor(rand() * COLS)
    const r0 = Math.floor(rand() * ROWS)

    const cells = []
    let ok = true
    for (let k = 0; k < len; k++) {
      const c = horizontal ? c0 + k : c0
      const r = horizontal ? r0 : r0 + k
      if (!inside(c, r) || occupied.has(idx(c, r))) { ok = false; break }
      cells.push(idx(c, r))
    }
    if (!ok) continue

    for (let i = 0; i < cells.length; i++) {
      occupied.add(cells[i])
      obstacles.push({ type: 'wall', col: colOf(cells[i]), row: rowOf(cells[i]) })
    }
    placedWalls += cells.length
  }

  // ② 冰窟窿与雪堆
  const scatter = (type, count) => {
    for (let i = 0; i < count; i++) {
      for (let attempt = 0; attempt < 80; attempt++) {
        const c = Math.floor(rand() * COLS)
        const r = Math.floor(rand() * ROWS)
        const cell = idx(c, r)
        if (occupied.has(cell)) continue
        occupied.add(cell)
        obstacles.push({ type, col: c, row: r })
        break
      }
    }
  }

  scatter('hole', randInt(rand, band.holes[0], band.holes[1]) + extraHoles)
  scatter('snow', randInt(rand, band.snows[0], band.snows[1]))

  return obstacles
}

/**
 * 连通性校验：最大的可行走连通域必须覆盖目标区所有格，且足够大。
 * 否则会出现「目标区被墙封死」或「冰块推不进去」的死盘。
 */
function isBoardOpen(grid, target) {
  const total = COLS * ROWS
  const comp = new Int8Array(total)
  for (let i = 0; i < total; i++) comp[i] = -1

  const passable = (cell) => grid[cell] === 0 || grid[cell] === 3

  let nextId = 0
  let bestId = -1
  let bestSize = 0

  for (let start = 0; start < total; start++) {
    if (!passable(start) || comp[start] >= 0) continue

    const stack = [start]
    comp[start] = nextId
    let size = 0

    while (stack.length > 0) {
      const cell = stack.pop()
      size++
      const c = colOf(cell)
      const r = rowOf(cell)
      for (let k = 0; k < 4; k++) {
        const nc = c + DIRS[k][0]
        const nr = r + DIRS[k][1]
        if (!inside(nc, nr)) continue
        const n = idx(nc, nr)
        if (!passable(n) || comp[n] >= 0) continue
        comp[n] = nextId
        stack.push(n)
      }
    }

    if (size > bestSize) { bestSize = size; bestId = nextId }
    nextId++
  }

  if (bestSize < 24) return false

  for (let c = target.col; c < target.col + target.w; c++) {
    for (let r = target.row; r < target.row + target.h; r++) {
      if (comp[idx(c, r)] !== bestId) return false
    }
  }

  return true
}

/**
 * 企鹅走位最短路（把冰块当障碍，避免路径上顺带推动）
 * @returns {number} 步数，不可达返回 -1
 */
function findPath(grid, stones, from, to) {
  if (from === to) return 0

  const seen = new Uint8Array(COLS * ROWS)
  seen[from] = 1
  const queue = [from]
  const depth = [0]
  let head = 0

  while (head < queue.length) {
    const cell = queue[head]
    const d = depth[head]
    head++

    const c = colOf(cell)
    const r = rowOf(cell)
    for (let k = 0; k < 4; k++) {
      const nc = c + DIRS[k][0]
      const nr = r + DIRS[k][1]
      if (!inside(nc, nr)) continue

      const n = idx(nc, nr)
      if (seen[n]) continue
      if (grid[n] === 1 || grid[n] === 2) continue
      if (stones.has(n)) continue

      if (n === to) return d + 1
      seen[n] = 1
      queue.push(n)
      depth.push(d + 1)
    }
  }

  return -1
}

/**
 * 逆向构造：从终局（冰块都在目标里）出发，做「目标驱动的拉箱」
 *
 * 为什么不用「随机游走 + 碰巧拉一把」：
 *   随机游走 90% 的步数是空走，实测 500 步只换来 5~13 次有效推箱，
 *   最优步数怎么都上不了 40。这里改成每轮**主动挑一块冰**、算出企鹅该
 *   站哪、走最短路过去、再拉一格——每一轮都必然是有效推箱，最优步数
 *   由轮数直接控制。
 *
 * 反向一步的语义（正向是「企鹅在 A 向 f 推，冰块 A+f → A+2f」）：
 *   冰块在 S，企鹅站 P = S + e，企鹅后退到 P + e，冰块拉到 P。
 *   要求 P 是**纯空地**——冰块落到雪堆/洞/墙上在正向根本推不动，
 *   这类「假可解」盘面会在生成阶段直接掐掉，省下一次 BFS。
 */
function reverseWalk(rand, target, obstacles, grid, stoneCount, pullTarget) {
  const targetCells = []
  for (let c = target.col; c < target.col + target.w; c++) {
    for (let r = target.row; r < target.row + target.h; r++) {
      targetCells.push(idx(c, r))
    }
  }
  if (targetCells.length < stoneCount) return null

  // 每块冰带 id：要单独统计「这块被推了几次」，否则三块冰的推箱次数
  // 会严重不均，一块被拉到边角、另外两块原地不动，最优步数上不去。
  const stones = pickN(rand, targetCells, stoneCount).map((cell, id) => ({ id, cell }))

  const free = []
  for (let cell = 0; cell < COLS * ROWS; cell++) {
    if (grid[cell] !== 0) continue
    if (stones.some(s => s.cell === cell)) continue
    free.push(cell)
  }
  if (free.length === 0) return null

  let penguin = free[Math.floor(rand() * free.length)]

  const tc = target.col + (target.w - 1) / 2
  const tr = target.row + (target.h - 1) / 2
  const distToTarget = (cell) =>
    Math.abs(colOf(cell) - tc) + Math.abs(rowOf(cell) - tr)

  const maxPerStone = Math.max(3, Math.ceil(pullTarget / stoneCount))
  const pullCount = new Array(stoneCount).fill(0)

  let walkSteps = 0
  let pulls = 0

  for (let round = 0; round < pullTarget; round++) {
    const stoneSet = new Set()
    for (let i = 0; i < stones.length; i++) stoneSet.add(stones[i].cell)

    // 两轮：先找「能拉得更远」的，一个都没有才允许「等距横移」
    const farOptions = []
    const flatOptions = []

    for (let si = 0; si < stones.length; si++) {
      const stone = stones[si]
      if (pullCount[stone.id] >= maxPerStone) continue

      const sc = colOf(stone.cell)
      const sr = rowOf(stone.cell)
      const before = distToTarget(stone.cell)

      for (let k = 0; k < 4; k++) {
        const ec = DIRS[k][0]
        const er = DIRS[k][1]

        // 冰块落点 P：必须是纯空地（雪堆/洞/墙在正向推不进去）
        const pc = sc + ec
        const pr = sr + er
        if (!inside(pc, pr)) continue
        const P = idx(pc, pr)
        if (grid[P] !== 0) continue
        if (stoneSet.has(P)) continue

        // 企鹅拉完后站的位置
        const bc = sc + ec * 2
        const br = sr + er * 2
        if (!inside(bc, br)) continue
        const back = idx(bc, br)
        if (grid[back] === 1 || grid[back] === 2) continue
        if (stoneSet.has(back)) continue

        const after = distToTarget(P)
        if (after < before) continue

        const steps = findPath(grid, stoneSet, penguin, P)
        if (steps < 0) continue

        // 冰块要分散到不同远端，否则三块冰挤在同一片角落互相挡路，
        // 每块都推不了几步就到了墙边（实测 pulls 卡在 5~13）。
        let nearest = 99
        for (let oi = 0; oi < stones.length; oi++) {
          if (stones[oi].id === stone.id) continue
          const d = Math.abs(colOf(stones[oi].cell) - pc) + Math.abs(rowOf(stones[oi].cell) - pr)
          if (d < nearest) nearest = d
        }

        // 离目标越近的冰块越值得拉（-before），三块冰才会轮流散开；
        // 推得越多越降权（-pullCount），防止一块冰被反复薅。
        let score =
          rand() * 0.4 +
          (after - before) * 2 -
          before * 0.35 -
          pullCount[stone.id] * 1.1
        if (nearest <= 1) score -= 4
        else if (nearest <= 2) score -= 1.5

        const option = { stoneId: stone.id, P, back, steps, score }
        if (after > before) farOptions.push(option)
        else flatOptions.push(option)
      }
    }

    const options = farOptions.length > 0 ? farOptions : flatOptions
    if (options.length === 0) break

    options.sort((a, b) => b.score - a.score)
    const chosen = options[0]

    for (let i = 0; i < stones.length; i++) {
      if (stones[i].id === chosen.stoneId) {
        stones[i].cell = chosen.P
        break
      }
    }
    pullCount[chosen.stoneId]++
    penguin = chosen.back
    walkSteps += chosen.steps + 1
    pulls++
  }

  if (pulls < 3) return null

  const stoneList = stones.map(s => ({ col: colOf(s.cell), row: rowOf(s.cell) }))
  if (stoneList.length !== stoneCount) return null

  // 一开始就通关的盘面没有意义
  if (stoneList.every(s => inRect(target, s.col, s.row))) return null

  // 不允许「冰块开局就压在目标格上」：
  // 目标格被冰块盖住后，玩家数到的目标点会比冰块少（出现过「3 个目标点
  // 只有 2 块冰」的反馈），而且这种局面等于白送一块冰，难度也虚高。
  if (stoneList.some(s => inRect(target, s.col, s.row))) return null

  return {
    penguin: { col: colOf(penguin), row: rowOf(penguin) },
    stones: stoneList,
    target: { col: target.col, row: target.row, w: target.w, h: target.h },
    obstacles: obstacles.map(o => ({ type: o.type, col: o.col, row: o.row })),
    pulls,
    walkSteps
  }
}

/**
 * 目标区格数必须等于冰块数
 *
 * 多出来的空格永远填不满，玩家会以为「目标点比冰块多」是 bug；少格则
 * 根本不可能通关。这里按冰块数兜底纠正形状（保持矩形），难度档写错也
 * 不会产出坏关卡。
 *
 * @param {number[]} size - [宽格数, 高格数]
 * @param {number} stoneCount
 * @returns {number[]}
 */
function fitTargetSize(size, stoneCount) {
  const tw = Math.max(1, Math.round(size[0]))
  const th = Math.max(1, Math.round(size[1]))
  if (tw * th === stoneCount) return [tw, th]
  if (th === 1) return [stoneCount, 1]
  if (tw === 1) return [1, stoneCount]
  // 非单行形状对不上格数时退回横排，保证「格数 === 冰块数」
  return [stoneCount, 1]
}

function buildBoard(rand, band, levelNum, pullTarget) {
  const target = pickTarget(rand, fitTargetSize(band.target, band.stones))
  if (!target) return null

  const obstacles = placeObstacles(rand, target, band, overflowHoles(levelNum))
  const grid = buildGrid(obstacles)
  if (!isBoardOpen(grid, target)) return null

  return reverseWalk(rand, target, obstacles, grid, band.stones, pullTarget)
}

/**
 * 盘面签名（去重口径：企鹅位 + 冰位 + 目标 + 全部障碍）
 * 输入是格子坐标的盘面。
 */
export function boardSignature(board) {
  const s = board.stones.map(x => x.col + ',' + x.row).sort().join(';')
  const o = board.obstacles.map(x => x.type + x.col + ',' + x.row).sort().join(';')
  const t = board.target.col + ',' + board.target.row + ',' + board.target.w + ',' + board.target.h
  return board.penguin.col + ',' + board.penguin.row + '|' + s + '|' + t + '|' + o
}

/**
 * 关卡数据签名
 * 输入是 boardToLevelData 产出的像素坐标关卡；内部折回格子后与
 * boardSignature 用同一套口径，两者对同一盘面必须给出相同字符串，
 * 否则「烘焙关」与「运行时生成关」之间的去重会失效。
 */
export function levelDataSignature(level) {
  const c = (v) => Math.round(v / CELL_SIZE)
  const s = level.stones.map(x => c(x.x) + ',' + c(x.y)).sort().join(';')
  const o = level.obstacles.map(x => x.type + c(x.x) + ',' + c(x.y)).sort().join(';')
  const t = c(level.target.x) + ',' + c(level.target.y) + ',' +
    Math.round(level.target.width / CELL_SIZE) + ',' +
    Math.round(level.target.height / CELL_SIZE)
  return c(level.penguin.x) + ',' + c(level.penguin.y) + '|' + s + '|' + t + '|' + o
}

/**
 * 逆向一轮「走位 + 拉一格」的平均步数，用于把目标最优步数换算成拉箱轮数
 * 实测 2.6~3.4，取 3 做基准，各 attempt 上下浮动
 */
const PULL_STEPS_PER_ROUND = 3

/**
 * 按最优步数映射难度标签
 *
 * 不用「生成时用的 band」：烘焙会按 optimal 重新排序关卡号，排序后
 * 第 31 关可能来自 band D 而第 41 关来自 band C，标签会跟关卡号错位
 * （出现过「第 31 关 expert、第 41 关 hard」）。直接按步数映射，标签
 * 和玩家体感永远一致，也顺带决定了入场食物消耗。
 */
export function difficultyForOptimal(optimal) {
  if (optimal <= 9) return 'tutorial'
  if (optimal <= 16) return 'easy'
  if (optimal <= 24) return 'medium'
  if (optimal <= 34) return 'hard'
  return 'expert'
}

/**
 * 按关卡号确定性生成一个盘面
 *
 * seed 只由 levelNum 派生，所以同一关无论重玩多少次、换几台设备，
 * 盘面完全一致——存档、排行榜、分享才有意义。
 *
 * @param {number} levelNum
 * @param {Object} [options]
 * @param {number} [options.maxAttempts=14] - 最多试几个候选
 * @param {number} [options.maxStates=120000] - 单次 BFS 的状态预算
 * @param {Set<string>} [options.seen] - 已知盘面签名，撞了就换候选
 * @param {number} [options.minOptimal=0] - 最优步数下界。无尽关卡靠它
 *        保证「后面的关不会比前面简单」——7×9 棋盘的最优步数天花板在
 *        50 左右，只靠难度档递进会在后期撞到上限然后开始随机波动
 * @param {number} [options.seedSalt=0] - seed 扰动。同一个关卡号换 salt
 *        会得到一批全新的候选，用来在下界没命中时重试
 * @param {number} [options.maxOptimal=0] - 最优步数上界（0 表示不限）。
 *        烘焙时用它压住尾段的极端值：不加限制的话第 200 关会撞出一个
 *        47 步的盘面，而 201 关之后的运行时生成只有 30~45，玩家会突然
 *        觉得「怎么变简单了」
 * @returns {Object|null} 盘面（格子坐标，含 optimal）
 */
export function generateLevelBoard(levelNum, options = {}) {
  const maxAttempts = options.maxAttempts || 14
  const maxStates = options.maxStates || 120000
  const seen = options.seen || null
  const minOptimal = options.minOptimal || 0
  const maxOptimal = options.maxOptimal || 0
  const seedSalt = options.seedSalt || 0

  const band = getBandForLevel(levelNum)
  const lo = band.optimal[0]
  const hi = band.optimal[1]
  const goal = lo + (hi - lo) * getBandProgress(levelNum)
  const tolerance = Math.max(2.5, (hi - lo) * 0.3)

  let qualified = null
  let qualifiedGap = Infinity
  let fallback = null
  let fallbackGap = Infinity

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const seed = ((levelNum * 2654435761) ^ (attempt * 40503) ^ (seedSalt * 7919)) >>> 0
    const rand = mulberry32(seed)

    // 轮数按目标步数反推；attempt 越大越敢拉，用来逼近目标区间
    const rounds = Math.max(3, Math.round((goal / PULL_STEPS_PER_ROUND) * (0.8 + attempt * 0.06)))
    const board = buildBoard(rand, band, levelNum, rounds)
    if (!board) continue

    // 逆向总步数是正向解的长度（optimal 的上界）。离目标太远的候选
    // 直接丢掉，省下一次几十毫秒的 BFS —— 运行时生成靠这个把耗电压住。
    if (board.walkSteps > goal * 1.8 + 10) continue

    if (seen && seen.has(boardSignature(board))) continue

    const result = solveBoard(board, { maxStates })
    if (!result.solvable || result.optimal < 1) continue

    const solved = {
      ...board,
      optimal: result.optimal,
      signature: boardSignature(board)
    }

    if (maxOptimal > 0 && result.optimal > maxOptimal) continue

    const gap = Math.abs(result.optimal - goal)

    if (result.optimal >= minOptimal) {
      if (gap <= tolerance) return solved
      if (gap < qualifiedGap) { qualified = solved; qualifiedGap = gap }
    }

    if (gap < fallbackGap) { fallback = solved; fallbackGap = gap }
  }

  return qualified || fallback
}

/**
 * 盘面（格子坐标）→ 关卡数据（50px 网格像素坐标）
 * @param {Object} board
 * @param {number} levelNum
 * @param {Object} [band] - 生成时用的难度档。烘焙会按最优步数重新排序关卡号，
 *        排序后 band 与关卡号不再对应，所以必须由调用方显式传进来
 * @returns {Object}
 */
export function boardToLevelData(board, levelNum, band) {
  const zone = band || getBandForLevel(levelNum)
  const name = zone.names[levelNum % zone.names.length]

  return {
    id: levelNum,
    name,
    difficulty: difficultyForOptimal(board.optimal),
    optimal: board.optimal,
    // 标准步数 = 最优步数（G1）：3 星必须走出最优解
    par: board.optimal,
    grid: { width: COLS, height: ROWS, cellSize: CELL_SIZE },
    penguin: {
      x: board.penguin.col * CELL_SIZE,
      y: board.penguin.row * CELL_SIZE
    },
    stones: board.stones.map(s => ({
      x: s.col * CELL_SIZE,
      y: s.row * CELL_SIZE,
      size: 40
    })),
    target: {
      x: board.target.col * CELL_SIZE,
      y: board.target.row * CELL_SIZE,
      width: board.target.w * CELL_SIZE,
      height: board.target.h * CELL_SIZE
    },
    obstacles: board.obstacles.map(o => ({
      type: o.type,
      x: o.col * CELL_SIZE,
      y: o.row * CELL_SIZE,
      size: CELL_SIZE
    }))
  }
}
