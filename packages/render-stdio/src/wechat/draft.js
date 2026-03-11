import { fetchWechatJson } from './client.js'

export async function addWechatDraft({
  accessToken,
  content,
  thumbMediaId,
  title,
}) {
  return fetchWechatJson(
    `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${accessToken}`,
    {
      body: JSON.stringify({
        articles: [
          {
            content,
            need_open_comment: 0,
            only_fans_can_comment: 0,
            thumb_media_id: thumbMediaId,
            title,
          },
        ],
      }),
      headers: {
        'content-type': `application/json`,
      },
      method: `POST`,
    },
    `新增草稿`,
  )
}
