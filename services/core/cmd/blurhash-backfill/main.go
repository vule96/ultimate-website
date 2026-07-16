// Command blurhash-backfill tính blurhash cho các bài đã có cover_image nhưng
// chưa có cover_blurhash (bài tạo trước Slice 9). Chạy tay hoặc cron.
//
// Bài học bounded concurrency: errgroup.SetLimit(4) — tối đa 4 goroutine tải
// ảnh song song, không nghẽn mạng/DB dù có hàng nghìn bài.
package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
	"golang.org/x/sync/errgroup"

	"github.com/vule96/ultimate-website/services/core/internal/platform/blurhash"
	"github.com/vule96/ultimate-website/services/core/internal/platform/config"
	"github.com/vule96/ultimate-website/services/core/internal/platform/database"
	"github.com/vule96/ultimate-website/services/core/internal/platform/logger"
)

type row struct {
	ID         uuid.UUID
	CoverImage string
}

func main() {
	_ = godotenv.Load()
	cfg, err := config.Load()
	if err != nil {
		panic(err)
	}
	log := logger.New(cfg.IsProduction(), cfg.LogLevel)

	db, err := database.Open(cfg.DatabaseURL, cfg.IsProduction())
	if err != nil {
		log.Error("connect database failed", "err", err)
		os.Exit(1)
	}

	var rows []row
	if err := db.Table("posts").
		Select("id", "cover_image").
		Where("cover_image IS NOT NULL AND cover_image <> '' AND cover_blurhash IS NULL").
		Scan(&rows).Error; err != nil {
		log.Error("query posts failed", "err", err)
		os.Exit(1)
	}
	if len(rows) == 0 {
		log.Info("backfill: không có bài nào cần tính blurhash")
		return
	}
	log.Info("backfill: bắt đầu", "posts", len(rows))

	fetcher := blurhash.NewHTTPFetcher(cfg.BlurhashFetchTimeout, cfg.BlurhashMaxBytes, cfg.BlurhashFetchAllowlist())
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	g, ctx := errgroup.WithContext(ctx)
	g.SetLimit(4) // bounded concurrency — tối đa 4 job song song

	var okCount, failCount int
	for _, r := range rows {
		g.Go(func() error {
			data, err := fetcher.Fetch(ctx, r.CoverImage)
			if err != nil {
				log.Warn("backfill: fetch failed", "id", r.ID, "err", err)
				failCount++
				return nil // lỗi 1 bài không dừng cả đợt
			}
			hash, err := blurhash.Encode(data)
			if err != nil {
				log.Warn("backfill: encode failed", "id", r.ID, "err", err)
				failCount++
				return nil
			}
			if err := db.WithContext(ctx).Table("posts").Where("id = ?", r.ID).
				UpdateColumn("cover_blurhash", hash).Error; err != nil {
				log.Warn("backfill: store failed", "id", r.ID, "err", err)
				failCount++
				return nil
			}
			okCount++
			return nil
		})
	}
	_ = g.Wait()

	log.Info("backfill: xong", "ok", okCount, "failed", failCount)
	if failCount > 0 {
		fmt.Fprintf(os.Stderr, "backfill: %d bài lỗi\n", failCount)
		os.Exit(1)
	}
}
