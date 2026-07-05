"use client";

import { useState } from "react";
import { UserCog, Plus, Check, X } from "lucide-react";
import { PageShell, Button, Badge, StatusBadge, EmptyState } from "@/components/internal/ui";
import { DataTable, type Column } from "@/components/internal/data-table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { employees, leaveRequests, type Employee, type LeaveRequest } from "@/lib/mock-modules";
import { hasPermission } from "@/lib/permissions";

export default function HRPage() {
  const [leaves, setLeaves] = useState(leaveRequests);

  const empColumns: Column<Employee>[] = [
    {
      key: "name", header: "Employee", sortValue: (e) => e.name,
      render: (e) => (
        <div>
          <p className="font-medium text-foreground">{e.name}</p>
          <p className="text-xs text-muted-foreground">{e.employeeNumber}</p>
        </div>
      ),
    },
    { key: "department", header: "Department", sortValue: (e) => e.department, render: (e) => <span className="text-muted-foreground">{e.department}</span> },
    { key: "position", header: "Position", render: (e) => <span className="text-muted-foreground">{e.position}</span> },
    { key: "employmentType", header: "Type", render: (e) => <Badge tone="neutral">{e.employmentType.replace("_", " ").toLowerCase()}</Badge> },
    { key: "startDate", header: "Started", sortValue: (e) => e.startDate, render: (e) => <span className="text-muted-foreground">{e.startDate}</span> },
    { key: "status", header: "Status", render: (e) => <StatusBadge status={e.status} /> },
  ];

  const leaveColumns: Column<LeaveRequest>[] = [
    { key: "employee", header: "Employee", sortValue: (l) => l.employee, render: (l) => <span className="font-medium text-foreground">{l.employee}</span> },
    { key: "type", header: "Type", render: (l) => <Badge tone="neutral">{l.type.toLowerCase()}</Badge> },
    { key: "dates", header: "Dates", render: (l) => <span className="whitespace-nowrap text-muted-foreground">{l.startDate} → {l.endDate}</span> },
    { key: "days", header: "Days", align: "center" },
    { key: "status", header: "Status", render: (l) => <StatusBadge status={l.status} /> },
    {
      key: "actions", header: "", align: "right",
      render: (l) =>
        l.status === "PENDING" && hasPermission("hr", "APPROVE") ? (
          <div className="flex justify-end gap-1.5">
            <Button size="sm" onClick={() => setLeaves((prev) => prev.map((x) => (x.id === l.id ? { ...x, status: "APPROVED" } : x)))}>
              <Check size={14} /> Approve
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setLeaves((prev) => prev.map((x) => (x.id === l.id ? { ...x, status: "REJECTED" } : x)))}>
              <X size={14} /> Reject
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <PageShell
      title="Human Resources"
      breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "HR" }]}
      actions={hasPermission("hr", "CREATE") && <Button><Plus size={16} /> New Employee</Button>}
    >
      <Tabs defaultValue="employees">
        <TabsList>
          <TabsTrigger value="employees">Employees ({employees.length})</TabsTrigger>
          <TabsTrigger value="leave">Leave Requests ({leaves.filter((l) => l.status === "PENDING").length})</TabsTrigger>
        </TabsList>
        <TabsContent value="employees" className="mt-4">
          <DataTable columns={empColumns} data={employees} emptyState={<EmptyState icon={UserCog} title="No employees" />} />
        </TabsContent>
        <TabsContent value="leave" className="mt-4">
          <DataTable columns={leaveColumns} data={leaves} emptyState={<EmptyState icon={UserCog} title="No leave requests" />} />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
