// Package bodylimit giới hạn kích thước body request (M4) — chống client
// (hoặc kẻ tấn công) gửi payload lớn làm cạn RAM/backpressure DB.
package bodylimit

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Middleware bọc body bằng http.MaxBytesReader; đọc quá maxBytes → lỗi
// *http.MaxBytesError khi handler bind (map sang 413 bằng IsTooLarge).
func Middleware(maxBytes int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
		c.Next()
	}
}

// IsTooLarge cho biết err (từ ShouldBindJSON/io.ReadAll) do body vượt giới hạn.
func IsTooLarge(err error) bool {
	var mbe *http.MaxBytesError
	return errors.As(err, &mbe)
}
