/**
 * 场景管理器
 * 管理游戏场景的切换和生命周期
 */
export default class SceneManager {
  constructor() {
    this.scenes = {}
    this.currentScene = null
    this.currentSceneName = ''
  }

  /**
   * 注册场景
   * @param {string} name - 场景名称
   * @param {Object} scene - 场景对象
   */
  register(name, scene) {
    this.scenes[name] = scene
  }

  /**
   * 切换场景
   * @param {string} name - 目标场景名称
   * @param {Object} data - 传递给场景的数据
   */
  switchTo(name, data = {}) {
    if (!this.scenes[name]) {
      console.error(`场景 ${name} 不存在`)
      return
    }

    // 退出当前场景
    if (this.currentScene && this.currentScene.onExit) {
      this.currentScene.onExit()
    }

    // 切换场景
    this.currentSceneName = name
    this.currentScene = this.scenes[name]

    // 进入新场景
    if (this.currentScene.onEnter) {
      this.currentScene.onEnter(data)
    }
  }

  /**
   * 获取当前场景
   * @returns {Object} 当前场景
   */
  getCurrentScene() {
    return this.currentScene
  }

  /**
   * 获取当前场景名称
   * @returns {string} 当前场景名称
   */
  getCurrentSceneName() {
    return this.currentSceneName
  }

  /**
   * 更新当前场景
   */
  update() {
    if (this.currentScene && this.currentScene.update) {
      this.currentScene.update()
    }
  }

  /**
   * 渲染当前场景
   * @param {CanvasRenderingContext2D} ctx - 画布上下文
   */
  render(ctx) {
    if (this.currentScene && this.currentScene.render) {
      this.currentScene.render(ctx)
    }
  }

  /**
   * 处理触摸开始事件
   * @param {Object} touch - 触摸事件
   */
  onTouchStart(touch) {
    if (this.currentScene && this.currentScene.onTouchStart) {
      this.currentScene.onTouchStart(touch)
    }
  }

  /**
   * 处理触摸移动事件
   * @param {Object} touch - 触摸事件
   */
  onTouchMove(touch) {
    if (this.currentScene && this.currentScene.onTouchMove) {
      this.currentScene.onTouchMove(touch)
    }
  }

  /**
   * 处理触摸结束事件
   * @param {Object} touch - 触摸事件
   */
  onTouchEnd(touch) {
    if (this.currentScene && this.currentScene.onTouchEnd) {
      this.currentScene.onTouchEnd(touch)
    }
  }
}
