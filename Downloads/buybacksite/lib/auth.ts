import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import EmailProvider from "next-auth/providers/email";
import type { Adapter } from "next-auth/adapters";
import { db } from "./db";
import { UserRole } from "@prisma/client";

export const authOptions: NextAuthOptions = {
  // Prisma adapter — stores sessions and users in your PostgreSQL DB
  adapter: PrismaAdapter(db) as Adapter,

  providers: [
    // Magic-link email login — no passwords, works with any email
    // Requires SMTP config (use Resend or any SMTP provider)
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM ?? "no-reply@buybacksite.com",
    }),
  ],

  // Use database sessions (not JWT) — safer for a SaaS with role-based access
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    // Attach role, tenantId, and tenantSlug to every session
    async session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id;
        session.user.role = user.role as UserRole;
        session.user.tenantId = user.tenantId ?? undefined;

        // Attach tenantSlug for easy use in layouts/navigation
        if (user.tenantId) {
          const tenant = await db.tenant.findUnique({
            where: { id: user.tenantId },
            select: { slug: true, name: true, plan: true, status: true },
          });
          session.user.tenantSlug = tenant?.slug ?? undefined;
          session.user.tenantName = tenant?.name ?? undefined;
          session.user.tenantPlan = tenant?.plan ?? undefined;
          session.user.tenantStatus = tenant?.status ?? undefined;
        }
      }
      return session;
    },

    // Prevent sign-in for CANCELLED tenants
    async signIn({ user }) {
      if (!user.tenantId) return true; // Platform admin or new user

      const tenant = await db.tenant.findUnique({
        where: { id: user.tenantId },
        select: { status: true },
      });

      if (tenant?.status === "CANCELLED") {
        return "/login?error=account-cancelled";
      }

      return true;
    },
  },

  pages: {
    signIn: "/login",
    verifyRequest: "/login?verify=true", // After magic link sent
    error: "/login",
  },

  // Required: set a strong random string in .env as NEXTAUTH_SECRET
  secret: process.env.NEXTAUTH_SECRET,

  debug: process.env.NODE_ENV === "development",
};
