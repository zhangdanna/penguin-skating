#!/usr/bin/env node
/**
 * 构建微信小游戏发布包
 *
 * 把项目根复制到 dist-weapp/，排除开发期文件（docs、tools、local-preview 等）。
 * 这样上传包更干净，也避免把本地配置带到线上。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIST = path.join(ROOT, 'dist-weapp')

const EXCLUDE_PATTERNS = [
  /^\.git\b/,
  /^\.workbuddy/,
  /^\.wbapp_/,
  /^docs\b/,
  /^tools\b/,
  /^local-preview\b/,
  /^design-preview\b/,
  /^node_modules\b/,
  /^dist-h5\b/,
  /^dist-weapp\b/,
  /\.log$/,
  /^\.gitignore$/,
  /^package\.json$/,
  /^package-lock\.json$/,
  /^project\.private\.config\.json$/,
  /^private\.wx\.key$/,
  /^preview-qrcode\.png$/,
  /^README(\.zh-CN)?\.md$/,
  /^game\.md$/,
  /^penguin-skating-design\.html$/,
  /^\.wbapp_.*\.genie$/
]

function shouldExclude(name) {
  return EXCLUDE_PATTERNS.some(p => p.test(name))
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (shouldExclude(entry.name)) continue
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

// 清理旧产物
//
// Windows 下 dist-weapp 常被微信开发者工具、资源管理器或预览进程占用。
// 三重降级：
//   1. rmSync（带重试）
//   2. 删不掉就清空目录内容、复用目录本身
//   3. 连内容都清不掉就跳过清理，靠 copyFileSync 就地覆盖
//
// 不要按 e.code 白名单（EBUSY / EPERM）过滤：本机 rmSync 会被
// safe-delete shim 接管，抛出来的错误不带这两个 code，一过滤就会把
// 后面两级降级整个跳过，构建直接失败。
async function cleanDist() {
  if (!fs.existsSync(DIST)) return

  let lastError = null
  const maxAttempts = 3

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      fs.rmSync(DIST, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 150
      })
      return
    } catch (e) {
      lastError = e
      await delay(300 * (attempt + 1))
    }
  }

  // 降级一：目录句柄被占用时 rmdir 会失败，但通常仍允许删除内部文件
  try {
    for (const entry of fs.readdirSync(DIST)) {
      fs.rmSync(path.join(DIST, entry), {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 150
      })
    }
    console.warn('⚠️  dist-weapp 目录被占用，已清空内容并复用该目录')
    return
  } catch (inner) {
    lastError = inner
  }

  // 降级二：跳过清理，就地覆盖。会残留已删除的旧文件，但不至于构建失败
  const reason = (lastError && lastError.message ? lastError.message.split('\n')[0] : '未知原因')
  console.warn(`⚠️  dist-weapp 无法清理（${reason}），改为就地覆盖，可能残留已删除的旧文件`)
}

await cleanDist()

copyDir(ROOT, DIST)

// 统计
const stats = { dirs: 0, files: 0, size: 0 }
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      stats.dirs++
      walk(p)
    } else {
      stats.files++
      stats.size += fs.statSync(p).size
    }
  }
}
walk(DIST)

console.log(`✅ 构建完成: dist-weapp/`)
console.log(`   目录: ${stats.dirs}, 文件: ${stats.files}, 总大小: ${(stats.size / 1024).toFixed(1)} KB`)

// 提醒包大小
if (stats.size > 4 * 1024 * 1024) {
  console.warn(`⚠️  主包超过 4MB (${(stats.size / 1024 / 1024).toFixed(2)} MB)，建议分包或压缩资源`)
}
