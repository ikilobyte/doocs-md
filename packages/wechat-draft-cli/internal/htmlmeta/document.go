package htmlmeta

import (
	"fmt"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

var titleTags = []string{`h1`, `h2`, `h3`}

type Document struct {
	root *goquery.Selection
}

func Parse(content string) (*Document, error) {
	wrapped := `<!doctype html><html><body><section id="root">` + content + `</section></body></html>`
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(wrapped))
	if err != nil {
		return nil, fmt.Errorf("解析 HTML 失败: %w", err)
	}

	root := doc.Find(`#root`).First()
	if root.Length() == 0 {
		return nil, fmt.Errorf("解析 HTML 失败: 未找到 root 节点")
	}

	return &Document{root: root}, nil
}

func (d *Document) ExtractTitle() (string, error) {
	for _, tagName := range titleTags {
		title := normalizeText(d.root.Find(tagName).First().Text())
		if title != `` {
			return title, nil
		}
	}

	return ``, fmt.Errorf("未找到可用标题，至少需要一个 h1、h2 或 h3")
}

func (d *Document) ImageSources() []string {
	sources := make([]string, 0)
	d.root.Find(`img[src]`).Each(func(_ int, selection *goquery.Selection) {
		src, exists := selection.Attr(`src`)
		if exists && strings.TrimSpace(src) != `` {
			sources = append(sources, src)
		}
	})
	return sources
}

func (d *Document) RewriteImages(rewrite func(src string) (string, error)) (int, error) {
	imageCount := 0
	var rewriteErr error

	d.root.Find(`img[src]`).EachWithBreak(func(_ int, selection *goquery.Selection) bool {
		src, exists := selection.Attr(`src`)
		if !exists || strings.TrimSpace(src) == `` {
			return true
		}

		replaced, err := rewrite(src)
		if err != nil {
			rewriteErr = err
			return false
		}

		selection.SetAttr(`src`, replaced)
		imageCount += 1
		return true
	})

	if rewriteErr != nil {
		return 0, rewriteErr
	}

	return imageCount, nil
}

func (d *Document) HTML() (string, error) {
	content, err := d.root.Html()
	if err != nil {
		return ``, fmt.Errorf("生成 HTML 失败: %w", err)
	}

	return content, nil
}

func normalizeText(value string) string {
	return strings.Join(strings.Fields(value), ` `)
}
