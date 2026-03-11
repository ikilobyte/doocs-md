import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'

const CACHE_DIRECTORY_NAME = `md-codex`
const CACHE_FILE_NAME = `wechat-access-token.json`
const REFRESH_WINDOW_MS = 10 * 60 * 1000

function isObject(value) {
  return value && typeof value === `object` && !Array.isArray(value)
}

function getCacheRootDirectory() {
  if (process.platform === `darwin`) {
    return join(homedir(), `Library`, `Caches`)
  }

  if (process.platform === `win32`) {
    return process.env.LOCALAPPDATA || join(homedir(), `AppData`, `Local`)
  }

  return process.env.XDG_CACHE_HOME || join(homedir(), `.cache`)
}

export function getWechatTokenCachePath() {
  return join(getCacheRootDirectory(), CACHE_DIRECTORY_NAME, CACHE_FILE_NAME)
}

async function readCacheStore() {
  const cachePath = getWechatTokenCachePath()

  try {
    const content = await readFile(cachePath, `utf8`)
    if (!content.trim()) {
      return {}
    }

    const parsed = JSON.parse(content)
    return isObject(parsed) ? parsed : {}
  }
  catch (error) {
    if (error?.code === `ENOENT` || error instanceof SyntaxError) {
      return {}
    }

    throw error
  }
}

async function writeCacheStore(store) {
  const cachePath = getWechatTokenCachePath()
  const tempPath = `${cachePath}.${process.pid}.${Date.now()}.tmp`

  await mkdir(dirname(cachePath), { recursive: true })

  try {
    await writeFile(tempPath, `${JSON.stringify(store, null, 2)}\n`, `utf8`)
    await rename(tempPath, cachePath)
  }
  finally {
    await rm(tempPath, { force: true }).catch(() => {})
  }
}

function normalizeCacheEntry(entry) {
  if (!isObject(entry)) {
    return null
  }

  const accessToken = typeof entry.accessToken === `string`
    ? entry.accessToken.trim()
    : ``
  const expiresAt = Number(entry.expiresAt)
  const updatedAt = Number(entry.updatedAt)
  const source = typeof entry.source === `string` ? entry.source : null

  if (!accessToken || !Number.isFinite(expiresAt)) {
    return null
  }

  return {
    accessToken,
    expiresAt,
    source,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : null,
  }
}

export async function loadCachedAccessToken(appid) {
  if (!appid) {
    return null
  }

  const store = await readCacheStore()
  const entry = normalizeCacheEntry(store[appid])

  if (!entry) {
    return null
  }

  const remainingMs = entry.expiresAt - Date.now()

  if (remainingMs <= REFRESH_WINDOW_MS) {
    return null
  }

  return {
    accessToken: entry.accessToken,
    expiresIn: Math.max(0, Math.floor(remainingMs / 1000)),
    source: `cache`,
  }
}

export async function saveCachedAccessToken(appid, {
  accessToken,
  expiresIn,
  source,
}) {
  if (!appid || typeof accessToken !== `string` || !accessToken.trim()) {
    return
  }

  const expiresInMs = Number(expiresIn) * 1000
  if (!Number.isFinite(expiresInMs) || expiresInMs <= 0) {
    return
  }

  const store = await readCacheStore()
  const now = Date.now()

  store[appid] = {
    accessToken: accessToken.trim(),
    expiresAt: now + expiresInMs,
    source: typeof source === `string` ? source : `token`,
    updatedAt: now,
  }

  await writeCacheStore(store)
}

export async function clearCachedAccessToken(appid) {
  if (!appid) {
    return
  }

  const store = await readCacheStore()

  if (!Object.hasOwn(store, appid)) {
    return
  }

  delete store[appid]
  await writeCacheStore(store)
}
