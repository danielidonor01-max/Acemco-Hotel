"use client";

import { Users, Plus, Star, Ban } from "lucide-react";
import { PageShell, Button, Badge, EmptyState } from "@/components/internal/ui";
import { DataTable, type Column } from "@/components/internal/data-table";
import { guests, type Guest } from "@/lib/mock-modules";
import { hasPermission } from "@/lib/permissions";

export default function GuestsPage() {
  const columns: Column<Guest>[] = [
    {
      key: "name", header: "Guest", sortValue: (g) => g.name,
      render: (g) => (
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          {g.name}
          {g.isVip && <Star size={14} className="text-primary" fill="currentColor" />}
          {g.isBlacklisted && <Ban size={14} className="text-danger" />}
        </span>
      ),
    },
    { key: "phone", header: "Phone", render: (g) => <span className="text-muted-foreground">{g.phone}</span> },
    { key: "email", header: "Email", render: (g) => <span className="text-muted-foreground">{g.email ?? "—"}</span> },
    { key: "nationality", header: "Nationality", align: "center" },
    { key: "stays", header: "Stays", align: "center", sortValue: (g) => g.stays },
    {
      key: "status", header: "Status",
      render: (g) =>
        g.isBlacklisted ? <Badge tone="danger">Blacklisted</Badge> : g.isVip ? <Badge tone="brand">VIP</Badge> : <Badge tone="neutral">Standard</Badge>,
    },
  ];

  return (
    <PageShell
      title="Guests"
      breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Guests" }]}
      actions={hasPermission("guests", "CREATE") && <Button><Plus size={16} /> New Guest</Button>}
    >
      <DataTable
        columns={columns}
        data={guests}
        emptyState={<EmptyState icon={Users} title="No guests yet" />}
      />
    </PageShell>
  );
}
