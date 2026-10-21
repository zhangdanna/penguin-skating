/**
 * 游戏主场景
 * 包装Game类，使其作为场景管理器中的一个场景
 */
export default class GameScene {
  constructor(game) {
    this.game = game
    this.isVisible = false
    this.currentLevel = null
  }

  /**
   * 进入场景
   */
  onEnter(data) {
    console.log('[GameScene] 进入场景，关卡:', data.level)
    this.isVisible = true
    this.currentLevel = data.level
    
    // 加载并启动关卡
    if (this.game && data.level) {
      this.game.startLevel(data.level)
    }
  }

  /**
   * 退出场景
   */
  onExit() {
    console.log('[GameScene] 退出场景')
    this.isVisible = false
  }

  /**
   * 更新
   */
  update() {
    // 游戏主循环由game自己管理
  }

  /**
   * 渲染
   */
  render(ctx) {
    // 游戏渲染由game自己管理
  }

  /**
   * 触摸开始
   */
  onTouchStart(touch) {
    // 触摸事件由game自己处理
  }

  /**
   * 触摸移动
   */
  onTouchMove(touch) {
    // 触摸事件由game自己处理
  }

  /**
   * 触摸结束
   */
  onTouchEnd(touch) {
    // 触摸事件由game自己处理
  }
}
