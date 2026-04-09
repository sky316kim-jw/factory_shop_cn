export const dynamic = "force-dynamic";
// 사용자 정보 확인/자동생성 API
// auth.users에는 있지만 public.users에 없는 경우 자동으로 생성
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const { user_id, email } = await request.json();

    if (!user_id) {
      return NextResponse.json({ error: "user_id가 필요합니다." }, { status: 400 });
    }

    // 1. users 테이블에서 조회 (service_role은 RLS 무시)
    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("role, member_code, is_approved, is_active")
      .eq("id", user_id)
      .single();

    if (existing) {
      return NextResponse.json({
        role: existing.role,
        member_code: existing.member_code,
        is_approved: existing.is_approved,
        is_active: existing.is_active,
      });
    }

    // 2. auth.users에서 정보 확인
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(user_id);

    if (!authUser?.user) {
      return NextResponse.json({ error: "인증 정보를 찾을 수 없습니다." }, { status: 404 });
    }

    // 3. users 테이블에 자동 생성 (기본값: buyer)
    const userEmail = email || authUser.user.email || "";
    const role = "buyer"; // 기본 역할
    const memberCode = await generateMemberCode(role);

    const { error: insertError } = await supabaseAdmin.from("users").insert({
      id: user_id,
      email: userEmail,
      role,
      company_name: userEmail.split("@")[0] || "미입력",
      member_code: memberCode,
      region: null,
    });

    if (insertError) {
      // 이미 다른 요청이 생성했을 수 있음 → 다시 조회
      const { data: retry } = await supabaseAdmin
        .from("users")
        .select("role, member_code")
        .eq("id", user_id)
        .single();

      if (retry) {
        return NextResponse.json({ role: retry.role, member_code: retry.member_code });
      }

      return NextResponse.json({ error: "사용자 생성 실패" }, { status: 500 });
    }

    return NextResponse.json({ role, member_code: memberCode, created: true });
  } catch (error) {
    console.error("ensure-user API 오류:", error);
    return NextResponse.json({ error: "서버 오류", detail: String(error) }, { status: 500 });
  }
}

// 회원번호 자동생성
async function generateMemberCode(role: string, regionCode?: string): Promise<string> {
  const prefix = role === "supplier" ? regionCode || "K" : "K";

  const { data } = await supabaseAdmin
    .from("users")
    .select("member_code")
    .like("member_code", `${prefix}%`)
    .order("member_code", { ascending: false })
    .limit(1);

  let nextNumber = 1;
  if (data && data.length > 0) {
    const lastCode = data[0].member_code;
    const lastNumber = parseInt(lastCode.substring(prefix.length), 10);
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(2, "0")}`;
}
