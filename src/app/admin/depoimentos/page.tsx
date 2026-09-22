import { requireArea } from "@/lib/permissions";
import { TestimonialAdmin } from "@/components/TestimonialAdmin";

export const dynamic = "force-dynamic";

export default async function AdminTestimonialsPage() {
  await requireArea("banners");
  return <><div className="adm-header"><h1>Depoimentos da home</h1></div><TestimonialAdmin /></>;
}
