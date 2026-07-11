# Phân tích & Đánh giá dự án: Website Blog Cá Nhân (FE + BE + AI)

> Tài liệu đánh giá tính khả thi và định hướng kiến trúc.
> Ngày: 2026-07-05 · Tác giả yêu cầu: huyvu.le@kamereo.vn
> Lựa chọn định hướng: **Cân bằng học + sản phẩm** · Ngân sách **~15–40 USD/tháng** · Backend **Golang** · AI **toàn diện**
>
> **Trạng thái triển khai (cập nhật 2026-07-11):** Phase 0 + Phase 1 **HOÀN TẤT** (Slice 1→4) + **3 đợt hardening 5a/5b/5c HOÀN TẤT** — sau senior code review toàn codebase đã đóng mọi issue high+ và polish FE (bảo mật visibility/CSRF/presign, mất-dữ-liệu form; production-readiness: graceful shutdown, request logging, path-based SSG pagination, 401-aware admin; SEO đầy đủ + sanitize + CSP + `next/font`). Blog công khai chạy live (Next.js SSG/ISR + SEO), admin dashboard, storage R2 verify (dev = MinIO / prod = R2). **Bước kế tiếp chưa chốt:** Slice 5d (backend robustness: tag ON CONFLICT, optimistic locking, outbox) *hoặc* Deploy production *hoặc* Phase 2 (AI). Tiến độ chi tiết từng slice + issue tracker ở **`CLAUDE.md`** và **`docs/reviews/2026-07-11-senior-code-review.md`**. **Kiến trúc vận hành thực tế** (sơ đồ, luồng BE↔FE, cache, AI tương lai): **`docs/architecture.md`**. Tài liệu này giữ vai trò **định hướng/đánh giá gốc** — không track tiến độ từng slice.

---

## Mục lục

**Phần cốt lõi (đánh giá & kiến trúc)**
- [0. TL;DR — Kết luận trung thực](#0-tldr--kết-luận-trung-thực)
- [1. Đánh giá thẳng thắn về "Microservice"](#1-đánh-giá-thẳng-thắn-về-microservice)
- [2. Stack đề xuất (tối ưu học + chi phí thấp)](#2-stack-đề-xuất-tối-ưu-học--chi-phí-thấp)
- [3. Phần AI — Phân tích chi tiết](#3-phần-ai--phân-tích-chi-tiết-bạn-ưu-tiên-toàn-bộ)
- [4. Observability / Monitoring](#4-observability--monitoring-bạn-yêu-cầu-grafana)
- [5. Chi phí thực tế (USD/tháng)](#5-chi-phí-thực-tế-usdtháng--trong-ngân-sách-1540-usd)
- [6. Claude Code — Plugins / Skills dùng được](#6-claude-code--plugins--skills-dùng-được-cho-dự-án-này)
- [7. Roadmap đề xuất (phân phase)](#7-roadmap-đề-xuất-phân-phase--chống-scope-creep)
- [8. Rủi ro & cách phòng tránh](#8-rủi-ro--cách-phòng-tránh)
- [9. Kết luận](#9-kết-luận)

**Phần bổ sung (đào sâu kỹ thuật)**
- [10. UI Library cho Next.js](#10-ui-library-cho-nextjs-đẹp-phổ-biến-nhẹ)
- [11. Rich Text Editor — So sánh & xếp hạng](#11-rich-text-editor--so-sánh-đầy-đủ-xếp-theo-độ-phù-hợp-giảm-dần)
- [12. craft.js, Reka.js & Visual Page Builder](#12-craftjs--visual-page-builder-câu-hỏi-đào-sâu-của-bạn)
- [13. Cấu trúc code & Design Pattern](#13-cấu-trúc-code--design-pattern-để-dễ-scale)
- [14. Admin Dashboard — App React SPA riêng](#14-admin-dashboard--app-react-spa-riêng-đã-chốt)
- [15. CI/CD](#15-cicd)
- [16. TypeScript nâng cao](#16-typescript-nâng-cao-câu-hỏi-tôi-rất-thích-của-bạn)
- [17. Tổng hợp link thư viện](#17-tổng-hợp-link-thư-viện-theo-yêu-cầu)
- [18. Plugins / Skills bổ sung](#18-plugins--skills-bổ-sung-cần-cho-các-yêu-cầu-mới)

---

## 0. TL;DR — Kết luận trung thực

| Câu hỏi | Trả lời thẳng |
|---|---|
| Có khả quan không? | **CÓ.** 100% làm được với ngân sách 15–40 USD/tháng cho một người. |
| Có nên dùng microservice không? | **KHÔNG dùng microservice "thật".** Dùng **Modular Monolith (Go) + tách 1 AI worker riêng.** |
| Rủi ro lớn nhất? | **Scope creep** (ôm quá nhiều) và **observability ngốn RAM** trên VPS rẻ. |
| AI auto-đăng bài có ổn không? | Ổn — **BẮT BUỘC có human-in-the-loop** (bạn duyệt qua Telegram trước khi đăng). |
| Thời gian thực tế? | ~3–5 tháng làm part-time nếu đi theo roadmap phân phase bên dưới. |

**Nguyên tắc xuyên suốt: YAGNI (You Aren't Gonna Need It).** Mỗi khi định thêm 1 công nghệ, hỏi: "Cái này phục vụ mục tiêu học *hay* mục tiêu sản phẩm? Nếu không phục vụ cái nào rõ ràng → bỏ."

---

## 1. Đánh giá thẳng thắn về "Microservice"

### 1.1. Sự thật về microservice cho blog cá nhân

Microservice **thật** (mỗi service 1 database riêng, giao tiếp qua network, deploy độc lập, service discovery, mesh...) sinh ra để giải quyết vấn đề **tổ chức người** (nhiều team) và **scale không đồng đều**. Một blog 1 người dùng **không có** hai vấn đề đó.

Nếu bê nguyên microservice lên 1 VPS 4GB RAM:
- ❌ Mỗi Go service ~30–80MB, nhưng Postgres + Redis + Prometheus + Grafana + Loki mới là thứ ngốn RAM (1.5–2.5GB).
- ❌ Debug khó gấp bội: 1 request đi qua 3 service = 3 nơi có thể lỗi.
- ❌ Transaction phân tán, eventual consistency — bài toán khó không cần thiết cho blog.

### 1.2. Giải pháp đúng: **Modular Monolith + 1 service tách riêng**

Đây là kiến trúc **học được đủ thứ hay của microservice** mà **không trả giá**:

```
┌─────────────────────────────────────────────────────────┐
│  API Core (Go monolith, chia module rõ ràng)            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ auth     │ │ posts    │ │ media    │ │ chat/rag   │  │
│  │ module   │ │ module   │ │ module   │ │ module     │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘  │
│  Mỗi module = 1 package Go, interface rõ ràng            │
└────────────────────────┬────────────────────────────────┘
                         │ gRPC / message queue (NATS/Redis Stream)
                         ▼
┌─────────────────────────────────────────────────────────┐
│  AI Worker (service RIÊNG — có thể là Go HOẶC Python)   │
│  - Research agent (LangChain/LangGraph)                  │
│  - Sinh embeddings, gọi LLM, viết draft                  │
│  - Chạy cron job 9h sáng                                 │
└─────────────────────────────────────────────────────────┘
```

**Vì sao tách AI worker riêng là hợp lý (không phải over-engineer):**
1. **Ngôn ngữ khác nhau**: Hệ sinh thái AI/LangChain mạnh nhất ở **Python**. Bạn học Go cho core, dùng Python cho AI → thực tế đúng như doanh nghiệp làm.
2. **Tải khác nhau**: Job research AI chạy nặng, lâu → tách ra để không block API chính.
3. **Deploy độc lập**: Sửa prompt AI không cần deploy lại API core.
4. **Bạn học thật**: giao tiếp inter-service (gRPC hoặc queue), containerization, health check — đủ "vị" microservice.

> **Khuyến nghị cụ thể theo lựa chọn của bạn (Golang):** Core = Go monolith module hoá. AI worker = Python (LangChain). Đây chính là mô hình "Hybrid" tốt nhất và trùng đúng với việc bạn đang học LangChain.

---

## 2. Stack đề xuất (tối ưu học + chi phí thấp)

### 2.1. Backend (Go core)

| Thành phần | Lựa chọn đề xuất | Lý do |
|---|---|---|
| HTTP framework | **Chi (`go-chi/chi`)** hoặc **Gin** | Chi nhẹ, idiomatic, dạy bạn hiểu net/http. Gin phổ biến, nhiều ví dụ. |
| ORM / DB access | **sqlc** (khuyến nghị) hoặc GORM | sqlc sinh code từ SQL → học SQL thật, type-safe, nhanh. GORM dễ hơn nhưng "che" SQL. |
| Database | **PostgreSQL** (1 instance duy nhất) | Đủ cho mọi thứ. Dùng schema/table tách theo module. |
| Vector store | **pgvector** (extension của Postgres) | **KHÔNG cần Pinecone/Qdrant riêng** → tiết kiệm RAM + tiền. Đủ tốt cho vài nghìn bài. |
| Cache / queue | **Redis** (hoặc NATS nếu muốn học pub/sub) | Cache, rate limit, message giữa core ↔ AI worker. |
| Inter-service | **gRPC** (để học) hoặc REST nội bộ | gRPC dạy bạn protobuf, contract-first. |
| Migration | **golang-migrate** hoặc Atlas | Versioned schema. |

### 2.2. Frontend — **2 app tách biệt** (web công khai + admin dashboard)

> **Quyết định (cập nhật):** dùng **hai app FE riêng** trong monorepo:
> - **`apps/web`** — blog công khai → **Next.js** (cần SSR/SSG cho SEO).
> - **`apps/admin`** — dashboard quản trị → **React SPA (Vite)**, KHÔNG dùng Next.js.
>
> Admin là khu vực đăng nhập, **không cần SEO/SSR** → SPA thuần nhẹ hơn, build đơn giản, đúng "vị" học SPA. Cả hai chia sẻ `packages/ui` (shadcn) và `packages/types`.

**`apps/web` — blog công khai (Next.js):**

| Thành phần | Lựa chọn | Ghi chú |
|---|---|---|
| Framework | **Next.js (App Router)** | SSR/SSG cho SEO blog rất tốt. |
| Styling | **Tailwind CSS + shadcn/ui** | Nhanh, đẹp, tuỳ biến cao. |
| Data fetching | **TanStack Query** (+ RSC fetch) | Cache client-side, mutation. |
| Auth | Không cần (trang đọc công khai) | Nếu có comment/like sau này mới thêm. |

**`apps/admin` — dashboard quản trị (React SPA):**

| Thành phần | Lựa chọn | Ghi chú |
|---|---|---|
| Build tool | **Vite + React** (TypeScript) | SPA thuần, HMR nhanh, build ra static. |
| Routing | **TanStack Router** (file-based) | Client-side routing type-safe (search params + loaders); thay App Router của Next. |
| Data table | **TanStack Table** (headless) | Bảng typed qua `DataTable<TData>` dùng chung; server-side sort/pagination/filter (manual mode), ẩn/hiện cột. |
| Styling | **Tailwind CSS + shadcn/ui** | shadcn hỗ trợ Vite; dùng chung `packages/ui`. |
| Data fetching | **TanStack Query** | Cache, mutation, optimistic update. |
| Auth | **Google OAuth qua Go core (BFF)** + session cookie httpOnly | SPA **không giữ token trong JS** (tránh XSS); Go core đổi code, set cookie; kiểm tra allowlist email. Xem §14.3. |
| Editor | **Tiptap** (hoặc Novel) | Trình soạn bài nằm trong admin, không ở web. |

### 2.3. Rich Text Editor (phần bạn hỏi riêng)

| Editor | Nền tảng | Điểm mạnh | Khi nào chọn |
|---|---|---|---|
| **Tiptap** ⭐ | ProseMirror | Tuỳ biến CỰC cao, headless, cộng đồng lớn, extension phong phú | **Khuyến nghị số 1** — cân bằng tốt nhất |
| **Novel** | Tiptap + AI | Trải nghiệm Notion-like, tích hợp sẵn AI autocomplete, slash command | Nếu muốn UX Notion + AI viết ngay trong editor |
| **Lexical** | Meta (Facebook) | Hiệu năng tốt, kiến trúc hiện đại | Nếu thích hệ sinh thái Meta, chịu được ít ví dụ hơn |
| **Plate** | Slate + shadcn | Tích hợp shadcn/ui đẹp, nhiều plugin sẵn | Nếu đã dùng shadcn nặng |
| **BlockNote** | ProseMirror | Block-based như Notion, dễ dùng ngay | Muốn nhanh, ít cấu hình |

> **Khuyến nghị: Tiptap** (hoặc **Novel** nếu bạn muốn tính năng AI-in-editor có sẵn — trùng luôn yêu cầu "trợ lý viết trong editor" của bạn).

**Upload ảnh ra S3/R2 (kiến trúc chuẩn — KHÔNG upload qua server để tiết kiệm băng thông):**

```
1. FE: user chèn/paste ảnh vào Tiptap
2. FE → API core: xin "presigned URL" (POST /media/presign)
3. API core: tạo presigned PUT URL cho R2/S3, trả về FE
4. FE: PUT ảnh TRỰC TIẾP lên R2/S3 (không qua server bạn)
5. FE: lưu URL công khai vào nội dung bài viết
```

> **Chọn Cloudflare R2 thay vì AWS S3:** R2 **miễn phí egress (băng thông ra)** — với blog nhiều ảnh, đây là khoản tiết kiệm lớn nhất. 10GB lưu trữ đầu tiên gần như miễn phí. API tương thích S3 nên code y hệt.

---

## 3. Phần AI — Phân tích chi tiết (bạn ưu tiên toàn bộ)

### 3.1. Chatbot RAG hỏi về website

**Luồng:**
```
Khi đăng/sửa bài:
  post content → chunk → embedding (API rẻ) → lưu vào pgvector

Khi user hỏi:
  câu hỏi → embedding → similarity search (pgvector)
          → lấy top-k chunk liên quan → nhét vào prompt LLM
          → LLM trả lời kèm trích dẫn bài viết
```

- Câu hỏi kiểu **"web đang có gì / có bài nào về X"** → có thể trả lời bằng **query metadata** (không cần LLM) HOẶC RAG. Nên **hybrid**: intent đơn giản → truy vấn DB; câu hỏi mở → RAG.
- **Model embedding rẻ**: `text-embedding-3-small` (OpenAI, rất rẻ) hoặc Google `text-embedding-004` (free tier rộng) hoặc chạy local bằng model open-source (bge-small) qua HuggingFace nếu muốn 0 đồng.

### 3.2. AI research + tự viết + Telegram 9h sáng (human-in-the-loop)

**Đây là tính năng "signature" của dự án. Luồng cụ thể:**

```
09:00 (cron trong AI worker):
  1. Lấy danh sách chủ đề quan tâm (bạn cấu hình trước, hoặc AI tự gợi ý)
  2. Web search chủ đề  → Tavily API (free tier) / SerpAPI / Brave Search
  3. Fetch & đọc nguồn  → tóm tắt, trích dẫn nguồn
  4. LLM viết draft bài (markdown) + tiêu đề + tags + meta SEO
  5. Lưu draft (status = PENDING_APPROVAL) vào DB
  6. Gửi Telegram cho bạn:
       "📝 Draft mới: <tiêu đề>
        <tóm tắt 3 dòng> + link preview
        [✅ Duyệt & đăng] [✏️ Sửa] [❌ Bỏ]"   ← inline buttons
  7. Bạn bấm nút:
       - Duyệt → API core publish bài (status = PUBLISHED)
       - Bỏ    → xoá draft
       - Sửa   → mở link editor để bạn chỉnh rồi đăng
```

- **Framework agent: LangGraph** (thuộc LangChain) — hợp cho luồng nhiều bước có state + human-in-the-loop. Bạn đang học LangChain → **trùng khớp mục tiêu học**.
- **Telegram**: dùng Bot API với **inline keyboard** để duyệt/từ chối. Webhook về AI worker.
- **An toàn**: AI **KHÔNG BAO GIỜ tự đăng** khi chưa có approve của bạn. Đây là ranh giới đạo đức + chất lượng bắt buộc (tránh hallucination lên blog công khai).

### 3.3. Trợ lý viết trong editor

- Streaming completion: bôi đen text → "viết tiếp / tóm tắt / đổi văn phong / dịch".
- Nếu chọn **Novel editor** → có sẵn slash command AI, tiết kiệm công.
- Dùng model rẻ + streaming (SSE) cho cảm giác mượt.

### 3.4. 🎁 Đề xuất thêm tính năng AI phù hợp blog cá nhân

| # | Tính năng | Giá trị | Độ khó |
|---|---|---|---|
| 1 | **Auto-tagging & phân loại** bài khi đăng | Khỏi tự gắn tag | Thấp |
| 2 | **Tự sinh SEO meta** (title, description, slug) | SEO tốt, đỡ thủ công | Thấp |
| 3 | **TL;DR / tóm tắt đầu bài** tự động | UX đọc tốt hơn | Thấp |
| 4 | **"Related posts"** bằng embedding similarity | Giữ chân người đọc | Thấp (đã có pgvector) |
| 5 | **Semantic search** cho blog (không chỉ keyword) | Tìm bài theo ý nghĩa | Trung bình |
| 6 | **"Ask this article"** — hỏi đáp trong từng bài | Tương tác cao | Trung bình |
| 7 | **Dịch song ngữ VN↔EN** tự động | Mở rộng người đọc | Trung bình |
| 8 | **Weekly digest** — AI tổng hợp bài trong tuần gửi newsletter/Telegram | Tái sử dụng content | Trung bình |
| 9 | **Kiểm duyệt bình luận** (nếu có comment) bằng LLM | Chống spam/toxic | Thấp |
| 10 | **Gợi ý chủ đề viết** dựa trên xu hướng + bài đã có | Chống bí ý tưởng | Trung bình |

> Gợi ý: **#1, #2, #3, #4** gần như "free" vì tái dùng pipeline embedding/LLM đã có. Làm ngay trong Phase 3.

---

## 4. Observability / Monitoring (bạn yêu cầu Grafana)

### 4.1. Sự thật về chi phí RAM

Full stack **LGTM** (Loki + Grafana + Tempo + Mimir/Prometheus) rất "ngon" để học nhưng **ngốn 1.5–2.5GB RAM** — cạnh tranh trực tiếp với app trên VPS rẻ.

### 4.2. Hai lựa chọn trung thực

**Lựa chọn A — Self-host gọn (khuyến nghị nếu VPS ≥ 4GB RAM):**
```
Prometheus  → metrics (scrape /metrics của Go & AI worker)
Grafana     → dashboard
Loki        → logs (nhẹ hơn ELK rất nhiều)
Tempo       → traces (tuỳ chọn, bật sau)
OpenTelemetry SDK → instrument code Go + Python
```
Học được đầy đủ metrics/logs/traces. Bật Tempo sau cùng.

**Lựa chọn B — Grafana Cloud Free Tier (khuyến nghị nếu VPS ≤ 2GB hoặc muốn tiết kiệm RAM):**
- Free tier: 10k metrics series, 50GB logs, 50GB traces/tháng — thừa cho blog cá nhân.
- Đẩy dữ liệu lên cloud → **VPS không tốn RAM cho monitoring stack**.
- Vẫn học OpenTelemetry, PromQL, dashboard — chỉ khác nơi lưu trữ.

> **Khuyến nghị: bắt đầu với B (Grafana Cloud Free)** để dồn RAM cho app, rồi thử self-host A trong 1 phase riêng để học vận hành. Đây là quyết định "cân bằng học + tiết kiệm" đúng nhất.

**Instrument tối thiểu nên có:** request rate/latency/error (RED metrics), số token LLM tiêu thụ + chi phí ước tính, thời gian job research, số bài publish.

---

## 5. Chi phí thực tế (USD/tháng) — trong ngân sách 15–40 USD

| Hạng mục | Lựa chọn tiết kiệm | Chi phí ước tính |
|---|---|---|
| VPS | **Hetzner CX22** (2 vCPU, 4GB, 40GB) ~€4.5 · hoặc Contabo ~$6 | **$5–8** |
| Domain | .com/.dev | **~$1** (≈$12/năm) |
| Object storage | **Cloudflare R2** (10GB đầu ~free, egress free) | **$0–2** |
| CDN / DNS / WAF | **Cloudflare** (free plan) | **$0** |
| LLM chat/viết | **Gemini 2.x Flash** / **DeepSeek** / **Claude Haiku** (rẻ, đủ tốt) | **$3–10** |
| Embeddings | `text-embedding-3-small` / Google / local | **$0–2** |
| Web search cho research | **Tavily free tier** (1000 call/tháng) | **$0** |
| Monitoring | **Grafana Cloud Free** | **$0** |
| Telegram Bot | Miễn phí | **$0** |
| **Tổng** | | **~$10–25/tháng** ✅ |

**Mẹo tối ưu chi phí AI (quan trọng nhất):**
1. **Chọn model theo việc**: research/viết dùng model rẻ (Flash/DeepSeek); chỉ dùng model mạnh khi thật cần.
2. **Cache embeddings**: không re-embed bài không đổi.
3. **Prompt caching** (Claude/Gemini hỗ trợ): cache phần system prompt/context lặp lại.
4. **Giới hạn tần suất**: research 1 lần/ngày, không gọi LLM cho mỗi request chatbot nếu intent đơn giản (dùng query DB).
5. **Theo dõi token** qua dashboard Grafana → biết bài nào/tính năng nào tốn tiền.

---

## 6. Claude Code — Plugins / Skills dùng được cho dự án này

Trong môi trường này đã có sẵn nhiều thứ hỗ trợ trực tiếp:

| Nhu cầu của bạn | Skill / Plugin / Tool có sẵn | Ghi chú |
|---|---|---|
| **Telegram 9h sáng + duyệt bài** | Skill **`telegram:configure`**, **`telegram:access`** | Cấu hình bot token, allowlist, chính sách kênh — dùng đúng cho luồng duyệt bài. |
| **Lên lịch/cron** | Skill **`schedule`**, **`loop`**; tool **CronCreate/CronList** | Tạo routine chạy theo cron (vd job 09:00). |
| **Object storage R2 / Cloudflare** | Plugin **cloudflare** (`cloudflare`, `wrangler`, `cloudflare` skill), **`turnstile-spin`** (chống bot form) | R2, Workers, Pages, WAF. Cần OAuth `claude mcp` để bật MCP. |
| **AI agent trên Cloudflare (tuỳ chọn)** | Skill **`cloudflare:agents-sdk`**, **`build-agent`**, **`build-mcp`** | Nếu muốn chạy AI worker serverless thay vì trên VPS. |
| **Tra cứu tài liệu thư viện chuẩn xác** | Plugin **context7** (`resolve-library-id`, `query-docs`) | Lấy docs mới nhất của Tiptap/Next.js/LangChain... thay vì đoán. |
| **Nghiên cứu chuyên sâu 1 chủ đề** | Skill **`deep-research`** | Fan-out search + kiểm chứng + báo cáo có trích dẫn (giống chính tính năng research bạn muốn xây). |
| **Embeddings / model local (0đ)** | Plugin **huggingface-skills** (`hf-cli`, `train-sentence-transformers`, `huggingface-local-models`, `transformers-js`) | Chạy embedding/model open-source để giảm chi phí API. |
| **Thiết kế FE đẹp, không "template"** | Skill **`frontend-design`** | Định hướng typography/màu/bố cục cho blog. |
| **Biểu đồ/dashboard trong FE** | Skill **`dataviz`** | Khi làm trang analytics/stat. |
| **Kiểm thử/tự động hoá trình duyệt** | Plugin **playwright**, **chrome-devtools-mcp** (+ skill `web-perf`, `a11y-debugging`, `debug-optimize-lcp`) | E2E test, đo Core Web Vitals, tối ưu LCP cho blog. |
| **Quy trình phát triển bài bản** | Skills **`brainstorming` → `writing-plans` → `feature-dev` → `test-driven-development` → `code-review` / `security-review`** | Bộ khung để làm từng feature có kỷ luật. |
| **Ghi nhớ ngữ cảnh dự án** | Skill **`remember`**, hệ thống memory | Lưu quyết định kiến trúc giữa các phiên. |

> ⚠️ **Lưu ý xác thực**: Một số MCP server (Cloudflare API, HuggingFace, Atlassian) **cần đăng nhập OAuth** qua `claude mcp` hoặc `/mcp` trong phiên tương tác — phiên hiện tại không tự chạy được. Skill (không phải MCP) như `telegram`, `schedule`, `deep-research`, `frontend-design` thì dùng được ngay.

---

## 7. Roadmap đề xuất (phân phase — chống scope creep)

Nguyên tắc: **mỗi phase ra được thứ chạy thật, demo được**, rồi mới sang phase sau.

### Phase 0 — Nền móng (1–2 tuần)
- VPS + Docker + docker-compose (Postgres, Redis).
- Cloudflare (DNS, R2 bucket, CDN).
- Repo Go core (module hoá) + repo/thư mục AI worker Python.
- CI đơn giản (GitHub Actions: build, test, deploy).

### Phase 1 — Blog cơ bản chạy được (2–3 tuần)
- Go: module `posts`, `auth`, `media` (presigned URL R2).
- `apps/web` (Next.js): trang list/detail bài công khai.
- `apps/admin` (React SPA Vite): login **Google OAuth** (BFF qua Go core), quản lý bài, editor **Tiptap** + upload ảnh R2.
- Deploy end-to-end. **→ Đã có blog dùng thật.**

### Phase 2 — Observability (1 tuần)
- OpenTelemetry cho Go + Next.js.
- Grafana Cloud Free: dashboard RED metrics + logs.
- **→ Nhìn được hệ thống đang chạy ra sao.**

### Phase 3 — AI nền tảng (2–3 tuần)
- pgvector + pipeline embedding khi đăng bài.
- Chatbot RAG (mục 3.1) + semantic search + related posts + auto-tag/SEO/TL;DR (#1–4).
- **→ AI "hiểu" nội dung web.**

### Phase 4 — AI research + Telegram (2–3 tuần)
- AI worker: LangGraph agent research (Tavily) → viết draft.
- Cron 09:00 → gửi Telegram inline buttons → duyệt/đăng.
- **→ Tính năng signature hoàn chỉnh.**

### Phase 5 — Nâng cao / học sâu (tuỳ chọn, liên tục)
- Trợ lý viết trong editor (streaming).
- gRPC giữa core ↔ AI worker (thay REST) để học.
- Self-host LGTM stack để học vận hành.
- Các tính năng AI còn lại (#7–10).

---

## 8. Rủi ro & cách phòng tránh

| Rủi ro | Mức độ | Phòng tránh |
|---|---|---|
| **Scope creep** (ôm quá nhiều bỏ dở) | 🔴 Cao | Đi theo phase; mỗi phase phải ra sản phẩm chạy được mới sang tiếp. |
| Observability ngốn RAM trên VPS rẻ | 🟠 TB | Dùng Grafana Cloud Free trước; self-host sau như 1 bài học riêng. |
| AI hallucination lên bài công khai | 🟠 TB | **Bắt buộc human-in-the-loop**; hiển thị nguồn trích dẫn; không auto-publish. |
| Chi phí LLM vượt kiểm soát | 🟡 Thấp | Model rẻ theo việc, cache, theo dõi token qua dashboard, rate limit. |
| Học Go chậm lúc đầu | 🟡 Thấp | Bắt đầu với Chi/Gin + sqlc; giữ core nhỏ; AI worker để Python cho nhanh. |
| Bí mật/khoá lộ (R2, LLM key) | 🟠 TB | Dùng secrets (không commit), Cloudflare WAF, rate limit, presigned URL có hạn. |
| Lock-in nhà cung cấp AI | 🟡 Thấp | Trừu tượng hoá LLM sau 1 interface; LangChain giúp đổi model dễ. |

---

## 9. Kết luận

Dự án **hoàn toàn khả quan** trong ngân sách 15–40 USD/tháng và phục vụ tốt cả hai mục tiêu **học** và **sản phẩm thật**. Ba quyết định quan trọng nhất để dự án thành công:

1. **KHÔNG làm microservice thật** → làm **Modular Monolith (Go) + 1 AI worker (Python) riêng**. Vẫn học đủ, không trả giá vận hành.
2. **Đi theo roadmap phân phase**, mỗi phase ra sản phẩm chạy được. Chống bỏ dở.
3. **AI luôn có human-in-the-loop** cho việc đăng bài; tối ưu chi phí bằng model rẻ + cache + theo dõi token.

**Bước tiếp theo đề xuất:** chốt phạm vi **Phase 0 + Phase 1** rồi lập kế hoạch triển khai chi tiết (dùng skill `writing-plans`), hoặc dùng skill `feature-dev` để bắt tay vào module `posts` đầu tiên.

---

# PHẦN BỔ SUNG (cập nhật 2026-07-05)

## 10. UI Library cho Next.js (đẹp, phổ biến, nhẹ)

### 10.1. Khuyến nghị số 1: **shadcn/ui + Tailwind CSS + Radix UI**

Đây là combo "đẹp – phổ biến – nhẹ" đúng nhất hiện nay và là mặc định của cộng đồng Next.js.

- **shadcn/ui KHÔNG phải một npm package** — nó là bộ component bạn **copy code vào repo** (CLI `npx shadcn@latest add button`). Bạn **sở hữu code**, sửa thoải mái → nhẹ (chỉ lấy cái cần), tuỳ biến vô hạn.
- Xây trên **Radix UI** (primitive headless, accessible sẵn: focus, keyboard, ARIA) + **Tailwind** (styling).
- Icons: **lucide-react**. Animation: **Motion** (Framer Motion). Toast/table/form đều có sẵn công thức.

### 10.2. So sánh nhanh các lựa chọn

| Lib | Kiểu | Nặng/nhẹ | Khi nào chọn |
|---|---|---|---|
| **shadcn/ui** ⭐ | Copy-in, headless + Tailwind | **Rất nhẹ** (own code) | Mặc định. Đẹp, tuỳ biến cao, phổ biến nhất. |
| **Radix UI** | Primitive headless | Nhẹ | Dùng trực tiếp nếu không thích Tailwind class của shadcn. |
| **Mantine** | Full component lib | Trung bình | Muốn "pin sẵn" nhiều component (date picker, modal...) đỡ tự ráp. |
| **HeroUI** (NextUI cũ) | Component lib đẹp | Trung bình | Muốn đẹp ngay, ít cấu hình, dùng Tailwind. |
| **Park UI** | shadcn-style trên Ark UI | Nhẹ | Muốn đa framework (React/Vue/Solid). |
| **Chakra UI v3** | Component lib | Trung bình–nặng | Thích API prop-based. |
| **MUI / Ant Design** | Enterprise lib | **Nặng** | ❌ Không khuyến nghị cho blog: nặng, khó "thoát template". |

> **Chốt:** shadcn/ui + Tailwind + Radix + lucide + Motion. Nếu muốn nhanh hơn nữa và không ngại "kém độc bản" một chút → HeroUI hoặc Mantine.

---

## 11. Rich Text Editor — So sánh đầy đủ, xếp theo độ phù hợp GIẢM DẦN

Bối cảnh chấm điểm: **blog cá nhân, cần AI hỗ trợ, upload ảnh R2, markdown-friendly, tuỳ biến cao, solo dev**.

| Hạng | Editor | Nền tảng | Ưu | Nhược | Điểm phù hợp |
|---|---|---|---|---|---|
| 🥇 1 | **Tiptap** | ProseMirror | Docs xuất sắc, extension nhiều nhất, cộng đồng lớn, headless, collab (Yjs) dễ | Một số extension xịn là bản trả phí (Pro) | ★★★★★ |
| 🥈 2 | **Novel** | Tiptap + Vercel AI | **AI viết/slash-command có sẵn**, UX Notion, dựng blog-AI nhanh nhất | Ít linh hoạt hơn Tiptap thuần, hệ sinh thái nhỏ hơn | ★★★★★ |
| 🥉 3 | **BlockNote** | ProseMirror/Tiptap | Block-based như Notion, dùng được ngay, đẹp | Kém tự do khi cần layout lạ | ★★★★☆ |
| 4 | **Lexical** | Meta (riêng) | **Hiệu năng top**, kiến trúc node hiện đại, Meta hậu thuẫn, React binding chính chủ | **Nhiều boilerplate hơn**, hệ sinh thái/plugin bên thứ 3 nhỏ hơn Tiptap, docs "ngợp" | ★★★★☆ |
| 5 | **Plate** | Slate | Tích hợp **shadcn/ui** đẹp, nhiều plugin sẵn, AI plugin | Slate đôi khi có edge-case ổn định | ★★★★☆ |
| 6 | **Milkdown** | ProseMirror | **Markdown-first**, plugin-driven, hợp dev viết markdown | Cộng đồng nhỏ hơn | ★★★☆☆ |
| 7 | **Editor.js** | Riêng (block) | Output JSON sạch, block đẹp | Paradigm khác, không phải rich-text truyền thống, plugin rời rạc | ★★★☆☆ |
| 8 | **Quill** | Riêng | Đơn giản, nhẹ, ổn định lâu năm | Khó mở rộng sâu, kiến trúc cũ | ★★☆☆☆ |
| 9 | **Slate** | Toolkit low-level | Tự do tuyệt đối | **Phải tự xây nhiều**, tốn công | ★★☆☆☆ |
| 10 | **TinyMCE / CKEditor** | Classic WYSIWYG | Rất mạnh, đầy đủ | **Nặng, vấn đề license bản thương mại**, kiểu cũ | ★★☆☆☆ |

### 11.1. Đánh giá riêng về Lexical (bạn hỏi)

Lexical **rất tốt** về hiệu năng, độ ổn định và được Meta dùng trong sản phẩm thật (Facebook, WhatsApp web). Nhưng cho **dự án solo cần đi nhanh + nhiều ví dụ cộng đồng + AI**, Lexical **thua Tiptap** ở chỗ: phải viết nhiều code hơn để có tính năng tương đương, plugin bên thứ ba ít hơn, docs dày nhưng dễ "ngợp". 

**Chọn Lexical khi:** hiệu năng/độ mượt trên mobile là ưu tiên tối cao, hoặc bạn muốn học kiến trúc editor hiện đại và không ngại viết nhiều. **Với blog cá nhân của bạn → Tiptap (hoặc Novel) vẫn là lựa chọn tối ưu.**

---

## 12. craft.js & Visual Page Builder (câu hỏi đào sâu của bạn)

### 12.1. craft.js là gì (hiểu chính xác)

**craft.js KHÔNG phải rich text editor, và cũng KHÔNG phải một page builder sẵn dùng.** Nó là **một framework/toolkit React để BẠN TỰ XÂY một page builder** của riêng mình. Nó cung cấp các "viên gạch":

- **Drag & drop** các React component vào canvas
- **Node tree** quản lý cấu trúc trang
- **Settings panel** để chỉnh properties từng component
- **Serialize ra JSON** để lưu, và **load lại từ JSON** để render

Bạn phải **tự dựng UI** của trình builder (toolbar, sidebar, canvas) và tự khai báo component nào được phép kéo-thả. Đổi lại → **tự do tuỳ biến tuyệt đối**.

> Phân biệt: Rich text editor (Tiptap) lo **nội dung chữ trong 1 bài**; page builder (craft.js/Puck) lo **bố cục cả trang bằng kéo-thả block/component**. Hai thứ **bổ sung** nhau, không thay thế.

### 12.2. Vấn đề của craft.js (đã kiểm chứng 2026-07)

- craft.js vẫn còn issue/hoạt động nhưng **bảo trì chậm lại rõ rệt**.
- **Lý do:** tác giả (Prev Wong) đang dồn sức cho dự án kế thừa tên **Reka.js** (xem 12.3) — Reka được xây để làm state engine thế hệ mới cho chính craft.js.
- **Hệ quả:** hỗ trợ **React 19** còn lấn cấn; rủi ro khi build production lâu dài cao hơn một lib đang active.
- **Khuyến nghị thay thế: dùng [Puck](https://puckeditor.com)** — visual editor cho React, **đang bảo trì tích cực** (~13K sao), hợp Next.js App Router, **có UI sẵn dùng ngay** (craft.js phải tự dựng nhiều hơn).

### 12.3. Reka.js là gì và khác craft.js ra sao

**Reka.js** = **hệ thống quản lý state để xây trình no-code/page builder**, cùng tác giả với craft.js. Nó lo phần **lõi khó nhất**: quản lý trạng thái thiết kế của người dùng, dựa trên một **AST (Abstract Syntax Tree)**.

Điểm khác biệt cốt lõi: với Reka, người dùng cuối không chỉ kéo-thả block **tĩnh**, mà có thể tạo **component có logic động** (props, state, render có điều kiện, vòng lặp) — như viết "mini-React" ngay trong trình builder.

| | **craft.js** | **Reka.js** |
|---|---|---|
| Vai trò | Framework dựng **UI** của page builder (drag-drop, canvas, settings) | **Engine state** bên dưới — lưu/sửa trạng thái thiết kế |
| Người dùng cuối làm được | Kéo-thả component **tĩnh** định nghĩa sẵn | Tạo component **có logic động** (state, if, loop) |
| Output | JSON node-tree | **View tree JSON framework-agnostic** (render ở React/Vue/Svelte) |
| Cộng thêm | — | **Collaboration realtime sẵn (CRDT/Yjs)** |
| Trạng thái | Bảo trì chậm | Mới, mạnh hơn nhưng **phức tạp & ngách hơn**, còn thử nghiệm |

Link: Reka.js — https://reka.js.org · GitHub — https://github.com/prevwong/reka.js

### 12.4. Những ứng dụng "hay ho" có thể làm với page builder trong blog

1. **Trình dựng trang chủ / landing / about tuỳ biến** — tự sắp xếp block Hero, Featured posts, CTA... không cần code lại; lưu layout dạng JSON trong DB.
2. **Custom layout cho từng bài đặc biệt** (showcase, case study) — bố cục 2 cột, gallery, section màu — vượt giới hạn rich text.
3. **🌟 AI sinh layout (tính năng độc đáo nhất):** vì output là **JSON**, có thể cho LLM sinh ra JSON layout. *"AI, tạo trang landing cho series bài về Go"* → AI trả JSON → page builder render ngay. Kết nối đẹp giữa **AI** (thứ đang học) và **page builder**.
4. **Trình tạo template newsletter/email** kéo-thả (tái dùng cho weekly digest).
5. **Widget/section builder** cho trang chủ/sidebar (bật/tắt, sắp xếp khối động).

### 12.5. Lời khuyên (chốt)

- **Đáng làm, nhưng để Phase 5 (nâng cao)** — sau khi blog + Tiptap + AI cơ bản đã chạy. Page builder là "món tráng miệng", không phải nền móng.
- **Thứ tự lựa chọn theo độ phù hợp giảm dần:**
  1. **Puck** — cho page builder của blog. Active, có UI sẵn, hợp Next.js. **Bắt đầu bằng cái này.**
  2. **craft.js** — chỉ khi cần tuỳ biến UX trình builder sâu hơn Puck (chấp nhận rủi ro bảo trì chậm).
  3. **Reka.js** — chỉ khi tham vọng biến thành nền tảng no-code **động** thật sự (vượt nhu cầu blog).
- **Điểm chung cả ba:** đều serialize ra **JSON** → giữ được ý tưởng "AI sinh layout" dù chọn cái nào.
- ❌ **Không đưa page builder vào giai đoạn đầu.** Ưu tiên rich text (Tiptap) cho việc viết bài trước.

---

## 13. Cấu trúc code & Design Pattern (để dễ scale)

### 13.1. Câu hỏi lớn trước tiên: **Monorepo hay không?**

Với mục tiêu **học + có nhiều app (web, admin, ai-worker)**, tôi khuyên **monorepo bằng pnpm workspaces + Turborepo** cho phần JS/TS, còn Go và Python để repo/thư mục riêng trong cùng monorepo:

```
blog/
├── apps/
│   ├── web/            # Next.js — blog công khai (SSR/SSG, SEO)
│   └── admin/          # React SPA (Vite + TanStack Router) — dashboard quản trị (mục 14)
├── packages/
│   ├── ui/             # shadcn components dùng chung
│   ├── types/          # type dùng chung (sinh từ OpenAPI/proto)
│   └── api-client/     # client gọi Go API, type-safe
├── services/
│   ├── core/           # Go monolith module hoá
│   └── ai-worker/      # Python (LangChain/LangGraph) + FastAPI
├── infra/              # docker-compose, deploy, monitoring config
└── turbo.json
```

### 13.2. Go core — **Modular Monolith + Clean Architecture-lite (Ports & Adapters)**

Theo chuẩn [golang-standards/project-layout](https://github.com/golang-standards/project-layout), mỗi module tự chứa 3 lớp:

```
services/core/
├── cmd/api/main.go              # entrypoint, wiring
├── internal/
│   ├── modules/
│   │   ├── posts/
│   │   │   ├── handler.go       # transport (HTTP/gRPC) — lớp ngoài
│   │   │   ├── service.go       # business logic — lõi
│   │   │   ├── repository.go    # data access (interface + impl sqlc)
│   │   │   └── domain.go        # struct/entity, error domain
│   │   ├── auth/  media/  chat/
│   ├── platform/                # db, redis, config, logger, otel
│   └── shared/                  # middleware, errors, response helpers
└── pkg/                         # code có thể tái dùng ngoài
```

**Nguyên tắc:** `handler → service → repository`, phụ thuộc đi vào trong (dependency inversion): service định nghĩa **interface** repository, không biết DB nào. Dễ test (mock repo), dễ đổi (Postgres → khác). Dùng **google/wire** hoặc DI thủ công. **Đừng over-abstract** — chỉ tách interface ở ranh giới thật sự cần.

### 13.3. Python AI worker — **Hexagonal + LangGraph structured**

```
services/ai-worker/
├── src/
│   ├── api/               # FastAPI routes (webhook Telegram, health)
│   ├── graphs/            # LangGraph state machines (research_graph.py)
│   ├── agents/            # agent definitions
│   ├── tools/             # web_search, fetch, publish_to_core...
│   ├── prompts/           # prompt templates (versioned)
│   ├── adapters/
│   │   ├── llm/           # interface LLMProvider + impl (gemini, claude, deepseek)
│   │   ├── vectorstore/   # pgvector adapter
│   │   └── core_client/   # gọi Go core API
│   ├── domain/            # pydantic models (Draft, Topic, ResearchResult)
│   └── config.py
└── pyproject.toml         # quản lý bằng uv
```

**Điểm mấu chốt:** trừu tượng hoá LLM sau interface `LLMProvider` → đổi model (Gemini/Claude/DeepSeek) chỉ sửa 1 chỗ. Pydantic cho mọi I/O → type-safe. Đây đúng tinh thần "viết nâng cao, dễ scale".

### 13.4. FE — **Feature-based (tham khảo bulletproof-react)** — áp dụng cho cả `web` và `admin`

**`apps/web` (Next.js — App Router):**

```
apps/web/src/
├── app/                   # App Router (routes, layouts)
├── features/              # nhóm theo tính năng
│   ├── posts/{api,components,hooks,types}.ts
│   ├── chat/
├── components/ui/         # shadcn (hoặc import từ packages/ui)
├── lib/                   # api client, utils, config
└── hooks/  types/  styles/
```

**`apps/admin` (React SPA — Vite + TanStack Router):**

```
apps/admin/src/
├── main.tsx               # entry SPA (tạo router + RouterProvider)
├── routes/                # TanStack Router file-based (__root, login, _authed + con)
├── routeTree.gen.ts       # route tree do plugin sinh (commit)
├── features/              # nhóm theo tính năng
│   ├── posts/{api,queries,components}.ts
│   ├── editor/  auth/  media/
├── components/ui/         # shadcn (import từ packages/ui)
├── lib/                   # api client, queryClient, config
└── styles/
```

Tham khảo kiến trúc chuẩn: [bulletproof-react](https://github.com/alan2207/bulletproof-react). Nguyên tắc: **colocation** (code liên quan ở gần nhau), tính năng độc lập, `features/*` không import chéo lộn xộn. Khác biệt chính: `web` route bằng App Router (file-based của Next), `admin` route bằng TanStack Router (file-based trong `src/routes/`, type-safe + loaders).

---

## 14. Admin Dashboard — **App React SPA riêng (đã chốt)**

**Quyết định (cập nhật 2026-07-05; routing cập nhật 2026-07-07 → TanStack Router):** Admin dashboard là **app React SPA riêng (`apps/admin`, Vite + React + TanStack Router)** trong cùng monorepo — **KHÔNG dùng Next.js**. Next.js chỉ dành cho `apps/web` (blog công khai cần SEO/SSR).

### 14.1. Vì sao SPA riêng hợp lý cho admin

| Lý do | Giải thích |
|---|---|
| **Không cần SEO/SSR** | Admin là khu vực đăng nhập, không index Google → SSR của Next.js là chi phí thừa. |
| **Nhẹ & đơn giản** | Vite build ra static thuần, HMR nhanh, cấu hình ít hơn Next.js cho một dashboard. |
| **Học SPA đúng nghĩa** | Client routing (TanStack Router: type-safe routes/search + loaders), quản lý auth, route guard — kỹ năng SPA hiện đại. |
| **Tách deploy** | Sửa admin không cần build/deploy lại web công khai và ngược lại. |
| **Vẫn chia sẻ code** | Monorepo → dùng chung `packages/ui` (shadcn), `packages/types`, `packages/api-client`. Không trùng lặp. |

### 14.2. So sánh các phương án (để rõ vì sao chọn SPA riêng)

| Phương án | Đánh giá |
|---|---|
| **App `apps/admin` = React SPA (Vite)** ⭐ | **Đã chọn.** Tách deploy, không SEO thừa, học SPA, vẫn share package qua monorepo. |
| Cùng Next.js, route group `(admin)` | Ít việc nhất nhưng gộp admin vào bundle web, kéo theo SSR không cần, không học SPA. Không chọn. |
| Repo hoàn toàn tách biệt | ❌ Thừa cho dự án cá nhân — mất khả năng share package, thêm gánh CI/CD. |

### 14.3. Điểm cần lưu ý khi làm admin SPA

- **Auth: Google OAuth theo BFF pattern (đã chốt).** SPA **không tự giữ token** — Go core lo toàn bộ, xem luồng ở §14.4. SPA chỉ gọi API kèm cookie (`fetch(..., { credentials: 'include' })`) và bọc route bằng **protected route** (chưa đăng nhập → về trang login).
- **Routing:** TanStack Router **file-based** (`src/routes/`, `routeTree.gen.ts` sinh tự động), search params type-safe + route loaders tích hợp TanStack Query.
- **Bảng dữ liệu:** TanStack Table (headless) qua `DataTable<TData>` dùng chung — sort server-side theo URL search, ẩn/hiện cột (column visibility).
- **shadcn/ui:** hỗ trợ Vite tốt — cấu hình `components.json` trỏ về `packages/ui` để dùng chung với web.
- **Editor Tiptap** và luồng **presigned URL upload R2** nằm trong app admin (nơi thực sự soạn bài).
- **Deploy:** build static → host trên **Cloudflare Pages / Vercel (static)** hoặc phục vụ qua Coolify (xem mục 15.3). Không cần Node runtime SSR.

### 14.4. Luồng Google OAuth (BFF pattern) — chi tiết

**Nguyên tắc:** SPA **không bao giờ chạm vào token của Google hay access token**. Go core đóng vai **Backend-for-Frontend (BFF)**: nó là OAuth client, đổi code, và chỉ trả về cho trình duyệt một **session cookie httpOnly**. Đây là khuyến nghị chính thức trong *OAuth 2.0 for Browser-Based Apps (BCP)* — an toàn hơn hẳn việc SPA tự giữ JWT (miễn nhiễm XSS đánh cắp token).

```
1. User bấm "Đăng nhập với Google" trong admin SPA
        → SPA điều hướng tới:  GET {core}/auth/google/login

2. Go core tạo state + PKCE (code_verifier/challenge), lưu tạm (cookie/redis),
   rồi redirect trình duyệt sang trang consent của Google.

3. User đồng ý → Google redirect về:  GET {core}/auth/google/callback?code=...&state=...

4. Go core:
     - kiểm tra state (chống CSRF)
     - đổi code → access/ID token với Google (dùng client_secret + code_verifier)
     - đọc email + email_verified từ ID token
     - ✅ KIỂM TRA ALLOWLIST: email có nằm trong danh sách admin cho phép không?
          → không thì từ chối (403), không tạo session.
     - tạo session (server-side, lưu Redis/DB), set cookie:
          Set-Cookie: sid=<...>; HttpOnly; Secure; SameSite=Lax; Path=/

5. Go core redirect trình duyệt về admin SPA (đã đăng nhập).

6. Mọi request sau: SPA gọi API với  credentials: 'include'
   → cookie tự đính kèm → Go core middleware xác thực session.

7. Logout:  POST {core}/auth/logout  → Go xoá session + clear cookie.
```

**Điểm mấu chốt cần nhớ:**
- **Allowlist email là bắt buộc** — nếu không, *bất kỳ ai có tài khoản Google* đều đăng nhập được. Chỉ cho phép email của bạn (cấu hình qua env/DB).
- **`client_secret` chỉ nằm ở Go core**, không bao giờ lộ ra SPA → đây chính là lý do phải dùng BFF (SPA thuần không giữ được secret an toàn).
- **CORS + cookie:** nếu admin và core khác origin → cần cấu hình CORS `Access-Control-Allow-Credentials: true` và `SameSite=None; Secure` (hoặc đặt cùng domain phụ để dùng `SameSite=Lax`).
- **Thư viện Go:** `golang.org/x/oauth2` + `oauth2/google` lo phần đổi code; tự thêm PKCE + state.

---

## 15. CI/CD

### 15.1. Công cụ: **GitHub Actions** (free, quá đủ cho cá nhân)

Pipeline đề xuất:
```
push/PR →
  ├── lint    (golangci-lint / eslint+prettier / ruff)
  ├── test    (go test / vitest / pytest)
  ├── build   (build Next.js, go build, docker build)
  ├── push    → GHCR (GitHub Container Registry, free)
  └── deploy  → VPS (chỉ khi merge vào main)
```

### 15.2. Deploy lên VPS — 3 cách, xếp theo khuyến nghị

| Cách | Mô tả | Khuyến nghị |
|---|---|---|
| **Coolify** (hoặc Dokploy) ⭐ | Self-hosted PaaS trên VPS: Git push → tự build & deploy, quản lý Docker/DB/SSL/env, có UI | **Số 1 cho bạn.** Giảm cực nhiều việc ops mà vẫn self-host, miễn phí. Học "Heroku tự dựng". |
| **Kamal** | Tool deploy Docker lên VPS zero-downtime (của 37signals), khai báo bằng YAML | Số 2. Học sâu hơn về deploy, không cần UI. |
| **docker-compose + script SSH / Watchtower** | Thủ công nhất, tự viết deploy script | Học nền tảng nhất nhưng nhiều việc tay. |

### 15.3. Frontend deploy — cân nhắc thật

- **`apps/web` (Next.js):** **Vercel Free** — DX tuyệt vời, SSR/ISR sẵn, **tiết kiệm RAM VPS**. Đủ cho traffic cá nhân. Hoặc **Cloudflare Pages** (free) hợp hệ sinh thái Cloudflare (R2). Hoặc self-host qua Coolify nếu muốn "tất cả trên VPS".
- **`apps/admin` (React SPA Vite):** build ra **static** → deploy cực nhẹ trên **Cloudflare Pages / Vercel (static)** (không cần Node runtime SSR), hoặc phục vụ static qua Coolify/Nginx trên VPS. Nhớ cấu hình **SPA fallback** (mọi route → `index.html`) cho client router (TanStack Router).

### 15.4. Nên có thêm

- **Renovate** (hoặc Dependabot): tự cập nhật dependency.
- **Pre-commit hooks**: Husky + lint-staged (FE); pre-commit (Python/Go).
- **Secrets**: GitHub Actions secrets + Coolify env (không commit `.env`).

---

## 16. TypeScript nâng cao (câu hỏi tôi rất thích của bạn)

Đoạn code bạn dán là **type nội bộ của react-hook-form** — dùng **conditional types, mapped types, template literal types, recursive types**. **CÓ, chúng ta hoàn toàn nên viết ở tầm đó** và nó rất đáng học. Áp dụng cụ thể cho dự án:

### 16.1. Kỹ thuật nên áp dụng

```typescript
// 1) Branded types — ID an toàn kiểu, không lẫn PostId với UserId
type Brand<T, B> = T & { readonly __brand: B };
type PostId = Brand<string, 'PostId'>;
type UserId = Brand<string, 'UserId'>;
// -> hàm nhận PostId sẽ báo lỗi nếu truyền UserId

// 2) Zod = single source of truth: định nghĩa schema 1 lần, suy ra type
const PostSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'PUBLISHED']),
});
type Post = z.infer<typeof PostSchema>;   // type tự sinh, luôn khớp validation

// 3) Recursive/mapped types (giống DeepRequired của react-hook-form)
type DeepReadonly<T> = T extends BrowserNativeObject
  ? T
  : { readonly [K in keyof T]: DeepReadonly<T[K]> };

// 4) Template literal types cho type-safe routing/permission
type Permission = `post:${'read' | 'write' | 'delete'}`;

// 5) Discriminated unions cho state AI draft
type DraftState =
  | { status: 'researching' }
  | { status: 'ready'; draft: Post; sources: string[] }
  | { status: 'failed'; error: string };
```

### 16.2. Thư viện hỗ trợ viết type nâng cao

- **[Zod](https://zod.dev)** — validation + suy ra type. Nền tảng của mọi thứ.
- **[type-fest](https://github.com/sindresorhus/type-fest)** — kho utility type nâng cao (`SetOptional`, `PartialDeep`, `Merge`...) — chính là loại tiện ích trong đoạn code bạn dán, viết sẵn cho bạn.
- **[ts-reset](https://github.com/total-typescript/ts-reset)** — vá các type built-in "lỏng" của TS (JSON.parse, filter Boolean...) thành chặt chẽ hơn.

### 16.3. "Vũ khí" quan trọng nhất: **End-to-end type safety Go ↔ TypeScript**

Vì BE là Go (không dùng được tRPC), dùng **contract-first codegen** để type chạy xuyên ngôn ngữ:

- **Cách A (REST + OpenAPI):** Go sinh OpenAPI spec (vd [swaggo/swag](https://github.com/swaggo/swag)) → FE sinh type + client TS bằng **[openapi-typescript](https://github.com/openapi-ts/openapi-typescript)** hoặc **[orval](https://orval.dev)** (kèm TanStack Query hooks).
- **Cách B (gRPC + Protobuf):** dùng **[buf](https://buf.build)** + **[Connect](https://connectrpc.com)** → sinh type Go **và** TS từ cùng 1 file `.proto`. Đây là cách "xịn" nhất, học được nhiều nhất, type an toàn tuyệt đối giữa Go core ↔ AI worker ↔ FE.

> Kết quả: đổi field trong Go → FE **compile lỗi ngay** nếu dùng sai. Đây là "viết nâng cao để dễ scale" đúng nghĩa.

---

## 17. Tổng hợp link thư viện (theo yêu cầu)

**UI / FE**
- shadcn/ui — https://ui.shadcn.com · Radix UI — https://www.radix-ui.com · Tailwind — https://tailwindcss.com
- Mantine — https://mantine.dev · HeroUI — https://www.heroui.com · Park UI — https://park-ui.com · Chakra — https://chakra-ui.com
- lucide (icons) — https://lucide.dev · Motion — https://motion.dev · TanStack Query — https://tanstack.com/query
- Next.js — https://nextjs.org · Auth.js — https://authjs.dev · bulletproof-react — https://github.com/alan2207/bulletproof-react
- Vite — https://vite.dev · TanStack Router — https://tanstack.com/router (cho `apps/admin` SPA)
- Turborepo — https://turbo.build · pnpm workspaces — https://pnpm.io/workspaces

**Rich text / Page builder**
- Tiptap — https://tiptap.dev · Novel — https://novel.sh · BlockNote — https://www.blocknotejs.org
- Lexical — https://lexical.dev · Plate — https://platejs.org · Milkdown — https://milkdown.dev
- Slate — https://docs.slatejs.org · ProseMirror — https://prosemirror.net · Editor.js — https://editorjs.io · Quill — https://quilljs.com
- Puck — https://puckeditor.com · craft.js — https://craft.js.org · GrapesJS — https://grapesjs.com

**Backend Go**
- chi — https://github.com/go-chi/chi · Gin — https://gin-gonic.com · sqlc — https://sqlc.dev · GORM — https://gorm.io
- golang-migrate — https://github.com/golang-migrate/migrate · Atlas — https://atlasgo.io · wire — https://github.com/google/wire
- pgvector — https://github.com/pgvector/pgvector · golangci-lint — https://golangci-lint.run
- oauth2 (Go) — https://pkg.go.dev/golang.org/x/oauth2 · Google OAuth 2.0 — https://developers.google.com/identity/protocols/oauth2 · OAuth for Browser-Based Apps (BCP) — https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps
- project-layout — https://github.com/golang-standards/project-layout · swaggo — https://github.com/swaggo/swag

**Python AI**
- LangChain — https://python.langchain.com · LangGraph — https://langchain-ai.github.io/langgraph
- FastAPI — https://fastapi.tiangolo.com · Pydantic — https://docs.pydantic.dev · Tavily — https://tavily.com
- uv — https://docs.astral.sh/uv · Ruff — https://docs.astral.sh/ruff

**TypeScript nâng cao**
- Zod — https://zod.dev · type-fest — https://github.com/sindresorhus/type-fest · ts-reset — https://github.com/total-typescript/ts-reset
- openapi-typescript — https://github.com/openapi-ts/openapi-typescript · orval — https://orval.dev · Connect — https://connectrpc.com · buf — https://buf.build

**CI/CD & Deploy**
- GitHub Actions — https://docs.github.com/actions · GHCR — https://docs.github.com/packages
- Coolify — https://coolify.io · Dokploy — https://dokploy.com · Kamal — https://kamal-deploy.org · Watchtower — https://containrrr.dev/watchtower
- Renovate — https://docs.renovatebot.com · Husky — https://typicode.github.io/husky · lint-staged — https://github.com/lint-staged/lint-staged

---

## 18. Plugins / Skills bổ sung cần cho các yêu cầu mới

Phần lớn đã có sẵn (xem mục 6). Bổ sung cho các yêu cầu mới:

| Nhu cầu mới | Có sẵn dùng được | Cần cài thêm? |
|---|---|---|
| Tra docs Tiptap/Lexical/Puck/shadcn/LangGraph chính xác | ✅ **context7** (`resolve-library-id` → `query-docs`) | Không |
| Thiết kế UI đẹp, không "template" | ✅ Skill **`frontend-design`** | Không |
| Kiểm tra hiệu năng editor/blog (LCP, CWV), a11y | ✅ **chrome-devtools-mcp** (`web-perf`, `debug-optimize-lcp`, `a11y-debugging`), **playwright** (E2E) | Không |
| Thiết lập CI/CD, hooks, tự động hoá Claude Code | ✅ Skill **`claude-code-setup:claude-automation-recommender`** (gợi ý hooks/subagent/skill cho repo) | Không |
| Commit/PR chuẩn | ✅ Plugin **commit-commands** (`commit`, `commit-push-pr`), **code-review**, **security-review** | Không |
| Deploy/hạ tầng Cloudflare (Pages, R2, Workers) | ✅ Plugin **cloudflare** + `wrangler` | Cần **OAuth** qua `claude mcp`/`/mcp` |
| (Tuỳ chọn) Cho Claude query trực tiếp Postgres khi dev | ❌ Chưa có | Có thể cài thêm **Postgres MCP server** (tuỳ chọn, không bắt buộc) |
| (Tuỳ chọn) Chạy embedding/model open-source 0đ | ✅ Plugin **huggingface-skills** | Cần **OAuth** HF |

> **Kết luận mục 18:** Không bắt buộc cài thêm plugin nào để bắt đầu. Việc nên làm là **bật OAuth** cho Cloudflare MCP (để tự động hoá R2/Pages) và (tuỳ chọn) thêm **Postgres MCP** nếu muốn Claude truy vấn DB khi phát triển. Skill thì đã đủ: `context7`, `frontend-design`, `feature-dev`, `writing-plans`, `test-driven-development`, `code-review`, `claude-automation-recommender`.
