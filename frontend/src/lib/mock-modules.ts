/**
 * Mock data for the broader operational modules (frontend-only phase).
 * Types mirror the Domain Model. Replaced by the NestJS API later.
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
export const guests: Guest[] = [
  { id: "g-1", name: "James Morrison", phone: "+44 7700 900123", email: "james.m@example.com", nationality: "GB", stays: 6, isVip: true, isBlacklisted: false },
  { id: "g-2", name: "Adaeze Obi", phone: "+234 803 111 2222", email: "adaeze@example.com", nationality: "NG", stays: 3, isVip: false, isBlacklisted: false },
  { id: "g-3", name: "Michael Chen", phone: "+65 8123 4567", nationality: "SG", stays: 2, isVip: false, isBlacklisted: false },
  { id: "g-4", name: "Fatima Bello", phone: "+234 802 777 8888", email: "fatima.b@example.com", nationality: "NG", stays: 1, isVip: false, isBlacklisted: true },
  { id: "g-5", name: "Sarah Nnamdi", phone: "+234 809 555 6666", nationality: "NG", stays: 4, isVip: false, isBlacklisted: false },
  { id: "g-6", name: "Robert Hayes", phone: "+1 415 555 0198", email: "r.hayes@example.com", nationality: "US", stays: 8, isVip: true, isBlacklisted: false },
  { id: "g-7", name: "Ngozi Okonkwo", phone: "+234 811 666 5555", nationality: "NG", stays: 2, isVip: false, isBlacklisted: false },
  { id: "g-8", name: "Tunde Balogun", phone: "+234 805 333 4444", email: "tunde.b@example.com", nationality: "NG", stays: 5, isVip: false, isBlacklisted: false },
];

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
export const inventoryItems: InventoryItem[] = [
  { id: "inv-1", name: "Basmati Rice", sku: "RST-RICE-01", department: "RESTAURANT", unit: "kg", currentQty: 8, minStockLevel: 20, unitCost: 2200, location: "Dry Store A" },
  { id: "inv-2", name: "Chicken (whole)", sku: "RST-CHKN-02", department: "RESTAURANT", unit: "kg", currentQty: 45, minStockLevel: 30, unitCost: 3500, location: "Cold Room 1" },
  { id: "inv-3", name: "Aged Rum", sku: "LNG-RUM-03", department: "LOUNGE", unit: "bottle", currentQty: 6, minStockLevel: 12, unitCost: 14000, location: "Bar Store" },
  { id: "inv-4", name: "Tonic Water", sku: "LNG-TNC-04", department: "LOUNGE", unit: "can", currentQty: 120, minStockLevel: 48, unitCost: 500, location: "Bar Store" },
  { id: "inv-5", name: "Bath Towels", sku: "HK-TWL-05", department: "HOUSEKEEPING", unit: "piece", currentQty: 60, minStockLevel: 80, unitCost: 3000, location: "Linen Room" },
  { id: "inv-6", name: "All-purpose Cleaner", sku: "HK-CLN-06", department: "HOUSEKEEPING", unit: "litre", currentQty: 22, minStockLevel: 15, unitCost: 1200, location: "Housekeeping Store" },
  { id: "inv-7", name: "LED Bulbs 9W", sku: "MNT-BLB-07", department: "MAINTENANCE", unit: "piece", currentQty: 14, minStockLevel: 20, unitCost: 900, location: "Workshop" },
  { id: "inv-8", name: "A4 Paper Ream", sku: "OFF-PPR-08", department: "OFFICE", unit: "ream", currentQty: 30, minStockLevel: 10, unitCost: 3500, location: "Admin Store" },
  { id: "inv-9", name: "Signature Candle (retail)", sku: "BTQ-CDL-09", department: "BOUTIQUE", unit: "piece", currentQty: 24, minStockLevel: 10, unitCost: 6000, location: "Boutique" },
  { id: "inv-10", name: "Coffee Beans", sku: "RST-COF-10", department: "RESTAURANT", unit: "kg", currentQty: 3, minStockLevel: 8, unitCost: 8000, location: "Dry Store A" },
];

/* ---------------- Maintenance (Domain §5.3) ---------------- */
export interface Asset {
  id: string; assetNumber: string; name: string; category: string; location: string;
  status: "OPERATIONAL" | "INSPECTION_DUE" | "NEEDS_REPAIR" | "UNDER_REPAIR" | "DECOMMISSIONED";
  nextInspection: string;
}
export const assets: Asset[] = [
  { id: "as-1", assetNumber: "AST-0042", name: "Generator — Main", category: "Power", location: "Basement", status: "OPERATIONAL", nextInspection: "2026-08-01" },
  { id: "as-2", assetNumber: "AST-0043", name: "Chiller Unit 1", category: "HVAC", location: "Roof", status: "INSPECTION_DUE", nextInspection: "2026-07-10" },
  { id: "as-3", assetNumber: "AST-0044", name: "Elevator A", category: "Vertical Transport", location: "Core", status: "NEEDS_REPAIR", nextInspection: "2026-07-06" },
  { id: "as-4", assetNumber: "AST-0045", name: "Pool Pump", category: "Leisure", location: "Rooftop", status: "UNDER_REPAIR", nextInspection: "2026-07-15" },
  { id: "as-5", assetNumber: "AST-0046", name: "Kitchen Extractor", category: "Kitchen", location: "Restaurant", status: "OPERATIONAL", nextInspection: "2026-09-01" },
];
export interface WorkOrder {
  id: string; workOrderNumber: string; asset: string; type: "CORRECTIVE" | "PREVENTIVE" | "INSPECTION";
  priority: "LOW" | "NORMAL" | "HIGH" | "CRITICAL"; status: "OPEN" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED";
  assignedTo?: string; estimatedCost: number;
}
export const workOrders: WorkOrder[] = [
  { id: "wo-1", workOrderNumber: "WO-2026-00018", asset: "Elevator A", type: "CORRECTIVE", priority: "CRITICAL", status: "OPEN", assignedTo: "Ibrahim K.", estimatedCost: 180000 },
  { id: "wo-2", workOrderNumber: "WO-2026-00019", asset: "Chiller Unit 1", type: "INSPECTION", priority: "NORMAL", status: "IN_PROGRESS", assignedTo: "Femi O.", estimatedCost: 25000 },
  { id: "wo-3", workOrderNumber: "WO-2026-00020", asset: "Pool Pump", type: "CORRECTIVE", priority: "HIGH", status: "IN_PROGRESS", assignedTo: "Ibrahim K.", estimatedCost: 60000 },
  { id: "wo-4", workOrderNumber: "WO-2026-00021", asset: "Generator — Main", type: "PREVENTIVE", priority: "NORMAL", status: "COMPLETED", assignedTo: "Femi O.", estimatedCost: 40000 },
];

/* ---------------- HR (Domain §6.1) ---------------- */
export interface Employee {
  id: string; employeeNumber: string; name: string; department: string; position: string;
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN";
  status: "ACTIVE" | "SUSPENDED" | "TERMINATED" | "RESIGNED"; startDate: string;
}
export const employees: Employee[] = [
  { id: "e-1", employeeNumber: "EMP-0042", name: "Blessing Aigbe", department: "Housekeeping", position: "Room Attendant", employmentType: "FULL_TIME", status: "ACTIVE", startDate: "2024-03-01" },
  { id: "e-2", employeeNumber: "EMP-0043", name: "Emeka Nwosu", department: "Housekeeping", position: "Supervisor", employmentType: "FULL_TIME", status: "ACTIVE", startDate: "2023-06-15" },
  { id: "e-3", employeeNumber: "EMP-0044", name: "Ada Okoro", department: "Management", position: "Hotel Manager", employmentType: "FULL_TIME", status: "ACTIVE", startDate: "2022-01-10" },
  { id: "e-4", employeeNumber: "EMP-0045", name: "Ibrahim Kabir", department: "Maintenance", position: "Technician", employmentType: "FULL_TIME", status: "ACTIVE", startDate: "2024-09-01" },
  { id: "e-5", employeeNumber: "EMP-0046", name: "Chidi Eze", department: "Restaurant", position: "Chef de Partie", employmentType: "FULL_TIME", status: "ACTIVE", startDate: "2023-11-20" },
  { id: "e-6", employeeNumber: "EMP-0047", name: "Halima Sani", department: "Front Desk", position: "Receptionist", employmentType: "PART_TIME", status: "ACTIVE", startDate: "2025-02-01" },
  { id: "e-7", employeeNumber: "EMP-0048", name: "Peter Obi", department: "Lounge", position: "Bartender", employmentType: "CONTRACT", status: "SUSPENDED", startDate: "2024-07-05" },
];
export interface LeaveRequest {
  id: string; employee: string; type: "ANNUAL" | "SICK" | "MATERNITY" | "PATERNITY" | "UNPAID" | "COMPASSIONATE";
  startDate: string; endDate: string; days: number; status: "PENDING" | "APPROVED" | "REJECTED";
}
export const leaveRequests: LeaveRequest[] = [
  { id: "lv-1", employee: "Halima Sani", type: "ANNUAL", startDate: "2026-07-14", endDate: "2026-07-18", days: 5, status: "PENDING" },
  { id: "lv-2", employee: "Chidi Eze", type: "SICK", startDate: "2026-07-05", endDate: "2026-07-06", days: 2, status: "APPROVED" },
  { id: "lv-3", employee: "Blessing Aigbe", type: "COMPASSIONATE", startDate: "2026-07-20", endDate: "2026-07-22", days: 3, status: "PENDING" },
];

/* ---------------- Payroll (Domain §6.2) ---------------- */
export interface PayrollPeriod {
  id: string; periodName: string; startDate: string; endDate: string;
  status: "DRAFT" | "PROCESSING" | "APPROVED" | "PAID" | "CLOSED";
  totalGross: number; totalNet: number; headcount: number;
}
export const payrollPeriods: PayrollPeriod[] = [
  { id: "pp-1", periodName: "June 2026", startDate: "2026-06-01", endDate: "2026-06-30", status: "PAID", totalGross: 8_400_000, totalNet: 7_140_000, headcount: 42 },
  { id: "pp-2", periodName: "July 2026", startDate: "2026-07-01", endDate: "2026-07-31", status: "PROCESSING", totalGross: 8_550_000, totalNet: 7_267_500, headcount: 43 },
];

/* ---------------- Finance (Domain §7) ---------------- */
export interface Transaction {
  id: string; transactionNumber: string; type: "REVENUE" | "EXPENSE" | "PAYROLL" | "REFUND";
  amount: number; direction: "DEBIT" | "CREDIT"; account: string; description: string;
  date: string; status: "PENDING" | "POSTED" | "VOIDED";
}
export const transactions: Transaction[] = [
  { id: "t-1", transactionNumber: "TXN-2026-04821", type: "REVENUE", amount: 480000, direction: "CREDIT", account: "Room Revenue", description: "Reservation RES-2026-00042", date: "2026-07-05", status: "POSTED" },
  { id: "t-2", transactionNumber: "TXN-2026-04822", type: "REVENUE", amount: 25500, direction: "CREDIT", account: "F&B Revenue", description: "Order REST-2026-00219", date: "2026-07-05", status: "POSTED" },
  { id: "t-3", transactionNumber: "TXN-2026-04823", type: "EXPENSE", amount: 180000, direction: "DEBIT", account: "Repairs & Maintenance", description: "WO-2026-00018 Elevator", date: "2026-07-05", status: "PENDING" },
  { id: "t-4", transactionNumber: "TXN-2026-04824", type: "EXPENSE", amount: 96000, direction: "DEBIT", account: "Utilities", description: "Diesel supply", date: "2026-07-04", status: "POSTED" },
  { id: "t-5", transactionNumber: "TXN-2026-04825", type: "REVENUE", amount: 24500, direction: "CREDIT", account: "F&B Revenue", description: "Order LNGE-2026-00061", date: "2026-07-05", status: "POSTED" },
  { id: "t-6", transactionNumber: "TXN-2026-04826", type: "REFUND", amount: 58000, direction: "DEBIT", account: "Room Revenue", description: "Cancellation RES-2026-00053", date: "2026-07-05", status: "POSTED" },
  { id: "t-7", transactionNumber: "TXN-2026-04827", type: "PAYROLL", amount: 7140000, direction: "DEBIT", account: "Salaries", description: "June 2026 payroll", date: "2026-06-30", status: "POSTED" },
];

/* ---------------- Reports (Domain §8.2) ---------------- */
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
