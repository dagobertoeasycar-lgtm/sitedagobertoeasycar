import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { sessionFor } from "@/lib/permissions";
import { query } from "@/lib/db";
import {
  adminImageContentTypes,
  adminImageMaxBytes,
  adminVideoContentTypes,
  adminVideoMaxBytes,
} from "@/lib/media-upload";

export const runtime = "nodejs";

const UUID = /^[0-9a-f-]{36}$/;

type ClientPayload = {
  kind?: "image" | "video";
  vehicleId?: string;
  defaultVideo?: boolean;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as HandleUploadPresignedBody | null;
  if (!body) return NextResponse.json({ error: "Solicitação de upload inválida." }, { status: 400 });
  if (body.type === "blob.generate-presigned-url" && !(await sessionFor("veiculos"))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const response = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname, rawPayload) => {
        const session = await sessionFor("veiculos");
        if (!session) throw new Error("Não autorizado");

        let payload: ClientPayload = {};
        try {
          payload = JSON.parse(rawPayload || "{}") as ClientPayload;
        } catch {
          throw new Error("Destino do arquivo inválido");
        }

        const isVideo = payload.kind === "video";
        const folder = isVideo ? "vehicle-videos" : "vehicle-images";
        const scope = payload.defaultVideo ? "default" : payload.vehicleId || "manual";
        if (!pathname.startsWith(`${folder}/${scope}/`)) throw new Error("Destino do arquivo inválido");

        if (payload.vehicleId) {
          if (!UUID.test(payload.vehicleId)) throw new Error("Veículo inválido");
          const vehicle = await query<{ id: string }>("SELECT id FROM vehicles WHERE id=$1 LIMIT 1", [payload.vehicleId]);
          if (!vehicle.rowCount) throw new Error("Veículo não encontrado");
        }

        const allowedContentTypes = isVideo ? [...adminVideoContentTypes] : [...adminImageContentTypes];
        const maximumSizeInBytes = isVideo ? adminVideoMaxBytes : adminImageMaxBytes;
        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          allowedContentTypes,
          maximumSizeInBytes,
        });

        return {
          token,
          urlOptions: {
            addRandomSuffix: true,
            tokenPayload: rawPayload,
          },
        };
      },
      onUploadCompleted: async () => undefined,
    });
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível autorizar o upload";
    return NextResponse.json({ error: message }, { status: message === "Não autorizado" ? 401 : 400 });
  }
}
