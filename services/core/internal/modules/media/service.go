package media

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Service chứa business logic của module media.
type Service struct {
	storage Storage
	now     func() time.Time
	newID   func() string
}

// NewService tạo Service với storage cho trước và đồng hồ/ID mặc định.
func NewService(storage Storage) *Service {
	return &Service{
		storage: storage,
		now:     time.Now,
		newID:   func() string { return uuid.NewString() },
	}
}

// Presign validate đầu vào, sinh object key và trả presigned URL để client upload.
func (s *Service) Presign(ctx context.Context, in PresignInput) (PresignResult, error) {
	ext, ok := allowedContentTypes[in.ContentType]
	if !ok {
		return PresignResult{}, validationErrorf("unsupported content type %q", in.ContentType)
	}
	if in.Size <= 0 {
		return PresignResult{}, validationErrorf("size must be positive")
	}
	if in.Size > MaxUploadSize {
		return PresignResult{}, validationErrorf("file too large (max %d bytes)", MaxUploadSize)
	}

	key := s.buildKey(ext)
	url, expires, err := s.storage.PresignPut(ctx, key, in.ContentType, in.Size)
	if err != nil {
		return PresignResult{}, err
	}
	return PresignResult{
		UploadURL: url,
		PublicURL: s.storage.PublicURL(key),
		Key:       key,
		ExpiresIn: expires,
	}, nil
}

// buildKey sinh object key dạng uploads/<yyyy>/<mm>/<uuid>.<ext>.
func (s *Service) buildKey(ext string) string {
	t := s.now().UTC()
	return fmt.Sprintf("uploads/%04d/%02d/%s.%s", t.Year(), t.Month(), s.newID(), ext)
}
