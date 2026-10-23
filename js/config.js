/**
 * 全局配置
 *
 * 广告位 ID 获取方式：
 *   微信公众平台 → 该小游戏 → 流量主 → 广告位管理 → 新建"激励视频"广告位
 *   新建后得到形如 `adunit-xxxxxxxxxxxxxxxx` 的 ID，粘贴到下面即可。
 *
 * 留空表示尚未开通流量主：
 *   AdManager 不会创建任何广告实例，游戏会自动隐藏"看视频复活"入口，
 *   不会出现"点了没反应"或"模拟广告"的死按钮。
 */
export const AD_UNITS = {
  // 激励视频广告位（复活、体力补充共用）
  rewardedVideo: ''
}

/** 当前版本号，随包发布时手动递增，用于 wx.getUpdateManager 提示文案 */
export const GAME_VERSION = '1.0.0'
