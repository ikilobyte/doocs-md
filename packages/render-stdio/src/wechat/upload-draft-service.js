import { readFile } from 'node:fs/promises'
import { resolveWechatAccessToken } from './auth.js'
import { isWechatAccessTokenError } from './client.js'
import { addWechatDraft } from './draft.js'
import { migrateContentImages } from './media.js'
import { extractArticleTitle } from './title.js'

async function uploadDraftOnce({
  accessToken,
  appid,
  contentFilePath,
  forceRefresh = false,
  html,
  secret,
}) {
  const title = extractArticleTitle(html)
  const authResult = await resolveWechatAccessToken({
    accessToken,
    appid,
    forceRefresh,
    secret,
  })

  const migratedImages = await migrateContentImages({
    accessToken: authResult.accessToken,
    contentFilePath,
    html,
  })

  const response = await addWechatDraft({
    accessToken: authResult.accessToken,
    content: migratedImages.html,
    thumbMediaId: migratedImages.thumbMediaId,
    title,
  })

  return {
    image_count: migratedImages.imageCount,
    media_id: response.media_id || null,
    mode: `draft`,
    response,
    thumb_media_id: migratedImages.thumbMediaId,
    title,
    token_source: authResult.source,
  }
}

function validateHtmlContent(html) {
  if (typeof html !== `string` || html.trim() === ``) {
    throw new Error(`上传内容不能为空`)
  }
}

export async function createWechatDraft({
  accessToken,
  appid,
  contentFilePath,
  html,
  secret,
}) {
  validateHtmlContent(html)

  try {
    return await uploadDraftOnce({
      accessToken,
      appid,
      contentFilePath,
      html,
      secret,
    })
  }
  catch (error) {
    if (!accessToken && appid && secret && isWechatAccessTokenError(error)) {
      return uploadDraftOnce({
        accessToken,
        appid,
        contentFilePath,
        forceRefresh: true,
        html,
        secret,
      })
    }

    throw error
  }
}

export async function createWechatDraftFromFile({
  accessToken,
  appid,
  filepath,
  secret,
}) {
  const html = await readFile(filepath, `utf8`)

  return createWechatDraft({
    accessToken,
    appid,
    contentFilePath: filepath,
    html,
    secret,
  })
}
