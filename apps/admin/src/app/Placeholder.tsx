import { Card, CardContent } from "@ultimate/ui";

export function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-2 p-16 text-center">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">
            Trang này sẽ được xây ở sub-slice tiếp theo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
