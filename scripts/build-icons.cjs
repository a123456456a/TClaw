/**
 * 从 `build/icon.svg` 生成 `build/icon.png`（512×512）与多尺寸 `build/icon.ico`，供 electron-builder 使用。
 * @see https://www.electron.build/icons
 */

const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const toIco = require('to-ico')

const ROOT = path.join(__dirname, '..')
const SVG_PATH = path.join(ROOT, 'build', 'icon.svg')
const PNG_OUT = path.join(ROOT, 'build', 'icon.png')
const ICO_OUT = path.join(ROOT, 'build', 'icon.ico')

/** Windows 任务栏与安装包常用尺寸（由小到大，与 to-ico 惯例一致） */
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

async function main() {
  if (!fs.existsSync(SVG_PATH)) {
    throw new Error(`缺少源文件: ${SVG_PATH}`)
  }
  const svg = fs.readFileSync(SVG_PATH)

  const png512 = await sharp(svg).resize(512, 512).png().toBuffer()
  fs.writeFileSync(PNG_OUT, png512)

  const buffers = await Promise.all(
    ICO_SIZES.map((s) => sharp(svg).resize(s, s).png().toBuffer())
  )
  const icoBuf = await toIco(buffers)
  fs.writeFileSync(ICO_OUT, icoBuf)

  console.log('已生成:', PNG_OUT)
  console.log('已生成:', ICO_OUT)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
