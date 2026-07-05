// Package pagination cung cấp tham số phân trang đã chuẩn hoá.
package pagination

const (
	defaultPage     = 1
	defaultPageSize = 20
	maxPageSize     = 100
)

// Params là tham số phân trang đã được chuẩn hoá (page ≥ 1, 1 ≤ page_size ≤ 100).
type Params struct {
	Page     int
	PageSize int
}

// Normalize ép page/page_size về khoảng hợp lệ, áp mặc định khi giá trị ≤ 0.
func Normalize(page, pageSize int) Params {
	if page < 1 {
		page = defaultPage
	}
	if pageSize < 1 {
		pageSize = defaultPageSize
	}
	if pageSize > maxPageSize {
		pageSize = maxPageSize
	}
	return Params{Page: page, PageSize: pageSize}
}

// Offset trả về số bản ghi cần bỏ qua cho trang hiện tại.
func (p Params) Offset() int { return (p.Page - 1) * p.PageSize }
