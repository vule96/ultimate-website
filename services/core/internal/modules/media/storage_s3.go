package media

import (
	"context"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// S3Config là cấu hình cho storage S3-compatible (MinIO/R2/S3).
type S3Config struct {
	Endpoint       string // rỗng = AWS mặc định
	Region         string
	AccessKey      string
	SecretKey      string
	Bucket         string
	PublicURL      string        // base URL công khai (không có dấu / cuối)
	UsePathStyle   bool          // true cho MinIO
	PresignExpires time.Duration // thời hạn presigned URL; 0 = mặc định 15 phút
}

// s3Storage cài đặt Storage bằng aws-sdk-go-v2.
type s3Storage struct {
	client    *s3.Client
	presign   *s3.PresignClient
	bucket    string
	publicURL string
	expires   time.Duration
}

var _ Storage = (*s3Storage)(nil)

// NewS3Storage tạo storage S3-compatible từ cấu hình.
func NewS3Storage(cfg S3Config) Storage {
	client := s3.New(s3.Options{
		Region:       cfg.Region,
		Credentials:  credentials.NewStaticCredentialsProvider(cfg.AccessKey, cfg.SecretKey, ""),
		BaseEndpoint: endpointPtr(cfg.Endpoint),
		UsePathStyle: cfg.UsePathStyle,
	})
	expires := cfg.PresignExpires
	if expires <= 0 {
		expires = 15 * time.Minute
	}
	return &s3Storage{
		client:    client,
		presign:   s3.NewPresignClient(client),
		bucket:    cfg.Bucket,
		publicURL: strings.TrimRight(cfg.PublicURL, "/"),
		expires:   expires,
	}
}

// PresignPut sinh presigned PUT URL cho object key; content-type và content-length
// đều là signed header — PUT với giá trị khác sẽ bị storage từ chối (403).
func (s *s3Storage) PresignPut(ctx context.Context, key, contentType string, size int64) (string, time.Duration, error) {
	req, err := s.presign.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(s.bucket),
		Key:           aws.String(key),
		ContentType:   aws.String(contentType),
		ContentLength: aws.Int64(size),
	}, s3.WithPresignExpires(s.expires))
	if err != nil {
		return "", 0, err
	}
	return req.URL, s.expires, nil
}

// PublicURL trả URL công khai để hiển thị object sau khi upload.
func (s *s3Storage) PublicURL(key string) string {
	return s.publicURL + "/" + key
}

func endpointPtr(endpoint string) *string {
	if endpoint == "" {
		return nil
	}
	return &endpoint
}
