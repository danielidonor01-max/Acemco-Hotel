"use client";

import { Shield, Plus } from "lucide-react";
import { PageShell, Card, CardHeader, CardTitle, CardContent, Button, Badge } from "@/components/internal/ui";
import { DataTable, type Column } from "@/components/internal/data-table";
import { currentUser } from "@/lib/permissions";

interface Role { id: string; name: string; description: string; system: boolean }
const ROLES: Role[] = [
  { id: "r1", name: "SUPER_ADMIN", description: "Unrestricted access to all modules and settings.", system: true },
  { id: "r2", name: "HOTEL_MANAGER", description: "Full operational access, no system settings.", system: true },
  { id: "r3", name: "RECEPTION", description: "Reservations, check-in/out, guest management.", system: true },
  { id: "r4", name: "HR", description: "Employee records, attendance, leave, payroll view.", system: true },
  { id: "r5", name: "FINANCE", description: "Financial records, reports, payroll approval.", system: true },
  { id: "r6", name: "RESTAURANT_MANAGER", description: "Restaurant POS, menu, inventory.", system: true },
  { id: "r7", name: "LOUNGE_MANAGER", description: "Lounge POS, menu, inventory.", system: true },
  { id: "r8", name: "BOUTIQUE_MANAGER", description: "Boutique POS, inventory.", system: true },
  { id: "r9", name: "MAINTENANCE", description: "Asset management, work orders.", system: true },
  { id: "r10", name: "HOUSEKEEPING", description: "Housekeeping tasks.", system: true },
  { id: "r11", name: "INVENTORY_OFFICER", description: "All inventory management.", system: true },
];

export default function AdministrationPage() {
  const columns: Column<Role>[] = [
    { key: "name", header: "Role", sortValue: (r) => r.name, render: (r) => <span className="font-medium text-foreground">{r.name.replace(/_/g, " ")}</span> },
    { key: "description", header: "Description", render: (r) => <span className="text-muted-foreground">{r.description}</span> },
    { key: "system", header: "Type", align: "right", render: (r) => <Badge tone={r.system ? "brand" : "neutral"}>{r.system ? "System" : "Custom"}</Badge> },
  ];

  return (
    <PageShell
      title="Administration"
      breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Administration" }]}
      actions={<Button><Plus size={16} /> New Role</Button>}
    >
      <Card className="mb-6">
        <CardHeader><CardTitle>Your Access</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-surface-3 font-semibold text-foreground">{currentUser.initials}</div>
          <div>
            <p className="font-medium text-foreground">{currentUser.name}</p>
            <p className="text-sm text-muted-foreground">{currentUser.role.replace(/_/g, " ")} · {currentUser.permissions.length} permissions</p>
          </div>
          <Badge tone="brand" className="ml-auto"><Shield size={12} className="mr-1" /> {currentUser.role.replace(/_/g, " ")}</Badge>
        </CardContent>
      </Card>

      <DataTable columns={columns} data={ROLES} />
    </PageShell>
  );
}
