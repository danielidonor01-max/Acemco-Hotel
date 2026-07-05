"use client";

import { useMemo, useState } from "react";
import { Package, Plus, AlertTriangle, Boxes, Wallet } from "lucide-react";
import { PageShell, StatCard, Button, Badge, EmptyState } from "@/components/internal/ui";
import { DataTable, type Column } from "@/components/internal/data-table";
import { inventoryItems, type InventoryItem, type Department } from "@/lib/mock-modules";
import { hasPermission } from "@/lib/permissions";
import { formatNaira, cn } from "@/lib/utils";

const DEPTS: (Department | "ALL")[] = ["ALL", "RESTAURANT", "LOUNGE", "BOUTIQUE", "HOUSEKEEPING", "MAINTENANCE", "OFFICE"];

export default function InventoryPage() {
  const [dept, setDept] = useState<Department | "ALL">("ALL");
  const [lowOnly, setLowOnly] = useState(false);

  const filtered = useMemo(
    () => inventoryItems.filter((i) => (dept === "ALL" || i.department === dept) && (!lowOnly || i.currentQty < i.minStockLevel)),
    [dept, lowOnly],
  );

  const lowCount = inventoryItems.filter((i) => i.currentQty < i.minStockLevel).length;
  const stockValue = inventoryItems.reduce((s, i) => s + i.currentQty * i.unitCost, 0);

  const columns: Column<InventoryItem>[] = [
    {
      key: "name", header: "Item", sortValue: (i) => i.name,
      render: (i) => (
        <div>
          <p className="font-medium text-foreground">{i.name}</p>
          <p className="text-xs text-muted-foreground">{i.sku}</p>
        </div>
      ),
    },
    { key: "department", header: "Department", render: (i) => <span className="capitalize text-muted-foreground">{i.department.toLowerCase()}</span> },
    { key: "location", header: "Location", render: (i) => <span className="text-muted-foreground">{i.location}</span> },
    {
      key: "currentQty", header: "In stock", align: "right", sortValue: (i) => i.currentQty,
      render: (i) => {
        const low = i.currentQty < i.minStockLevel;
        return (
          <span className={cn("inline-flex items-center gap-1.5 font-medium", low ? "text-warn" : "text-foreground")}>
            {low && <AlertTriangle size={13} />}
            {i.currentQty} {i.unit} <span className="text-muted-foreground">/ min {i.minStockLevel}</span>
          </span>
        );
      },
    },
    { key: "unitCost", header: "Unit cost", align: "right", sortValue: (i) => i.unitCost, render: (i) => formatNaira(i.unitCost) },
    {
      key: "value", header: "Value", align: "right", sortValue: (i) => i.currentQty * i.unitCost,
      render: (i) => <span className="font-medium text-foreground">{formatNaira(i.currentQty * i.unitCost)}</span>,
    },
  ];

  return (
    <PageShell
      title="Inventory"
      breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Inventory" }]}
      actions={hasPermission("inventory", "CREATE") && <Button><Plus size={16} /> New Item</Button>}
    >
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Total Items" value={String(inventoryItems.length)} icon={Boxes} />
        <StatCard title="Low Stock Alerts" value={String(lowCount)} delta="Below minimum level" deltaType={lowCount ? "negative" : "neutral"} icon={AlertTriangle} />
        <StatCard title="Stock Value" value={formatNaira(stockValue)} icon={Wallet} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {DEPTS.map((d) => (
          <button
            key={d}
            onClick={() => setDept(d)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm capitalize transition-colors",
              dept === d ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {d.toLowerCase()}
          </button>
        ))}
        <button
          onClick={() => setLowOnly((v) => !v)}
          className={cn(
            "ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
            lowOnly ? "border-warn bg-warn-bg text-warn" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          <AlertTriangle size={13} /> Low stock only
        </button>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        emptyState={<EmptyState icon={Package} title="No items match" description="Try a different department or clear the low-stock filter." />}
      />
    </PageShell>
  );
}
