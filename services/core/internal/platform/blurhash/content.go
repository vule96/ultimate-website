package blurhash

import (
	"strings"

	"golang.org/x/net/html"
)

// maxContentImages: trần số ảnh xử lý mỗi bài — chống bài rác nghìn ảnh.
const maxContentImages = 20

// ExtractImgSrcs trích src của <img> trong HTML: chỉ http(s) tuyệt đối,
// dedupe giữ thứ tự xuất hiện, tối đa maxContentImages.
func ExtractImgSrcs(rawHTML string) []string {
	node, err := html.Parse(strings.NewReader(rawHTML))
	if err != nil {
		return nil
	}
	seen := make(map[string]struct{})
	var out []string
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if len(out) >= maxContentImages {
			return
		}
		if n.Type == html.ElementNode && n.Data == "img" {
			for _, a := range n.Attr {
				if a.Key != "src" {
					continue
				}
				src := strings.TrimSpace(a.Val)
				lower := strings.ToLower(src)
				if !strings.HasPrefix(lower, "http://") && !strings.HasPrefix(lower, "https://") {
					break
				}
				if _, dup := seen[src]; !dup {
					seen[src] = struct{}{}
					out = append(out, src)
				}
				break
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(node)
	return out
}
