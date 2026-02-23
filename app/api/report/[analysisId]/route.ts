import { NextResponse } from "next/server";
import { getAnalysisRecord } from "@/app/lib/db/analysis-session-store";
import { readCookie } from "@/app/lib/validation/http-cookies";

type RouteParams = {
  params: Promise<{ analysisId: string }>;
};

export const runtime = "nodejs";

export async function GET(request: Request, { params }: RouteParams) {
  const { analysisId } = await params;
  const record = getAnalysisRecord(analysisId);

  if (!record) {
    return NextResponse.json(
      { ok: false, error: "Report not found or expired." },
      { status: 404 }
    );
  }

  const requestUserId =
    request.headers.get("x-user-id") ??
    request.headers.get("x-userid") ??
    readCookie(request.headers.get("cookie"), "cipher_sleuth_user_id");
  const guestId = readCookie(request.headers.get("cookie"), "cipher_sleuth_guest_id");

  if (record.ownerUserId) {
    if (!requestUserId || requestUserId !== record.ownerUserId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized report access." },
        { status: 403 }
      );
    }
  } else if (!guestId || guestId !== record.ownerGuestId) {
    return NextResponse.json(
      { ok: false, error: "Guest session is not authorized for this report." },
      { status: 403 }
    );
  }

  return new NextResponse(record.reportText, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${analysisId}-report.txt"`,
      "Cache-Control": "no-store",
    },
  });
}
