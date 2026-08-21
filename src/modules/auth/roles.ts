export const staffRoles = ["KITCHEN", "CASHIER", "ADMIN"] as const;

export type StaffRole = (typeof staffRoles)[number];

export const staffRouteAccess = {
  "/kitchen": ["KITCHEN", "ADMIN"],
  "/cashier": ["CASHIER", "ADMIN"],
  "/admin": ["ADMIN"],
} as const satisfies Record<string, readonly StaffRole[]>;

export type StaffRoute = keyof typeof staffRouteAccess;

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && staffRoles.includes(value as StaffRole);
}

export function canAccessStaffRoute(role: StaffRole, route: StaffRoute): boolean {
  return staffRouteAccess[route].some((allowedRole) => allowedRole === role);
}

export function defaultRouteForRole(role: StaffRole): StaffRoute {
  switch (role) {
    case "KITCHEN":
      return "/kitchen";
    case "CASHIER":
      return "/cashier";
    case "ADMIN":
      return "/admin";
  }
}

export function parseStaffRoute(value: unknown): StaffRoute | null {
  if (typeof value !== "string") return null;
  return value in staffRouteAccess ? (value as StaffRoute) : null;
}
