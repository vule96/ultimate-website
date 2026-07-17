// Command blurhash-backfill tính blurhash cho các bài đã có cover_image nhưng
// chưa có cover_blurhash (bài tạo trước Slice 9). Chạy tay hoặc cron.
//
// Bài học bounded concurrency: errgroup.SetLimit(4) — tối đa 4 goroutine tải
// ảnh song song, không nghẽn mạng/DB dù có hàng nghìn bài.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sync/atomic"
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
	// KHÔNG return sớm khi pass 1 rỗng — pass 2 (content) vẫn phải chạy.
	log.Info("backfill cover: bắt đầu", "posts", len(rows))

	fetcher := blurhash.NewHTTPFetcher(cfg.BlurhashFetchTimeout, cfg.BlurhashMaxBytes, cfg.BlurhashFetchAllowlist())
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(4) // bounded concurrency — tối đa 4 job song song

	var okCount, failCount atomic.Int64
	for _, r := range rows {
		g.Go(func() error {
			data, err := fetcher.Fetch(gctx, r.CoverImage)
			if err != nil {
				log.Warn("backfill: fetch failed", "id", r.ID, "err", err)
				failCount.Add(1)
				return nil // lỗi 1 bài không dừng cả đợt
			}
			hash, err := blurhash.Encode(data)
			if err != nil {
				log.Warn("backfill: encode failed", "id", r.ID, "err", err)
				failCount.Add(1)
				return nil
			}
			if err := db.WithContext(gctx).Table("posts").Where("id = ?", r.ID).
				UpdateColumn("cover_blurhash", hash).Error; err != nil {
				log.Warn("backfill: store failed", "id", r.ID, "err", err)
				failCount.Add(1)
				return nil
			}
			okCount.Add(1)
			return nil
		})
	}
	_ = g.Wait()

	// ── Pass 2: meta ảnh trong content (Slice 12) ──────────────────
	var contentRows []struct {
		ID          uuid.UUID
		ContentHTML string
	}
	if err := db.Table("posts").
		Select("id", "content_html").
		Where("content_html LIKE '%<img%' AND content_image_meta IS NULL").
		Scan(&contentRows).Error; err != nil {
		log.Error("query content rows failed", "err", err)
		os.Exit(1)
	}
	log.Info("backfill content: bắt đầu", "posts", len(contentRows))
	var contentOK, contentFail atomic.Int64
	g2, ctx2 := errgroup.WithContext(ctx)
	g2.SetLimit(4)
	for _, r := range contentRows {
		g2.Go(func() error {
			meta := map[string]any{}
			for _, src := range blurhash.ExtractImgSrcs(r.ContentHTML) {
				data, err := fetcher.Fetch(ctx2, src)
				if err != nil {
					log.Warn("backfill content: fetch failed", "id", r.ID, "src", src, "err", err)
					continue
				}
				m, err := blurhash.EncodeMeta(data)
				if err != nil {
					log.Warn("backfill content: encode failed", "id", r.ID, "src", src, "err", err)
					continue
				}
				meta[src] = map[string]any{"w": m.W, "h": m.H, "ph": m.PlaceholderPNG}
			}
			if len(meta) == 0 {
				contentFail.Add(1)
				return nil
			}
			raw, _ := json.Marshal(meta)
			if err := db.WithContext(ctx2).Table("posts").Where("id = ?", r.ID).
				UpdateColumn("content_image_meta", raw).Error; err != nil {
				log.Warn("backfill content: store failed", "id", r.ID, "err", err)
				contentFail.Add(1)
				return nil
			}
			contentOK.Add(1)
			return nil
		})
	}
	_ = g2.Wait()
	log.Info("backfill content: xong", "ok", contentOK.Load(), "failed", contentFail.Load())

	log.Info("backfill: xong", "ok", okCount.Load(), "failed", failCount.Load())
	if failCount.Load() > 0 {
		fmt.Fprintf(os.Stderr, "backfill: %d bài lỗi\n", failCount.Load())
		os.Exit(1)
	}
}
