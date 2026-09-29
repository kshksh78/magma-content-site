import { NextRequest, NextResponse } from "next/server";
import { PublishError, upsertPost, verifyApiKey } from "@/lib/publish";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function PUT(req: NextRequest, context: RouteContext) {
  if (!verifyApiKey(req.headers.get("authorization"))) {
    return NextResponse.json(
      { error: "인증 실패 — 'Authorization: Bearer ***' 헤더를 확인하세요" },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "본문이 JSON 이 아닙니다" }, { status: 422 });
  }

  try {
    const { slug } = await context.params;
    const { result, created } = await upsertPost(body, slug);
    return NextResponse.json(result, { status: created ? 201 : 200 });
  } catch (error) {
    if (error instanceof PublishError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
