import { requireArea } from "@/lib/permissions";
import { BannerAdmin } from "@/components/BannerAdmin";

export const dynamic = "force-dynamic";

export default async function AdminBannersPage() {
  await requireArea("banners");

  return (
    <>
      <div className="adm-header"><h1>Banners e Home</h1></div>
      <BannerAdmin />
    </>
  );
}
