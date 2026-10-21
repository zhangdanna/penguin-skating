/**
 * 游戏包装器 - 将微信小游戏代码适配到Web环境
 */

console.log('📦 game-wrapper.js 开始加载...');

// 确保全局变量可用
import { gameCanvas, gameCtx } from './wechat-adapter.js';

console.log('✅ wechat-adapter.js 加载成功');
console.log('gameCanvas:', gameCanvas);
console.log('gameCtx:', gameCtx);

// 将canvas和ctx设置为全局变量（游戏代码会访问）
window.canvas = gameCanvas;
window.ctx = gameCtx;

// 动态导入游戏主类（game.js 末尾会自动实例化，这里不要重复创建）
import('../game.js').then(() => {
  console.log('✅ 游戏模块加载完成')
}).catch(err => {
  console.error('❌ 加载游戏失败:', err)
  document.body.innerHTML += `<div style="color:red;text-align:center;margin-top:20px;">加载游戏失败: ${err.message}<br/>请查看控制台了解详情</div>`
});
