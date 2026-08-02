import { getMetaFeedSnapshot } from "@/lib/meta-feed-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const feed = await getMetaFeedSnapshot();
  return new Response(`\uFEFF${feed.csv}`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'inline; filename="meta-veiculos.csv"',
      "Cache-Control": "public, max-age=60, s-maxage=120, stale-while-revalidate=60",
      "X-Content-Type-Options": "nosniff",
      "X-Feed-Generated-At": feed.generatedAt,
      "X-Feed-Items": String(feed.exported),
    },
  });
}

