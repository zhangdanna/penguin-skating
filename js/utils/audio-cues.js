/**
 * 音效表（Cue Sheet）—— 音频系统的唯一数据源
 *
 * 改音量/并发/冷却/换素材只动这里，不要去 audio-manager.js 里写魔法数字。
 * 素材由 tools/gen-sfx.py 生成，规格与设计意图见 docs/AUDIO.md。
 *
 * 字段说明：
 *   file      素材路径（相对小游戏根目录）
 *   bus       总线：'ui' 点击类 / 'sfx' 玩法类。UI 总线固定比玩法轻一档，
 *             避免"点按钮"盖过"推冰块"这种关键反馈
 *   gain      基础增益（0~1）。已在素材侧做过响度归一，这里只做相对关系
 *   voices    并发声部上限。1 = 独占（长音效，后一声打断前一声）；
 *             2~3 = 允许叠住（滑行/推动这种会连打的动作）
 *   cooldown  同一音效的最小间隔（ms）。没有它，快速连点就是机关枪
 *   rate      播放速率抖动区间 [min, max]，同时改变音高，消除机械感。
 *             需要基础库支持 InnerAudioContext.playbackRate（2.11.0+），
 *             不支持的环境自动跳过，不影响播放
 *   duck      >0 时把 BGM 压低到该倍数，播放结束后回升（混音 ducking）
 *   durMs     素材实际时长（ms），用于声部占用计时
 */

export const SfxCues = {
  // ---- UI 总线：短、亮、轻 ----
  tap: {
    file: 'audio/ui_tap.wav',
    bus: 'ui',
    gain: 0.70,
    voices: 2,
    cooldown: 45,
    durMs: 100
  },
  back: {
    file: 'audio/ui_back.wav',
    bus: 'ui',
    gain: 0.75,
    voices: 1,
    cooldown: 90,
    durMs: 200
  },

  // ---- 玩法总线：反馈音，必须"准"且"不烦"（一局会听上百次） ----
  slide: {
    file: 'audio/slide.wav',
    bus: 'sfx',
    gain: 0.72,
    voices: 3,
    cooldown: 55,
    rate: [0.94, 1.07],
    durMs: 260
  },
  push: {
    file: 'audio/push.wav',
    bus: 'sfx',
    gain: 0.85,
    voices: 3,
    cooldown: 70,
    rate: [0.95, 1.05],
    durMs: 300
  },
  bump: {
    file: 'audio/collision.wav',
    bus: 'sfx',
    gain: 0.70,
    voices: 2,
    cooldown: 110,
    rate: [0.96, 1.04],
    durMs: 240
  },
  undo: {
    file: 'audio/undo.wav',
    bus: 'sfx',
    gain: 0.65,
    voices: 1,
    cooldown: 220,
    durMs: 340
  },

  // ---- 反馈/结算：长音效，独占 + 闪避 BGM ----
  star: {
    file: 'audio/star.wav',
    bus: 'sfx',
    gain: 0.62,
    voices: 2,
    cooldown: 60,
    durMs: 400
  },
  levelStart: {
    file: 'audio/level-start.wav',
    bus: 'sfx',
    gain: 0.55,
    voices: 1,
    cooldown: 700,
    durMs: 850
  },
  win: {
    file: 'audio/win.wav',
    bus: 'sfx',
    gain: 0.80,
    voices: 1,
    cooldown: 900,
    duck: 0.55,
    durMs: 1900
  },
  fail: {
    file: 'audio/fail.wav',
    bus: 'sfx',
    gain: 0.70,
    voices: 1,
    cooldown: 900,
    duck: 0.45,
    durMs: 1350
  },
  achievement: {
    file: 'audio/achievement.wav',
    bus: 'sfx',
    gain: 0.75,
    voices: 1,
    cooldown: 1200,
    duck: 0.45,
    durMs: 1300
  },
  revive: {
    file: 'audio/revive.wav',
    bus: 'sfx',
    gain: 0.70,
    voices: 1,
    cooldown: 800,
    duck: 0.35,
    durMs: 1050
  }
}

/**
 * 旧 cue 名 → 新 cue 名
 *
 * 老代码里 collision / button 这两个名字散落在多处，改名会牵动一堆调用点，
 * 所以在管理器入口做一次映射，内部只认新名字。
 */
export const CUE_ALIASES = {
  collision: 'bump',
  button: 'tap'
}

/**
 * BGM 配置
 *
 * stateVolume 是"同一个循环曲、不同场景给不同音量"的做法：
 * 进关卡压低到 0.7 让玩家专注思考，结算再压到 0.45 给音效让路。
 * 真正需要换曲时，在这里扩成 { menu: 'audio/bgm-menu.wav', ... } 并让
 * AudioManager 做双实例交叉淡入淡出（接口已按这个方向留好）。
 */
export const BgmConfig = {
  sources: ['audio/bgm.wav'],
  defaultVolume: 0.6,
  stateVolume: {
    menu: 1.0,
    game: 0.7,
    result: 0.45
  }
}
