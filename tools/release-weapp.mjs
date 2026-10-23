#!/usr/bin/env node
/**
 * 一键发布微信小游戏
 *
 * 等价于依次执行 build:weapp + upload，任一失败即中止。
 *
 * 用法：
 *   node tools/release-weapp.mjs [version] [desc]
 *   npm run release -- 1.0.1 修复若干问题
 */
import { spawn } from 'node:child_process'

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: true })
    child.on('close', code => {
      if (code === 0) resolve()
      else reject(new Error(`命令退出码 ${code}`))
    })
  })
}

try {
  console.log('🔨 步骤 1/2: 构建小游戏包...\n')
  await run('node', ['tools/build-weapp.mjs'])

  console.log('\n⬆️  步骤 2/2: 上传到微信公众平台...\n')
  const args = ['tools/upload-weapp.mjs']
  const version = process.argv[2]
  const desc = process.argv[3]
  if (version) args.push(version)
  if (desc) args.push(desc)
  await run('node', args)

  console.log('\n🎉 发布完成')
} catch (e) {
  console.error('\n❌ 发布失败:', e.message)
  process.exit(1)
}
