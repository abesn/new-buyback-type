import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Providers } from "@/components/providers";
import { AdminSidebar } from "@/components/admin/sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <Providers session={session}>
      <div className="flex min-h-screen bg-gray-50">
        <AdminSidebar
          user={{
            name: session.user.name ?? undefined,
            email: session.user.email ?? "",
            role: session.user.role,
          }}
          tenantName={session.user.tenantName}
        />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </Providers>
  );
}
