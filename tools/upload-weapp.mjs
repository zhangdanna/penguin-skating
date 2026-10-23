#!/usr/bin/env node
/**
 * 上传微信小程序（小游戏）
 *
 * 前置条件：
 *   1. 项目根目录存在 private.wx.key（上传密钥）
 *   2. 已运行 npm install 安装 miniprogram-ci
 *   3. IP 白名单已配置（或已关闭白名单校验）
 *
 * 用法：
 *   node tools/upload-weapp.mjs [version] [desc]
 *   npm run upload -- 1.0.1 修复若干问题
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// 读取项目配置
const projectConfig = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'project.config.json'), 'utf8')
)
const appid = projectConfig.appid

const privateKeyPath = path.join(ROOT, 'private.wx.key')
if (!fs.existsSync(privateKeyPath)) {
  console.error('❌ 未找到上传密钥: private.wx.key')
  console.error('')
  console.error('获取方式：')
  console.error('  1. 登录微信公众平台 → 开发 → 开发管理 → 开发设置')
  console.error('  2. 找到「小程序代码上传」→ 生成密钥')
  console.error('  3. 下载并保存为项目根目录的 private.wx.key')
  console.error('  4. 同一位置配置 IP 白名单（或关闭白名单校验）')
  process.exit(1)
}

// 读取版本号
let version = process.argv[2] || process.env.WX_VERSION
let desc = process.argv[3] || process.env.WX_DESC || '更新'

if (!version) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
    version = pkg.version
  } catch {}
}

if (!version) {
  console.error('❌ 请提供版本号')
  console.error('   用法: npm run upload -- <version> [desc]')
  console.error('   或在 package.json 中设置 version 字段')
  process.exit(1)
}

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.warn(`⚠️  版本号 "${version}" 不符合 x.y.z 格式，建议修改`)
}

const distPath = path.join(ROOT, 'dist-weapp')
if (!fs.existsSync(distPath)) {
  console.error('❌ 未找到构建产物 dist-weapp/')
  console.error('   请先运行: npm run build:weapp')
  process.exit(1)
}

// 动态导入 miniprogram-ci（ESM 兼容）
let ci
try {
  const mod = await import('miniprogram-ci')
  ci = mod.default || mod
} catch (e) {
  console.error('❌ 未找到 miniprogram-ci')
  console.error('   请运行: npm install')
  process.exit(1)
}

const project = new ci.Project({
  appid,
  type: 'miniGame',
  projectPath: distPath,
  privateKeyPath,
  ignores: ['node_modules/**/*']
})

console.log(`⬆️  开始上传...`)
console.log(`   AppID : ${appid}`)
console.log(`   版本  : ${version}`)
console.log(`   说明  : ${desc}`)
console.log('')

try {
  await ci.upload({
    project,
    version,
    desc,
    setting: {
      es6: true,
      minifyJS: true,
      minifyWXML: true,
      minifyWXSS: true
    },
    onProgressUpdate(info) {
      if (info._msg) process.stdout.write(`\r   ${info._msg}`)
    }
  })
} catch (e) {
  const message = String(e && e.message ? e.message : e)
  const ipMatch = message.match(/invalid ip:\s*([0-9.]+)/i)

  console.error('\n❌ 上传失败')
  if (ipMatch) {
    console.error(`   微信公众平台拒绝了当前出口 IP：${ipMatch[1]}`)
    console.error('   请到：微信公众平台 → 开发 → 开发管理 → 开发设置 → 小程序代码上传 → IP 白名单')
    console.error(`   将 ${ipMatch[1]} 加入白名单后重新执行 npm run release`)
    console.error('   文档：https://developers.weixin.qq.com/miniprogram/dev/devtools/ci.html')
  } else {
    console.error(`   ${message}`)
  }
  process.exit(1)
}

console.log('\n✅ 上传成功')
console.log('   请到微信公众平台 → 版本管理 → 开发版本 查看')
