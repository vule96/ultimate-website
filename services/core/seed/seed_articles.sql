-- Seed idempotent cho trang chủ Mạch. Chạy lại an toàn (ON CONFLICT DO NOTHING).
-- Cách chạy: docker compose exec -T postgres psql -U blog -d blog < services/core/seed/seed_articles.sql

INSERT INTO tags (name, slug) VALUES
  ('IT','it'), ('AI','ai'), ('Tài chính','finance'), ('Chứng khoán','stock'),
  ('Kiến trúc','arch'), ('Văn hóa','culture'), ('Giải trí','ent'),
  ('Tin tức','news'), ('Phát triển bản thân','growth'), ('Review sách','book')
ON CONFLICT (slug) DO NOTHING;

WITH seed(title, slug, excerpt, cat, days) AS (
  VALUES
    ('Vì sao Go trở thành lựa chọn số 1 cho backend hiện đại','vi-sao-go-backend','Goroutine, tooling và trải nghiệm deploy khiến Go bứt phá.','it', 1),
    ('RAG là gì và tại sao nó thay đổi cách ta xây chatbot','rag-la-gi','Retrieval-Augmented Generation kết hợp truy hồi và sinh văn bản.','ai', 2),
    ('Lãi kép: kỳ quan thứ tám của thế giới đầu tư','lai-kep-ky-quan','Hiểu đúng lãi kép để tiền làm việc thay bạn.','finance', 3),
    ('Đọc bảng giá chứng khoán cho người mới bắt đầu','doc-bang-gia-ck','Khớp lệnh, dư mua dư bán và những con số cần nhìn.','stock', 4),
    ('Kiến trúc nhiệt đới: sống cùng khí hậu thay vì chống lại','kien-truc-nhiet-doi','Thông gió tự nhiên và vật liệu bản địa.','arch', 5),
    ('Cà phê Việt và hành trình từ nông trại tới thế giới','ca-phe-viet','Câu chuyện văn hoá sau mỗi tách cà phê.','culture', 6),
    ('Điện ảnh Việt 2026: làn sóng đạo diễn trẻ','dien-anh-viet-2026','Những gương mặt định hình phòng vé năm nay.','ent', 7),
    ('Tổng hợp công nghệ tuần: chip mới, mã nguồn mở và AI','tong-hop-cong-nghe-tuan','Điểm tin nhanh những gì đáng chú ý.','news', 8),
    ('Kỷ luật hơn động lực: xây thói quen bền vững','ky-luat-hon-dong-luc','Vì sao hệ thống thắng mục tiêu.','growth', 9),
    ('Review "Thinking, Fast and Slow" — hai hệ tư duy','review-thinking-fast-slow','Daniel Kahneman và cách bộ não ra quyết định.','book', 10),
    ('TypeScript nâng cao: type-level programming thực chiến','ts-nang-cao','Conditional types, template literal types và hơn thế.','it', 11),
    ('Prompt engineering: nói chuyện với mô hình sao cho hiệu quả','prompt-engineering','Cấu trúc prompt, few-shot và ràng buộc đầu ra.','ai', 12)
)
INSERT INTO posts (title, slug, content_html, content_json, excerpt, cover_image, status, published_at, created_at, updated_at)
SELECT
  s.title, s.slug,
  '<p>' || s.excerpt || '</p><h2>Mở đầu</h2><p>Đây là nội dung mẫu cho bài viết trên tạp chí Mạch, đủ dài để tính thời gian đọc và hiển thị ở trang chi tiết. '
    || repeat('Chúng ta cùng đi sâu vào chủ đề này qua các ví dụ thực tế và góc nhìn dễ hiểu. ', 12)
    || '</p><h2>Kết</h2><p>Cảm ơn bạn đã đọc tới đây.</p>',
  '{}'::jsonb,
  s.excerpt,
  'https://picsum.photos/seed/' || s.slug || '/528/360',
  'PUBLISHED',
  now() - (s.days || ' days')::interval,
  now() - (s.days || ' days')::interval,
  now() - (s.days || ' days')::interval
FROM seed s
ON CONFLICT (slug) DO NOTHING;

-- Nối mỗi bài với đúng 1 category chính.
INSERT INTO post_tags (post_id, tag_id)
SELECT p.id, t.id
FROM posts p
JOIN (VALUES
  ('vi-sao-go-backend','it'),('rag-la-gi','ai'),('lai-kep-ky-quan','finance'),
  ('doc-bang-gia-ck','stock'),('kien-truc-nhiet-doi','arch'),('ca-phe-viet','culture'),
  ('dien-anh-viet-2026','ent'),('tong-hop-cong-nghe-tuan','news'),
  ('ky-luat-hon-dong-luc','growth'),('review-thinking-fast-slow','book'),
  ('ts-nang-cao','it'),('prompt-engineering','ai')
) m(pslug, tslug) ON m.pslug = p.slug
JOIN tags t ON t.slug = m.tslug
ON CONFLICT (post_id, tag_id) DO NOTHING;
