#!/usr/bin/env node
/**
 * 生成微信小程序（小游戏）预览二维码
 *
 * 前置条件与 upload 相同，需要 private.wx.key。
 *
 * 用法：
 *   node tools/preview-weapp.mjs [version] [desc]
 *   npm run preview -- 1.0.0 预览版
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const projectConfig = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'project.config.json'), 'utf8')
)
const appid = projectConfig.appid

const privateKeyPath = path.join(ROOT, 'private.wx.key')
if (!fs.existsSync(privateKeyPath)) {
  console.error('❌ 未找到上传密钥: private.wx.key')
  console.error('   获取方式同 upload，见 tools/upload-weapp.mjs 顶部注释')
  process.exit(1)
}

let version = process.argv[2] || process.env.WX_VERSION || 'preview'
let desc = process.argv[3] || process.env.WX_DESC || '预览'

const distPath = path.join(ROOT, 'dist-weapp')
if (!fs.existsSync(distPath)) {
  console.error('❌ 未找到构建产物 dist-weapp/')
  console.error('   请先运行: npm run build:weapp')
  process.exit(1)
}

let ci
try {
  const mod = await import('miniprogram-ci')
  ci = mod.default || mod
} catch (e) {
  console.error('❌ 未找到 miniprogram-ci，请运行 npm install')
  process.exit(1)
}

const project = new ci.Project({
  appid,
  type: 'miniGame',
  projectPath: distPath,
  privateKeyPath,
  ignores: ['node_modules/**/*']
})

const qrcodePath = path.join(ROOT, 'preview-qrcode.png')

console.log(`📱 生成预览二维码...`)
console.log(`   AppID : ${appid}`)
console.log(`   版本  : ${version}`)

await ci.preview({
  project,
  version,
  desc,
  qrcodeFormat: 'image',
  qrcodeOutputDest: qrcodePath,
  onProgressUpdate(info) {
    if (info._msg) process.stdout.write(`\r   ${info._msg}`)
  }
})

console.log(`\n✅ 二维码已保存: ${qrcodePath}`)
console.log('   请用微信扫码预览')
