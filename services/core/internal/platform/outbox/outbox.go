// Package outbox cài transactional outbox pattern (chuẩn bị Phase 2):
// module nghiệp vụ ghi event vào bảng outbox TRONG CÙNG transaction với write —
// không bao giờ có chuyện DB đã đổi mà event bị mất (crash giữa chừng).
// Consumer (Phase 2: AI worker index RAG) poll bảng này qua Dispatcher/trực tiếp.
package outbox

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// Event là một bản ghi outbox — "lá thư chưa gửi" cho consumer.
type Event struct {
	ID          uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	Aggregate   string         `gorm:"not null"` // vd "post"
	AggregateID uuid.UUID      `gorm:"type:uuid;not null"`
	EventType   string         `gorm:"not null"` // vd "post.created"
	Payload     datatypes.JSON `gorm:"type:jsonb;not null"`
	CreatedAt   time.Time      `gorm:"not null;default:now();index:idx_outbox_unprocessed,where:processed_at IS NULL"`
	ProcessedAt *time.Time
}

func (Event) TableName() string { return "outbox" }

// Models trả về GORM model cho công cụ migration (Atlas loader).
func Models() []any { return []any{&Event{}} }

// Write ghi 1 event bằng chính tx đang mở — PHẢI gọi trong cùng transaction
// với write nghiệp vụ để giữ tính atomic của outbox pattern.
func Write(tx *gorm.DB, aggregate string, aggregateID uuid.UUID, eventType string, payload any) error {
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return tx.Create(&Event{
		Aggregate:   aggregate,
		AggregateID: aggregateID,
		EventType:   eventType,
		Payload:     datatypes.JSON(raw),
	}).Error
}
