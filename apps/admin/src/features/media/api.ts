import { PresignResponseSchema } from "@ultimate/types";
import { apiFetch, ApiError } from "@/lib/apiClient";

/** Content-type ảnh cho phép (khớp allowlist ở core). */
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Upload một ảnh: xin presigned URL từ core → PUT thẳng lên storage → trả public URL.
 * Ném ApiError nếu file không hợp lệ hoặc upload thất bại.
 */
export async function uploadImage(file: File): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new ApiError(400, "INVALID_TYPE", "Chỉ hỗ trợ ảnh PNG, JPEG, WebP, GIF.");
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_SIZE) {
    throw new ApiError(400, "INVALID_SIZE", "Ảnh phải nhỏ hơn 5MB.");
  }

  const presign = await apiFetch("/api/v1/media/presign", PresignResponseSchema, {
    method: "POST",
    body: JSON.stringify({ filename: file.name, content_type: file.type, size: file.size }),
  });

  const putRes = await fetch(presign.upload_url, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!putRes.ok) {
    throw new ApiError(putRes.status, "UPLOAD_FAILED", "Tải ảnh lên thất bại.");
  }

  return presign.public_url;
}
