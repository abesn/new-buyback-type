import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import EmailProvider from "next-auth/providers/email";
import type { Adapter } from "next-auth/adapters";
import { db } from "./db";
import { UserRole } from "@prisma/client";

export const authOptions: NextAuthOptions = {
  // Prisma adapter — stores users and accounts in PostgreSQL
  adapter: PrismaAdapter(db) as Adapter,

  providers: [
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT ?? 465),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM ?? "no-reply@buybacksite.com",
    }),
  ],

  // JWT strategy — required so middleware's getToken() can read the session
  // from the cookie without hitting the database on every request.
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    // Embed user fields into the JWT on first sign-in, refresh on every request
    async jwt({ token, user, trigger }) {
      // `user` is only present on the very first sign-in.
      // The Prisma adapter only exposes standard NextAuth fields on `user`,
      // so we always fetch role + tenantId directly from the DB.
      if (user) {
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: { role: true, tenantId: true },
        });
        token.id       = user.id;
        token.role     = dbUser?.role     ?? UserRole.STAFF;
        token.tenantId = dbUser?.tenantId ?? null;
      }

      // Re-fetch tenant display fields on first load or explicit update()
      if (token.tenantId && (trigger === "update" || !token.tenantName)) {
        const tenant = await db.tenant.findUnique({
          where: { id: token.tenantId as string },
          select: { slug: true, name: true, plan: true, status: true },
        });
        token.tenantSlug   = tenant?.slug;
        token.tenantName   = tenant?.name;
        token.tenantPlan   = tenant?.plan;
        token.tenantStatus = tenant?.status;
      }

      return token;
    },

    // Expose token fields on the session object used in server components
    async session({ session, token }) {
      if (session.user) {
        session.user.id           = token.id as string;
        session.user.role         = token.role as UserRole;
        session.user.tenantId     = (token.tenantId as string) ?? undefined;
        session.user.tenantSlug   = (token.tenantSlug as string) ?? undefined;
        session.user.tenantName   = (token.tenantName as string) ?? undefined;
        session.user.tenantPlan   = token.tenantPlan as string ?? undefined;
        session.user.tenantStatus = token.tenantStatus as string ?? undefined;
      }
      return session;
    },

    // Block sign-in for CANCELLED tenants
    async signIn({ user }) {
      const u = user as { tenantId?: string };
      if (!u.tenantId) return true; // platform admin or unassigned

      const tenant = await db.tenant.findUnique({
        where: { id: u.tenantId },
        select: { status: true },
      });

      if (tenant?.status === "CANCELLED") {
        return "/login?error=account-cancelled";
      }

      return true;
    },
  },

  pages: {
    signIn:        "/login",
    verifyRequest: "/login?verify=true",
    error:         "/login",
  },

  secret: process.env.NEXTAUTH_SECRET,
  debug:  process.env.NODE_ENV === "development",
};
