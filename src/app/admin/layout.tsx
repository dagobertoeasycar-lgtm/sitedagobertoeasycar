import { currentSession } from "@/lib/auth";
import { AdminLayout } from "@/components/AdminLayout";
import { query } from "@/lib/db";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await currentSession();

  // Not authenticated: render children without sidebar (login page will show)
  if (!session) {
    return <>{children}</>;
  }

  // Authenticated: render with AdminLayout sidebar
  let email: string | undefined;
  try {
    const account = await query<{ must_change_password: boolean; email: string }>(
      "select email, must_change_password from users where id=$1 and active limit 1",
      [session.userId],
    );
    email = account.rows[0]?.email;
  } catch {
    email = undefined;
  }

  return <AdminLayout user={email}>{children}</AdminLayout>;
}
