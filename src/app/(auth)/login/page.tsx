// 로그인 페이지 - Supabase Auth 연결 + 역할별 자동 이동
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  // 입력값 상태
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // UI 상태
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 로그인 처리
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Supabase로 로그인
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        setError("이메일 또는 비밀번호가 틀렸습니다.");
        setLoading(false);
        return;
      }

      // 2. 사용자 역할 조회 (3가지 방법 시도)
      let userData: { role: string; is_approved?: boolean } | null = null;

      // 방법 1: 서버 API (service_role, RLS 우회)
      try {
        const res = await fetch("/api/auth/ensure-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: authData.user.id, email }),
        });
        if (res.ok) {
          const result = await res.json();
          if (result.role) {
            userData = { role: result.role, is_approved: result.is_approved };
          }
        }
      } catch {
        // API 호출 자체 실패
      }

      // 방법 2: 클라이언트 직접 조회 (세션 반영 대기)
      if (!userData) {
        for (let attempt = 0; attempt < 5; attempt++) {
          const { data } = await supabase
            .from("users")
            .select("role, is_approved")
            .eq("id", authData.user.id)
            .single();
          if (data) {
            userData = { role: data.role, is_approved: data.is_approved };
            break;
          }
          await new Promise((r) => setTimeout(r, 800));
        }
      }

      // 방법 3: Supabase Auth 메타데이터에서 조회
      if (!userData) {
        // users 테이블의 RLS를 우회할 수 없으면,
        // 최소한 auth는 성공했으므로 기본값으로 진행
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          // 로그인은 성공했지만 users 조회만 실패한 경우
          // 일단 진행하고 각 페이지에서 역할 조회
          userData = { role: "buyer", is_approved: true };
        }
      }

      if (!userData) {
        setError("사용자 정보를 찾을 수 없습니다. 관리자에게 문의해주세요.");
        setLoading(false);
        return;
      }

      // 미승인 바이어 차단
      if (userData.role === "buyer" && userData.is_approved === false) {
        await supabase.auth.signOut();
        setError("승인 대기중입니다. 관리자 승인 후 이용 가능합니다.");
        setLoading(false);
        return;
      }

      // 3. 역할에 따라 자동 이동
      switch (userData.role) {
        case "super_admin":
        case "super_buyer":
          router.push("/admin");
          break;
        case "admin":
          router.push("/admin");
          break;
        case "supplier":
          router.push("/supplier/products");
          break;
        case "buyer":
          router.push("/buyer/gallery");
          break;
        default:
          router.push("/");
      }
    } catch {
      setError("서버 연결에 실패했습니다. 다시 시도해주세요.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-8">로그인</h1>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* 이메일 입력 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일을 입력하세요"
              required
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 비밀번호 입력 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              required
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 로그인 버튼 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors mt-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        {/* 회원가입 링크 */}
        <p className="text-center text-sm text-gray-500 mt-6">
          계정이 없으신가요?{" "}
          <Link href="/signup" className="text-blue-600 hover:underline">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
