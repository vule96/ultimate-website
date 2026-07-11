import "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // onDelete optional — không ép mọi table trong app phải có action xoá.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData> {
    onDelete?: (row: TData) => void;
  }
}
