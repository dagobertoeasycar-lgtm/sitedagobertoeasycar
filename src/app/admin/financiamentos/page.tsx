import { requireArea } from "@/lib/permissions";
import { LeadsView } from "@/components/LeadsView";

export const dynamic = "force-dynamic";

export default async function AdminFinancingPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireArea("leads");
  return (
    <>
      <div className="adm-header"><h1>Financiamentos</h1></div>
      <LeadsView mode="financing" searchParams={await searchParams} basePath="/admin/financiamentos" />
    </>
  );
}
