// Supabase 클라이언트 설정 파일
// 브라우저(클라이언트)에서 Supabase에 접속할 때 사용

import { createClient } from "@supabase/supabase-js";

// 환경변수에서 Supabase 접속 정보를 가져옴
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Supabase 클라이언트 생성 (브라우저용)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
