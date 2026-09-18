import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";
import { TestimonialAdmin } from "@/components/TestimonialAdmin";

export const dynamic = "force-dynamic";

export default async function AdminTestimonialsPage() {
  if (!(await currentSession())) redirect("/admin/login");
  return <><div className="adm-header"><h1>Depoimentos da home</h1></div><TestimonialAdmin /></>;
}
