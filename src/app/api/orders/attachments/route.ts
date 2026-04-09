// 발주 첨부파일 저장 API
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const { po_id, file_url, file_name, file_type } = await request.json();
    const { error } = await supabaseAdmin.from("order_attachments").insert({
      po_id, file_url, file_name, file_type,
    });
    if (error) return NextResponse.json({ error: "저장 실패" }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
