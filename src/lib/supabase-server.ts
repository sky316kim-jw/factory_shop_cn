// Supabase 서버 클라이언트 설정 파일
// 서버 컴포넌트나 API 라우트에서 Supabase에 접속할 때 사용

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("SUPABASE 환경변수 누락!", {
    url: supabaseUrl ? "OK" : "MISSING",
    key: supabaseServiceKey ? "OK" : "MISSING",
  });
}

// Supabase 서버 클라이언트 생성 (서버 전용 - 관리자 권한)
export const supabaseAdmin = createClient(
  supabaseUrl || "",
  supabaseServiceKey || ""
);
