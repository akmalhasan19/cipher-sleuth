import { NextResponse } from "next/server";

type RouteParams = {
  params: Promise<{ analysisId: string }>;
};

export const runtime = "nodejs";

export async function GET(request: Request, { params }: RouteParams) {
  const { analysisId } = await params;
  const redirectUrl = new URL(`/api/report/${analysisId}/pdf`, request.url);
  return NextResponse.redirect(redirectUrl, { status: 307 });
}
