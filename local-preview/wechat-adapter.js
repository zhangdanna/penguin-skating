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
  
  // 音效
  createInnerAudioContext: () => {
    return {
      src: '',
      loop: false,
      autoplay: false,
      volume: 1,
      currentTime: 0,
      duration: 0,
      buffered: 0,
      paused: true,
      
      play: function() {
        console.log('[Audio] Play:', this.src);
        this.paused = false;
      },
      
      pause: function() {
        this.paused = true;
      },
      
      stop: function() {
        this.paused = true;
        this.currentTime = 0;
      },
      
      destroy: function() {
        // No-op
      },
      
      onPlay: function(callback) {
        // No-op
      },
      
      onPause: function(callback) {
        // No-op
      },
      
      onStop: function(callback) {
        // No-op
      },
      
      onError: function(callback) {
        // No-op
      }
    };
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
    alert('分享功能（模拟）: ' + (options.title || '企鹅滑冰'));
  },
  
  shareAppMessageToGroup: (options) => {
    console.log('[Share] 分享到群:', options);
    alert('分享到群功能（模拟）: ' + (options.title || '企鹅滑冰'));
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
  createRewardedVideoAd: () => {
    return {
      load: () => Promise.resolve(),
      show: () => {
        console.log('[Ad] 显示激励视频广告');
        alert('广告观看（模拟）');
        return Promise.resolve();
      },
      onClose: (callback) => {
        setTimeout(() => callback({ isEnded: true }), 1000);
      },
      onError: (callback) => {
        // No-op
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
