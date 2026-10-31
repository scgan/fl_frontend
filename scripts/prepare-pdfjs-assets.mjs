/** 将当前 PDF.js 版本的 CMap 与标准字体复制为同源静态资源，供开发和生产阅读器离线加载。 */
import { cp, mkdir, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const packagePath = require.resolve('pdfjs-dist/package.json')
const pdfjsRoot = dirname(packagePath)
const { version } = JSON.parse(await readFile(packagePath, 'utf8'))
const projectRoot = fileURLToPath(new URL('../', import.meta.url))
// 版本目录防止升级解析器后，浏览器仍命中旧版本字符映射或字体缓存。
const destination = join(projectRoot, 'public', 'pdfjs', version)
await mkdir(destination, { recursive: true })
for (const directory of ['cmaps', 'standard_fonts']) {
  await cp(join(pdfjsRoot, directory), join(destination, directory), { recursive: true })
}
console.log(`PDF.js ${version}: CMaps and standard fonts prepared`)
