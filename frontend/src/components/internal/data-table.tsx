"use client";

import { useMemo, useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
  align?: "left" | "right" | "center";
}

/**
 * DataTable (§8.4) — the primary internal listing component. Client-side sort,
 * loading skeleton, empty state, responsive horizontal scroll. Server-side
 * pagination slots in when the real API is wired.
 */
export function DataTable<T extends { id: string }>({
  columns,
  data,
  isLoading,
  emptyState,
  onRowClick,
}: {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  onRowClick?: (row: T) => void;
}) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return data;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return data;
    const val = col.sortValue;
    return [...data].sort((a, b) => {
      const av = val(a), bv = val(b);
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [data, sort, columns]);

  function toggleSort(key: string) {
    setSort((s) =>
      s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-brand-surface shadow-[0_1px_2px_#14100a0d,0_6px_20px_-8px_#14100a12]">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-brand-surface-2/40">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  "px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-fg-muted",
                  c.align === "right" && "text-right",
                  c.align === "center" && "text-center",
                  c.className,
                )}
              >
                {c.sortValue ? (
                  <button
                    type="button"
                    onClick={() => toggleSort(c.key)}
                    className={cn("inline-flex items-center gap-1 transition-colors hover:text-fg", c.align === "right" && "flex-row-reverse")}
                  >
                    {c.header}
                    {sort?.key === c.key ? (
                      sort.dir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />
                    ) : (
                      <ChevronsUpDown size={13} className="opacity-40" />
                    )}
                  </button>
                ) : (
                  c.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-line/60 last:border-0">
                {columns.map((c) => (
                  <td key={c.key} className="px-5 py-4">
                    <div className="int-skeleton h-4 w-2/3" />
                  </td>
                ))}
              </tr>
            ))
          ) : sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-0">
                {emptyState ?? <div className="px-5 py-16 text-center text-fg-soft">No results.</div>}
              </td>
            </tr>
          ) : (
            sorted.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-line/60 last:border-0 transition-colors",
                  onRowClick && "cursor-pointer hover:bg-brand-surface-2/50",
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-5 py-4 text-fg",
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center",
                      c.className,
                    )}
                  >
                    {c.render ? c.render(row) : (row as Record<string, unknown>)[c.key] as React.ReactNode}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
