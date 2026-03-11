import { fetchWechatJson } from './client.js'
import {
  clearCachedAccessToken,
  loadCachedAccessToken,
  saveCachedAccessToken,
} from './token-cache.js'

async function requestStableAccessToken(appid, secret, forceRefresh = false) {
  return fetchWechatJson(
    `https://api.weixin.qq.com/cgi-bin/stable_token`,
    {
      body: JSON.stringify({
        appid,
        force_refresh: forceRefresh,
        grant_type: `client_credential`,
        secret,
      }),
      headers: {
        'content-type': `application/json`,
      },
      method: `POST`,
    },
    `获取 stable access_token`,
  )
}

async function requestLegacyAccessToken(appid, secret) {
  const url = new URL(`https://api.weixin.qq.com/cgi-bin/token`)
  url.searchParams.set(`grant_type`, `client_credential`)
  url.searchParams.set(`appid`, appid)
  url.searchParams.set(`secret`, secret)

  return fetchWechatJson(url, { method: `GET` }, `获取 access_token`)
}

export async function resolveWechatAccessToken({
  accessToken,
  appid,
  secret,
  forceRefresh = false,
}) {
  if (accessToken) {
    return {
      accessToken,
      source: `provided`,
    }
  }

  if (!forceRefresh) {
    const cachedToken = await loadCachedAccessToken(appid)
    if (cachedToken) {
      return cachedToken
    }
  }
  else {
    await clearCachedAccessToken(appid)
  }

  let stableError
  try {
    const result = await requestStableAccessToken(appid, secret, forceRefresh)
    if (result.access_token) {
      await saveCachedAccessToken(appid, {
        accessToken: result.access_token,
        expiresIn: result.expires_in,
        source: `stable_token`,
      })
      return {
        accessToken: result.access_token,
        expiresIn: result.expires_in,
        source: `stable_token`,
      }
    }
  }
  catch (error) {
    stableError = error
  }

  try {
    const result = await requestLegacyAccessToken(appid, secret)
    if (result.access_token) {
      await saveCachedAccessToken(appid, {
        accessToken: result.access_token,
        expiresIn: result.expires_in,
        source: `token`,
      })
      return {
        accessToken: result.access_token,
        expiresIn: result.expires_in,
        source: `token`,
      }
    }
  }
  catch (error) {
    const stableMessage = stableError instanceof Error ? stableError.message : String(stableError || ``)
    const legacyMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`获取 access_token 失败: ${legacyMessage}${stableMessage ? `; stable_token: ${stableMessage}` : ``}`)
  }

  throw new Error(`获取 access_token 失败`)
}
