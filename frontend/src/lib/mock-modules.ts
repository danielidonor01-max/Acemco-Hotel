/**
 * Shared domain types for the operational modules. The system runs on the live
 * API — no sample data lives here. `reportDefs` is static UI config describing
 * the report catalogue, not business data.
 */

/* ---------------- Guests (Domain §3.3) ---------------- */
export interface Guest {
  id: string;
  name: string;
  phone: string;
  email?: string;
  nationality: string;
  stays: number;
  isVip: boolean;
  isBlacklisted: boolean;
}

/* ---------------- Inventory (Domain §5.1) ---------------- */
export type Department = "RESTAURANT" | "LOUNGE" | "BOUTIQUE" | "HOUSEKEEPING" | "MAINTENANCE" | "OFFICE" | "GENERAL";
export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  department: Department;
  unit: string;
  currentQty: number;
  minStockLevel: number;
  unitCost: number;
  location: string;
}

/* ---------------- Maintenance (Domain §5.3) ---------------- */
export interface Asset {
  id: string; assetNumber: string; name: string; category: string; location: string;
  status: "OPERATIONAL" | "INSPECTION_DUE" | "NEEDS_REPAIR" | "UNDER_REPAIR" | "DECOMMISSIONED";
  nextInspection: string;
}
export interface WorkOrder {
  id: string; workOrderNumber: string; asset: string; type: "CORRECTIVE" | "PREVENTIVE" | "INSPECTION";
  priority: "LOW" | "NORMAL" | "HIGH" | "CRITICAL"; status: "OPEN" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED";
  assignedTo?: string; estimatedCost: number;
}

/* ---------------- HR (Domain §6.1) ---------------- */
export interface Employee {
  id: string; employeeNumber: string; name: string; department: string; position: string;
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN";
  status: "ACTIVE" | "SUSPENDED" | "TERMINATED" | "RESIGNED"; startDate: string;
}
export interface LeaveRequest {
  id: string; employee: string; type: "ANNUAL" | "SICK" | "MATERNITY" | "PATERNITY" | "UNPAID" | "COMPASSIONATE";
  startDate: string; endDate: string; days: number; status: "PENDING" | "APPROVED" | "REJECTED";
}

/* ---------------- Payroll (Domain §6.2) ---------------- */
export interface PayrollPeriod {
  id: string; periodName: string; startDate: string; endDate: string;
  status: "DRAFT" | "PROCESSING" | "APPROVED" | "PAID" | "CLOSED";
  totalGross: number; totalNet: number; headcount: number;
}

/* ---------------- Finance (Domain §7) ---------------- */
export interface Transaction {
  id: string; transactionNumber: string; type: "REVENUE" | "EXPENSE" | "PAYROLL" | "REFUND";
  amount: number; direction: "DEBIT" | "CREDIT"; account: string; description: string;
  date: string; status: "PENDING" | "POSTED" | "VOIDED";
}

/* ---------------- Reports (Domain §8.2) — static UI catalogue ---------------- */
export interface ReportDef {
  id: string; name: string; module: string; description: string;
}
export const reportDefs: ReportDef[] = [
  { id: "rp-1", name: "Occupancy & ADR", module: "Rooms", description: "Daily occupancy rate and average daily rate." },
  { id: "rp-2", name: "Revenue by Department", module: "Finance", description: "Rooms, F&B, and boutique revenue split." },
  { id: "rp-3", name: "Reservations Pace", module: "Reservations", description: "Bookings on the books vs. same time last year." },
  { id: "rp-4", name: "Inventory Valuation", module: "Inventory", description: "Current stock value by department." },
  { id: "rp-5", name: "Payroll Summary", module: "Payroll", description: "Gross, deductions, and net by period." },
  { id: "rp-6", name: "Work Order Costs", module: "Maintenance", description: "Estimated vs. actual maintenance spend." },
];
