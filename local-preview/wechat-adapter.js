/**
 * 微信小游戏API适配器 - 将微信API转换为Web API
 * 用于本地预览，让游戏可以在浏览器中运行
 */

console.log('🔧 wechat-adapter.js 开始加载...');

// Canvas setup
const gameCanvas = document.getElementById('gameCanvas');
const gameCtx = gameCanvas.getContext('2d');

// 设置Canvas为全屏（相对于游戏逻辑）
gameCanvas.width = 375;
gameCanvas.height = 667;

// 全局变量 - 游戏代码会访问这些全局变量
window.canvas = gameCanvas;
window.ctx = gameCtx;

// 画布可能被 CSS 缩放，触摸坐标需换算回游戏逻辑坐标
function getCanvasPoint(clientX, clientY) {
  const rect = gameCanvas.getBoundingClientRect();
  return {
    clientX: (clientX - rect.left) * (gameCanvas.width / rect.width),
    clientY: (clientY - rect.top) * (gameCanvas.height / rect.height)
  };
}

// 触摸事件适配
let touchStartX = 0;
let touchStartY = 0;
let touchCallback = null;
let touchEndCallback = null;
let touchMoveCallback = null;

gameCanvas.addEventListener('touchstart', (e) => {
  e.preventDefault();

  // 转换所有触摸点（含画布缩放换算）
  const touches = Array.from(e.touches).map(t => ({
    ...getCanvasPoint(t.clientX, t.clientY),
    identifier: t.identifier
  }));
  
  touchStartX = touches[0].clientX;
  touchStartY = touches[0].clientY;
  
  if (touchCallback) {
    touchCallback({
      touches: touches,
      changedTouches: touches,
      timeStamp: Date.now()
    });
  }
});

gameCanvas.addEventListener('touchend', (e) => {
  e.preventDefault();

  const changedTouches = Array.from(e.changedTouches).map(t => ({
    ...getCanvasPoint(t.clientX, t.clientY),
    identifier: t.identifier
  }));
  
  if (touchEndCallback) {
    touchEndCallback({
      touches: [],
      changedTouches: changedTouches,
      timeStamp: Date.now()
    });
  }
});

gameCanvas.addEventListener('touchmove', (e) => {
  e.preventDefault();

  // 转换所有触摸点（含画布缩放换算）
  const touches = Array.from(e.touches).map(t => ({
    ...getCanvasPoint(t.clientX, t.clientY),
    identifier: t.identifier
  }));
  
  if (touchMoveCallback) {
    touchMoveCallback({
      touches: touches,
      changedTouches: touches,
      timeStamp: Date.now()
    });
  }
});

// 鼠标事件适配（用于桌面浏览器测试）
gameCanvas.addEventListener('mousedown', (e) => {
  const point = getCanvasPoint(e.clientX, e.clientY);
  const x = point.clientX;
  const y = point.clientY;
  touchStartX = x;
  touchStartY = y;
  
  // 模拟触摸事件格式
  const touchEvent = {
    touches: [{ clientX: x, clientY: y }],
    changedTouches: [{ clientX: x, clientY: y }],
    timeStamp: Date.now()
  };
  
  if (touchCallback) {
    touchCallback(touchEvent);
  }
});

gameCanvas.addEventListener('mouseup', (e) => {
  const point = getCanvasPoint(e.clientX, e.clientY);
  const x = point.clientX;
  const y = point.clientY;
  
  // 模拟触摸事件格式
  const touchEvent = {
    touches: [],
    changedTouches: [{ clientX: x, clientY: y }],
    timeStamp: Date.now()
  };
  
  if (touchEndCallback) {
    touchEndCallback(touchEvent);
  }
});

gameCanvas.addEventListener('mousemove', (e) => {
  if (e.buttons !== 1) return; // 只在鼠标按下时移动

  const point = getCanvasPoint(e.clientX, e.clientY);
  const x = point.clientX;
  const y = point.clientY;
  
  // 模拟触摸事件格式
  const touchEvent = {
    touches: [{ clientX: x, clientY: y }],
    changedTouches: [{ clientX: x, clientY: y }],
    timeStamp: Date.now()
  };
  
  if (touchMoveCallback) {
    touchMoveCallback(touchEvent);
  }
});

/**
 * 轻量提示条（替代 alert）
 *
 * 手机上 alert 会阻塞渲染、样式也脱离游戏风格，
 * 本地预览一律用自绘提示条。
 */
function showPreviewTip(text, duration = 1800) {
  const tip = document.createElement('div');
  tip.textContent = text;
  tip.style.cssText = `
    position: fixed;
    left: 50%;
    top: 12%;
    transform: translateX(-50%);
    max-width: 80vw;
    padding: 10px 18px;
    background: rgba(31, 58, 95, 0.92);
    color: #fff;
    font-size: 14px;
    line-height: 1.4;
    border-radius: 10px;
    text-align: center;
    pointer-events: none;
    z-index: 9999;
    transition: opacity 0.25s ease;
  `;
  document.body.appendChild(tip);
  setTimeout(() => {
    tip.style.opacity = '0';
    setTimeout(() => tip.remove(), 260);
  }, duration);
}

// 微信API模拟 - 使用Proxy确保所有API都存在
const wxAPIs = {
  // 触摸事件
  onTouchStart: (callback) => {
    touchCallback = callback;
  },
  
  onTouchEnd: (callback) => {
    touchEndCallback = callback;
  },
  
  onTouchMove: (callback) => {
    touchMoveCallback = callback;
  },
  
  onTouchCancel: (callback) => {
    // 触摸取消事件（模拟）
  },
  
  offTouchStart: () => {
    touchCallback = null;
  },
  
  offTouchEnd: () => {
    touchEndCallback = null;
  },
  
  offTouchMove: () => {
    touchMoveCallback = null;
  },
  
  offTouchCancel: () => {
    // 取消触摸取消事件
  },
  
  // Canvas相关
  createCanvas: () => {
    const offscreen = document.createElement('canvas');
    offscreen.width = gameCanvas.width;
    offscreen.height = gameCanvas.height;
    return offscreen;
  },
  
  // 系统信息
  getSystemInfo: () => {
    return {
      windowWidth: canvas.width,
      windowHeight: canvas.height,
      pixelRatio: window.devicePixelRatio || 1,
      platform: 'web',
      language: navigator.language
    };
  },
  
  getSystemInfoSync: () => {
    return window.wx.getSystemInfo();
  },

  // 窗口信息（新版基础库接口，game.js 的 resize 逻辑优先用它）
  getWindowInfo: () => {
    return {
      windowWidth: gameCanvas.width,
      windowHeight: gameCanvas.height,
      pixelRatio: window.devicePixelRatio || 1,
      screenWidth: gameCanvas.width,
      screenHeight: gameCanvas.height,
      statusBarHeight: 0,
      safeArea: {
        top: 0,
        left: 0,
        right: gameCanvas.width,
        bottom: gameCanvas.height,
        width: gameCanvas.width,
        height: gameCanvas.height
      }
    };
  },

  // 前后台切换：浏览器里用 visibilitychange 模拟（切标签页 = 切后台）
  onShow: (cb) => {
    if (typeof cb !== 'function') return;
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) cb({ scene: 1001 });
    });
  },

  onHide: (cb) => {
    if (typeof cb !== 'function') return;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cb({ scene: 1001 });
    });
  },

  // 窗口尺寸变化：本地预览画布固定为 375x667，这里只做接口占位
  onWindowResize: (cb) => {
    if (typeof cb !== 'function') return;
    window.addEventListener('resize', () => {
      cb({ windowWidth: gameCanvas.width, windowHeight: gameCanvas.height });
    });
  },
  
  // 文件系统环境变量（本地预览映射到站点根路径）
  env: {
    USER_DATA_PATH: ''
  },
  
  // 文件系统：本地预览通过HTTP读取游戏目录下的关卡文件
  getFileSystemManager: () => {
    return {
      readFile: ({ filePath, encoding, success, fail }) => {
        fetch(filePath)
          .then(res => {
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${filePath}`);
            }
            return encoding === 'utf8' ? res.text() : res.arrayBuffer();
          })
          .then(data => {
            success && success({ data });
          })
          .catch(err => {
            console.warn('[FS] 读取文件失败:', filePath, err.message);
            fail && fail(err);
          });
      }
    };
  },
  
  // 本地存储
  setStorage: (options) => {
    try {
      localStorage.setItem(options.key, JSON.stringify(options.data));
      options.success && options.success({});
    } catch (e) {
      options.fail && options.fail(e);
    }
  },
  
  setStorageSync: (key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error('setStorageSync error:', e);
    }
  },
  
  getStorage: (options) => {
    try {
      const data = localStorage.getItem(options.key);
      options.success && options.success({
        data: data ? JSON.parse(data) : null
      });
    } catch (e) {
      options.fail && options.fail(e);
    }
  },
  
  getStorageSync: (key) => {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('getStorageSync error:', e);
      return null;
    }
  },
  
  removeStorage: (options) => {
    try {
      localStorage.removeItem(options.key);
      options.success && options.success({});
    } catch (e) {
      options.fail && options.fail(e);
    }
  },
  
  removeStorageSync: (key) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error('removeStorageSync error:', e);
    }
  },
  
  // 音效：用真实 HTMLAudioElement 驱动，手机上能听到声音
  // （原来只 console.log，本地预览完全静音，手机上根本没法验听感）
  createInnerAudioContext: () => {
    const el = new Audio();
    el.preload = 'auto';

    const handlers = { play: [], pause: [], stop: [], ended: [], error: [], canplay: [] };
    const emit = (name, arg) => {
      handlers[name].forEach((fn) => {
        try {
          fn(arg);
        } catch (e) {
          console.warn(`[Audio] ${name} 回调异常:`, e);
        }
      });
    };

    el.addEventListener('play', () => emit('play'));
    el.addEventListener('pause', () => emit('pause'));
    el.addEventListener('ended', () => emit('ended'));
    el.addEventListener('canplay', () => emit('canplay'));
    // 关键：src 404 时要把错误抛给游戏，这样 bgm.mp3 → bgm.wav 的回退才能生效
    el.addEventListener('error', () => {
      emit('error', { errMsg: `audio error: ${el.currentSrc || el.src}` });
    });

    const ctx = {
      loop: false,
      autoplay: false,
      buffered: 0,

      get src() {
        return el.src;
      },
      set src(value) {
        el.src = value;
        el.load();
      },

      get volume() {
        return el.volume;
      },
      set volume(value) {
        const v = Number(value);
        el.volume = Math.max(0, Math.min(1, Number.isFinite(v) ? v : 1));
      },

      get paused() {
        return el.paused;
      },

      get currentTime() {
        return el.currentTime || 0;
      },
      set currentTime(value) {
        try {
          el.currentTime = value;
        } catch (e) {
          // 元数据还没加载完时赋值会抛，忽略
        }
      },

      get duration() {
        return Number.isFinite(el.duration) ? el.duration : 0;
      },

      play() {
        el.loop = ctx.loop;
        const p = el.play();
        // iOS / Chrome 的自动播放策略会拒绝没有用户手势的播放，静默吞掉
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      },

      pause() {
        el.pause();
      },

      stop() {
        el.pause();
        try {
          el.currentTime = 0;
        } catch (e) {
          // 忽略
        }
        emit('stop');
      },

      seek(position) {
        try {
          el.currentTime = position;
        } catch (e) {
          // 忽略
        }
      },

      destroy() {
        el.pause();
        el.removeAttribute('src');
        el.load();
      },

      onPlay(fn) { handlers.play.push(fn); },
      onPause(fn) { handlers.pause.push(fn); },
      onStop(fn) { handlers.stop.push(fn); },
      onEnded(fn) { handlers.ended.push(fn); },
      onError(fn) { handlers.error.push(fn); },
      onCanplay(fn) { handlers.canplay.push(fn); },

      offPlay() { handlers.play.length = 0; },
      offPause() { handlers.pause.length = 0; },
      offStop() { handlers.stop.length = 0; },
      offEnded() { handlers.ended.length = 0; },
      offError() { handlers.error.length = 0; },
      offCanplay() { handlers.canplay.length = 0; }
    };

    return ctx;
  },
  
  // 振动
  vibrateShort: () => {
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  },
  
  vibrateLong: () => {
    if (navigator.vibrate) {
      navigator.vibrate(200);
    }
  },
  
  // 分享（模拟）
  shareAppMessage: (options) => {
    console.log('[Share] 分享到好友:', options);
    showPreviewTip(`分享（本地预览为模拟）：${options.title || '企鹅滑冰'}`);
  },
  
  shareAppMessageToGroup: (options) => {
    console.log('[Share] 分享到群:', options);
    showPreviewTip(`分享到群（本地预览为模拟）：${options.title || '企鹅滑冰'}`);
  },
  
  showShareMenu: (options = {}) => {
    console.log('[Share] 显示分享菜单');
    options.success && options.success({});
  },
  
  hideShareMenu: (options = {}) => {
    console.log('[Share] 隐藏分享菜单');
    options.success && options.success({});
  },
  
  updateShareMenu: (options = {}) => {
    console.log('[Share] 更新分享菜单');
    options.success && options.success({});
  },
  
  onShareAppMessage: (callback) => {
    console.log('[Share] 注册分享回调');
    // 存储回调但不执行
  },
  
  onShareTimeline: (callback) => {
    console.log('[Share] 注册朋友圈分享回调');
    // 存储回调但不执行
  },
  
  offShareTimeline: (callback) => {
    console.log('[Share] 取消朋友圈分享回调');
  },
  
  offShareAppMessage: (callback) => {
    console.log('[Share] 取消分享回调');
  },
  
  // 广告（模拟）
  // 注意：onClose 必须在 show() 之后才触发，否则真实 AdManager 的
  // showRewardedVideoAd() Promise 永远等不到结果（B2 联调时踩过）
  createRewardedVideoAd: (options) => {
    console.log('[Ad] 创建激励视频实例:', options && options.adUnitId);

    let loadCallback = null;
    let closeCallback = null;
    let errorCallback = null;
    let timer = null;

    return {
      load: () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            loadCallback && loadCallback();
            resolve();
          }, 80);
        });
      },
      show: () => {
        console.log('[Ad] 显示激励视频广告（模拟 2 秒后完整观看）');
        clearTimeout(timer);
        timer = setTimeout(() => {
          closeCallback && closeCallback({ isEnded: true });
        }, 2000);
        return Promise.resolve();
      },
      onLoad: (callback) => { loadCallback = callback; },
      onClose: (callback) => { closeCallback = callback; },
      onError: (callback) => { errorCallback = callback; },
      offClose: () => { closeCallback = null; },
      destroy: () => {
        clearTimeout(timer);
        loadCallback = closeCallback = errorCallback = null;
      }
    };
  },
  
  createBannerAd: () => {
    return {
      show: () => Promise.resolve(),
      hide: () => Promise.resolve(),
      destroy: () => {},
      onError: (callback) => {},
      onResize: (callback) => {}
    };
  },

  // 全局错误兜底（D3）：把浏览器的错误转成小游戏的回调，
  // 这样本地预览也能走到游戏自己的异常复位逻辑
  onError: (callback) => {
    window.__wxErrorCallback = callback;
    if (window.__wxErrorBound) return;
    window.__wxErrorBound = true;
    window.addEventListener('error', (event) => {
      if (!window.__wxErrorCallback) return;
      window.__wxErrorCallback(
        `${event.message}\n${event.filename}:${event.lineno}`
      );
    });
  },
  offError: () => {
    window.__wxErrorCallback = null;
  },

  onUnhandledRejection: (callback) => {
    window.__wxRejectionCallback = callback;
    if (window.__wxRejectionBound) return;
    window.__wxRejectionBound = true;
    window.addEventListener('unhandledrejection', (event) => {
      if (!window.__wxRejectionCallback) return;
      const reason = event.reason;
      window.__wxRejectionCallback(
        reason && reason.stack ? reason.stack : String(reason)
      );
    });
  },
  offUnhandledRejection: () => {
    window.__wxRejectionCallback = null;
  },

  // 热更新：本地预览没有发布流程，回调注册即可，永远不触发
  getUpdateManager: () => ({
    onCheckForUpdate: () => {},
    onUpdateReady: () => {},
    onUpdateFailed: () => {},
    applyUpdate: () => console.log('[Update] 本地预览无热更新，忽略 applyUpdate')
  }),

  // 隐私授权（模拟）
  // 本地预览不会自动触发，控制台执行 window.__triggerPrivacy() 可手动验证弹窗
  onNeedPrivacyAuthorization: (callback) => {
    console.log('[Privacy] 已注册隐私授权回调');
    window.__privacyCallback = callback;
    window.__triggerPrivacy = () => {
      if (!window.__privacyCallback) return;
      window.__privacyCallback(
        (res) => console.log('[Privacy] 用户选择:', res),
        { referrer: 'local-preview' }
      );
    };
  },

  openPrivacyContract: (options = {}) => {
    console.log('[Privacy] 打开隐私指引（本地预览不可用）');
    options.fail && options.fail({ errMsg: 'local preview' });
  },

  requirePrivacyAuthorize: (options = {}) => {
    console.log('[Privacy] requirePrivacyAuthorize（本地预览直接通过）');
    options.success && options.success({});
  },
  
  // 登录（模拟）
  login: (options) => {
    console.log('[Login] 微信登录');
    setTimeout(() => {
      options.success && options.success({
        code: 'mock_code_' + Date.now()
      });
    }, 500);
  },
  
  // 用户信息
  getUserInfo: (options) => {
    console.log('[UserInfo] 获取用户信息');
    setTimeout(() => {
      options.success && options.success({
        userInfo: {
          nickName: '测试用户',
          avatarUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="%234a90e2"/><text x="50" y="65" font-size="40" text-anchor="middle" fill="white">🐧</text></svg>'
        }
      });
    }, 500);
  },
  
  // 开放数据域
  getOpenDataContext: () => {
    return {
      canvas: document.createElement('canvas'),
      postMessage: (data) => {
        console.log('[OpenData] Post message:', data);
      }
    };
  },
  
  // 排行榜（模拟）
  setUserCloudStorage: (options) => {
    console.log('[Rank] 设置云存储:', options);
    options.success && options.success({});
  },
  
  getFriendCloudStorage: (options) => {
    console.log('[Rank] 获取好友云存储（本地预览返回空列表）');
    setTimeout(() => {
      options.success && options.success({ data: [] });
    }, 100);
  },
  
  getUserCloudStorage: (options) => {
    options.success && options.success({ KVDataList: [] });
  },
  
  // 图片
  createImage: () => new Image(),
  
  // 剪贴板
  setClipboardData: (options) => {
    console.log('[Clipboard] 复制到剪贴板:', options.data);
    options.success && options.success({});
  },
  
  // 模态对话框
  showModal: (options) => {
    const result = confirm(options.content || '提示');
    if (result) {
      options.success && options.success({ confirm: true });
    } else {
      options.success && options.success({ confirm: false });
    }
  },
  
  showToast: (options) => {
    console.log('[Toast]', options.title);
    // 简单的toast实现
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      z-index: 9999;
      font-size: 14px;
    `;
    toast.textContent = options.title || '提示';
    document.body.appendChild(toast);
    
    setTimeout(() => {
      document.body.removeChild(toast);
    }, options.duration || 2000);
  },
  
  // 请求（模拟）
  request: (options) => {
    console.log('[Request]', options.url);
    setTimeout(() => {
      options.success && options.success({
        data: {},
        statusCode: 200
      });
    }, 500);
  }
};

// 使用Proxy包装wx对象，确保所有API都存在（即使未实现也不会报错）
window.wx = new Proxy(wxAPIs, {
  get(target, prop) {
    if (prop in target) {
      return target[prop];
    }
    // 对于未定义的API，返回一个空函数并打印警告
    console.warn(`[wx] API未实现: wx.${prop}，已自动降级为空函数`);
    return function(...args) {
      // 空函数，不做任何事
    };
  }
});

// requestAnimationFrame polyfill
if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = (callback) => {
    return setTimeout(callback, 1000 / 60);
  };
}

if (!window.cancelAnimationFrame) {
  window.cancelAnimationFrame = (id) => {
    clearTimeout(id);
  };
}

// 游戏循环已经由requestAnimationFrame原生支持，不需要额外适配
console.log('✅ 微信小游戏API适配器已加载');
console.log('🎮 游戏画布:', gameCanvas.width, 'x', gameCanvas.height);

// 导出给模块使用
export { gameCanvas, gameCtx };
