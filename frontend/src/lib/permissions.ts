/**
 * Permission action vocabulary (Domain §3.1). The authoritative permission set
 * for the signed-in user comes from the API's JWT `permissions` claim via
 * `useAuth()` — there is no client-side source of truth for who-can-do-what.
 */
export type Action = "VIEW" | "CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "EXPORT" | "PRINT";
