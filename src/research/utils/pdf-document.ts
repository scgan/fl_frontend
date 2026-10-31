/** 为文献问答与引用阅读器统一提供 PDF.js 字符映射及标准字体，避免中文正文因资源缺失而消失。 */
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.js'
import type { DocumentInitParameters } from 'pdfjs-dist/types/src/display/api'

/**
 * 创建带同源字体资源的文档加载参数，沿用当前应用部署前缀与解析器版本。
 * @param data 通过权限接口取得的原 PDF 字节。
 * @returns 供 PDF.js getDocument 使用的参数，不改变原文件内容。
 */
export function pdfDocumentOptions(data: Uint8Array | ArrayBuffer): DocumentInitParameters {
  const resources = `${import.meta.env.BASE_URL}pdfjs/${pdfjs.version}/`
  return {
    data,
    cMapUrl: `${resources}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${resources}standard_fonts/`,
  }
}
