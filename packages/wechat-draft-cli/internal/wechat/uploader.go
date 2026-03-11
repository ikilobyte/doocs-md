package wechat

import (
	"context"
	"fmt"
	"os"
	"regexp"
	"strings"

	"github.com/doocs/md/packages/wechat-draft-cli/internal/assets"
	filecache "github.com/doocs/md/packages/wechat-draft-cli/internal/cache"
	appconfig "github.com/doocs/md/packages/wechat-draft-cli/internal/config"
	"github.com/doocs/md/packages/wechat-draft-cli/internal/htmlmeta"
	silencewechat "github.com/silenceper/wechat/v2"
	offConfig "github.com/silenceper/wechat/v2/officialaccount/config"
	"github.com/silenceper/wechat/v2/officialaccount/draft"
	"github.com/silenceper/wechat/v2/officialaccount/material"
)

var accessTokenErrorPattern = regexp.MustCompile(`errcode=(40001|40014|42001)`)

type Result struct {
	ImageCount   int    `json:"image_count"`
	MediaID      string `json:"media_id"`
	Mode         string `json:"mode"`
	ThumbMediaID string `json:"thumb_media_id"`
	Title        string `json:"title"`
}

type Uploader struct {
	cache    *filecache.FileCache
	config   *appconfig.Config
	draftAPI *draft.Draft
	material *material.Material
}

func NewUploader(cfg *appconfig.Config) (*Uploader, error) {
	tokenCache := filecache.NewFileCache(cfg.Cache.AccessTokenFile)
	wechatClient := silencewechat.NewWechat()
	officialAccount := wechatClient.GetOfficialAccount(&offConfig.Config{
		AppID:       cfg.Wechat.AppID,
		AppSecret:   cfg.Wechat.AppSecret,
		Cache:       tokenCache,
		UseStableAK: cfg.Wechat.UseStableAK,
	})

	return &Uploader{
		cache:    tokenCache,
		config:   cfg,
		draftAPI: officialAccount.GetDraft(),
		material: officialAccount.GetMaterial(),
	}, nil
}

func (u *Uploader) UploadHTMLFile(ctx context.Context, filePath string) (*Result, error) {
	result, err := u.uploadHTMLFile(ctx, filePath)
	if err == nil {
		return result, nil
	}

	if !isAccessTokenError(err) {
		return nil, err
	}

	if clearErr := u.cache.Clear(); clearErr != nil {
		return nil, fmt.Errorf("%w; 清理 access_token 缓存失败: %v", err, clearErr)
	}

	return u.uploadHTMLFile(ctx, filePath)
}

func (u *Uploader) uploadHTMLFile(ctx context.Context, filePath string) (*Result, error) {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("读取 HTML 文件失败: %w", err)
	}

	if strings.TrimSpace(string(content)) == `` {
		return nil, fmt.Errorf("上传内容不能为空")
	}

	document, err := htmlmeta.Parse(string(content))
	if err != nil {
		return nil, err
	}

	title, err := document.ExtractTitle()
	if err != nil {
		return nil, err
	}

	imageSources := document.ImageSources()
	if len(imageSources) == 0 {
		return nil, fmt.Errorf("上传草稿要求文章至少包含一张图片，用于生成 thumb_media_id")
	}

	coverSource := imageSources[0]
	tempDir, err := os.MkdirTemp(``, `wechat-draft-cli-*`)
	if err != nil {
		return nil, fmt.Errorf("创建临时目录失败: %w", err)
	}
	defer os.RemoveAll(tempDir)

	uploadedURLs := make(map[string]string)
	var thumbMediaID string

	imageCount, err := document.RewriteImages(func(src string) (string, error) {
		if uploadedURL, ok := uploadedURLs[src]; ok {
			return uploadedURL, nil
		}

		asset, err := assets.Load(ctx, src, filePath)
		if err != nil {
			return ``, err
		}

		tempPath, err := assets.WriteTempFile(tempDir, asset)
		if err != nil {
			return ``, err
		}

		if err := assets.ValidateBodyImage(asset); err != nil {
			return ``, err
		}

		if thumbMediaID == `` && src == coverSource {
			mediaID, _, err := u.material.AddMaterial(material.MediaTypeImage, tempPath)
			if err != nil {
				return ``, fmt.Errorf("上传封面图失败: %w", err)
			}
			thumbMediaID = mediaID
		}

		uploadedURL, err := u.material.ImageUpload(tempPath)
		if err != nil {
			return ``, fmt.Errorf("上传正文图片失败: %w", err)
		}

		uploadedURLs[src] = uploadedURL
		return uploadedURL, nil
	})
	if err != nil {
		return nil, err
	}

	rewrittenHTML, err := document.HTML()
	if err != nil {
		return nil, err
	}

	mediaID, err := u.draftAPI.AddDraft([]*draft.Article{
		{
			Content:            rewrittenHTML,
			NeedOpenComment:    u.config.Draft.NeedOpenComment,
			OnlyFansCanComment: u.config.Draft.OnlyFansCanComment,
			ShowCoverPic:       u.config.Draft.ShowCoverPic,
			ThumbMediaID:       thumbMediaID,
			Title:              title,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("创建草稿失败: %w", err)
	}

	return &Result{
		ImageCount:   imageCount,
		MediaID:      mediaID,
		Mode:         `draft`,
		ThumbMediaID: thumbMediaID,
		Title:        title,
	}, nil
}

func isAccessTokenError(err error) bool {
	if err == nil {
		return false
	}

	return accessTokenErrorPattern.MatchString(err.Error())
}
