/**
 * Permission model (Domain §3.1 / Blueprint §6). Frontend mock for now —
 * replaced by the JWT `permissions` claim when the API is wired.
 */
export type Action = "VIEW" | "CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "EXPORT" | "PRINT";

export interface CurrentUser {
  name: string;
  role: string;
  initials: string;
  permissions: string[]; // "module:ACTION"
}

// Mock signed-in user — HOTEL_MANAGER (broad operational access, no system settings).
export const currentUser: CurrentUser = {
  name: "Ada Okoro",
  role: "HOTEL_MANAGER",
  initials: "AO",
  permissions: [
    "rooms:VIEW", "rooms:CREATE", "rooms:UPDATE", "rooms:DELETE",
    "reservations:VIEW", "reservations:CREATE", "reservations:UPDATE", "reservations:APPROVE",
    "reception:VIEW", "reception:CREATE",
    "guests:VIEW", "guests:CREATE", "guests:UPDATE",
    "pos.restaurant:VIEW", "pos.restaurant:CREATE", "pos.restaurant:UPDATE",
    "pos.lounge:VIEW", "pos.lounge:CREATE",
    "pos.boutique:VIEW", "pos.boutique:CREATE",
    "inventory:VIEW", "housekeeping:VIEW", "maintenance:VIEW",
    "hr:VIEW", "payroll:VIEW", "finance:VIEW", "reports:VIEW", "reports:EXPORT",
    "cms:VIEW", "cms:UPDATE", "settings:VIEW",
  ],
};

export function hasPermission(module: string, action: Action): boolean {
  return currentUser.permissions.includes(`${module}:${action}`);
}
