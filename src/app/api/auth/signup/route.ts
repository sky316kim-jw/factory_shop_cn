// 회원가입 API - 회원번호 자동생성 포함
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 서버용 Supabase 클라이언트 (관리자 권한)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { email, password, companyName, role, regionCode, name, phone, wechatId, department } =
      await request.json();

    // 1. Supabase Auth로 사용자 생성
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // 이메일 확인 없이 바로 활성화
      });

    if (authError) {
      // 에러 메시지를 한국어로 변환
      const message = translateError(authError.message);
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const userId = authData.user.id;

    // 2. 회원번호 자동생성
    const memberCode = await generateMemberCode(role, regionCode);

    // 3. users 테이블에 프로필 저장
    const { error: profileError } = await supabaseAdmin.from("users").insert({
      id: userId,
      email,
      role,
      company_name: companyName,
      member_code: memberCode,
      region: role === "supplier" ? regionCode : null,
      name: name || null,
      phone: phone || null,
      wechat_id: wechatId || null,
      department: department || null,
      is_approved: role === "supplier" ? true : false, // 공급업체는 즉시 승인
      is_active: true,
    });

    if (profileError) {
      // 프로필 저장 실패 시 Auth 사용자도 삭제
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: "회원 정보 저장에 실패했습니다. 다시 시도해주세요." },
        { status: 500 }
      );
    }

    // 3-1. 공급업체인 경우 suppliers 테이블에도 저장
    if (role === "supplier") {
      const { error: supplierError } = await supabaseAdmin
        .from("suppliers")
        .insert({
          user_id: userId,
          company_name_cn: companyName,
          company_name_ko: companyName,
          contact_person: name || null,
          phone: phone || null,
        });

      if (supplierError) {
        // suppliers 저장 실패 시 users와 Auth 사용자도 삭제
        await supabaseAdmin.from("users").delete().eq("id", userId);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return NextResponse.json(
          { error: "공급업체 정보 저장에 실패했습니다. 다시 시도해주세요." },
          { status: 500 }
        );
      }
    }

    // 4. 성공 응답
    return NextResponse.json({
      success: true,
      memberCode,
      message: `회원가입 완료! 회원번호: ${memberCode}`,
    });
  } catch {
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다. 다시 시도해주세요." },
      { status: 500 }
    );
  }
}

// 회원번호 자동생성 함수
async function generateMemberCode(
  role: string,
  regionCode?: string
): Promise<string> {
  // 공급업체: 지역이니셜 + 2자리 (예: G01)
  // 바이어: K + 2자리 (예: K01)
  const prefix = role === "supplier" ? regionCode || "K" : "K";

  // 같은 접두사를 가진 회원번호 중 가장 큰 번호 조회
  const { data } = await supabaseAdmin
    .from("users")
    .select("member_code")
    .like("member_code", `${prefix}%`)
    .order("member_code", { ascending: false })
    .limit(1);

  let nextNumber = 1;
  if (data && data.length > 0) {
    // 기존 번호에서 숫자 부분 추출 후 +1
    const lastCode = data[0].member_code;
    const lastNumber = parseInt(lastCode.substring(prefix.length), 10);
    nextNumber = lastNumber + 1;
  }

  // 2자리로 패딩 (예: 1 → "01")
  return `${prefix}${nextNumber.toString().padStart(2, "0")}`;
}

// Supabase 에러 메시지를 한국어로 변환
function translateError(message: string): string {
  if (message.includes("already been registered") || message.includes("already exists")) {
    return "이미 가입된 이메일입니다.";
  }
  if (message.includes("password") && message.includes("short")) {
    return "비밀번호가 너무 짧습니다. 6자 이상 입력해주세요.";
  }
  if (message.includes("valid email")) {
    return "올바른 이메일 형식을 입력해주세요.";
  }
  return "회원가입에 실패했습니다. 다시 시도해주세요.";
}
