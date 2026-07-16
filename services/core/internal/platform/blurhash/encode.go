// Package blurhash tính blurhash cho ảnh cover ở background (worker pool),
// tách khỏi request path — bài học goroutine của Slice 9.
package blurhash

import (
	"bytes"
	"fmt"
	"image"
	_ "image/gif"  // đăng ký decoder
	_ "image/jpeg" // đăng ký decoder
	_ "image/png"  // đăng ký decoder

	bh "github.com/buckket/go-blurhash"
	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp" // đăng ký decoder webp
)

// maxEdge: blurhash chỉ cần thumbnail — downscale trước khi encode cho rẻ CPU.
const maxEdge = 64

// Chống decompression bomb: PNG vài KB có thể khai báo 40000×40000 → decode
// ngốn hàng GB RAM. Check header (DecodeConfig — không decode pixel) trước.
const (
	maxDimension = 10000
	maxPixels    = 25_000_000 // ~25MP
)

// Encode decode ảnh (jpeg/png/gif/webp) → downscale ≤64px → blurhash 4x3.
func Encode(data []byte) (string, error) {
	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return "", fmt.Errorf("blurhash: read image header: %w", err)
	}
	if cfg.Width <= 0 || cfg.Height <= 0 ||
		cfg.Width > maxDimension || cfg.Height > maxDimension ||
		cfg.Width*cfg.Height > maxPixels {
		return "", fmt.Errorf("blurhash: image dimensions %dx%d exceed limit", cfg.Width, cfg.Height)
	}
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return "", fmt.Errorf("blurhash: decode image: %w", err)
	}
	return bh.Encode(4, 3, downscale(img))
}

// downscale thu nhỏ ảnh giữ tỉ lệ, cạnh dài ≤ maxEdge.
func downscale(src image.Image) image.Image {
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	if w <= maxEdge && h <= maxEdge {
		return src
	}
	scale := float64(maxEdge) / float64(max(w, h))
	nw, nh := max(1, int(float64(w)*scale)), max(1, int(float64(h)*scale))
	dst := image.NewRGBA(image.Rect(0, 0, nw, nh))
	draw.ApproxBiLinear.Scale(dst, dst.Bounds(), src, b, draw.Over, nil)
	return dst
}
