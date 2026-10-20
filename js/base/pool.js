/**
 * 对象池
 * 用于复用游戏对象，减少GC压力
 */
export default class Pool {
  constructor(factory, initialSize = 10) {
    this.factory = factory
    this.pool = []
    this.active = []

    // 预创建对象
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factory())
    }
  }

  /**
   * 获取对象
   * @returns {Object} 从池中获取的对象
   */
  get() {
    const obj = this.pool.length > 0 ? this.pool.pop() : this.factory()
    this.active.push(obj)
    return obj
  }

  /**
   * 回收对象
   * @param {Object} obj - 要回收的对象
   */
  release(obj) {
    const index = this.active.indexOf(obj)
    if (index > -1) {
      this.active.splice(index, 1)
      this.pool.push(obj)
    }
  }

  /**
   * 回收所有活跃对象
   */
  releaseAll() {
    while (this.active.length > 0) {
      this.pool.push(this.active.pop())
    }
  }

  /**
   * 获取活跃对象数量
   * @returns {number}
   */
  get activeCount() {
    return this.active.length
  }

  /**
   * 获取池中可用对象数量
   * @returns {number}
   */
  get availableCount() {
    return this.pool.length
  }
}
