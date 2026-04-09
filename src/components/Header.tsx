// 공통 헤더 - 역할별 네비 + 로그인 정보 + sticky
"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface UserInfo {
  email: string;
  role: string;
  member_code: string | null;
}

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // 서버 API로 빠르게 역할 조회 (RLS 우회)
      try {
        const res = await fetch("/api/auth/ensure-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: session.user.id }),
        });
        const data = await res.json();
        if (data.role) {
          setUser({ email: session.user.email || "", role: data.role, member_code: data.member_code || null });
          return;
        }
      } catch { /* 폴백 */ }

      // 폴백: 클라이언트 직접 조회
      const { data } = await supabase.from("users").select("email, role, member_code").eq("id", session.user.id).single();
      if (data) setUser(data);
    };
    load();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const roleLabel = () => {
    if (!user) return "";
    switch (user.role) {
      case "super_admin": return "슈퍼관리자";
      case "admin": return "관리자";
      case "super_buyer": return "슈퍼바이어";
      case "buyer": return "바이어";
      case "supplier": return "供应商";
      default: return user.role;
    }
  };

  const isSuper = user?.role === "super_admin" || user?.role === "super_buyer";
  const isAdmin = user?.role === "admin";
  const isSupplier = user?.role === "supplier";
  const canSeeDashboard = isSuper || isAdmin;

  const isOnAdminPage = pathname?.startsWith("/admin");

  return (
    <header className="bg-white shadow-sm border-b sticky top-0 z-30 print:hidden">
      <div className="max-w-[1400px] mx-auto px-4 py-2.5 flex items-center justify-between gap-2">
        {/* ⚠️ 중요: 로고 클릭 라우팅 규칙 - 절대 변경 금지
            supplier → /supplier/products
            buyer/admin 계열 (buyer, super_buyer, admin, super_admin) → /buyer/gallery */}
        <h1 className="text-lg font-bold text-blue-600 flex-shrink-0 cursor-pointer"
          onClick={() => {
            if (user?.role === "supplier") {
              // 공급업체는 항상 상품 목록으로 이동
              router.push("/supplier/products");
            } else if (user?.role) {
              // buyer, super_buyer, admin, super_admin → 바이어 갤러리
              router.push("/buyer/gallery");
            } else {
              // 역할 로드 전: 현재 경로 기반 판단
              if (pathname?.startsWith("/supplier")) router.push("/supplier/products");
              else router.push("/buyer/gallery");
            }
          }}>
          Factory Shop CN
        </h1>

        {/* 네비게이션 */}
        <div className="hidden sm:flex items-center gap-2">
          {/* 대시보드 버튼: admin 페이지가 아닐 때 표시 */}
          {canSeeDashboard && !isOnAdminPage && (
            <button onClick={() => router.push("/admin")}
              className="px-3 py-1.5 text-xs font-medium text-white bg-gray-800 rounded hover:bg-gray-900">
              대시보드
            </button>
          )}
          {/* 바이어 화면 버튼: admin 페이지일 때 표시 */}
          {canSeeDashboard && isOnAdminPage && (
            <button onClick={() => router.push("/buyer/gallery")}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200">
              바이어 화면
            </button>
          )}
          {isSuper && (
            <button onClick={() => router.push("/buyer/orders")}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200">
              발주 관리
            </button>
          )}
        </div>

        {/* 로그인 정보 + 로그아웃 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {user && (
            <div className="text-xs text-gray-500 hidden md:block cursor-pointer hover:text-blue-600"
              onClick={() => router.push("/mypage")}>
              {isSupplier && user.member_code && (
                <span className="font-mono text-blue-600 font-medium mr-1">{user.member_code} |</span>
              )}
              <span>{user.email}</span>
              <span className="ml-1 text-gray-400">({roleLabel()})</span>
            </div>
          )}
          <button onClick={handleLogout}
            className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-100">
            {isSupplier ? "退出" : "로그아웃"}
          </button>
        </div>
      </div>
    </header>
  );
}
