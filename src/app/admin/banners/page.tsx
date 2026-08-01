import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";
import { BannerAdmin } from "@/components/BannerAdmin";

export const dynamic = "force-dynamic";

export default async function AdminBannersPage() {
  const session = await currentSession();
  if (!session) redirect("/admin/login");

  return (
    <>
      <div className="adm-header"><h1>Banners e Home</h1></div>
      <BannerAdmin />
    </>
  );
}
