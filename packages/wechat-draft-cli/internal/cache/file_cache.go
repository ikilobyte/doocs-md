package cache

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type FileCache struct {
	mu   sync.Mutex
	path string
}

type store map[string]entry

type entry struct {
	ExpiresAt time.Time `json:"expires_at"`
	Value     string    `json:"value"`
}

func NewFileCache(path string) *FileCache {
	return &FileCache{path: path}
}

func (c *FileCache) Get(key string) interface{} {
	c.mu.Lock()
	defer c.mu.Unlock()

	currentStore, err := c.loadStoreLocked()
	if err != nil {
		return nil
	}

	currentEntry, ok := currentStore[key]
	if !ok {
		return nil
	}

	if currentEntry.isExpired() {
		delete(currentStore, key)
		_ = c.writeStoreLocked(currentStore)
		return nil
	}

	return currentEntry.Value
}

func (c *FileCache) IsExist(key string) bool {
	return c.Get(key) != nil
}

func (c *FileCache) Set(key string, val interface{}, timeout time.Duration) error {
	normalizedValue, err := normalizeValue(val)
	if err != nil {
		return err
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	currentStore, err := c.loadStoreLocked()
	if err != nil {
		return err
	}

	currentStore[key] = entry{
		ExpiresAt: time.Now().Add(timeout),
		Value:     normalizedValue,
	}

	return c.writeStoreLocked(currentStore)
}

func (c *FileCache) Delete(key string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	currentStore, err := c.loadStoreLocked()
	if err != nil {
		return err
	}

	delete(currentStore, key)
	return c.writeStoreLocked(currentStore)
}

func (c *FileCache) Clear() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.writeStoreLocked(store{})
}

func normalizeValue(val interface{}) (string, error) {
	switch typed := val.(type) {
	case string:
		return typed, nil
	case []byte:
		return string(typed), nil
	default:
		return ``, fmt.Errorf("不支持的缓存值类型: %T", val)
	}
}

func (e entry) isExpired() bool {
	return !e.ExpiresAt.IsZero() && e.ExpiresAt.Before(time.Now())
}

func (c *FileCache) loadStoreLocked() (store, error) {
	content, err := os.ReadFile(c.path)
	if err != nil {
		if os.IsNotExist(err) {
			return store{}, nil
		}
		return nil, err
	}

	if len(content) == 0 {
		return store{}, nil
	}

	currentStore := store{}
	if err := json.Unmarshal(content, &currentStore); err != nil {
		return store{}, nil
	}

	cleanupRequired := false
	for key, currentEntry := range currentStore {
		if currentEntry.isExpired() {
			delete(currentStore, key)
			cleanupRequired = true
		}
	}

	if cleanupRequired {
		if err := c.writeStoreLocked(currentStore); err != nil {
			return nil, err
		}
	}

	return currentStore, nil
}

func (c *FileCache) writeStoreLocked(currentStore store) error {
	if err := os.MkdirAll(filepath.Dir(c.path), 0o755); err != nil {
		return err
	}

	content, err := json.MarshalIndent(currentStore, ``, `  `)
	if err != nil {
		return err
	}

	tempFile, err := os.CreateTemp(filepath.Dir(c.path), `wechat-access-token-*.tmp`)
	if err != nil {
		return err
	}

	tempPath := tempFile.Name()
	if _, err := tempFile.Write(append(content, '\n')); err != nil {
		_ = tempFile.Close()
		_ = os.Remove(tempPath)
		return err
	}

	if err := tempFile.Close(); err != nil {
		_ = os.Remove(tempPath)
		return err
	}

	if err := os.Rename(tempPath, c.path); err != nil {
		_ = os.Remove(tempPath)
		return err
	}

	return nil
}
