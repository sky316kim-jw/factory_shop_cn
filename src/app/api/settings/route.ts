export const dynamic = "force-dynamic";
// 설정 API - GET/PUT
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET() {
  try {
    const { data } = await supabaseAdmin.from("settings").select("key, value");
    const settings: Record<string, string> = {};
    for (const row of data || []) {
      settings[row.key] = row.value || "";
    }
    return NextResponse.json({ settings });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { key, value } = await request.json();
    if (!key) return NextResponse.json({ error: "key 필요" }, { status: 400 });

    // upsert
    const { error } = await supabaseAdmin
      .from("settings")
      .upsert({ key, value }, { onConflict: "key" });

    if (error) return NextResponse.json({ error: "저장 실패" }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
