/**
 * 外观系统（皮肤）
 *
 * 职责：
 *   - 商品目录（唯一数据源，改价只改 `SKIN_ITEMS`）
 *   - 拥有 / 穿戴（存档 `ownedSkins` / `equippedSkin`）
 *   - 给绘制层提供「当前该长什么样」的快照
 *
 * 三条硬约束（改了就会出问题，回归会拦）：
 *   1. **不能换冰块颜色** —— 蓝色是它唯一的识别特征，换了玩家会把冰块当雪堆
 *   2. **展台（目标区）必须保持暖色 R>G>B** —— 冷色展台会被读成地板，
 *      上一版目标区和冰块同色系，玩家直接把目标当成背景
 *   3. **不能换企鹅围巾的黄** —— 与橙色喙同色系、必须有描边，这是形象识别
 *
 * 所以「能换的」只有三样：企鹅配件（头顶/眼部/耳部）、展台托盘配色、水体渐变。
 * 不碰判定、不碰格子尺寸、不碰任何影响可读性的颜色。
 *
 * 绘制层怎么拿到当前穿戴：
 *   模块级快照 `current`，由 `setCurrent()` 在启动和换装时刷新。
 *   这样 `drawPenguin` / `drawOceanBase` / `renderPlate` 这些被调用几十次的
 *   函数不用各自加参数 —— 它们读 `getCurrentSkin()` 就行。
 *   想在某个场景画「不带配件」的企鹅（比如成就详情），显式传 `{ accessory: null }`。
 */

const KEY_OWNED = 'ownedSkins'
const KEY_EQUIPPED = 'equippedSkin'

/** 穿戴槽位：一个槽同时只能穿一件 */
export const SKIN_CATEGORIES = ['penguin', 'stage', 'bg']

/**
 * 商品目录
 *
 * `price` 是雪花钱价格；`limited` 的只能通过活动/签到获得，商城里显示「满签获得」，
 * 不可购买 —— 限定品一旦能直接买就不叫限定了。
 */
export const SKIN_ITEMS = [
  {
    id: 'hat_winter',
    category: 'penguin',
    name: '毛线帽',
    price: 60,
    desc: '冬天的第一件装备'
  },
  {
    id: 'glasses_round',
    category: 'penguin',
    name: '圆墨镜',
    price: 60,
    desc: '滑冰也要有型'
  },
  {
    id: 'headphones',
    category: 'penguin',
    name: '耳机',
    price: 90,
    desc: '自带 BGM 的企鹅'
  },
  {
    id: 'hat_santa',
    category: 'penguin',
    name: '圣诞帽',
    price: 0,
    limited: true,
    desc: '首次满签赠送 · 不售卖'
  },
  {
    id: 'tray_coral',
    category: 'stage',
    name: '珊瑚托盘',
    price: 90,
    desc: '更深的珊瑚色，展台更醒目'
  },
  {
    id: 'tray_shell',
    category: 'stage',
    name: '贝壳托盘',
    price: 120,
    desc: '暖白贝壳纹，冰块落上去更亮'
  },
  {
    id: 'bg_aurora',
    category: 'bg',
    name: '极光海域',
    price: 60,
    desc: '水色换成青绿'
  },
  {
    id: 'bg_deep',
    category: 'bg',
    name: '深海夜',
    price: 90,
    desc: '更深的海水，冰块更亮'
  }
]

/**
 * 展台配色
 *
 * **每一档都必须暖色（R > G > B，且 R-B 有足够差距）**，
 * 否则目标区会和冰块（#8ACBEA 冷蓝）糊在一起。
 *
 * 三档要有明显「升级感」（用户反馈原默认=珊瑚，买了没变化）：
 *   默认 = 淡奶油 + 琥珀金边
 *   珊瑚 = 浓珊瑚橙 + 珊瑚纹（加深、加纹理，一眼看得出换了）
 *   贝壳 = 珠光暖白 + 扇骨 + 珍珠高光
 */
export const TRAY_PALETTES = {
  tray_coral: {
    top: '#FFC9A4',
    bottom: '#F58B5A',
    edge: 'rgba(196, 70, 30, 0.96)',
    shadow: 'rgba(196, 70, 30, 0.22)',
    inner: 'rgba(255, 245, 235, 0.92)'
  },
  tray_shell: {
    top: '#FFEDD4',
    bottom: '#F2D3AE',
    edge: 'rgba(178, 128, 66, 0.94)',
    shadow: 'rgba(178, 128, 66, 0.18)',
    inner: 'rgba(255, 255, 255, 0.96)'
  }
}

/**
 * 水体渐变（多档色标）
 *
 * 沙底和海草不动 —— 换的只是水色，不然「糖果海洋馆」的底子就散了。
 *
 * `stops` 是可选的 4 档色标（offset 0~1）。有它时绘制层用 stops，没有时
 * 退回默认三档。极光用「青→紫→粉」的三色过渡做出光带感，深海用更暗的
 * 靛蓝到近黑 —— 只用三档的话两款背景太像，玩家看不出买了什么。
 */
export const BG_PALETTES = {
  bg_aurora: {
    top: '#E6FFF8', mid: '#7FE0CE', bottom: '#2E9E96',
    stops: [
      [0, '#DFFFF6'],
      [0.38, '#8CE3D6'],
      [0.7, '#8BB6E8'],
      [1, '#4E8FC4']
    ]
  },
  bg_deep: {
    top: '#BFE4FF', mid: '#5FA8E0', bottom: '#245A96',
    stops: [
      [0, '#9FD4F7'],
      [0.4, '#3E7FC4'],
      [0.75, '#1D4A8C'],
      [1, '#0E2358']
    ]
  }
}

/** 当前穿戴快照（绘制层读它） */
let current = { penguin: null, stage: null, bg: null }

/** 按 id 查商品 */
export function getSkinItem(id) {
  return SKIN_ITEMS.find(item => item.id === id) || null
}

/**
 * 给绘制层的当前快照
 * @returns {{penguin:string|null, stage:string|null, bg:string|null}}
 */
export function getCurrentSkin() {
  return current
}

/**
 * 当前该戴的配件 id（null = 不戴）
 * @returns {string|null}
 */
export function getEquippedAccessoryId() {
  return current.penguin
}

/**
 * 当前水体皮肤 id（null = 默认水色）
 * @returns {string|null}
 */
export function getCurrentBgId() {
  return current.bg
}

/**
 * 当前水体色标（null = 用 theme.js 里的默认渐变）
 * @returns {{top:string, mid:string, bottom:string}|null}
 */
export function getCurrentBgPalette() {
  return current.bg ? BG_PALETTES[current.bg] || null : null
}

/**
 * 当前穿着的展台 id（null = 默认展台，纹理层据此决定画不画扇骨）
 * @returns {string|null}
 */
export function getCurrentTrayId() {
  return current.stage
}

/**
 * 当前展台配色（null = 用 target.js 里的默认暖色）
 * @returns {Object|null}
 */
export function getCurrentTrayPalette() {
  return current.stage ? TRAY_PALETTES[current.stage] || null : null
}

export default class SkinManager {
  /**
   * @param {Object} [coinManager] - 购买时扣款；不传则只能查看 / 穿戴
   */
  constructor(coinManager = null) {
    this.coinManager = coinManager

    /** @type {string[]} */
    this.owned = []
    /** @type {{penguin:string|null, stage:string|null, bg:string|null}} */
    this.equipped = { penguin: null, stage: null, bg: null }

    this.load()
    this.syncCurrent()
  }

  /**
   * 商品列表（可按分类过滤）
   * @param {string} [category]
   * @returns {Array}
   */
  getItems(category) {
    if (!category) return SKIN_ITEMS.slice()
    return SKIN_ITEMS.filter(item => item.category === category)
  }

  /**
   * 是否拥有
   * @param {string} id
   * @returns {boolean}
   */
  owns(id) {
    return this.owned.indexOf(id) >= 0
  }

  /**
   * 是否正穿着
   * @param {string} id
   * @returns {boolean}
   */
  isEquipped(id) {
    const item = getSkinItem(id)
    if (!item) return false
    return this.equipped[item.category] === id
  }

  /**
   * 直接授予（签到满签礼、活动奖励用；不扣钱）
   * @param {string} id
   * @returns {boolean} 是否新获得（已拥有返回 false）
   */
  grant(id) {
    const item = getSkinItem(id)
    if (!item) return false
    if (this.owns(id)) return false

    this.owned.push(id)
    this.save()

    // 第一次拿到就自动穿上：不然玩家会以为「领了没反应」
    if (!this.equipped[item.category]) this.equip(id, { silent: true })

    return true
  }

  /**
   * 购买
   *
   * @param {string} id
   * @returns {{ok:boolean, reason?:string}}
   */
  buy(id) {
    const item = getSkinItem(id)
    if (!item) return { ok: false, reason: 'not-found' }
    if (item.limited) return { ok: false, reason: 'limited' }
    if (this.owns(id)) return { ok: false, reason: 'owned' }
    if (!this.coinManager) return { ok: false, reason: 'no-wallet' }
    if (this.coinManager.get() < item.price) return { ok: false, reason: 'poor' }

    if (!this.coinManager.spend(item.price)) return { ok: false, reason: 'poor' }

    this.owned.push(id)
    this.save()
    this.equip(id, { silent: true })

    return { ok: true }
  }

  /**
   * 穿戴（不拥有则忽略）
   * @param {string} id
   * @param {{silent?:boolean}} [options]
   * @returns {boolean}
   */
  equip(id, options = {}) {
    const item = getSkinItem(id)
    if (!item || !this.owns(id)) return false

    this.equipped[item.category] = id
    this.save()
    this.syncCurrent()
    if (!options.silent) console.log(`[Skin] 穿戴 ${item.name}`)
    return true
  }

  /**
   * 脱下某分类（回到默认外观）
   * @param {string} category
   * @returns {boolean}
   */
  unequip(category) {
    if (SKIN_CATEGORIES.indexOf(category) < 0) return false
    if (!this.equipped[category]) return false

    this.equipped[category] = null
    this.save()
    this.syncCurrent()
    return true
  }

  /**
   * 把穿戴状态同步给绘制层的模块级快照
   *
   * 每次 load / equip / buy 之后都要调 —— 漏了的话「买了但画面没变」。
   */
  syncCurrent() {
    current = {
      penguin: this.owns(this.equipped.penguin) ? this.equipped.penguin : null,
      stage: this.owns(this.equipped.stage) ? this.equipped.stage : null,
      bg: this.owns(this.equipped.bg) ? this.equipped.bg : null
    }
  }

  save() {
    try {
      wx.setStorageSync(KEY_OWNED, this.owned)
      wx.setStorageSync(KEY_EQUIPPED, this.equipped)
    } catch (e) {
      console.error('保存外观失败:', e)
    }
  }

  load() {
    try {
      const owned = wx.getStorageSync(KEY_OWNED)
      if (Array.isArray(owned)) {
        // 过滤掉已下架 / 改名的 id，避免「拥有 9 件但商城只显示 8 件」
        this.owned = owned.filter(id => !!getSkinItem(id))
      }

      const equipped = wx.getStorageSync(KEY_EQUIPPED)
      if (equipped && typeof equipped === 'object') {
        SKIN_CATEGORIES.forEach((category) => {
          const id = equipped[category]
          if (typeof id === 'string' && getSkinItem(id) && this.owns(id)) {
            this.equipped[category] = id
          }
        })
      }
    } catch (e) {
      console.error('加载外观失败:', e)
    }
  }

  /**
   * 调试用
   */
  reset() {
    this.owned = []
    this.equipped = { penguin: null, stage: null, bg: null }
    this.save()
    this.syncCurrent()
  }
}
