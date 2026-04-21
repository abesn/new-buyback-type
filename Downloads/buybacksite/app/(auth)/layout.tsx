import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Already logged in — send to dashboard
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  return <>{children}</>;
}
