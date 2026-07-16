package cache

import (
	"crypto/sha1"
	"fmt"
	"strings"
)

// Key dựng cache key dạng "<group>:v<ver>:<sha1(parts)>".
// parts nối bằng ký tự unit-separator để "a","bc" không trùng "ab","c".
func Key(group string, ver int64, parts ...string) string {
	sum := sha1.Sum([]byte(strings.Join(parts, "\x1f")))
	return fmt.Sprintf("%s:v%d:%x", group, ver, sum)
}
