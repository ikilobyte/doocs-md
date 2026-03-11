const ACCESS_TOKEN_ERROR_CODES = new Set([40001, 40014, 42001])

export class WechatApiError extends Error {
  constructor(message, {
    errcode = null,
    errmsg = null,
    status = null,
  } = {}) {
    super(message)
    this.name = `WechatApiError`
    this.errcode = errcode
    this.errmsg = errmsg
    this.status = status
  }
}

export function isWechatAccessTokenError(error) {
  return error instanceof WechatApiError
    && typeof error.errcode === `number`
    && ACCESS_TOKEN_ERROR_CODES.has(error.errcode)
}

async function parseJsonResponse(response, label) {
  const text = await response.text()

  let data
  try {
    data = text ? JSON.parse(text) : {}
  }
  catch {
    throw new Error(`${label} 返回了非 JSON 响应: ${text.slice(0, 200)}`)
  }

  if (!response.ok) {
    const message = data?.errmsg || response.statusText || text
    throw new WechatApiError(
      `${label} 失败: HTTP ${response.status} ${message}`,
      {
        errcode: typeof data?.errcode === `number` ? data.errcode : null,
        errmsg: data?.errmsg || null,
        status: response.status,
      },
    )
  }

  if (typeof data?.errcode === `number` && data.errcode !== 0) {
    throw new WechatApiError(
      `${label} 失败: ${data.errcode} ${data.errmsg || `unknown error`}`,
      {
        errcode: data.errcode,
        errmsg: data.errmsg || null,
        status: response.status,
      },
    )
  }

  return data
}

export async function fetchWechatJson(url, init, label) {
  const response = await fetch(url, init)
  return parseJsonResponse(response, label)
}
