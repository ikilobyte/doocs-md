package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"

	appconfig "github.com/doocs/md/packages/wechat-draft-cli/internal/config"
	"github.com/doocs/md/packages/wechat-draft-cli/internal/wechat"
)

func main() {
	if err := run(context.Background(), os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, err.Error())
		os.Exit(1)
	}
}

func run(ctx context.Context, args []string) error {
	fs := flag.NewFlagSet(`wechat-draft-cli`, flag.ContinueOnError)
	fs.SetOutput(os.Stderr)

	var (
		configPath string
		filePath   string
	)

	fs.StringVar(&filePath, `filepath`, ``, `渲染后 HTML 文件路径`)
	fs.StringVar(&configPath, `config`, `config.yaml`, `配置文件路径`)

	if err := fs.Parse(args); err != nil {
		return err
	}

	if filePath == `` {
		return errors.New(`缺少 --filepath 参数`)
	}

	cfg, err := appconfig.Load(configPath)
	if err != nil {
		return err
	}

	uploader, err := wechat.NewUploader(cfg)
	if err != nil {
		return err
	}

	result, err := uploader.UploadHTMLFile(ctx, filePath)
	if err != nil {
		return err
	}

	encoder := json.NewEncoder(os.Stdout)
	encoder.SetEscapeHTML(false)
	encoder.SetIndent(``, `  `)

	return encoder.Encode(result)
}
