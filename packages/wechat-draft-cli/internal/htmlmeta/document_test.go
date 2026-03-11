package htmlmeta

import (
	"strings"
	"testing"
)

func TestExtractTitleFallback(t *testing.T) {
	t.Parallel()

	doc, err := Parse(`<p>hello</p><h2>  Draft   Title </h2>`)
	if err != nil {
		t.Fatalf("Parse() error = %v", err)
	}

	title, err := doc.ExtractTitle()
	if err != nil {
		t.Fatalf("ExtractTitle() error = %v", err)
	}

	if title != `Draft Title` {
		t.Fatalf("ExtractTitle() = %q, want %q", title, `Draft Title`)
	}
}

func TestRewriteImages(t *testing.T) {
	t.Parallel()

	doc, err := Parse(`<h1>Title</h1><img src="a.png"><img src="b.png">`)
	if err != nil {
		t.Fatalf("Parse() error = %v", err)
	}

	imageCount, err := doc.RewriteImages(func(src string) (string, error) {
		return `https://example.com/` + src, nil
	})
	if err != nil {
		t.Fatalf("RewriteImages() error = %v", err)
	}

	if imageCount != 2 {
		t.Fatalf("RewriteImages() count = %d, want 2", imageCount)
	}

	content, err := doc.HTML()
	if err != nil {
		t.Fatalf("HTML() error = %v", err)
	}

	if !strings.Contains(content, `https://example.com/a.png`) {
		t.Fatalf("HTML() missing rewritten src: %s", content)
	}
}
