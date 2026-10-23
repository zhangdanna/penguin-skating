const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// 发布到公网时由平台注入 PORT；本地预览沿用 8080
const PORT = Number(process.env.PORT) || 8080;
// 必须绑 0.0.0.0，否则容器外的反向代理连不进来
const HOST = process.env.HOST || '0.0.0.0';

const ROOT = path.resolve(__dirname, '..');
const ENTRY_HTML = path.join(__dirname, 'index.html');

// 公网可见范围：这些目录/文件一律 403
// （本地开发时也用同一套规则，避免"本地能读、线上读不到"的差异）
const BLOCKED_DIRS = ['.git', '.workbuddy', '.workbuddy-ai', 'node_modules', 'docs', 'tools'];
const BLOCKED_FILES = [
  'project.private.config.json',
  'project.config.json',
  'game.md',
  'package.json',
  'package-lock.json',
  'private.wx.key',
  'preview-qrcode.png',
  '.wbapp_hjDG7BG911lkYn79M1Mtzf.genie',
  'local-preview/server.js',
  'README.md'
];

// MIME types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2'
};

// 只压缩文本类资源，音频/图片压了反而更慢
const COMPRESSIBLE = new Set([
  '.html', '.js', '.mjs', '.css', '.json', '.svg'
]);

/**
 * 把请求路径解析成磁盘上的绝对路径，越界或命中黑名单返回 null
 * @param {string} urlPath - 已去掉 query 的路径
 * @returns {string|null}
 */
function resolveSafePath(urlPath) {
  let decoded
  try {
    decoded = decodeURIComponent(urlPath)
  } catch (e) {
    // 非法转义，直接拒绝
    return null
  }

  // 目录穿越：path.resolve 会把 .. 折叠掉，再校验是否还在 ROOT 里
  const resolved = path.resolve(ROOT, '.' + path.posix.normalize(decoded))
  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) return null

  const relative = path.relative(ROOT, resolved)
  const segments = relative.split(path.sep)

  // 任何一层目录命中黑名单都拒绝（防止 /js/../.git/config 这类绕过）
  if (segments.some((seg) => BLOCKED_DIRS.includes(seg))) return null
  if (BLOCKED_FILES.includes(relative.split(path.sep).join('/'))) return null

  return resolved
}

/**
 * 发送文件，带 gzip 与缓存头
 */
function sendFile(req, res, filePath, statusCode = 200) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('File not found');
      } else {
        console.error(`❌ 读取失败: ${err.code} - ${filePath}`);
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Error loading file');
      }
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // 入口 html 不缓存（改完刷新就能看到），其余静态资源长缓存
    const isHtml = ext === '.html';
    const headers = {
      'Content-Type': contentType,
      'Cache-Control': isHtml ? 'no-cache' : 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      Vary: 'Accept-Encoding'
    };

    const acceptsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    if (acceptsGzip && COMPRESSIBLE.has(ext) && data.length > 1024) {
      zlib.gzip(data, (zipErr, zipped) => {
        if (zipErr) {
          res.writeHead(statusCode, headers);
          res.end(data);
          return;
        }
        headers['Content-Encoding'] = 'gzip';
        headers['Content-Length'] = zipped.length;
        res.writeHead(statusCode, headers);
        res.end(zipped);
      });
      return;
    }

    headers['Content-Length'] = data.length;
    res.writeHead(statusCode, headers);
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0].split('#')[0];

  // 根路径给入口页
  if (urlPath === '/' || urlPath === '/index.html') {
    sendFile(req, res, ENTRY_HTML);
    return;
  }

  // 健康检查（发布平台探活用）
  if (urlPath === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ok');
    return;
  }

  const safePath = resolveSafePath(urlPath);
  if (!safePath) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  // 没写扩展名时补 .js（游戏里 import 的都是带扩展名的，这里只是兜底）
  if (!path.extname(safePath) && fs.existsSync(safePath + '.js')) {
    sendFile(req, res, safePath + '.js');
    return;
  }

  sendFile(req, res, safePath);
});

server.listen(PORT, HOST, () => {
  console.log(`\n🐧 一企推推乐 — 预览服务已启动`);
  console.log(`📍 监听: http://${HOST}:${PORT}`);
  console.log(`📁 根目录: ${ROOT}`);
  console.log(`🔒 已屏蔽: ${BLOCKED_DIRS.join(', ')}\n`);
});

// 平台回收容器时先收到 SIGTERM，优雅退出
process.on('SIGTERM', () => {
  console.log('[Server] 收到 SIGTERM，正在关闭');
  server.close(() => process.exit(0));
});
