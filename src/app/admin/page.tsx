// 관리자 대시보드 - 등급별 메뉴
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";

interface DashboardData {
  userCount: number;
  supplierCount: number;
  productCount: number;
  orderCount: number;
  pendingApprovalOrders: number;
  pendingApprovalUsers: number;
  unpaidBalance: number;
  invoiceCount: number;
  inboundPending: number;
}

export default function AdminPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      // 본인 역할 확인 (서버 API로 RLS 우회)
      let myRole = "";
      try {
        const meRes = await fetch("/api/auth/ensure-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: session.user.id }),
        });
        const meData = await meRes.json();
        myRole = meData.role || "";
      } catch {
        // 폴백: 클라이언트 직접 조회
        const { data: me } = await supabase
          .from("users").select("role").eq("id", session.user.id).single();
        myRole = me?.role || "";
      }

      if (!myRole) { router.push("/login"); return; }
      setUserRole(myRole);

      try {
        const res = await fetch(`/api/admin?user_id=${session.user.id}`);
        const result = await res.json();
        if (result.error) { router.push("/login"); return; }

        const users = result.users || [];
        const orders = result.orders || [];

        // 미결제 잔액
        let unpaid = 0;
        let invoiceCount = 0;
        if (myRole === "super_admin" || myRole === "super_buyer") {
          const invRes = await fetch(`/api/invoices?user_id=${session.user.id}&role=admin`);
          const invData = await invRes.json();
          const invoices = invData.invoices || [];
          unpaid = invoices.reduce((s: number, i: { balance: number }) => s + Number(i.balance), 0);
          invoiceCount = invoices.length;
        }

        setData({
          userCount: users.length,
          supplierCount: users.filter((u: { role: string }) => u.role === "supplier").length,
          productCount: (result.products || []).length,
          orderCount: orders.length,
          pendingApprovalOrders: orders.filter((o: { status: string }) => o.status === "발주요청대기").length,
          pendingApprovalUsers: users.filter((u: { role: string; is_approved: boolean }) => u.role === "buyer" && !u.is_approved).length,
          unpaidBalance: unpaid,
          invoiceCount,
          inboundPending: orders.filter((o: { status: string }) => o.status === "선적완료" || o.status === "부분입고").length,
        });
      } catch { /* */ }
      setLoading(false);
    };
    init();
  }, [router]);

  if (loading) {
    return <div className="min-h-screen bg-gray-50"><Header /><div className="text-center py-20 text-gray-500">로딩 중...</div></div>;
  }

  const isSuperAdmin = userRole === "super_admin";
  const isSuperBuyer = userRole === "super_buyer";
  const isSuper = isSuperAdmin || isSuperBuyer;
  const isNormalAdmin = userRole === "admin";

  // 슈퍼관리자/슈퍼바이어 카드
  const superCards = [
    { icon: "📦", title: "전체 발주 현황", value: `${data?.orderCount || 0}건`, href: "/buyer/orders", color: "bg-blue-50 border-blue-200 hover:bg-blue-100" },
    ...(data?.pendingApprovalOrders ? [{
      icon: "⏳", title: "발주요청 승인 대기", value: `${data.pendingApprovalOrders}건`, href: "/buyer/orders", color: "bg-yellow-50 border-yellow-300 hover:bg-yellow-100"
    }] : []),
    { icon: "🏭", title: "공급업체 관리", value: `${data?.supplierCount || 0}개사`, href: "/admin/suppliers", color: "bg-green-50 border-green-200 hover:bg-green-100" },
    ...(isSuperAdmin ? [{
      icon: "👥", title: "회원 관리", value: `${data?.userCount || 0}명`, href: "/admin/users",
      color: data?.pendingApprovalUsers ? "bg-red-50 border-red-300 hover:bg-red-100" : "bg-purple-50 border-purple-200 hover:bg-purple-100",
    }] : []),
    { icon: "💰", title: "정산 현황", value: data?.unpaidBalance ? `미결제 ¥${data.unpaidBalance.toLocaleString()}` : "정산 완료", href: "/admin/payments",
      color: data?.unpaidBalance ? "bg-red-50 border-red-200 hover:bg-red-100" : "bg-gray-50 border-gray-200 hover:bg-gray-100" },
    { icon: "🧾", title: "인보이스 관리", value: `${data?.invoiceCount || 0}건`, href: "/admin/invoices", color: "bg-yellow-50 border-yellow-200 hover:bg-yellow-100" },
    ...(data?.inboundPending ? [{
      icon: "📬", title: "입고 관리", value: `대기 ${data.inboundPending}건`, href: "/admin/inbound", color: "bg-purple-50 border-purple-300 hover:bg-purple-100"
    }] : [{ icon: "📬", title: "입고 관리", value: "0건", href: "/admin/inbound", color: "bg-gray-50 border-gray-200 hover:bg-gray-100" }]),
  ];

  // 일반관리자 카드
  const adminCards = [
    ...(data?.pendingApprovalUsers ? [{
      icon: "👤", title: "바이어 승인 대기", value: `${data.pendingApprovalUsers}명`, href: "/admin/users", color: "bg-red-50 border-red-300 hover:bg-red-100"
    }] : []),
    ...(data?.pendingApprovalOrders ? [{
      icon: "⏳", title: "발주요청 승인 대기", value: `${data.pendingApprovalOrders}건`, href: "/buyer/orders", color: "bg-yellow-50 border-yellow-300 hover:bg-yellow-100"
    }] : []),
    { icon: "📦", title: "발주 관리", value: `${data?.orderCount || 0}건`, href: "/buyer/orders", color: "bg-blue-50 border-blue-200 hover:bg-blue-100" },
    ...(data?.inboundPending ? [{
      icon: "📬", title: "입고 승인 대기", value: `${data.inboundPending}건`, href: "/admin/inbound", color: "bg-purple-50 border-purple-300 hover:bg-purple-100"
    }] : []),
    { icon: "🛒", title: "상품 갤러리", value: `${data?.productCount || 0}개`, href: "/buyer/gallery", color: "bg-indigo-50 border-indigo-200 hover:bg-indigo-100" },
  ];

  const cards = isSuper ? superCards : isNormalAdmin ? adminCards : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          {isSuperAdmin ? "슈퍼관리자" : isSuperBuyer ? "슈퍼바이어" : "관리자"} 대시보드
        </h2>
        <p className="text-sm text-gray-500 mb-8">
          {isSuperAdmin && "모든 기능에 접근할 수 있습니다."}
          {isSuperBuyer && "회원관리를 제외한 모든 기능에 접근할 수 있습니다."}
          {isNormalAdmin && "바이어 승인, 발주 승인, 입고 승인을 관리합니다."}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {cards.map((card) => (
            <div key={card.title} onClick={() => router.push(card.href)}
              className={`rounded-xl border-2 p-6 cursor-pointer transition-all ${card.color}`}>
              <div className="text-3xl mb-3">{card.icon}</div>
              <h3 className="font-bold text-gray-800 text-lg">{card.title}</h3>
              <p className="text-2xl font-bold text-gray-900 mt-2">{card.value}</p>
            </div>
          ))}
        </div>

        {/* 빠른 작업 */}
        <div className="mt-8 flex flex-wrap gap-3">
          {(isSuper || isNormalAdmin) && (
            <button onClick={() => router.push("/buyer/orders/new")}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
              + 새 발주 작성
            </button>
          )}
          <button onClick={() => router.push("/buyer/gallery")}
            className="px-5 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm font-medium">
            바이어 화면으로 보기
          </button>
          {isSuper && (
            <button onClick={() => router.push("/admin/settings")}
              className="px-5 py-2.5 bg-gray-400 text-white rounded-lg hover:bg-gray-500 text-sm font-medium">
              알림 설정
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
