/**
 * 构建可发布的 H5 目录（dist-h5/）
 *
 * 为什么需要这一步：
 * 1. 项目根有 project.config.json，发布平台会把它判定成「微信小程序项目」，
 *    走小程序的发布路径，拿不到 web 链接；
 * 2. 根目录还带着 docs/ tools/ .git/ 私有配置，不该一起上传；
 * 3. H5 真正需要的只有游戏源码 + 适配层 + 资源。
 *
 * 产出目录结构（保持与源码一致的相对路径，index.html 里的绝对路径才能对上）：
 *   dist-h5/
 *     index.html
 *     game.js
 *     local-preview/{game-wrapper.js, wechat-adapter.js}
 *     js/**
 *     audio/**
 *     images/**
 *
 * 用法：node tools/build-h5.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'dist-h5')

/** 需要整体复制的目录 */
const COPY_DIRS = ['js', 'audio', 'images']

/** 需要单独复制的文件：[源, 目标相对路径] */
const COPY_FILES = [
  ['local-preview/index.html', 'index.html'],
  ['local-preview/game-wrapper.js', 'local-preview/game-wrapper.js'],
  ['local-preview/wechat-adapter.js', 'local-preview/wechat-adapter.js'],
  ['game.js', 'game.js'],
  // 发布包必须自带服务器：源码 import 不写 .js 后缀，纯静态托管会全部 404
  ['tools/h5-server.js', 'server.js']
]

/** 不进发布包的资源 */
const SKIP_EXT = new Set(['.md', '.html', '.py'])

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function copyDir(srcDir, destDir, stats) {
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name)
    const dest = path.join(destDir, entry.name)

    if (entry.isDirectory()) {
      copyDir(src, dest, stats)
      continue
    }

    // audio/ 只保留运行时音频；.md/.html 属于开发素材，不进 H5 包
    if (SKIP_EXT.has(path.extname(entry.name).toLowerCase())) continue

    ensureDir(destDir)
    fs.copyFileSync(src, dest)
    stats.files++
    stats.bytes += fs.statSync(dest).size
  }
}

function build() {
  if (fs.existsSync(OUT)) {
    fs.rmSync(OUT, { recursive: true, force: true })
  }
  ensureDir(OUT)

  const stats = { files: 0, bytes: 0 }

  for (const dir of COPY_DIRS) {
    const srcDir = path.join(ROOT, dir)
    if (!fs.existsSync(srcDir)) {
      console.warn(`⚠️  跳过不存在的目录: ${dir}`)
      continue
    }
    copyDir(srcDir, path.join(OUT, dir), stats)
  }

  for (const [src, dest] of COPY_FILES) {
    const srcPath = path.join(ROOT, src)
    if (!fs.existsSync(srcPath)) {
      console.warn(`⚠️  缺少文件: ${src}`)
      continue
    }
    const destPath = path.join(OUT, dest)
    ensureDir(path.dirname(destPath))
    fs.copyFileSync(srcPath, destPath)
    stats.files++
    stats.bytes += fs.statSync(destPath).size
  }

  // 发布目录里绝不能出现小程序工程配置，否则会被当成小程序项目
  const forbidden = ['project.config.json', 'project.private.config.json', 'game.json']
  for (const name of forbidden) {
    const p = path.join(OUT, name)
    if (fs.existsSync(p)) {
      fs.rmSync(p)
      console.warn(`⚠️  已移除不该发布的小程序配置: ${name}`)
    }
  }

  const mb = (stats.bytes / 1024 / 1024).toFixed(2)
  console.log(`✅ 构建完成: ${path.relative(ROOT, OUT)}`)
  console.log(`   文件数: ${stats.files}，体积: ${mb} MB`)
  console.log(`   入口: dist-h5/index.html`)
}

build()
