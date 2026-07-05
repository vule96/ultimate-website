// Package httperr chuẩn hoá response lỗi JSON cho API.
package httperr

import "github.com/gin-gonic/gin"

// body là envelope lỗi: {"error": {"code": "...", "message": "..."}}.
type body struct {
	Error detail `json:"error"`
}

type detail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Write ghi response lỗi JSON với status, code và message cho trước.
func Write(c *gin.Context, status int, code, message string) {
	c.JSON(status, body{Error: detail{Code: code, Message: message}})
}
