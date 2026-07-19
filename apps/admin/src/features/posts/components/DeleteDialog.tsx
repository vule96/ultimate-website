import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@ultimate/ui";
import { buttonVariants } from "@ultimate/ui";
import { cn } from "@ultimate/ui";

export function DeleteDialog({
  open,
  onOpenChange,
  title,
  onConfirm,
  pending,
  heading = "Xoá bài viết?",
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onConfirm: () => void;
  pending: boolean;
  heading?: string;
  description?: ReactNode;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogTitle>{heading}</AlertDialogTitle>
        <AlertDialogDescription>
          {description ?? (
            <>
              Bạn sắp xoá <span className="font-medium text-foreground">“{title}”</span>. Hành động
              này không thể hoàn tác.
            </>
          )}
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel className={cn(buttonVariants({ variant: "outline" }))} disabled={pending}>
            Huỷ
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: "destructive" }))}
            disabled={pending}
            onClick={(e) => {
              e.preventDefault(); // để mutation tự đóng dialog khi xong
              onConfirm();
            }}
          >
            {pending ? "Đang xoá…" : "Xoá"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
