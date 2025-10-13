/* eslint-disable @typescript-eslint/no-explicit-any */
// components/table/data-table.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type Table as TanTable,
} from "@tanstack/react-table";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  List,
  ListCollapse,
  Search,
  Settings2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export type { ColumnDef };

/**
 * Reusable DataTable with:
 * - Sorting, global filtering, column visibility
 * - Client pagination
 * - Density toggle (comfortable/compact)
 * - Export CSV (current view)
 * - Optional row link
 *
 * Usage:
 * <DataTable
 *   columns={columns}
 *   data={rows}
 *   isLoading={isLoading}
 *   rowLink={(row) => `/paper/${row.arxivId}`}
 * />
 */

export type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  getRowId?: (originalRow: TData, index: number, parent?: any) => string;
  rowLink?: (row: TData) => string | undefined;
  initialSorting?: SortingState;
  initialColumnVisibility?: VisibilityState;
  toolbar?: React.ReactNode; // optional custom right-side toolbar controls
  className?: string;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  pageSize = 10,
  pageSizeOptions = [10, 20, 50, 100],
  getRowId,
  rowLink,
  initialSorting = [],
  initialColumnVisibility,
  toolbar,
  className,
  emptyTitle = "No results",
  emptyDescription = "Try adjusting filters or search.",
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(initialColumnVisibility || {});
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [density, setDensity] = React.useState<"comfortable" | "compact">(
    "comfortable"
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      globalFilter,
    },
    globalFilterFn: fuzzyIncludes,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId,
    initialState: {
      pagination: { pageSize },
    },
  });

  const rowClass =
    density === "compact"
      ? "h-9 [&>td]:py-1.5 [&>th]:py-1.5"
      : "h-12 [&>td]:py-2.5 [&>th]:py-2.5";

  const visibleRows = table.getRowModel().rows;
  const isEmpty = !isLoading && visibleRows.length === 0;

  return (
    <div className={["rounded-xl border bg-card", className || ""].join(" ")}>
      {/* Toolbar */}
      <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <DebouncedInput
              value={globalFilter ?? ""}
              onChange={(v) => setGlobalFilter(String(v))}
              placeholder="Search…"
              className="pl-8"
            />
          </div>

          {/* Density */}
          <div className="hidden items-center gap-1 sm:flex">
            <Button
              type="button"
              variant={density === "comfortable" ? "secondary" : "outline"}
              size="sm"
              className="h-8 px-2"
              onClick={() => setDensity("comfortable")}
              aria-pressed={density === "comfortable"}
              title="Comfortable"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={density === "compact" ? "secondary" : "outline"}
              size="sm"
              className="h-8 px-2"
              onClick={() => setDensity("compact")}
              aria-pressed={density === "compact"}
              title="Compact"
            >
              <ListCollapse className="h-4 w-4" />
            </Button>
          </div>

          {/* Column visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <Columns3 className="h-4 w-4" />
                Columns
                <ChevronDown className="h-4 w-4 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllLeafColumns()
                .filter(
                  (column) => typeof column.columnDef.header !== "undefined"
                )
                .map((column) => {
                  const headerText =
                    typeof column.columnDef.header === "string"
                      ? column.columnDef.header
                      : column.id;
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {headerText}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Export */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => exportCSV(table)}
            title="Export CSV (current view)"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>

        {/* Right-side slot (custom controls) */}
        <div className="flex items-center gap-2">
          {toolbar}
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            <Settings2 className="h-4 w-4" />
            View
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="w-full overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className={rowClass}>
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      className={[
                        "whitespace-nowrap",
                        canSort ? "cursor-pointer select-none" : "",
                      ].join(" ")}
                      onClick={
                        canSort
                          ? header.column.getToggleSortingHandler()
                          : undefined
                      }
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                          ? "descending"
                          : "none"
                      }
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                      {sorted ? (
                        <span className="ml-1 text-[10px] text-muted-foreground">
                          {sorted === "asc" ? "▲" : "▼"}
                        </span>
                      ) : null}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {isLoading ? (
              <SkeletonRows
                columns={table.getAllLeafColumns().length}
                count={Math.min(pageSize, 6)}
              />
            ) : isEmpty ? (
              <TableRow>
                <TableCell
                  colSpan={table.getAllLeafColumns().length}
                  className="p-0"
                >
                  <div className="p-6">
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon" />
                        <EmptyTitle>{emptyTitle}</EmptyTitle>
                        <EmptyDescription>{emptyDescription}</EmptyDescription>
                      </EmptyHeader>
                      <EmptyContent />
                    </Empty>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => {
                const href = rowLink?.(row.original);
                return (
                  <TableRow
                    key={row.id}
                    data-clickable={!!href}
                    className={[
                      rowClass,
                      href
                        ? "relative hover:bg-accent/60 focus-within:bg-accent/60"
                        : "",
                    ].join(" ")}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="align-middle">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                    {href ? (
                      <td className="pointer-events-none absolute inset-0">
                        <Link href={href} className="block h-full w-full" />
                      </td>
                    ) : null}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
        <div className="text-xs text-muted-foreground">
          {table.getFilteredRowModel().rows.length} results
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-8 rounded-md border bg-card px-2 text-xs"
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
          >
            {pageSizeOptions.map((s) => (
              <option key={s} value={s}>
                {s} / page
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs tabular-nums">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount() || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ===== Helpers & subcomponents ===== */

function SkeletonRows({
  columns,
  count = 5,
}: {
  columns: number;
  count?: number;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, r) => (
        <TableRow key={`sk-${r}`}>
          {Array.from({ length: columns }).map((__, c) => (
            <TableCell key={`sk-${r}-${c}`}>
              <div className="h-3 w-full rounded bg-muted/50" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function DebouncedInput({
  value: initialValue,
  onChange,
  debounce = 250,
  className,
  ...props
}: {
  value: string | number;
  onChange: (value: string | number) => void;
  debounce?: number;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange">) {
  const [value, setValue] = React.useState(initialValue);

  React.useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  React.useEffect(() => {
    const t = setTimeout(() => onChange(value), debounce);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Input
      {...props}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className={className}
    />
  );
}

function exportCSV<TData>(table: TanTable<TData>): void {
  const cols = table
    .getAllLeafColumns()
    .filter((c) => c.getIsVisible() && c.id !== "_selector");

  const headers = cols.map((c) =>
    typeof c.columnDef.header === "string" ? c.columnDef.header : c.id
  );

  const rows = table.getRowModel().rows.map((row) =>
    cols.map((c) => {
      const v = row.getValue(c.id) as unknown;
      return csvEscape(valueToString(v));
    })
  );

  const csv = [
    headers.map(csvEscape).join(","),
    ...rows.map((r) => r.join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `export-${new Date().toISOString().slice(0, 19)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function valueToString(v: unknown): string {
  if (v == null) return "";

  switch (typeof v) {
    case "string":
      return v;
    case "number":
    case "boolean":
    case "bigint":
      return String(v);
    case "symbol":
      // TS narrows correctly when using typeof directly
      return v.description ?? v.toString();
    case "function":
      return "[function]";
    case "object":
      if (Array.isArray(v)) {
        return v.map((x) => valueToString(x)).join(" | ");
      }
      if (v instanceof Date) {
        return v.toISOString();
      }
      try {
        const s = JSON.stringify(v);
        return typeof s === "string" ? s : String(v);
      } catch {
        return String(v);
      }
    default:
      return String(v);
  }
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// Simple, case-insensitive contains (global filter)
function fuzzyIncludes(
  row: any,
  columnId: string,
  filterValue: string
): boolean {
  const v = row.getValue(columnId);
  if (v == null) return false;
  const hay =
    typeof v === "string"
      ? v
      : typeof v === "number" || typeof v === "boolean"
      ? String(v)
      : Array.isArray(v)
      ? v.join(" ")
      : JSON.stringify(v);
  return hay.toLowerCase().includes(String(filterValue).toLowerCase());
}
