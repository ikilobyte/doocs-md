package cache

import (
	"path/filepath"
	"testing"
	"time"
)

func TestFileCacheSetAndGet(t *testing.T) {
	t.Parallel()

	cachePath := filepath.Join(t.TempDir(), `access_token.json`)
	fileCache := NewFileCache(cachePath)

	if err := fileCache.Set(`token`, `value`, time.Hour); err != nil {
		t.Fatalf("Set() error = %v", err)
	}

	got := fileCache.Get(`token`)
	if got == nil || got.(string) != `value` {
		t.Fatalf("Get() = %v, want value", got)
	}

	if !fileCache.IsExist(`token`) {
		t.Fatalf("IsExist() = false, want true")
	}
}

func TestFileCacheExpiredEntry(t *testing.T) {
	t.Parallel()

	cachePath := filepath.Join(t.TempDir(), `access_token.json`)
	fileCache := NewFileCache(cachePath)

	if err := fileCache.Set(`token`, `value`, 10*time.Millisecond); err != nil {
		t.Fatalf("Set() error = %v", err)
	}

	time.Sleep(30 * time.Millisecond)

	if got := fileCache.Get(`token`); got != nil {
		t.Fatalf("Get() = %v, want nil", got)
	}
}
