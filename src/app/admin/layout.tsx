import { currentSession } from "@/lib/auth";
import { AdminLayout } from "@/components/AdminLayout";
import { query } from "@/lib/db";
import { getAdminOverview } from "@/lib/admin-overview";
import "./admin.css";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await currentSession();

  // Not authenticated: render children without sidebar (login page will show)
  if (!session) {
    return <>{children}</>;
  }

  // Authenticated: render with AdminLayout sidebar
  let email: string | undefined;
  let role: string | undefined;
  try {
    const account = await query<{ email: string; role: string }>(
      "select email, role from users where id=$1 and active limit 1",
      [session.userId],
    );
    email = account.rows[0]?.email;
    role = account.rows[0]?.role;
  } catch {
    email = undefined;
  }

  const overview = await getAdminOverview();

  return (
    <AdminLayout user={email} role={role} sessionExpiresAt={session.expiresAt} overview={overview}>
      {children}
    </AdminLayout>
  );
}
