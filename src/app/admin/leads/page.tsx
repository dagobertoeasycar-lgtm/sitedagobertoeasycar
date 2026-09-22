import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";
import { LeadsView } from "@/components/LeadsView";

export const dynamic = "force-dynamic";

export default async function AdminLeadsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  if (!(await currentSession())) redirect("/admin/login");
  return (
    <>
      <div className="adm-header"><h1>Leads / contatos</h1></div>
      <LeadsView mode="contacts" searchParams={await searchParams} basePath="/admin/leads" />
    </>
  );
}
