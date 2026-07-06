"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserCog, Plus, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageShell, Button, Badge, StatusBadge, EmptyState } from "@/components/internal/ui";
import { DataTable, type Column } from "@/components/internal/data-table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/internal/date-picker";
import { listEmployees, listLeave, setLeaveStatus, createEmployee } from "@/lib/data/operations";
import { type Employee, type LeaveRequest } from "@/lib/mock-modules";
import { useAuth } from "@/providers/auth-provider";

const EMP_TYPES: Employee["employmentType"][] = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"];

export default function HRPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const { data: employees = [] } = useQuery({ queryKey: ["employees"], queryFn: listEmployees });
  const { data: leaves = [], isLoading: leaveLoading } = useQuery({ queryKey: ["leave"], queryFn: listLeave });

  const decide = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LeaveRequest["status"] }) => setLeaveStatus(id, status),
    onSuccess: () => { toast.success("Leave request updated."); qc.invalidateQueries({ queryKey: ["leave"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

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
            <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: l.id, status: "APPROVED" })}>
              <Check size={14} /> Approve
            </Button>
            <Button size="sm" variant="ghost" disabled={decide.isPending} onClick={() => decide.mutate({ id: l.id, status: "REJECTED" })}>
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
      actions={hasPermission("hr", "CREATE") && <Button onClick={() => setCreating(true)}><Plus size={16} /> New Employee</Button>}
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
          <DataTable columns={leaveColumns} data={leaves} isLoading={leaveLoading} emptyState={<EmptyState icon={UserCog} title="No leave requests" />} />
        </TabsContent>
      </Tabs>
      {creating && <EmployeeDialog onClose={() => setCreating(false)} />}
    </PageShell>
  );
}

function EmployeeDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ employeeNumber: "", name: "", department: "", position: "", employmentType: "FULL_TIME" as Employee["employmentType"], startDate: "" });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => createEmployee({
      employeeNumber: form.employeeNumber.trim(), name: form.name.trim(), department: form.department.trim(),
      position: form.position.trim(), employmentType: form.employmentType, status: "ACTIVE",
      startDate: form.startDate,
    }),
    onSuccess: () => { toast.success("Employee added."); qc.invalidateQueries({ queryKey: ["employees"] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const canSave = form.employeeNumber.trim() && form.name.trim() && form.department.trim() && form.position.trim() && form.startDate && !save.isPending;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Employee</DialogTitle>
          <DialogDescription>Add a staff record to the HR register.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5"><Label htmlFor="e-num">Employee no.</Label><Input id="e-num" value={form.employeeNumber} onChange={(e) => set("employeeNumber", e.target.value)} placeholder="EMP-0049" /></div>
            <div className="grid gap-1.5"><Label htmlFor="e-name">Full name</Label><Input id="e-name" value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5"><Label htmlFor="e-dept">Department</Label><Input id="e-dept" value={form.department} onChange={(e) => set("department", e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="e-pos">Position</Label><Input id="e-pos" value={form.position} onChange={(e) => set("position", e.target.value)} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Employment type</Label>
              <Select value={form.employmentType} onValueChange={(v) => set("employmentType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EMP_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t.replace("_", " ").toLowerCase()}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Start date</Label>
              <DatePicker value={form.startDate} onChange={(v) => set("startDate", v)} placeholder="Select date" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!canSave} onClick={() => save.mutate()}>{save.isPending && <Loader2 size={14} className="animate-spin" />} Add employee</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
