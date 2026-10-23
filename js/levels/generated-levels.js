/**
 * 第 8~60 关（C5 自动生成，请勿手改）
 *
 * 由 tools/gen-levels.mjs 生成：
 *   - 逆向构造：从终局随机反向移动，盘面必然可解
 *   - BFS 求解器计算真实最优步数 optimal
 *   - par = ceil(optimal × 1.2)，3 星不再要求零失误（C4）
 *   - 盘面签名去重，60 关互不重复
 *
 * 需要调整难度时改脚本后重跑：node tools/gen-levels.mjs
 */

export const GENERATED_LEVELS = {
  8: {
    id: 8,
    baseName: '冰墙回廊',
    difficulty: 'medium',
    optimal: 18,
    par: 22,
    penguin: { x: 100, y: 200 },
    stones: [{ x: 100, y: 300, size: 40 }, { x: 100, y: 350, size: 40 }, { x: 250, y: 50, size: 40 }],
    target: { x: 100, y: 250, width: 50, height: 150 },
    obstacles: [
      { type: 'snow', x: 250, y: 100, size: 50 },
      { type: 'wall', x: 0, y: 150, size: 50 },
      { type: 'hole', x: 100, y: 50, size: 50 },
      { type: 'snow', x: 100, y: 150, size: 50 }
    ]
  },
  9: {
    id: 9,
    baseName: '冰墙回廊',
    difficulty: 'medium',
    optimal: 18,
    par: 22,
    penguin: { x: 300, y: 150 },
    stones: [{ x: 50, y: 350, size: 40 }, { x: 100, y: 350, size: 40 }, { x: 250, y: 50, size: 40 }],
    target: { x: 50, y: 350, width: 150, height: 50 },
    obstacles: [
      { type: 'wall', x: 0, y: 200, size: 50 },
      { type: 'wall', x: 200, y: 100, size: 50 },
      { type: 'hole', x: 250, y: 150, size: 50 },
      { type: 'snow', x: 150, y: 250, size: 50 }
    ]
  },
  10: {
    id: 10,
    baseName: '冰墙回廊',
    difficulty: 'medium',
    optimal: 18,
    par: 22,
    penguin: { x: 200, y: 350 },
    stones: [{ x: 50, y: 200, size: 40 }, { x: 250, y: 350, size: 40 }, { x: 150, y: 350, size: 40 }],
    target: { x: 50, y: 200, width: 150, height: 50 },
    obstacles: [
      { type: 'snow', x: 300, y: 100, size: 50 },
      { type: 'hole', x: 200, y: 150, size: 50 },
      { type: 'hole', x: 250, y: 150, size: 50 },
      { type: 'hole', x: 50, y: 100, size: 50 }
    ]
  },
  11: {
    id: 11,
    baseName: '冰墙回廊',
    difficulty: 'medium',
    optimal: 18,
    par: 22,
    penguin: { x: 250, y: 50 },
    stones: [{ x: 50, y: 350, size: 40 }, { x: 50, y: 250, size: 40 }, { x: 250, y: 100, size: 40 }],
    target: { x: 50, y: 250, width: 150, height: 50 },
    obstacles: [
      { type: 'snow', x: 0, y: 200, size: 50 },
      { type: 'snow', x: 100, y: 50, size: 50 },
      { type: 'wall', x: 150, y: 100, size: 50 }
    ]
  },
  12: {
    id: 12,
    baseName: '冰墙回廊',
    difficulty: 'medium',
    optimal: 18,
    par: 22,
    penguin: { x: 0, y: 400 },
    stones: [{ x: 250, y: 350, size: 40 }, { x: 250, y: 400, size: 40 }, { x: 250, y: 50, size: 40 }],
    target: { x: 250, y: 300, width: 50, height: 150 },
    obstacles: [
      { type: 'snow', x: 300, y: 250, size: 50 },
      { type: 'hole', x: 150, y: 50, size: 50 },
      { type: 'snow', x: 0, y: 250, size: 50 },
      { type: 'wall', x: 150, y: 200, size: 50 }
    ]
  },
  13: {
    id: 13,
    baseName: '冰墙回廊',
    difficulty: 'medium',
    optimal: 18,
    par: 22,
    penguin: { x: 100, y: 0 },
    stones: [{ x: 150, y: 300, size: 40 }, { x: 250, y: 50, size: 40 }, { x: 200, y: 50, size: 40 }],
    target: { x: 150, y: 300, width: 150, height: 50 },
    obstacles: [
      { type: 'snow', x: 300, y: 50, size: 50 },
      { type: 'wall', x: 50, y: 200, size: 50 },
      { type: 'wall', x: 150, y: 200, size: 50 },
      { type: 'wall', x: 150, y: 50, size: 50 }
    ]
  },
  14: {
    id: 14,
    baseName: '冰墙回廊',
    difficulty: 'medium',
    optimal: 19,
    par: 23,
    penguin: { x: 0, y: 200 },
    stones: [{ x: 50, y: 350, size: 40 }, { x: 150, y: 350, size: 40 }, { x: 250, y: 250, size: 40 }],
    target: { x: 100, y: 300, width: 150, height: 50 },
    obstacles: [
      { type: 'wall', x: 0, y: 50, size: 50 },
      { type: 'hole', x: 250, y: 150, size: 50 },
      { type: 'wall', x: 100, y: 50, size: 50 }
    ]
  },
  15: {
    id: 15,
    baseName: '冰墙回廊',
    difficulty: 'medium',
    optimal: 19,
    par: 23,
    penguin: { x: 150, y: 350 },
    stones: [{ x: 50, y: 200, size: 40 }, { x: 250, y: 350, size: 40 }, { x: 150, y: 50, size: 40 }],
    target: { x: 50, y: 200, width: 150, height: 50 },
    obstacles: [
      { type: 'wall', x: 150, y: 100, size: 50 },
      { type: 'hole', x: 250, y: 150, size: 50 },
      { type: 'wall', x: 250, y: 50, size: 50 },
      { type: 'snow', x: 300, y: 100, size: 50 }
    ]
  },
  16: {
    id: 16,
    baseName: '冰墙回廊',
    difficulty: 'medium',
    optimal: 19,
    par: 23,
    penguin: { x: 250, y: 50 },
    stones: [{ x: 250, y: 350, size: 40 }, { x: 50, y: 350, size: 40 }, { x: 150, y: 50, size: 40 }],
    target: { x: 150, y: 350, width: 150, height: 50 },
    obstacles: [
      { type: 'wall', x: 50, y: 300, size: 50 },
      { type: 'hole', x: 200, y: 150, size: 50 },
      { type: 'wall', x: 300, y: 250, size: 50 },
      { type: 'hole', x: 250, y: 200, size: 50 }
    ]
  },
  17: {
    id: 17,
    baseName: '冰墙回廊',
    difficulty: 'medium',
    optimal: 19,
    par: 23,
    penguin: { x: 0, y: 400 },
    stones: [{ x: 200, y: 350, size: 40 }, { x: 50, y: 50, size: 40 }, { x: 50, y: 350, size: 40 }],
    target: { x: 100, y: 350, width: 150, height: 50 },
    obstacles: [
      { type: 'snow', x: 300, y: 100, size: 50 },
      { type: 'wall', x: 300, y: 300, size: 50 },
      { type: 'hole', x: 300, y: 250, size: 50 },
      { type: 'snow', x: 250, y: 50, size: 50 }
    ]
  },
  18: {
    id: 18,
    baseName: '冰墙回廊',
    difficulty: 'medium',
    optimal: 20,
    par: 24,
    penguin: { x: 100, y: 150 },
    stones: [{ x: 50, y: 200, size: 40 }, { x: 250, y: 350, size: 40 }, { x: 250, y: 200, size: 40 }],
    target: { x: 50, y: 200, width: 150, height: 50 },
    obstacles: [
      { type: 'wall', x: 300, y: 50, size: 50 },
      { type: 'hole', x: 250, y: 100, size: 50 },
      { type: 'wall', x: 50, y: 50, size: 50 }
    ]
  },
  19: {
    id: 19,
    baseName: '冰墙回廊',
    difficulty: 'medium',
    optimal: 20,
    par: 24,
    penguin: { x: 0, y: 100 },
    stones: [{ x: 150, y: 250, size: 40 }, { x: 250, y: 350, size: 40 }, { x: 250, y: 50, size: 40 }],
    target: { x: 150, y: 250, width: 150, height: 50 },
    obstacles: [
      { type: 'wall', x: 200, y: 100, size: 50 },
      { type: 'wall', x: 200, y: 150, size: 50 },
      { type: 'wall', x: 50, y: 200, size: 50 }
    ]
  },
  20: {
    id: 20,
    baseName: '冰墙回廊',
    difficulty: 'medium',
    optimal: 21,
    par: 26,
    penguin: { x: 200, y: 250 },
    stones: [{ x: 50, y: 350, size: 40 }, { x: 100, y: 350, size: 40 }, { x: 250, y: 350, size: 40 }],
    target: { x: 100, y: 300, width: 150, height: 50 },
    obstacles: [
      { type: 'snow', x: 0, y: 100, size: 50 },
      { type: 'snow', x: 200, y: 50, size: 50 },
      { type: 'wall', x: 300, y: 150, size: 50 },
      { type: 'hole', x: 50, y: 50, size: 50 }
    ]
  },
  21: {
    id: 21,
    baseName: '冰墙回廊',
    difficulty: 'medium',
    optimal: 21,
    par: 26,
    penguin: { x: 250, y: 250 },
    stones: [{ x: 150, y: 400, size: 40 }, { x: 250, y: 350, size: 40 }, { x: 250, y: 50, size: 40 }],
    target: { x: 150, y: 300, width: 50, height: 150 },
    obstacles: [
      { type: 'snow', x: 150, y: 200, size: 50 },
      { type: 'snow', x: 100, y: 200, size: 50 },
      { type: 'snow', x: 250, y: 250, size: 50 },
      { type: 'wall', x: 150, y: 150, size: 50 }
    ]
  },
  22: {
    id: 22,
    baseName: '冰墙回廊',
    difficulty: 'medium',
    optimal: 21,
    par: 26,
    penguin: { x: 0, y: 100 },
    stones: [{ x: 250, y: 200, size: 40 }, { x: 50, y: 350, size: 40 }, { x: 50, y: 300, size: 40 }],
    target: { x: 250, y: 200, width: 50, height: 150 },
    obstacles: [
      { type: 'hole', x: 300, y: 150, size: 50 },
      { type: 'snow', x: 50, y: 50, size: 50 },
      { type: 'hole', x: 250, y: 50, size: 50 },
      { type: 'wall', x: 100, y: 150, size: 50 }
    ]
  },
  23: {
    id: 23,
    baseName: '冰墙回廊',
    difficulty: 'medium',
    optimal: 21,
    par: 26,
    penguin: { x: 250, y: 0 },
    stones: [{ x: 100, y: 250, size: 40 }, { x: 200, y: 50, size: 40 }, { x: 250, y: 50, size: 40 }],
    target: { x: 100, y: 250, width: 150, height: 50 },
    obstacles: [
      { type: 'hole', x: 150, y: 100, size: 50 },
      { type: 'wall', x: 300, y: 50, size: 50 },
      { type: 'wall', x: 100, y: 50, size: 50 },
      { type: 'wall', x: 300, y: 200, size: 50 }
    ]
  },
  24: {
    id: 24,
    baseName: '冰墙回廊',
    difficulty: 'medium',
    optimal: 21,
    par: 26,
    penguin: { x: 100, y: 150 },
    stones: [{ x: 50, y: 350, size: 40 }, { x: 250, y: 350, size: 40 }, { x: 150, y: 350, size: 40 }],
    target: { x: 50, y: 300, width: 150, height: 50 },
    obstacles: [
      { type: 'wall', x: 150, y: 50, size: 50 },
      { type: 'wall', x: 100, y: 200, size: 50 },
      { type: 'wall', x: 50, y: 150, size: 50 },
      { type: 'wall', x: 200, y: 100, size: 50 }
    ]
  },
  25: {
    id: 25,
    baseName: '冰墙回廊',
    difficulty: 'medium',
    optimal: 22,
    par: 27,
    penguin: { x: 100, y: 100 },
    stones: [{ x: 50, y: 350, size: 40 }, { x: 150, y: 50, size: 40 }, { x: 50, y: 50, size: 40 }],
    target: { x: 50, y: 250, width: 50, height: 150 },
    obstacles: [
      { type: 'wall', x: 250, y: 50, size: 50 },
      { type: 'snow', x: 150, y: 50, size: 50 },
      { type: 'snow', x: 50, y: 50, size: 50 }
    ]
  },
  26: {
    id: 26,
    baseName: '裂隙迷阵',
    difficulty: 'hard',
    optimal: 22,
    par: 27,
    penguin: { x: 50, y: 400 },
    stones: [{ x: 50, y: 200, size: 40 }, { x: 50, y: 350, size: 40 }, { x: 250, y: 350, size: 40 }],
    target: { x: 50, y: 250, width: 150, height: 50 },
    obstacles: [
      { type: 'hole', x: 50, y: 50, size: 50 },
      { type: 'wall', x: 50, y: 100, size: 50 },
      { type: 'snow', x: 0, y: 100, size: 50 },
      { type: 'hole', x: 200, y: 100, size: 50 }
    ]
  },
  27: {
    id: 27,
    baseName: '裂隙迷阵',
    difficulty: 'hard',
    optimal: 22,
    par: 27,
    penguin: { x: 150, y: 100 },
    stones: [{ x: 50, y: 300, size: 40 }, { x: 250, y: 50, size: 40 }, { x: 250, y: 350, size: 40 }],
    target: { x: 50, y: 300, width: 150, height: 50 },
    obstacles: [
      { type: 'hole', x: 50, y: 150, size: 50 },
      { type: 'wall', x: 300, y: 100, size: 50 },
      { type: 'wall', x: 0, y: 100, size: 50 },
      { type: 'wall', x: 100, y: 100, size: 50 }
    ]
  },
  28: {
    id: 28,
    baseName: '裂隙迷阵',
    difficulty: 'hard',
    optimal: 22,
    par: 27,
    penguin: { x: 0, y: 250 },
    stones: [{ x: 250, y: 350, size: 40 }, { x: 50, y: 350, size: 40 }, { x: 250, y: 250, size: 40 }],
    target: { x: 150, y: 200, width: 150, height: 50 },
    obstacles: [
      { type: 'snow', x: 300, y: 50, size: 50 },
      { type: 'hole', x: 100, y: 100, size: 50 },
      { type: 'wall', x: 50, y: 100, size: 50 }
    ]
  },
  29: {
    id: 29,
    baseName: '裂隙迷阵',
    difficulty: 'hard',
    optimal: 22,
    par: 27,
    penguin: { x: 200, y: 150 },
    stones: [{ x: 50, y: 350, size: 40 }, { x: 250, y: 350, size: 40 }, { x: 250, y: 50, size: 40 }],
    target: { x: 50, y: 350, width: 150, height: 50 },
    obstacles: [
      { type: 'wall', x: 200, y: 200, size: 50 },
      { type: 'wall', x: 50, y: 250, size: 50 },
      { type: 'wall', x: 50, y: 200, size: 50 }
    ]
  },
  30: {
    id: 30,
    baseName: '裂隙迷阵',
    difficulty: 'hard',
    optimal: 22,
    par: 27,
    penguin: { x: 0, y: 350 },
    stones: [{ x: 50, y: 200, size: 40 }, { x: 250, y: 350, size: 40 }, { x: 250, y: 200, size: 40 }],
    target: { x: 50, y: 200, width: 150, height: 50 },
    obstacles: [
      { type: 'hole', x: 100, y: 100, size: 50 },
      { type: 'wall', x: 200, y: 50, size: 50 },
      { type: 'wall', x: 0, y: 50, size: 50 },
      { type: 'snow', x: 250, y: 50, size: 50 }
    ]
  },
  31: {
    id: 31,
    baseName: '裂隙迷阵',
    difficulty: 'hard',
    optimal: 23,
    par: 28,
    penguin: { x: 300, y: 350 },
    stones: [{ x: 250, y: 50, size: 40 }, { x: 250, y: 350, size: 40 }, { x: 150, y: 350, size: 40 }],
    target: { x: 150, y: 300, width: 150, height: 50 },
    obstacles: [
      { type: 'wall', x: 0, y: 100, size: 50 },
      { type: 'hole', x: 150, y: 200, size: 50 },
      { type: 'snow', x: 150, y: 150, size: 50 }
    ]
  },
  32: {
    id: 32,
    baseName: '裂隙迷阵',
    difficulty: 'hard',
    optimal: 23,
    par: 28,
    penguin: { x: 150, y: 300 },
    stones: [{ x: 50, y: 350, size: 40 }, { x: 50, y: 200, size: 40 }, { x: 250, y: 350, size: 40 }],
    target: { x: 150, y: 200, width: 50, height: 150 },
    obstacles: [
      { type: 'wall', x: 250, y: 150, size: 50 },
      { type: 'wall', x: 150, y: 100, size: 50 },
      { type: 'hole', x: 50, y: 150, size: 50 },
      { type: 'wall', x: 0, y: 100, size: 50 }
    ]
  },
  33: {
    id: 33,
    baseName: '裂隙迷阵',
    difficulty: 'hard',
    optimal: 23,
    par: 28,
    penguin: { x: 100, y: 0 },
    stones: [{ x: 200, y: 350, size: 40 }, { x: 50, y: 350, size: 40 }, { x: 250, y: 50, size: 40 }],
    target: { x: 150, y: 300, width: 150, height: 50 },
    obstacles: [
      { type: 'hole', x: 300, y: 100, size: 50 },
      { type: 'snow', x: 100, y: 250, size: 50 },
      { type: 'hole', x: 200, y: 50, size: 50 },
      { type: 'snow', x: 100, y: 150, size: 50 }
    ]
  },
  34: {
    id: 34,
    baseName: '裂隙迷阵',
    difficulty: 'hard',
    optimal: 23,
    par: 28,
    penguin: { x: 150, y: 350 },
    stones: [{ x: 50, y: 200, size: 40 }, { x: 50, y: 350, size: 40 }, { x: 250, y: 350, size: 40 }],
    target: { x: 50, y: 200, width: 150, height: 50 },
    obstacles: [
      { type: 'wall', x: 150, y: 100, size: 50 },
      { type: 'wall', x: 250, y: 100, size: 50 },
      { type: 'wall', x: 250, y: 150, size: 50 },
      { type: 'hole', x: 300, y: 50, size: 50 }
    ]
  },
  35: {
    id: 35,
    baseName: '裂隙迷阵',
    difficulty: 'hard',
    optimal: 23,
    par: 28,
    penguin: { x: 150, y: 250 },
    stones: [{ x: 250, y: 350, size: 40 }, { x: 250, y: 250, size: 40 }, { x: 50, y: 350, size: 40 }],
    target: { x: 50, y: 250, width: 150, height: 50 },
    obstacles: [
      { type: 'wall', x: 250, y: 150, size: 50 },
      { type: 'wall', x: 0, y: 200, size: 50 },
      { type: 'hole', x: 150, y: 150, size: 50 }
    ]
  },
  36: {
    id: 36,
    baseName: '裂隙迷阵',
    difficulty: 'hard',
    optimal: 23,
    par: 28,
    penguin: { x: 300, y: 400 },
    stones: [{ x: 100, y: 350, size: 40 }, { x: 250, y: 50, size: 40 }, { x: 250, y: 300, size: 40 }],
    target: { x: 100, y: 350, width: 150, height: 50 },
    obstacles: [
      { type: 'hole', x: 150, y: 200, size: 50 },
      { type: 'snow', x: 250, y: 100, size: 50 },
      { type: 'hole', x: 100, y: 250, size: 50 }
    ]
  },
  37: {
    id: 37,
    baseName: '裂隙迷阵',
    difficulty: 'hard',
    optimal: 24,
    par: 29,
    penguin: { x: 0, y: 250 },
    stones: [{ x: 150, y: 300, size: 40 }, { x: 50, y: 50, size: 40 }, { x: 50, y: 350, size: 40 }],
    target: { x: 150, y: 200, width: 50, height: 150 },
    obstacles: [
      { type: 'hole', x: 200, y: 150, size: 50 },
      { type: 'wall', x: 150, y: 100, size: 50 },
      { type: 'wall', x: 100, y: 100, size: 50 }
    ]
  },
  38: {
    id: 38,
    baseName: '裂隙迷阵',
    difficulty: 'hard',
    optimal: 24,
    par: 29,
    penguin: { x: 150, y: 0 },
    stones: [{ x: 50, y: 50, size: 40 }, { x: 50, y: 150, size: 40 }, { x: 50, y: 300, size: 40 }],
    target: { x: 100, y: 200, width: 50, height: 150 },
    obstacles: [
      { type: 'wall', x: 300, y: 50, size: 50 },
      { type: 'wall', x: 0, y: 50, size: 50 },
      { type: 'wall', x: 150, y: 150, size: 50 },
      { type: 'snow', x: 200, y: 150, size: 50 }
    ]
  },
  39: {
    id: 39,
    baseName: '裂隙迷阵',
    difficulty: 'hard',
    optimal: 24,
    par: 29,
    penguin: { x: 250, y: 200 },
    stones: [{ x: 100, y: 300, size: 40 }, { x: 100, y: 50, size: 40 }, { x: 250, y: 350, size: 40 }],
    target: { x: 100, y: 200, width: 50, height: 150 },
    obstacles: [
      { type: 'wall', x: 250, y: 100, size: 50 },
      { type: 'snow', x: 250, y: 50, size: 50 },
      { type: 'wall', x: 150, y: 100, size: 50 },
      { type: 'snow', x: 250, y: 150, size: 50 }
    ]
  },
  40: {
    id: 40,
    baseName: '裂隙迷阵',
    difficulty: 'hard',
    optimal: 24,
    par: 29,
    penguin: { x: 50, y: 0 },
    stones: [{ x: 100, y: 400, size: 40 }, { x: 250, y: 150, size: 40 }, { x: 150, y: 50, size: 40 }],
    target: { x: 100, y: 300, width: 50, height: 150 },
    obstacles: [
      { type: 'wall', x: 100, y: 50, size: 50 },
      { type: 'hole', x: 300, y: 100, size: 50 },
      { type: 'snow', x: 100, y: 150, size: 50 },
      { type: 'wall', x: 250, y: 50, size: 50 }
    ]
  },
  41: {
    id: 41,
    baseName: '裂隙迷阵',
    difficulty: 'hard',
    optimal: 24,
    par: 29,
    penguin: { x: 100, y: 50 },
    stones: [{ x: 50, y: 350, size: 40 }, { x: 250, y: 350, size: 40 }, { x: 250, y: 250, size: 40 }],
    target: { x: 150, y: 250, width: 50, height: 150 },
    obstacles: [
      { type: 'snow', x: 300, y: 150, size: 50 },
      { type: 'wall', x: 250, y: 100, size: 50 },
      { type: 'wall', x: 250, y: 150, size: 50 }
    ]
  },
  42: {
    id: 42,
    baseName: '裂隙迷阵',
    difficulty: 'hard',
    optimal: 24,
    par: 29,
    penguin: { x: 300, y: 200 },
    stones: [{ x: 250, y: 350, size: 40 }, { x: 250, y: 250, size: 40 }, { x: 150, y: 50, size: 40 }],
    target: { x: 150, y: 200, width: 150, height: 50 },
    obstacles: [
      { type: 'wall', x: 300, y: 100, size: 50 },
      { type: 'snow', x: 50, y: 150, size: 50 },
      { type: 'hole', x: 100, y: 50, size: 50 }
    ]
  },
  43: {
    id: 43,
    baseName: '裂隙迷阵',
    difficulty: 'hard',
    optimal: 25,
    par: 30,
    penguin: { x: 0, y: 50 },
    stones: [{ x: 50, y: 350, size: 40 }, { x: 150, y: 200, size: 40 }, { x: 250, y: 50, size: 40 }],
    target: { x: 50, y: 350, width: 150, height: 50 },
    obstacles: [
      { type: 'hole', x: 150, y: 100, size: 50 },
      { type: 'hole', x: 50, y: 100, size: 50 },
      { type: 'wall', x: 0, y: 100, size: 50 },
      { type: 'hole', x: 200, y: 100, size: 50 }
    ]
  },
  44: {
    id: 44,
    baseName: '裂隙迷阵',
    difficulty: 'hard',
    optimal: 25,
    par: 30,
    penguin: { x: 200, y: 300 },
    stones: [{ x: 100, y: 350, size: 40 }, { x: 250, y: 50, size: 40 }, { x: 250, y: 250, size: 40 }],
    target: { x: 100, y: 350, width: 150, height: 50 },
    obstacles: [
      { type: 'wall', x: 150, y: 150, size: 50 },
      { type: 'wall', x: 300, y: 200, size: 50 },
      { type: 'snow', x: 150, y: 200, size: 50 },
      { type: 'wall', x: 300, y: 150, size: 50 }
    ]
  },
  45: {
    id: 45,
    baseName: '极寒试炼',
    difficulty: 'expert',
    optimal: 25,
    par: 30,
    penguin: { x: 0, y: 50 },
    stones: [{ x: 250, y: 350, size: 40 }, { x: 250, y: 300, size: 40 }, { x: 50, y: 50, size: 40 }],
    target: { x: 100, y: 300, width: 150, height: 50 },
    obstacles: [
      { type: 'wall', x: 200, y: 200, size: 50 },
      { type: 'hole', x: 250, y: 250, size: 50 },
      { type: 'snow', x: 300, y: 250, size: 50 },
      { type: 'hole', x: 150, y: 200, size: 50 }
    ]
  },
  46: {
    id: 46,
    baseName: '极寒试炼',
    difficulty: 'expert',
    optimal: 25,
    par: 30,
    penguin: { x: 200, y: 300 },
    stones: [{ x: 50, y: 300, size: 40 }, { x: 250, y: 50, size: 40 }, { x: 250, y: 200, size: 40 }],
    target: { x: 50, y: 200, width: 50, height: 150 },
    obstacles: [
      { type: 'hole', x: 200, y: 150, size: 50 },
      { type: 'wall', x: 300, y: 50, size: 50 },
      { type: 'snow', x: 0, y: 150, size: 50 }
    ]
  },
  47: {
    id: 47,
    baseName: '极寒试炼',
    difficulty: 'expert',
    optimal: 25,
    par: 30,
    penguin: { x: 250, y: 100 },
    stones: [{ x: 150, y: 350, size: 40 }, { x: 250, y: 350, size: 40 }, { x: 50, y: 350, size: 40 }],
    target: { x: 100, y: 250, width: 150, height: 50 },
    obstacles: [
      { type: 'hole', x: 150, y: 150, size: 50 },
      { type: 'hole', x: 50, y: 150, size: 50 },
      { type: 'wall', x: 300, y: 100, size: 50 },
      { type: 'wall', x: 300, y: 50, size: 50 }
    ]
  },
  48: {
    id: 48,
    baseName: '极寒试炼',
    difficulty: 'expert',
    optimal: 26,
    par: 32,
    penguin: { x: 300, y: 150 },
    stones: [{ x: 50, y: 350, size: 40 }, { x: 50, y: 50, size: 40 }, { x: 250, y: 250, size: 40 }],
    target: { x: 150, y: 250, width: 50, height: 150 },
    obstacles: [
      { type: 'hole', x: 100, y: 150, size: 50 },
      { type: 'wall', x: 150, y: 50, size: 50 },
      { type: 'wall', x: 150, y: 150, size: 50 }
    ]
  },
  49: {
    id: 49,
    baseName: '极寒试炼',
    difficulty: 'expert',
    optimal: 26,
    par: 32,
    penguin: { x: 50, y: 0 },
    stones: [{ x: 250, y: 350, size: 40 }, { x: 250, y: 250, size: 40 }, { x: 50, y: 350, size: 40 }],
    target: { x: 100, y: 300, width: 150, height: 50 },
    obstacles: [
      { type: 'wall', x: 250, y: 150, size: 50 },
      { type: 'snow', x: 300, y: 150, size: 50 },
      { type: 'hole', x: 0, y: 200, size: 50 }
    ]
  },
  50: {
    id: 50,
    baseName: '极寒试炼',
    difficulty: 'expert',
    optimal: 27,
    par: 33,
    penguin: { x: 150, y: 300 },
    stones: [{ x: 250, y: 350, size: 40 }, { x: 50, y: 50, size: 40 }, { x: 50, y: 350, size: 40 }],
    target: { x: 150, y: 350, width: 150, height: 50 },
    obstacles: [
      { type: 'snow', x: 150, y: 150, size: 50 },
      { type: 'snow', x: 200, y: 150, size: 50 },
      { type: 'snow', x: 50, y: 300, size: 50 }
    ]
  },
  51: {
    id: 51,
    baseName: '极寒试炼',
    difficulty: 'expert',
    optimal: 27,
    par: 33,
    penguin: { x: 0, y: 150 },
    stones: [{ x: 250, y: 300, size: 40 }, { x: 50, y: 50, size: 40 }, { x: 50, y: 400, size: 40 }],
    target: { x: 250, y: 300, width: 50, height: 150 },
    obstacles: [
      { type: 'hole', x: 0, y: 100, size: 50 },
      { type: 'snow', x: 300, y: 250, size: 50 },
      { type: 'hole', x: 250, y: 150, size: 50 },
      { type: 'snow', x: 200, y: 50, size: 50 }
    ]
  },
  52: {
    id: 52,
    baseName: '极寒试炼',
    difficulty: 'expert',
    optimal: 27,
    par: 33,
    penguin: { x: 150, y: 200 },
    stones: [{ x: 250, y: 350, size: 40 }, { x: 50, y: 350, size: 40 }, { x: 250, y: 50, size: 40 }],
    target: { x: 150, y: 300, width: 150, height: 50 },
    obstacles: [
      { type: 'hole', x: 0, y: 100, size: 50 },
      { type: 'hole', x: 0, y: 250, size: 50 },
      { type: 'wall', x: 100, y: 100, size: 50 }
    ]
  },
  53: {
    id: 53,
    baseName: '极寒试炼',
    difficulty: 'expert',
    optimal: 27,
    par: 33,
    penguin: { x: 50, y: 150 },
    stones: [{ x: 150, y: 50, size: 40 }, { x: 250, y: 200, size: 40 }, { x: 50, y: 350, size: 40 }],
    target: { x: 50, y: 250, width: 150, height: 50 },
    obstacles: [
      { type: 'wall', x: 200, y: 200, size: 50 },
      { type: 'wall', x: 250, y: 100, size: 50 },
      { type: 'hole', x: 250, y: 50, size: 50 },
      { type: 'snow', x: 100, y: 50, size: 50 }
    ]
  },
  54: {
    id: 54,
    baseName: '极寒试炼',
    difficulty: 'expert',
    optimal: 28,
    par: 34,
    penguin: { x: 100, y: 100 },
    stones: [{ x: 50, y: 350, size: 40 }, { x: 250, y: 50, size: 40 }, { x: 250, y: 400, size: 40 }],
    target: { x: 200, y: 300, width: 50, height: 150 },
    obstacles: [
      { type: 'wall', x: 50, y: 250, size: 50 },
      { type: 'snow', x: 150, y: 50, size: 50 },
      { type: 'hole', x: 300, y: 150, size: 50 }
    ]
  },
  55: {
    id: 55,
    baseName: '极寒试炼',
    difficulty: 'expert',
    optimal: 28,
    par: 34,
    penguin: { x: 0, y: 300 },
    stones: [{ x: 50, y: 400, size: 40 }, { x: 250, y: 300, size: 40 }, { x: 150, y: 50, size: 40 }],
    target: { x: 50, y: 300, width: 50, height: 150 },
    obstacles: [
      { type: 'snow', x: 300, y: 150, size: 50 },
      { type: 'wall', x: 200, y: 250, size: 50 },
      { type: 'wall', x: 250, y: 50, size: 50 }
    ]
  },
  56: {
    id: 56,
    baseName: '极寒试炼',
    difficulty: 'expert',
    optimal: 29,
    par: 35,
    penguin: { x: 150, y: 100 },
    stones: [{ x: 250, y: 400, size: 40 }, { x: 250, y: 350, size: 40 }, { x: 250, y: 300, size: 40 }],
    target: { x: 50, y: 300, width: 50, height: 150 },
    obstacles: [
      { type: 'hole', x: 250, y: 250, size: 50 },
      { type: 'hole', x: 150, y: 250, size: 50 },
      { type: 'hole', x: 250, y: 50, size: 50 },
      { type: 'snow', x: 100, y: 50, size: 50 }
    ]
  },
  57: {
    id: 57,
    baseName: '极寒试炼',
    difficulty: 'expert',
    optimal: 30,
    par: 36,
    penguin: { x: 0, y: 150 },
    stones: [{ x: 100, y: 400, size: 40 }, { x: 50, y: 50, size: 40 }, { x: 250, y: 50, size: 40 }],
    target: { x: 100, y: 300, width: 50, height: 150 },
    obstacles: [
      { type: 'snow', x: 50, y: 100, size: 50 },
      { type: 'hole', x: 250, y: 250, size: 50 },
      { type: 'snow', x: 50, y: 250, size: 50 }
    ]
  },
  58: {
    id: 58,
    baseName: '极寒试炼',
    difficulty: 'expert',
    optimal: 31,
    par: 38,
    penguin: { x: 0, y: 300 },
    stones: [{ x: 150, y: 400, size: 40 }, { x: 250, y: 50, size: 40 }, { x: 150, y: 50, size: 40 }],
    target: { x: 150, y: 300, width: 50, height: 150 },
    obstacles: [
      { type: 'hole', x: 200, y: 100, size: 50 },
      { type: 'hole', x: 100, y: 50, size: 50 },
      { type: 'hole', x: 200, y: 150, size: 50 },
      { type: 'snow', x: 200, y: 50, size: 50 }
    ]
  },
  59: {
    id: 59,
    baseName: '极寒试炼',
    difficulty: 'expert',
    optimal: 33,
    par: 40,
    penguin: { x: 100, y: 100 },
    stones: [{ x: 250, y: 50, size: 40 }, { x: 50, y: 400, size: 40 }, { x: 50, y: 250, size: 40 }],
    target: { x: 200, y: 300, width: 50, height: 150 },
    obstacles: [
      { type: 'wall', x: 100, y: 250, size: 50 },
      { type: 'hole', x: 50, y: 150, size: 50 },
      { type: 'hole', x: 200, y: 50, size: 50 }
    ]
  },
  60: {
    id: 60,
    baseName: '极寒试炼',
    difficulty: 'expert',
    optimal: 39,
    par: 47,
    penguin: { x: 300, y: 250 },
    stones: [{ x: 50, y: 400, size: 40 }, { x: 250, y: 50, size: 40 }, { x: 150, y: 50, size: 40 }],
    target: { x: 50, y: 300, width: 50, height: 150 },
    obstacles: [
      { type: 'snow', x: 200, y: 150, size: 50 },
      { type: 'wall', x: 300, y: 100, size: 50 },
      { type: 'wall', x: 250, y: 100, size: 50 }
    ]
  },
}
