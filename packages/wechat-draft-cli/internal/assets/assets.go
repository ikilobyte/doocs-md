package assets

import (
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"
)

const bodyImageMaxSize = 1024 * 1024

var (
	base64DataURLPattern         = regexp.MustCompile(`^data:([^;,]+)?;base64,(.+)$`)
	httpImagePattern             = regexp.MustCompile(`^https?://`)
	protocolRelativeImagePattern = regexp.MustCompile(`^//`)
)

var mimeToExtension = map[string]string{
	`image/gif`:     `.gif`,
	`image/jpeg`:    `.jpg`,
	`image/jpg`:     `.jpg`,
	`image/png`:     `.png`,
	`image/svg+xml`: `.svg`,
	`image/webp`:    `.webp`,
}

type Asset struct {
	ContentType string
	Data        []byte
	Filename    string
	Source      string
}

func Load(ctx context.Context, source string, contentFilePath string) (*Asset, error) {
	switch {
	case strings.HasPrefix(source, `data:`):
		return loadBase64(source)
	case httpImagePattern.MatchString(source) || protocolRelativeImagePattern.MatchString(source):
		return loadRemote(ctx, source)
	default:
		return loadLocal(source, contentFilePath)
	}
}

func ValidateBodyImage(asset *Asset) error {
	if asset.ContentType != `image/jpeg` && asset.ContentType != `image/png` {
		return fmt.Errorf("正文图片不符合微信要求，仅支持 jpg/png: %s", asset.Source)
	}

	if len(asset.Data) >= bodyImageMaxSize {
		return fmt.Errorf("正文图片不符合微信要求，大小必须小于 1MB: %s", asset.Source)
	}

	return nil
}

func WriteTempFile(tempDir string, asset *Asset) (string, error) {
	ext := filepath.Ext(asset.Filename)
	pattern := `wechat-asset-*`
	if ext != `` {
		pattern += ext
	}

	file, err := os.CreateTemp(tempDir, pattern)
	if err != nil {
		return ``, fmt.Errorf("创建临时文件失败: %w", err)
	}

	tempPath := file.Name()
	if _, err := file.Write(asset.Data); err != nil {
		_ = file.Close()
		_ = os.Remove(tempPath)
		return ``, fmt.Errorf("写入临时文件失败: %w", err)
	}

	if err := file.Close(); err != nil {
		_ = os.Remove(tempPath)
		return ``, fmt.Errorf("关闭临时文件失败: %w", err)
	}

	return tempPath, nil
}

func loadBase64(source string) (*Asset, error) {
	matches := base64DataURLPattern.FindStringSubmatch(source)
	if len(matches) != 3 {
		return nil, fmt.Errorf("不支持的 data URL 图片格式")
	}

	contentType := sanitizeContentType(matches[1])
	data, err := base64.StdEncoding.DecodeString(matches[2])
	if err != nil {
		return nil, fmt.Errorf("解析 base64 图片失败: %w", err)
	}

	filename := `inline-image` + inferExtension(``, contentType, data)

	return &Asset{
		ContentType: normalizeContentType(contentType, filename, data),
		Data:        data,
		Filename:    filename,
		Source:      source,
	}, nil
}

func loadRemote(ctx context.Context, source string) (*Asset, error) {
	normalizedSource := normalizeRemoteURL(source)
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, normalizedSource, nil)
	if err != nil {
		return nil, fmt.Errorf("创建图片下载请求失败: %w", err)
	}

	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return nil, fmt.Errorf("下载图片失败: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, fmt.Errorf("下载图片失败: HTTP %d", response.StatusCode)
	}

	data, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, fmt.Errorf("读取远程图片失败: %w", err)
	}

	contentType := sanitizeContentType(response.Header.Get(`Content-Type`))
	filename := inferRemoteFilename(normalizedSource, contentType, data)

	return &Asset{
		ContentType: normalizeContentType(contentType, filename, data),
		Data:        data,
		Filename:    filename,
		Source:      source,
	}, nil
}

func loadLocal(source string, contentFilePath string) (*Asset, error) {
	if contentFilePath == `` {
		return nil, fmt.Errorf("无法解析本地图片路径，缺少内容文件路径: %s", source)
	}

	resolvedPath := source
	if !filepath.IsAbs(resolvedPath) {
		resolvedPath = filepath.Join(filepath.Dir(contentFilePath), source)
	}

	data, err := os.ReadFile(resolvedPath)
	if err != nil {
		return nil, fmt.Errorf("读取本地图片失败: %w", err)
	}

	filename := filepath.Base(resolvedPath)
	contentType := inferContentType(filename, ``, data)

	return &Asset{
		ContentType: contentType,
		Data:        data,
		Filename:    filename,
		Source:      source,
	}, nil
}

func inferRemoteFilename(source string, contentType string, data []byte) string {
	parsedURL, err := url.Parse(source)
	if err == nil {
		currentName := path.Base(parsedURL.Path)
		if currentName != `` && currentName != `.` && currentName != `/` {
			return currentName
		}
	}

	return `remote-image` + inferExtension(``, contentType, data)
}

func normalizeRemoteURL(source string) string {
	if protocolRelativeImagePattern.MatchString(source) {
		return `https:` + source
	}
	return source
}

func sanitizeContentType(contentType string) string {
	if contentType == `` {
		return ``
	}

	return strings.ToLower(strings.TrimSpace(strings.Split(contentType, `;`)[0]))
}

func normalizeContentType(contentType string, filename string, data []byte) string {
	return inferContentType(filename, contentType, data)
}

func inferContentType(filename string, fallback string, data []byte) string {
	if fallback != `` {
		return fallback
	}

	if inferred := mime.TypeByExtension(strings.ToLower(filepath.Ext(filename))); inferred != `` {
		return sanitizeContentType(inferred)
	}

	if len(data) > 0 {
		return sanitizeContentType(http.DetectContentType(data))
	}

	return `application/octet-stream`
}

func inferExtension(filename string, contentType string, data []byte) string {
	if ext := strings.ToLower(filepath.Ext(filename)); ext != `` {
		return ext
	}

	if ext := mimeToExtension[inferContentType(filename, contentType, data)]; ext != `` {
		return ext
	}

	return `.bin`
}
