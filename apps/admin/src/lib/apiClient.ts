import type { z } from "zod";
import { CORE_URL } from "./config";

/** Lỗi API kèm HTTP status + mã lỗi domain. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Lỗi khi response không khớp schema mong đợi (bug hợp đồng API). */
export class ApiSchemaError extends Error {
  constructor(
    public path: string,
    public cause: unknown,
  ) {
    super(`response from ${path} did not match expected schema`);
    this.name = "ApiSchemaError";
  }
}

// Có schema → validate và trả về type suy ra từ schema.
export async function apiFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T>;
// schema = null → endpoint không trả nội dung (vd 204).
export async function apiFetch(path: string, schema: null, init?: RequestInit): Promise<void>;
export async function apiFetch<T>(
  path: string,
  schema: z.ZodType<T> | null,
  init?: RequestInit,
): Promise<T | void> {
  const res = await fetch(`${CORE_URL}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let code = "ERROR";
    let message = res.statusText || "request failed";
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string } };
      if (body?.error?.code) code = body.error.code;
      if (body?.error?.message) message = body.error.message;
    } catch {
      // body không phải JSON — giữ message mặc định
    }
    throw new ApiError(res.status, code, message);
  }

  if (schema === null) return;
  // Có schema nhưng 204 (không body) là vi phạm hợp đồng — báo lỗi thay vì trả undefined as T.
  if (res.status === 204) {
    throw new ApiSchemaError(path, new Error("expected response body but got 204"));
  }

  const json: unknown = await res.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ApiSchemaError(path, parsed.error);
  }
  return parsed.data;
}
