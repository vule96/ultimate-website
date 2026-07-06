import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function DeleteDialog({
  open,
  onOpenChange,
  title,
  onConfirm,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogTitle>Xoá bài viết?</AlertDialogTitle>
        <AlertDialogDescription>
          Bạn sắp xoá <span className="font-medium text-foreground">“{title}”</span>. Hành động này
          không thể hoàn tác.
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
