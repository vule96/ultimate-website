import { useEffect, useState, type ReactNode } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import type { PostStatus } from "@ultimate/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
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

export function PostFormPage() {
  const { slug } = useParams();
  const isEdit = Boolean(slug);
  const navigate = useNavigate();
  const { toast } = useToast();

  const postQuery = usePostQuery(slug);
  const createMutation = useCreatePost();
  const updateMutation = useUpdatePost();
  const [formError, setFormError] = useState<string | null>(null);

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
  const [contentJson, setContentJson] = useState<unknown>({});

  // Khi post đã load (chế độ sửa) → prefill form + json.
  const loaded = postQuery.data;
  useEffect(() => {
    if (loaded) {
      reset(postToFormValues(loaded));
      setContentJson(loaded.content_json ?? {});
    }
  }, [loaded, reset]);

  const saving = createMutation.isPending || updateMutation.isPending;

  function onSubmit(values: PostFormValues) {
    setFormError(null);
    const input = toUpsertInput(values, contentJson);
    const onError = (err: unknown) => {
      setFormError(err instanceof ApiError ? err.message : "Lưu bài viết thất bại.");
    };
    if (isEdit && loaded) {
      updateMutation.mutate(
        { id: loaded.id, input },
        {
          onSuccess: () => {
            toast("Đã cập nhật bài viết.");
            navigate("/posts");
          },
          onError,
        },
      );
    } else {
      createMutation.mutate(input, {
        onSuccess: () => {
          toast("Đã tạo bài viết.");
          navigate("/posts");
        },
        onError,
      });
    }
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
                  initialHtml={loaded?.content_html ?? ""}
                  onChange={({ html, json }) => {
                    setValue("content", html, { shouldDirty: true });
                    setContentJson(json);
                  }}
                  uploadImage={uploadImage}
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
                    <Select value={field.value} onValueChange={field.onChange}>
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
