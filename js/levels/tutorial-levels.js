/**
 * 前 3 关：手写的新手引导关
 *
 * 为什么不用生成器造这 3 关：
 *   生成器只保证「可解 + 最优步数落在区间」，不管「这一关教会了什么」。
 *   教程关要的是**概念可辨认**：第 1 关只有企鹅 / 冰块 / 展台三样东西，
 *   第 2 关才出现冰墙和冰洞，第 3 关才出现雪堆。生成器做不到这种克制。
 *
 * 为什么不新增 3 关、而是覆盖第 1~3 关：
 *   关卡号是存档（`gameProgress.unlockedLevel`）、烘焙数据、成就里程碑、
 *   排行榜上报的共同主键。前面插 3 关等于把 200 个烘焙关整体重编号，
 *   老存档的「第 12 关」会变成另一张盘面。覆盖 1~3 关不动编号，代价是
 *   原来的 3 张教学盘面不再使用（它们本来也只是随机生成的简单盘面）。
 *
 * 步数约束：第 4 关 optimal = 5，回归测试要求 1~200 关的 optimal 单调不减，
 * 所以这三关的 optimal 必须 ≤ 5。实测 3 / 4 / 5，正好每关多一步。
 * 改盘面后必须重跑 `solveBoard` 核对，别手写 optimal。
 */

import { CELL_SIZE } from './level-generator'

/**
 * 三个教学盘面（格子坐标）
 *
 * 锚点 anchor 用于引导气泡指位置：
 *   { kind: 'target' }         → 整块展台
 *   { kind: 'cell', col, row } → 某一个格子（冰墙 / 冰洞 / 雪堆）
 *   { kind: 'penguin' }        → 企鹅当前位置
 *
 * `at` 是触发阈值：显示「at ≤ 当前步数」里 at 最大的那条，
 * 所以第 1 关能做到「先教滑动，滑一步之后再教推箱」。
 */
export const TUTORIAL_LEVELS = {
  1: {
    name: '认识展台',
    optimal: 3,
    difficulty: 'tutorial',
    penguin: { col: 3, row: 6 },
    stones: [{ col: 3, row: 5 }],
    target: { col: 3, row: 2, w: 1, h: 1 },
    obstacles: [],
    hints: [
      {
        at: 0,
        text: '滑动屏幕，企鹅一次走一格',
        anchor: { kind: 'penguin' }
      },
      {
        at: 1,
        text: '把冰块一路推到小鱼展台上',
        anchor: { kind: 'target' }
      }
    ]
  },

  2: {
    name: '冰墙与冰洞',
    optimal: 4,
    difficulty: 'tutorial',
    penguin: { col: 3, row: 6 },
    stones: [{ col: 3, row: 4 }],
    target: { col: 3, row: 1, w: 1, h: 1 },
    // 目标那一行左边是墙、右边是洞，三种元素并排，一眼能对照
    obstacles: [
      { type: 'wall', col: 2, row: 1 },
      { type: 'hole', col: 4, row: 1 }
    ],
    hints: [
      {
        at: 0,
        text: '蓝色冰墙挡路，企鹅和冰块都推不动',
        anchor: { kind: 'cell', col: 2, row: 1 }
      },
      {
        at: 1,
        text: '深色冰洞掉进去就失败，别把冰块推过头',
        anchor: { kind: 'cell', col: 4, row: 1 }
      }
    ]
  },

  3: {
    name: '雪堆慢行',
    optimal: 5,
    difficulty: 'tutorial',
    // 企鹅起步在右边，必须踩上雪堆才能绕到冰块下方
    penguin: { col: 4, row: 6 },
    stones: [{ col: 3, row: 4 }],
    target: { col: 3, row: 1, w: 1, h: 1 },
    obstacles: [{ type: 'snow', col: 3, row: 5 }],
    hints: [
      {
        at: 0,
        text: '雪堆上滑得慢，冰块也推不上去',
        anchor: { kind: 'cell', col: 3, row: 5 }
      }
    ]
  }
}

/**
 * 把格子坐标的盘面转成关卡数据（50px 网格像素坐标）
 *
 * 与 level-generator 的 boardToLevelData 同口径，但保留手写的名字与提示。
 *
 * @param {number} levelNum
 * @param {Object} def - TUTORIAL_LEVELS 里的一项
 * @returns {Object} 可直接交给 LevelManager.normalize 的关卡数据
 */
export function buildTutorialLevel(levelNum, def) {
  return {
    id: levelNum,
    name: def.name,
    difficulty: def.difficulty || 'tutorial',
    optimal: def.optimal,
    par: def.optimal,
    grid: { width: 7, height: 9, cellSize: CELL_SIZE },
    penguin: {
      x: def.penguin.col * CELL_SIZE,
      y: def.penguin.row * CELL_SIZE
    },
    stones: def.stones.map(s => ({
      x: s.col * CELL_SIZE,
      y: s.row * CELL_SIZE,
      size: 40
    })),
    target: {
      x: def.target.col * CELL_SIZE,
      y: def.target.row * CELL_SIZE,
      width: def.target.w * CELL_SIZE,
      height: def.target.h * CELL_SIZE
    },
    obstacles: def.obstacles.map(o => ({
      type: o.type,
      x: o.col * CELL_SIZE,
      y: o.row * CELL_SIZE,
      size: CELL_SIZE
    }))
  }
}

/**
 * 取某一关在指定步数下应该显示的引导
 * @param {number} levelNum
 * @param {number} moves
 * @returns {Object|null} { text, anchor }
 */
export function getTutorialHint(levelNum, moves) {
  const def = TUTORIAL_LEVELS[levelNum]
  if (!def || !def.hints || !def.hints.length) return null

  let picked = null
  def.hints.forEach(hint => {
    if (moves >= hint.at) picked = hint
  })
  return picked
}
