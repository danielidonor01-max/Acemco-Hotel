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

/* ---------------- Inventory / HR / Maintenance updates ---------------- */
export async function updateInventoryItem(id: string, input: Partial<NewInventoryItem>): Promise<void> {
  await apiRequest(`/inventory/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}
export async function updateEmployee(id: string, input: Partial<Omit<NewEmployee, "employeeNumber">>): Promise<void> {
  await apiRequest(`/employees/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}
export interface NewLeave { employeeId: string; type: LeaveRequest["type"]; startDate: string; endDate: string; days: number; }
export async function createLeave(input: NewLeave): Promise<void> {
  await apiRequest("/leave-requests", { method: "POST", body: JSON.stringify(input) });
}
export type AssetArea = "ROOM" | "POOL" | "BAR" | "RESTAURANT" | "RECEPTION" | "GYM" | "LOUNGE" | "KITCHEN" | "EXTERIOR" | "BACK_OF_HOUSE" | "OTHER";
export interface NewAsset { assetNumber: string; name: string; category: string; area: AssetArea; roomNumber?: string; location: string; status: Asset["status"]; nextInspection?: string; }
export async function createAsset(input: NewAsset): Promise<void> {
  await apiRequest("/assets", { method: "POST", body: JSON.stringify(input) });
}

/* ---------------- Finance create + daily revenue ---------------- */
export interface NewTransaction {
  type: Transaction["type"]; amount: number; direction: Transaction["direction"];
  account: string; description: string; date: string; status?: Transaction["status"];
}
export async function createTransaction(input: NewTransaction): Promise<void> {
  await apiRequest("/finance/transactions", { method: "POST", body: JSON.stringify(input) });
}
export async function getRevenueDaily(days = 7): Promise<{ date: string; amount: number }[]> {
  if (!hasApi()) return [];
  const { data } = await apiRequest<{ date: string; amount: number }[]>(`/finance/revenue-daily?days=${days}`);
  return data;
}

/* ---------------- Folio (guest billing) ---------------- */
export interface FolioLine { id: string; description: string; amount: number; type: string; postedAt: string; }
export interface FolioView {
  folio: { id: string; status: string } | null;
  lines: FolioLine[];
  balance: number;
}
export async function getFolio(reservationId: string): Promise<FolioView> {
  const { data } = await apiRequest<{ folio: { id: string; status: string } | null; lines: any[]; balance: number }>(`/folios/reservation/${reservationId}`);
  return { folio: data.folio, balance: Number(data.balance), lines: data.lines.map((l) => ({ ...l, amount: Number(l.amount) })) };
}
export async function addFolioLine(folioId: string, input: { description: string; amount: number; type: string }): Promise<void> {
  await apiRequest(`/folios/${folioId}/lines`, { method: "POST", body: JSON.stringify(input) });
}

/* ---------------- Audit log ---------------- */
export interface AuditEntry { id: string; action: string; module: string; targetId?: string; occurredAt: string; user: string; }
export async function listAuditLogs(): Promise<AuditEntry[]> {
  if (!hasApi()) return [];
  const { data } = await apiRequest<AuditEntry[]>("/audit-logs?limit=100");
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

export interface OccupancyReport {
  days: number;
  totalRooms: number;
  occupied: number;
  currentOccupancy: number;
  occupancyRate: number;
  roomNights: number;
  roomRevenue: number;
  adr: number;
  revpar: number;
  statusBreakdown: { status: string; count: number }[];
}
export async function getOccupancyReport(days = 30): Promise<OccupancyReport | null> {
  if (!hasApi()) return null;
  const { data } = await apiRequest<OccupancyReport>(`/reports/occupancy?days=${days}`);
  return data;
}
