/**
 * H5 发布用的极简静态服务器（构建产物，会被复制到 dist-h5/server.js）
 *
 * 为什么不能直接用 python -m http.server / 纯静态托管：
 * 游戏源码里的 import 没写 .js 后缀（微信小游戏会自动补，浏览器原生 ESM 不会），
 * 纯静态服务器会全部 404。所以必须有一个能补后缀的服务器。
 *
 * 只依赖 Node 内置模块，无需 npm install。
 */

const http = require('http')
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const PORT = Number(process.env.PORT) || 8080
const HOST = process.env.HOST || '0.0.0.0'
const ROOT = __dirname

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
}

const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg'])

/**
 * 解析请求路径到磁盘文件；不存在时尝试补 .js / /index.html
 */
function resolveFile(urlPath) {
  let decoded
  try {
    decoded = decodeURIComponent(urlPath)
  } catch (e) {
    return null
  }

  const resolved = path.resolve(ROOT, '.' + path.posix.normalize(decoded))
  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) return null
  if (resolved === ROOT) return path.join(ROOT, 'index.html')

  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved

  // 关键兜底：源码 import 没写扩展名
  if (!path.extname(resolved) && fs.existsSync(resolved + '.js')) return resolved + '.js'

  // 目录 → index.html
  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    const index = path.join(resolved, 'index.html')
    if (fs.existsSync(index)) return index
  }

  return resolved
}

function sendFile(req, res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      const code = err.code === 'ENOENT' ? 404 : 500
      res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end(code === 404 ? 'File not found' : 'Server error')
      return
    }

    const ext = path.extname(filePath).toLowerCase()
    const isHtml = ext === '.html'
    const headers = {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': isHtml ? 'no-cache' : 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      Vary: 'Accept-Encoding'
    }

    const acceptsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '')
    if (acceptsGzip && COMPRESSIBLE.has(ext) && data.length > 1024) {
      zlib.gzip(data, (zipErr, zipped) => {
        if (zipErr) {
          headers['Content-Length'] = data.length
          res.writeHead(200, headers)
          res.end(data)
          return
        }
        headers['Content-Encoding'] = 'gzip'
        headers['Content-Length'] = zipped.length
        res.writeHead(200, headers)
        res.end(zipped)
      })
      return
    }

    headers['Content-Length'] = data.length
    res.writeHead(200, headers)
    res.end(data)
  })
}

const server = http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0].split('#')[0]

  if (urlPath === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('ok')
    return
  }

  const filePath = resolveFile(urlPath)
  if (!filePath) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Forbidden')
    return
  }

  sendFile(req, res, filePath)
})

server.listen(PORT, HOST, () => {
  console.log(`🐧 一企推推乐 H5 已启动: http://${HOST}:${PORT}`)
})

process.on('SIGTERM', () => {
  server.close(() => process.exit(0))
})
