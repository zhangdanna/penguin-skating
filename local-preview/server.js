const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const GAME_DIR = path.join(__dirname, '..');

// MIME types
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg'
};

const server = http.createServer((req, res) => {
  // 根路径返回index.html
  if (req.url === '/' || req.url === '/index.html') {
    const indexPath = path.join(__dirname, 'index.html');
    console.log(`[GET] / -> ${indexPath}`);
    
    fs.readFile(indexPath, (err, data) => {
      if (err) {
        console.error(`❌ 错误: ${err.code}`);
        res.writeHead(500);
        res.end('Error loading index.html');
        return;
      }
      console.log(`✅ 成功: ${indexPath} (${data.length} bytes)`);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
    return;
  }
  
  // 其他路径
  let filePath = path.join(GAME_DIR, req.url);
  
  // 如果没有扩展名，尝试添加.js
  const ext = path.extname(filePath);
  if (!ext) {
    // 尝试.js文件
    if (fs.existsSync(filePath + '.js')) {
      filePath = filePath + '.js';
    }
  }
  
  const fileExt = path.extname(filePath);
  const contentType = MIME_TYPES[fileExt] || 'application/octet-stream';
  
  console.log(`[${req.method}] ${req.url} -> ${filePath}`);
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.error(`❌ 错误: ${err.code} - ${filePath}`);
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end('Error loading file');
      }
      return;
    }
    
    console.log(`✅ 成功: ${filePath} (${data.length} bytes)`);
    res.writeHead(200, { 
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n🐧 企鹅滑冰游戏本地预览服务器已启动！\n`);
  console.log(`📍 地址: http://localhost:${PORT}`);
  console.log(`🎮 在浏览器中打开上述地址即可预览游戏\n`);
  console.log(`按 Ctrl+C 停止服务器\n`);
});
