import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== UserRole.PLATFORM_ADMIN) {
    redirect("/dashboard");
  }
  return <>{children}</>;
}
