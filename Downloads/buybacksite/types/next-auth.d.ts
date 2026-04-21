import { UserRole, TenantPlan, TenantStatus } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      tenantId?: string;
      tenantSlug?: string;
      tenantName?: string;
      tenantPlan?: TenantPlan;
      tenantStatus?: TenantStatus;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    tenantId?: string | null;
  }
}

declare module "next-auth/adapters" {
  interface AdapterUser {
    role: UserRole;
    tenantId?: string | null;
  }
}
