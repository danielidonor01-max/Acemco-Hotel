import { apiRequest } from "@/lib/api";
import { hasApi } from "@/lib/config";
import {
  inventoryItems, assets, workOrders, employees, leaveRequests, payrollPeriods, transactions,
  type InventoryItem, type Department, type Asset, type WorkOrder, type Employee, type LeaveRequest,
  type PayrollPeriod, type Transaction,
} from "@/lib/mock-modules";
import { housekeepingTasks, type HousekeepingTask } from "@/lib/mock";

const num = (v: unknown) => Number(v ?? 0);
const day = (v?: string | null) => (v ? v.slice(0, 10) : "");

/* ---------------- Inventory ---------------- */
export async function listInventory(): Promise<InventoryItem[]> {
  if (!hasApi()) return inventoryItems;
  const { data } = await apiRequest<any[]>("/inventory");
  return data.map((i) => ({ ...i, unitCost: num(i.unitCost), location: i.location ?? "" }));
}
export interface NewInventoryItem {
  name: string; sku: string; department: Department; unit: string;
  currentQty: number; minStockLevel: number; unitCost: number; location?: string;
}
export async function createInventoryItem(input: NewInventoryItem): Promise<void> {
  await apiRequest("/inventory", { method: "POST", body: JSON.stringify(input) });
}

/* ---------------- Maintenance ---------------- */
export async function listAssets(): Promise<Asset[]> {
  if (!hasApi()) return assets;
  const { data } = await apiRequest<any[]>("/assets");
  return data.map((a) => ({ ...a, nextInspection: day(a.nextInspection) }));
}
export async function listWorkOrders(): Promise<WorkOrder[]> {
  if (!hasApi()) return workOrders;
  const { data } = await apiRequest<any[]>("/work-orders");
  return data.map((w) => ({ ...w, asset: w.asset?.name ?? "—", estimatedCost: num(w.estimatedCost) }));
}
export interface NewWorkOrder {
  assetId?: string; type: WorkOrder["type"]; priority: WorkOrder["priority"];
  assignedTo?: string; estimatedCost: number;
}
export async function createWorkOrder(input: NewWorkOrder): Promise<void> {
  await apiRequest("/work-orders", { method: "POST", body: JSON.stringify(input) });
}
export async function updateWorkOrderStatus(id: string, status: WorkOrder["status"]): Promise<void> {
  await apiRequest(`/work-orders/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
}

/* ---------------- HR ---------------- */
export async function listEmployees(): Promise<Employee[]> {
  if (!hasApi()) return employees;
  const { data } = await apiRequest<any[]>("/employees");
  return data.map((e) => ({ ...e, startDate: day(e.startDate) }));
}
export interface NewEmployee {
  employeeNumber: string; name: string; department: string; position: string;
  employmentType: Employee["employmentType"]; status: Employee["status"]; startDate: string;
}
export async function createEmployee(input: NewEmployee): Promise<void> {
  await apiRequest("/employees", { method: "POST", body: JSON.stringify(input) });
}
export async function listLeave(): Promise<LeaveRequest[]> {
  if (!hasApi()) return leaveRequests;
  const { data } = await apiRequest<any[]>("/leave-requests");
  return data.map((l) => ({ ...l, employee: l.employee?.name ?? "—", startDate: day(l.startDate), endDate: day(l.endDate) }));
}
export async function setLeaveStatus(id: string, status: LeaveRequest["status"]): Promise<void> {
  await apiRequest(`/leave-requests/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
}

/* ---------------- Payroll ---------------- */
export async function listPayrollPeriods(): Promise<PayrollPeriod[]> {
  if (!hasApi()) return payrollPeriods;
  const { data } = await apiRequest<any[]>("/payroll-periods");
  return data.map((p) => ({ ...p, totalGross: num(p.totalGross), totalNet: num(p.totalNet), startDate: day(p.startDate), endDate: day(p.endDate) }));
}
export async function setPayrollStatus(id: string, status: PayrollPeriod["status"]): Promise<void> {
  await apiRequest(`/payroll-periods/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
}

/* ---------------- Finance ---------------- */
export async function listTransactions(): Promise<Transaction[]> {
  if (!hasApi()) return transactions;
  const { data } = await apiRequest<any[]>("/finance/transactions");
  return data.map((t) => ({ ...t, amount: num(t.amount), date: day(t.date) }));
}
export interface FinanceSummary {
  revenue: number; expense: number; payroll: number; refund: number; net: number;
  byAccount: Record<string, number>; pending: number;
}
export async function getFinanceSummary(): Promise<FinanceSummary | null> {
  if (!hasApi()) return null;
  const { data } = await apiRequest<FinanceSummary>("/finance/summary");
  return data;
}

/* ---------------- Housekeeping ---------------- */
export async function listHousekeeping(): Promise<HousekeepingTask[]> {
  if (!hasApi()) return housekeepingTasks;
  const { data } = await apiRequest<any[]>("/housekeeping");
  return data.map((t) => ({ ...t, assignedTo: t.assignedTo ?? undefined }));
}
export async function updateHousekeepingStatus(id: string, status: HousekeepingTask["status"]): Promise<void> {
  await apiRequest(`/housekeeping/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
}

/* ---------------- Dashboard + Reports ---------------- */
export interface DashboardStats {
  occupancyRate: number; revenueToday: number; arrivalsToday: number; departuresToday: number;
  pendingReservations: number; lowStockAlerts: number; openWorkOrders: number; activeHousekeeping: number;
}
export async function getDashboardStats(): Promise<DashboardStats | null> {
  if (!hasApi()) return null;
  const { data } = await apiRequest<DashboardStats>("/dashboard/stats");
  return data;
}

export interface ReportsOverview {
  occupancyRate: number;
  revenueByAccount: Record<string, number>;
  totalRevenue: number; totalExpense: number; netPosition: number;
  inventoryValuation: number;
  latestPayroll: { periodName: string; totalGross: number; totalNet: number; headcount: number } | null;
  workOrderSpend: number;
}
export async function getReportsOverview(): Promise<ReportsOverview | null> {
  if (!hasApi()) return null;
  const { data } = await apiRequest<ReportsOverview>("/reports/overview");
  return data;
}
