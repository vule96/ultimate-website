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

// Encode decode ảnh (jpeg/png/gif/webp) → downscale ≤64px → blurhash 4x3.
func Encode(data []byte) (string, error) {
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
