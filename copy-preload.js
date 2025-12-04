// 跨平台复制 preload.cjs 文件的脚本
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const source = path.join(__dirname, 'electron', 'preload.cjs')
const dest = path.join(__dirname, 'dist-electron', 'preload.cjs')

// 确保目标目录存在
const destDir = path.dirname(dest)
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true })
}

// 复制文件
try {
  fs.copyFileSync(source, dest)
  console.log(`已复制 preload.cjs 到 ${dest}`)
} catch (error) {
  console.error('复制 preload.cjs 失败:', error)
  process.exit(1)
}

