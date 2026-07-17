// Command atlas-loader in ra DDL của toàn bộ GORM model để Atlas nạp schema.
// Dùng làm external_schema trong atlas.hcl.
package main

import (
	"fmt"
	"io"
	"os"

	"ariga.io/atlas-provider-gorm/gormschema"

	"github.com/vule96/ultimate-website/services/core/internal/modules/posts"
	"github.com/vule96/ultimate-website/services/core/internal/modules/readers"
	"github.com/vule96/ultimate-website/services/core/internal/platform/outbox"
	"github.com/vule96/ultimate-website/services/core/internal/platform/session"
)

func main() {
	var models []any
	models = append(models, posts.Models()...)
	models = append(models, session.Models()...)
	models = append(models, outbox.Models()...)
	models = append(models, readers.Models()...)

	stmts, err := gormschema.New("postgres").Load(models...)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to load gorm schema: %v\n", err)
		os.Exit(1)
	}
	_, _ = io.WriteString(os.Stdout, stmts)
}
