"use client";

import { Wrench, Plus } from "lucide-react";
import { PageShell, Button, Badge, StatusBadge, EmptyState } from "@/components/internal/ui";
import { DataTable, type Column } from "@/components/internal/data-table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { assets, workOrders, type Asset, type WorkOrder } from "@/lib/mock-modules";
import { hasPermission } from "@/lib/permissions";
import { formatNaira } from "@/lib/utils";

const PRIORITY_TONE = { LOW: "neutral", NORMAL: "info", HIGH: "warning", CRITICAL: "danger" } as const;

export default function MaintenancePage() {
  const assetColumns: Column<Asset>[] = [
    {
      key: "assetNumber", header: "Asset", sortValue: (a) => a.assetNumber,
      render: (a) => (
        <div>
          <p className="font-medium text-foreground">{a.name}</p>
          <p className="text-xs text-muted-foreground">{a.assetNumber} · {a.category}</p>
        </div>
      ),
    },
    { key: "location", header: "Location", render: (a) => <span className="text-muted-foreground">{a.location}</span> },
    { key: "nextInspection", header: "Next inspection", sortValue: (a) => a.nextInspection, render: (a) => <span className="text-muted-foreground">{a.nextInspection}</span> },
    { key: "status", header: "Status", render: (a) => <StatusBadge status={a.status} /> },
  ];

  const woColumns: Column<WorkOrder>[] = [
    {
      key: "workOrderNumber", header: "Work Order", sortValue: (w) => w.workOrderNumber,
      render: (w) => (
        <div>
          <p className="font-medium text-foreground">{w.workOrderNumber}</p>
          <p className="text-xs text-muted-foreground">{w.asset}</p>
        </div>
      ),
    },
    { key: "type", header: "Type", render: (w) => <Badge tone="neutral">{w.type.toLowerCase()}</Badge> },
    { key: "priority", header: "Priority", render: (w) => <Badge tone={PRIORITY_TONE[w.priority]}>{w.priority.toLowerCase()}</Badge> },
    { key: "assignedTo", header: "Assigned", render: (w) => <span className="text-muted-foreground">{w.assignedTo ?? "Unassigned"}</span> },
    { key: "status", header: "Status", render: (w) => <StatusBadge status={w.status} /> },
    { key: "estimatedCost", header: "Est. cost", align: "right", sortValue: (w) => w.estimatedCost, render: (w) => formatNaira(w.estimatedCost) },
  ];

  return (
    <PageShell
      title="Maintenance"
      breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Maintenance" }]}
      actions={hasPermission("maintenance", "CREATE") && <Button><Plus size={16} /> New Work Order</Button>}
    >
      <Tabs defaultValue="workorders">
        <TabsList>
          <TabsTrigger value="workorders">Work Orders ({workOrders.filter((w) => w.status !== "COMPLETED").length})</TabsTrigger>
          <TabsTrigger value="assets">Assets ({assets.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="workorders" className="mt-4">
          <DataTable columns={woColumns} data={workOrders} emptyState={<EmptyState icon={Wrench} title="No work orders" />} />
        </TabsContent>
        <TabsContent value="assets" className="mt-4">
          <DataTable columns={assetColumns} data={assets} emptyState={<EmptyState icon={Wrench} title="No assets" />} />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
