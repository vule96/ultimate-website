// Package media quản lý upload ảnh qua presigned URL (S3-compatible: MinIO/R2).
// Theo mô hình Clean-lite: domain ← service ← storage/handler (tầng ngoài).
package media

import (
	"context"
	"errors"
	"fmt"
	"time"
)

// MaxUploadSize là giới hạn kích thước ảnh cho phép (5 MB).
const MaxUploadSize int64 = 5 << 20

// allowedContentTypes ánh xạ content-type ảnh hợp lệ → đuôi file.
var allowedContentTypes = map[string]string{
	"image/png":  "png",
	"image/jpeg": "jpg",
	"image/webp": "webp",
	"image/gif":  "gif",
}

// Các lỗi domain (tầng ngoài dùng errors.Is để map sang HTTP).
var (
	ErrValidation = errors.New("validation error")
)

func validationErrorf(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrValidation, fmt.Sprintf(format, args...))
}

// PresignInput là yêu cầu xin presigned URL để upload một ảnh.
type PresignInput struct {
	ContentType string
	Size        int64
}

// PresignResult là kết quả trả về cho client để upload trực tiếp lên storage.
type PresignResult struct {
	UploadURL string        // presigned PUT URL (upload thẳng lên storage)
	PublicURL string        // URL công khai để hiển thị ảnh sau khi upload
	Key       string        // object key trong bucket
	ExpiresIn time.Duration // thời hạn của presigned URL
}

// Storage là cổng (port) sinh presigned URL. Service không biết cài đặt cụ thể (S3/MinIO/R2).
// size được ký vào URL (Content-Length) để storage từ chối upload sai kích thước.
type Storage interface {
	PresignPut(ctx context.Context, key, contentType string, size int64) (url string, expires time.Duration, err error)
	PublicURL(key string) string
}
