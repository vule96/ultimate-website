package blurhash_test

import (
	"strings"
	"testing"

	"github.com/vule96/ultimate-website/services/core/internal/platform/blurhash"
)

func TestExtractImgSrcs_DedupeOrderCap(t *testing.T) {
	html := `<p>x</p><img src="https://a/1.png"><img src="https://a/2.png"><img src="https://a/1.png">`
	got := blurhash.ExtractImgSrcs(html)
	if len(got) != 2 || got[0] != "https://a/1.png" || got[1] != "https://a/2.png" {
		t.Errorf("got %v, want dedupe giữ thứ tự", got)
	}

	var b strings.Builder
	for i := 0; i < 30; i++ {
		b.WriteString(`<img src="https://a/` + string(rune('a'+i)) + `.png">`)
	}
	if n := len(blurhash.ExtractImgSrcs(b.String())); n != 20 {
		t.Errorf("cap 20, got %d", n)
	}
}

func TestExtractImgSrcs_SkipsNonHTTP(t *testing.T) {
	html := `<img src="data:image/png;base64,xxx"><img src="/relative.png"><img src="javascript:alert(1)"><img src="https://ok/x.jpg">`
	got := blurhash.ExtractImgSrcs(html)
	if len(got) != 1 || got[0] != "https://ok/x.jpg" {
		t.Errorf("chỉ giữ http(s) tuyệt đối, got %v", got)
	}
}

func TestEncodeMeta_ReturnsDimsAndPlaceholder(t *testing.T) {
	meta, err := blurhash.EncodeMeta(png4x4(t))
	if err != nil {
		t.Fatal(err)
	}
	if meta.W != 4 || meta.H != 4 {
		t.Errorf("dims = %dx%d, want 4x4", meta.W, meta.H)
	}
	if meta.Blurhash == "" {
		t.Error("Blurhash rỗng")
	}
	if !strings.HasPrefix(meta.PlaceholderPNG, "data:image/png;base64,") {
		t.Errorf("PlaceholderPNG phải là data URI png, got %.40s", meta.PlaceholderPNG)
	}
}

func TestEncodeMeta_RejectsBomb(t *testing.T) {
	if _, err := blurhash.EncodeMeta(bigPNGHeader(40000, 40000)); err == nil {
		t.Fatal("bomb phải bị chặn")
	}
}
