// 공급업체 정보가 없으면 자동으로 생성하는 헬퍼 함수
// 기존에 가입했지만 suppliers 테이블에 데이터가 없는 경우를 처리
import { supabase } from "@/lib/supabase";

/**
 * 공급업체 ID를 가져오거나, 없으면 자동 생성
 * @param userId - 로그인한 사용자의 ID
 * @returns supplierId 또는 null (실패 시)
 */
export async function ensureSupplier(userId: string): Promise<string | null> {
  // 1. 먼저 기존 suppliers 레코드 확인 (중복 있어도 에러 안 나도록 maybeSingle 사용)
  const { data: existingList } = await supabase
    .from("suppliers")
    .select("id")
    .eq("user_id", userId)
    .limit(1);

  if (existingList && existingList.length > 0) {
    return existingList[0].id;
  }

  // 2. 없으면 users 테이블에서 회사명 가져와서 자동 생성
  const { data: userData } = await supabase
    .from("users")
    .select("company_name, role")
    .eq("id", userId)
    .single();

  // supplier 역할이 아니면 생성하지 않음
  if (!userData || userData.role !== "supplier") {
    return null;
  }

  const companyName = userData.company_name || "미입력";

  // 3. suppliers 테이블에 자동 생성 (UNIQUE 제약으로 중복 방지됨)
  const { data: newSupplier, error } = await supabase
    .from("suppliers")
    .insert({
      user_id: userId,
      company_name_cn: companyName,
      company_name_ko: companyName,
    })
    .select("id")
    .single();

  if (error) {
    // UNIQUE 제약 위반 = 다른 요청이 이미 생성함 → 다시 조회
    if (error.code === "23505") {
      const { data: retry } = await supabase
        .from("suppliers")
        .select("id")
        .eq("user_id", userId)
        .limit(1);
      if (retry && retry.length > 0) {
        return retry[0].id;
      }
    }
    console.error("공급업체 자동 생성 실패:", error);
    return null;
  }

  return newSupplier?.id || null;
}
