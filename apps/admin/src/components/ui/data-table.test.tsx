import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createColumnHelper, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { DataTable } from "./data-table";

interface Row {
  name: string;
  age: number;
}
const helper = createColumnHelper<Row>();
const columns = [
  helper.accessor("name", { header: "Tên", enableSorting: true }),
  helper.accessor("age", { header: "Tuổi", enableSorting: false }),
] as ColumnDef<Row, unknown>[];

const data: Row[] = [
  { name: "An", age: 20 },
  { name: "Bình", age: 30 },
];

describe("DataTable", () => {
  it("renders headers and rows", () => {
    render(<DataTable columns={columns} data={data} sorting={[]} onSortingChange={vi.fn()} />);
    expect(screen.getByText("Tên")).toBeInTheDocument();
    expect(screen.getByText("An")).toBeInTheDocument();
    expect(screen.getByText("Bình")).toBeInTheDocument();
  });

  it("shows empty message when no data", () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        sorting={[]}
        onSortingChange={vi.fn()}
        emptyMessage="Trống trơn"
      />,
    );
    expect(screen.getByText("Trống trơn")).toBeInTheDocument();
  });

  it("calls onSortingChange when a sortable header is clicked", () => {
    const onSortingChange = vi.fn();
    const sorting: SortingState = [];
    render(
      <DataTable columns={columns} data={data} sorting={sorting} onSortingChange={onSortingChange} />,
    );
    fireEvent.click(screen.getByText("Tên"));
    expect(onSortingChange).toHaveBeenCalled();
  });
});
