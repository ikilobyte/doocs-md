package config

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

const defaultAccessTokenFile = `.cache/wechat/access_token.json`

type Config struct {
	Cache  CacheConfig  `yaml:"cache"`
	Draft  DraftConfig  `yaml:"draft"`
	Wechat WechatConfig `yaml:"wechat"`

	configPath string
}

type WechatConfig struct {
	AppID       string `yaml:"app_id"`
	AppSecret   string `yaml:"app_secret"`
	UseStableAK bool   `yaml:"use_stable_ak"`
}

type CacheConfig struct {
	AccessTokenFile string `yaml:"access_token_file"`
}

type DraftConfig struct {
	NeedOpenComment    uint `yaml:"need_open_comment"`
	OnlyFansCanComment uint `yaml:"only_fans_can_comment"`
	ShowCoverPic       uint `yaml:"show_cover_pic"`
}

func Load(path string) (*Config, error) {
	resolvedPath, err := filepath.Abs(path)
	if err != nil {
		return nil, fmt.Errorf("解析配置文件路径失败: %w", err)
	}

	content, err := os.ReadFile(resolvedPath)
	if err != nil {
		return nil, fmt.Errorf("读取配置文件失败: %w", err)
	}

	cfg := &Config{
		Cache: CacheConfig{
			AccessTokenFile: defaultAccessTokenFile,
		},
		Wechat: WechatConfig{
			UseStableAK: true,
		},
		configPath: resolvedPath,
	}

	if err := yaml.Unmarshal(content, cfg); err != nil {
		return nil, fmt.Errorf("解析配置文件失败: %w", err)
	}

	if err := cfg.applyDefaults(); err != nil {
		return nil, err
	}

	if err := cfg.validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

func (c *Config) applyDefaults() error {
	if c.Cache.AccessTokenFile == `` {
		c.Cache.AccessTokenFile = defaultAccessTokenFile
	}

	if !filepath.IsAbs(c.Cache.AccessTokenFile) {
		c.Cache.AccessTokenFile = filepath.Join(filepath.Dir(c.configPath), c.Cache.AccessTokenFile)
	}

	resolvedCachePath, err := filepath.Abs(c.Cache.AccessTokenFile)
	if err != nil {
		return fmt.Errorf("解析 access_token 缓存路径失败: %w", err)
	}

	c.Cache.AccessTokenFile = resolvedCachePath
	return nil
}

func (c *Config) validate() error {
	if c.Wechat.AppID == `` {
		return fmt.Errorf("config.yaml 缺少 wechat.app_id")
	}

	if c.Wechat.AppSecret == `` {
		return fmt.Errorf("config.yaml 缺少 wechat.app_secret")
	}

	if c.Draft.ShowCoverPic > 1 {
		return fmt.Errorf("draft.show_cover_pic 只能为 0 或 1")
	}

	if c.Draft.NeedOpenComment > 1 {
		return fmt.Errorf("draft.need_open_comment 只能为 0 或 1")
	}

	if c.Draft.OnlyFansCanComment > 1 {
		return fmt.Errorf("draft.only_fans_can_comment 只能为 0 或 1")
	}

	return nil
}
