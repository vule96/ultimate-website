package posts

import (
	"context"

	"github.com/google/uuid"
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
