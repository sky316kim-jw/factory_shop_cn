export const dynamic = "force-dynamic";
// 마이페이지 API - 조회(GET) + 수정(PUT)
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");
    if (!userId) return NextResponse.json({ error: "user_id 필요" }, { status: 400 });

    const { data } = await supabaseAdmin
      .from("users")
      .select("name, phone, department, wechat_id, email, role, member_code, company_name")
      .eq("id", userId)
      .single();

    return NextResponse.json({ user: data });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user_id, name, phone, department, wechat_id, new_password } = await request.json();
    if (!user_id) return NextResponse.json({ error: "user_id 필요" }, { status: 400 });

    // 프로필 업데이트
    await supabaseAdmin.from("users").update({
      name: name || null,
      phone: phone || null,
      department: department || null,
      wechat_id: wechat_id || null,
    }).eq("id", user_id);

    // 비밀번호 변경
    if (new_password && new_password.length >= 6) {
      await supabaseAdmin.auth.admin.updateUserById(user_id, { password: new_password });
    }

    // suppliers 테이블도 업데이트 (공급업체인 경우)
    const { data: userData } = await supabaseAdmin.from("users").select("role").eq("id", user_id).single();
    if (userData?.role === "supplier") {
      await supabaseAdmin.from("suppliers").update({
        contact_person: name || null,
        phone: phone || null,
      }).eq("user_id", user_id);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
