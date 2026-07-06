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
import { listEmployees, listLeave, setLeaveStatus, createEmployee, updateEmployee, createLeave } from "@/lib/data/operations";
import { type Employee, type LeaveRequest } from "@/lib/mock-modules";
import { useAuth } from "@/providers/auth-provider";

const EMP_TYPES: Employee["employmentType"][] = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"];
const EMP_STATUSES: Employee["status"][] = ["ACTIVE", "SUSPENDED", "TERMINATED", "RESIGNED"];
const LEAVE_TYPES: LeaveRequest["type"][] = ["ANNUAL", "SICK", "MATERNITY", "PATERNITY", "UNPAID", "COMPASSIONATE"];

export default function HRPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [requestingLeave, setRequestingLeave] = useState(false);
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
          <DataTable
            columns={empColumns}
            data={employees}
            onRowClick={hasPermission("hr", "UPDATE") ? (e) => setEditing(e) : undefined}
            emptyState={<EmptyState icon={UserCog} title="No employees" />}
          />
        </TabsContent>
        <TabsContent value="leave" className="mt-4">
          {hasPermission("hr", "CREATE") && (
            <div className="mb-3 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setRequestingLeave(true)}><Plus size={15} /> Request leave</Button>
            </div>
          )}
          <DataTable columns={leaveColumns} data={leaves} isLoading={leaveLoading} emptyState={<EmptyState icon={UserCog} title="No leave requests" />} />
        </TabsContent>
      </Tabs>
      {creating && <EmployeeDialog onClose={() => setCreating(false)} />}
      {editing && <EmployeeDialog employee={editing} onClose={() => setEditing(null)} />}
      {requestingLeave && <LeaveDialog employees={employees} onClose={() => setRequestingLeave(false)} />}
    </PageShell>
  );
}

function EmployeeDialog({ employee, onClose }: { employee?: Employee; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!employee;
  const [form, setForm] = useState({
    employeeNumber: employee?.employeeNumber ?? "", name: employee?.name ?? "", department: employee?.department ?? "",
    position: employee?.position ?? "", employmentType: (employee?.employmentType ?? "FULL_TIME") as Employee["employmentType"],
    status: (employee?.status ?? "ACTIVE") as Employee["status"], startDate: employee?.startDate ?? "",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () =>
      isEdit
        ? updateEmployee(employee!.id, { name: form.name.trim(), department: form.department.trim(), position: form.position.trim(), employmentType: form.employmentType, status: form.status })
        : createEmployee({ employeeNumber: form.employeeNumber.trim(), name: form.name.trim(), department: form.department.trim(), position: form.position.trim(), employmentType: form.employmentType, status: form.status, startDate: form.startDate }),
    onSuccess: () => { toast.success(isEdit ? "Employee updated." : "Employee added."); qc.invalidateQueries({ queryKey: ["employees"] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const canSave = form.employeeNumber.trim() && form.name.trim() && form.department.trim() && form.position.trim() && form.startDate && !save.isPending;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${employee!.name}` : "New Employee"}</DialogTitle>
          <DialogDescription>{isEdit ? "Update role, department, or status." : "Add a staff record to the HR register."}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5"><Label htmlFor="e-num">Employee no.</Label><Input id="e-num" value={form.employeeNumber} disabled={isEdit} onChange={(e) => set("employeeNumber", e.target.value)} placeholder="EMP-0049" /></div>
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
            {isEdit ? (
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EMP_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.toLowerCase()}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid gap-1.5">
                <Label>Start date</Label>
                <DatePicker value={form.startDate} onChange={(v) => set("startDate", v)} placeholder="Select date" />
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!canSave} onClick={() => save.mutate()}>{save.isPending && <Loader2 size={14} className="animate-spin" />} {isEdit ? "Save changes" : "Add employee"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LeaveDialog({ employees, onClose }: { employees: Employee[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ employeeId: "", type: "ANNUAL" as LeaveRequest["type"], startDate: "", endDate: "" });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const days = form.startDate && form.endDate ? Math.max(1, Math.round((+new Date(form.endDate) - +new Date(form.startDate)) / 86_400_000) + 1) : 0;

  const save = useMutation({
    mutationFn: () => createLeave({ employeeId: form.employeeId, type: form.type, startDate: form.startDate, endDate: form.endDate, days }),
    onSuccess: () => { toast.success("Leave request submitted."); qc.invalidateQueries({ queryKey: ["leave"] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const canSave = form.employeeId && form.startDate && form.endDate && days > 0 && !save.isPending;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Leave</DialogTitle>
          <DialogDescription>Submit a leave request for approval.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Employee</Label>
            <Select value={form.employeeId} onValueChange={(v) => set("employeeId", v)}>
              <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(v) => set("type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{LEAVE_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t.toLowerCase()}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5"><Label>Start</Label><DatePicker value={form.startDate} onChange={(v) => set("startDate", v)} placeholder="Select date" /></div>
            <div className="grid gap-1.5"><Label>End</Label><DatePicker value={form.endDate} min={form.startDate} onChange={(v) => set("endDate", v)} placeholder="Select date" /></div>
          </div>
          {days > 0 && <p className="text-sm text-muted-foreground">{days} day{days !== 1 ? "s" : ""}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!canSave} onClick={() => save.mutate()}>{save.isPending && <Loader2 size={14} className="animate-spin" />} Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
