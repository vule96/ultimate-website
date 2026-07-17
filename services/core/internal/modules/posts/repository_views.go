package posts

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// IncrementViews cộng dồn view theo batch trong 1 transaction — gọi bởi
// ViewCounter mỗi chu kỳ flush, KHÔNG gọi trong request path.
// ID không tồn tại được bỏ qua im lặng (bài có thể vừa bị xoá).
// Chủ ý KHÔNG bump cache version: views lệch tối đa TTL (60s) chấp nhận được,
// bump mỗi 5s sẽ vô hiệu cache liên tục.
func (r *GormRepository) IncrementViews(ctx context.Context, counts map[uuid.UUID]int64) error {
	if len(counts) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for id, n := range counts {
			if err := tx.Model(&gormPost{}).Where("id = ?", id).
				Update("views", gorm.Expr("views + ?", n)).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// SetBlurhash lưu blurhash do worker nền tính — chỉ đụng 1 cột, không đổi
// version/updated_at (không phải chỉnh sửa nội dung của người dùng).
func (r *GormRepository) SetBlurhash(ctx context.Context, id uuid.UUID, hash string) error {
	return r.db.WithContext(ctx).Model(&gormPost{}).Where("id = ?", id).
		UpdateColumn("cover_blurhash", hash).Error
}

// decodeImageMeta unmarshal cột jsonb content_image_meta (nil/lỗi → nil).
func decodeImageMeta(raw []byte) map[string]ImageMeta {
	if len(raw) == 0 {
		return nil
	}
	var m map[string]ImageMeta
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil
	}
	return m
}

// SetContentImageMeta lưu meta ảnh content do worker nền tính — 1 cột,
// không đổi version/updated_at.
func (r *GormRepository) SetContentImageMeta(ctx context.Context, id uuid.UUID, meta map[string]ImageMeta) error {
	raw, err := json.Marshal(meta)
	if err != nil {
		return err
	}
	return r.db.WithContext(ctx).Model(&gormPost{}).Where("id = ?", id).
		UpdateColumn("content_image_meta", datatypes.JSON(raw)).Error
}
