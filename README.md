# @rain-monorepo/npk-parser

用于解析 DNF 的 `NPK` 与 `IMG` 资源文件，支持提取 NPK 文件条目、解析 IMG 帧数据，以及根据路径从多个 NPK 中定位 IMG 资源。

## 功能特性

- 解析 `NPK` 文件头与文件列表
- 提取单个文件条目的二进制数据
- 解析多版本 `IMG` 文件帧数据
- 构建跨 NPK 的 IMG 索引
- 将调色板 RGBA 数据转换为 CSS 颜色字符串

## 安装

当前包配置为私有包，适合在仓库内本地开发和构建：

```bash
npm install
```

## 构建

```bash
npm run build
```

## 导出内容

- `NpkParser`
- `ImgParser`
- `buildNpkIndex`
- `resolveImgFromNpk`
- `paletteRgbaToCssColors`

## 基本用法

### 解析 NPK 文件

```ts
import { NpkParser } from '@rain-monorepo/npk-parser'

const buffer = await file.arrayBuffer()
const parser = new NpkParser(buffer)
const entries = parser.parse()

console.log(entries[0].name)
console.log(entries[0].size)
```

### 解析 IMG 文件

```ts
import { ImgParser } from '@rain-monorepo/npk-parser'

const buffer = await file.arrayBuffer()
const parser = new ImgParser(buffer)
const frames = parser.parse()

console.log(frames.length)
console.log(parser.getColorBoardCount())
```

### 构建 NPK 索引并定位 IMG

```ts
import { NpkParser, buildNpkIndex, resolveImgFromNpk } from '@rain-monorepo/npk-parser'

const npkFiles = await Promise.all(
  files.map(async (file) => {
    const buffer = await file.arrayBuffer()
    const entries = new NpkParser(buffer).parse()
    return {
      name: file.name,
      buffer,
      entries
    }
  })
)

const npkIndex = buildNpkIndex(npkFiles)
const resolved = resolveImgFromNpk('sprite/character/example.img', 0, npkIndex)

console.log(resolved)
```

### 调色板转换

```ts
import { paletteRgbaToCssColors } from '@rain-monorepo/npk-parser'

const colors = paletteRgbaToCssColors(new Uint8ClampedArray([
  255, 0, 0, 255,
  0, 255, 0, 255
]))

console.log(colors)
```

## 开发说明

- 入口文件位于 `src/index.ts`
- 构建工具为 `Vite`
- 类型声明由 `vite-plugin-dts` 生成

## 许可

本项目基于 MIT License 开源，详见 `LICENSE` 文件。
