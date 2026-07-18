import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { PostStatus } from "@ultimate/types";
import { Button } from "@ultimate/ui";
import { Input } from "@ultimate/ui";
import { Textarea } from "@ultimate/ui";
import { Label } from "@ultimate/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@ultimate/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ultimate/ui";
import { useToast } from "@ultimate/ui";
import { ApiError } from "@/lib/apiClient";
import { EditorSwitch } from "@/features/editor/EditorSwitch";
import { uploadImage } from "@/features/media/api";
import { usePostQuery, useCreatePost, useUpdatePost } from "./queries";
import {
  postFormSchema,
  emptyPostForm,
  toUpsertInput,
  postToFormValues,
  type PostFormValues,
} from "./formSchema";

const statusOptions: { value: PostStatus; label: string }[] = [
  { value: "DRAFT", label: "Nháp" },
  { value: "PENDING_APPROVAL", label: "Chờ duyệt" },
  { value: "PUBLISHED", label: "Đã đăng" },
];

export function PostFormPage({ slug }: { slug?: string }) {
  const isEdit = Boolean(slug);
  const navigate = useNavigate();
  const { toast } = useToast();

  const postQuery = usePostQuery(slug);
  const createMutation = useCreatePost();
  const updateMutation = useUpdatePost();
  const [formError, setFormError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  // Đổi key để remount editor khi nạp lại bản mới (editor uncontrolled, chỉ đọc initialHtml lúc mount).
  const [editorKey, setEditorKey] = useState(0);

  // Bọc uploadImage: nếu upload lỗi (vd CORS/mạng/kích thước) thì hiện toast thay vì
  // nuốt im lặng trong editor — người dùng biết vì sao ảnh không chèn được.
  const handleUploadImage = async (file: File): Promise<string> => {
    try {
      return await uploadImage(file);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Tải ảnh lên thất bại.", "error");
      throw e;
    }
  };

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    defaultValues: emptyPostForm,
  });

  // content_json native của editor (best-effort); HTML vẫn là nguồn nạp chung.
  // Dùng ref (không phải state): chỉ đọc lúc submit — keystroke không cần re-render form (A4).
  const contentJsonRef = useRef<unknown>({});

  // Hydrate form đúng MỘT lần khi post load xong. Background refetch tạo object mới
  // nhưng không được reset() đè lên nội dung user đang sửa (A1).
  const hasHydratedRef = useRef(false);
  // HTML nạp editor chốt tại lần load đầu (editor uncontrolled — chỉ đọc lúc mount).
  const initialHtmlRef = useRef<string | null>(null);

  const loaded = postQuery.data;
  if (loaded && initialHtmlRef.current === null) {
    initialHtmlRef.current = loaded.content_html;
  }
  useEffect(() => {
    if (loaded && !hasHydratedRef.current) {
      hasHydratedRef.current = true;
      reset(postToFormValues(loaded));
      contentJsonRef.current = loaded.content_json ?? {};
    }
  }, [loaded, reset]);

  const saving = createMutation.isPending || updateMutation.isPending;

  function onSubmit(values: PostFormValues) {
    setFormError(null);
    setConflict(false); // retry mới: dọn banner conflict cũ, tránh hiện 2 banner cùng lúc
    const input = toUpsertInput(values, contentJsonRef.current);
    const onError = (err: unknown) => {
      if (err instanceof ApiError && err.code === "VERSION_CONFLICT") {
        setConflict(true); // M5: bài đã bị sửa ở nơi khác — không đè, cho user chọn tải lại
        return;
      }
      setFormError(err instanceof ApiError ? err.message : "Lưu bài viết thất bại.");
    };
    if (isEdit && loaded) {
      updateMutation.mutate(
        { id: loaded.id, input: { ...input, version: loaded.version } },
        {
          onSuccess: () => {
            toast("Đã cập nhật bài viết.");
            void navigate({ to: "/posts" });
          },
          onError,
        },
      );
    } else {
      createMutation.mutate(input, {
        onSuccess: () => {
          toast("Đã tạo bài viết.");
          void navigate({ to: "/posts" });
        },
        onError,
      });
    }
  }

  function reloadLatest() {
    setConflict(false);
    hasHydratedRef.current = false; // cho phép hydrate lại từ data mới
    initialHtmlRef.current = null; // chốt lại HTML editor theo bản mới
    setEditorKey((k) => k + 1); // remount editor với initialHtml mới
    void postQuery.refetch();
  }

  if (isEdit && postQuery.isPending) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground" role="status">
        Đang tải…
      </div>
    );
  }
  if (isEdit && postQuery.isError) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-50 p-4 text-sm text-red-700">
        Không tìm thấy bài viết.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Quay lại">
          <Link to="/posts">
            <ArrowLeft />
          </Link>
        </Button>
        <h2 className="text-2xl font-bold tracking-tight">
          {isEdit ? "Sửa bài viết" : "Bài viết mới"}
        </h2>
      </div>

      {formError && (
        <div className="rounded-lg border border-red-500/30 bg-red-50 p-3 text-sm text-red-700">
          {formError}
        </div>
      )}

      {conflict && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-800"
        >
          <span>Bài đã bị sửa ở nơi khác — thay đổi của bạn chưa được lưu.</span>
          <Button type="button" variant="outline" size="sm" onClick={reloadLatest}>
            Tải bản mới nhất
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardContent className="flex flex-col gap-4 p-5">
              <Field label="Tiêu đề" error={errors.title?.message}>
                <Input {...register("title")} placeholder="Tiêu đề bài viết" />
              </Field>
              <Field label="Slug" hint="Để trống sẽ tự sinh từ tiêu đề.">
                <Input {...register("slug")} placeholder="duong-dan-bai-viet" />
              </Field>
              <Field label="Tóm tắt">
                <Textarea {...register("excerpt")} rows={2} placeholder="Mô tả ngắn…" />
              </Field>
              <Field label="Nội dung">
                <input type="hidden" {...register("content")} />
                <EditorSwitch
                  key={editorKey}
                  initialHtml={initialHtmlRef.current ?? ""}
                  onChange={({ html, json }) => {
                    setValue("content", html, { shouldDirty: true });
                    contentJsonRef.current = json;
                  }}
                  uploadImage={handleUploadImage}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SEO (tuỳ chọn)</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Field label="Meta title">
                <Input {...register("metaTitle")} />
              </Field>
              <Field label="Meta description">
                <Textarea {...register("metaDesc")} rows={2} />
              </Field>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Xuất bản</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Field label="Trạng thái">
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    // key={field.value}: radix Select (React 19) không cập nhật label
                    // hiển thị khi `value` đổi sau mount (initial undefined → reset()).
                    // Remount theo value ép Select khởi tạo lại với value đúng.
                    <Select
                      key={field.value}
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Tags" hint="Phân tách bằng dấu phẩy.">
                <Input {...register("tagsCsv")} placeholder="Go, Backend" />
              </Field>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving} className="flex-1">
                  {saving ? "Đang lưu…" : "Lưu"}
                </Button>
                <Button asChild type="button" variant="outline">
                  <Link to="/posts">Huỷ</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
