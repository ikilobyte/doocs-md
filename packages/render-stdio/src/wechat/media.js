import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, resolve } from 'node:path'
import { parseHTML } from 'linkedom'
import { fetchWechatJson } from './client.js'

const BODY_IMAGE_MAX_SIZE = 1024 * 1024
const BASE64_DATA_URL_PATTERN = /^data:([^;,]+)?;base64,(.+)$/u
const HTTP_IMAGE_PATTERN = /^https?:\/\//iu
const PROTOCOL_RELATIVE_IMAGE_PATTERN = /^\/\//u
const JPG_MIME_TYPES = new Set([`image/jpeg`, `image/png`])
const MIME_TO_EXTENSION = {
  'image/gif': `.gif`,
  'image/jpeg': `.jpg`,
  'image/jpg': `.jpg`,
  'image/png': `.png`,
  'image/svg+xml': `.svg`,
  'image/webp': `.webp`,
}
const EXTENSION_TO_MIME = {
  '.gif': `image/gif`,
  '.jpeg': `image/jpeg`,
  '.jpg': `image/jpeg`,
  '.png': `image/png`,
  '.svg': `image/svg+xml`,
  '.webp': `image/webp`,
}

function createRootDocument(html = ``) {
  const { document } = parseHTML(`<!doctype html><html><body><section id="root"></section></body></html>`)
  const root = document.getElementById(`root`)
  root.innerHTML = html
  return { document, root }
}

function normalizeRemoteUrl(src) {
  return PROTOCOL_RELATIVE_IMAGE_PATTERN.test(src) ? `https:${src}` : src
}

function inferMimeType(filename, fallbackMimeType = ``) {
  const normalizedFallback = fallbackMimeType.split(`;`)[0].trim().toLowerCase()
  if (normalizedFallback) {
    return normalizedFallback
  }

  return EXTENSION_TO_MIME[extname(filename).toLowerCase()] || `application/octet-stream`
}

function inferFilename(src, mimeType) {
  if (HTTP_IMAGE_PATTERN.test(src) || PROTOCOL_RELATIVE_IMAGE_PATTERN.test(src)) {
    const url = new URL(normalizeRemoteUrl(src))
    const currentName = basename(url.pathname)
    if (currentName) {
      return currentName
    }
  }

  if (src.startsWith(`data:`)) {
    const extension = MIME_TO_EXTENSION[mimeType] || `.bin`
    return `inline-image${extension}`
  }

  return basename(src)
}

async function readRemoteImage(src) {
  const response = await fetch(normalizeRemoteUrl(src))
  if (!response.ok) {
    throw new Error(`下载图片失败: HTTP ${response.status} ${response.statusText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const contentType = response.headers.get(`content-type`) || ``
  const filename = inferFilename(src, contentType)

  return {
    buffer,
    filename,
    mimeType: inferMimeType(filename, contentType),
  }
}

async function readLocalImage(src, contentFilePath) {
  if (!contentFilePath) {
    throw new Error(`无法解析本地图片路径，缺少内容文件路径: ${src}`)
  }

  const resolvedPath = isAbsolute(src) ? src : resolve(dirname(contentFilePath), src)
  const buffer = await readFile(resolvedPath)
  return {
    buffer,
    filename: basename(resolvedPath),
    mimeType: inferMimeType(resolvedPath),
  }
}

function readBase64Image(src) {
  const match = src.match(BASE64_DATA_URL_PATTERN)
  if (!match) {
    throw new Error(`不支持的 data URL 图片格式`)
  }

  const mimeType = (match[1] || `application/octet-stream`).toLowerCase()
  const buffer = Buffer.from(match[2], `base64`)
  return {
    buffer,
    filename: inferFilename(src, mimeType),
    mimeType,
  }
}

async function resolveImageAsset(src, contentFilePath) {
  if (src.startsWith(`data:`)) {
    return readBase64Image(src)
  }

  if (HTTP_IMAGE_PATTERN.test(src) || PROTOCOL_RELATIVE_IMAGE_PATTERN.test(src)) {
    return readRemoteImage(src)
  }

  return readLocalImage(src, contentFilePath)
}

function validateBodyImageAsset(asset, src) {
  if (!JPG_MIME_TYPES.has(asset.mimeType)) {
    throw new Error(`正文图片不符合微信要求，仅支持 jpg/png: ${src}`)
  }

  if (asset.buffer.byteLength >= BODY_IMAGE_MAX_SIZE) {
    throw new Error(`正文图片不符合微信要求，大小必须小于 1MB: ${src}`)
  }
}

async function uploadImage(accessToken, asset, {
  cover = false,
  source = asset.filename,
} = {}) {
  const formData = new FormData()
  const blob = new Blob([asset.buffer], { type: asset.mimeType })
  formData.append(`media`, blob, asset.filename)

  if (!cover) {
    validateBodyImageAsset(asset, source)
  }

  const url = cover
    ? `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${accessToken}&type=image`
    : `https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=${accessToken}`

  const result = await fetchWechatJson(
    url,
    {
      body: formData,
      method: `POST`,
    },
    cover ? `上传封面图` : `上传正文图片`,
  )

  if (cover) {
    if (!result.media_id) {
      throw new Error(`上传封面图失败: 未返回 media_id`)
    }

    return {
      mediaId: result.media_id,
      response: result,
    }
  }

  if (!result.url) {
    throw new Error(`上传正文图片失败: 未返回 url`)
  }

  return {
    response: result,
    url: result.url,
  }
}

export async function migrateContentImages({
  accessToken,
  html,
  contentFilePath,
}) {
  const { root } = createRootDocument(html)
  const imageNodes = [...root.querySelectorAll(`img[src]`)]

  if (imageNodes.length === 0) {
    throw new Error(`上传草稿要求文章至少包含一张图片，用于生成 thumb_media_id`)
  }

  const assetCache = new Map()
  const uploadedUrlCache = new Map()

  const firstImageSource = imageNodes[0].getAttribute(`src`)
  if (!firstImageSource) {
    throw new Error(`封面图片解析失败`)
  }

  const getImageAsset = async (src) => {
    if (!assetCache.has(src)) {
      assetCache.set(src, resolveImageAsset(src, contentFilePath))
    }
    return assetCache.get(src)
  }

  const coverAsset = await getImageAsset(firstImageSource)
  const coverUpload = await uploadImage(accessToken, coverAsset, { cover: true })

  for (const imageNode of imageNodes) {
    const src = imageNode.getAttribute(`src`)
    if (!src) {
      continue
    }

    if (!uploadedUrlCache.has(src)) {
      const asset = await getImageAsset(src)
      const uploaded = await uploadImage(accessToken, asset, { source: src })
      uploadedUrlCache.set(src, uploaded.url)
    }

    imageNode.setAttribute(`src`, uploadedUrlCache.get(src))
  }

  return {
    html: root.innerHTML,
    imageCount: imageNodes.length,
    thumbMediaId: coverUpload.mediaId,
  }
}
