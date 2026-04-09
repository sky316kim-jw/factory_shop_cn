// 관리자 - 공급업체 관리 페이지
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";

interface SupplierRow {
  id: string;
  member_code: string;
  company_name: string;
  region: string;
  contact_person: string;
  phone: string;
  wechat_id: string;
  email: string;
  product_count: number;
  order_count: number;
  created_at: string;
}

export default function AdminSuppliersPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      // 서버 API로 데이터 조회
      const res = await fetch(`/api/admin?user_id=${session.user.id}`);
      const data = await res.json();
      if (data.error) { router.push("/login"); return; }

      const users = (data.users || []).filter((u: { role: string }) => u.role === "supplier");

      // 각 공급업체 상세 정보 보강
      const enriched: SupplierRow[] = await Promise.all(
        users.map(async (u: Record<string, unknown>) => {
          // suppliers 테이블에서 추가 정보
          const { data: sData } = await supabase
            .from("suppliers")
            .select("id, contact_person, phone")
            .eq("user_id", u.id as string)
            .limit(1);

          const supplier = sData?.[0];

          // 상품 수
          let productCount = 0;
          if (supplier) {
            const { count } = await supabase
              .from("products")
              .select("id", { count: "exact", head: true })
              .eq("supplier_id", supplier.id);
            productCount = count || 0;
          }

          return {
            id: u.id as string,
            member_code: (u.member_code as string) || "-",
            company_name: (u.company_name as string) || "-",
            region: (u.region as string) || "-",
            contact_person: supplier?.contact_person || "-",
            phone: supplier?.phone || (u.phone as string) || "-",
            wechat_id: (u.wechat_id as string) || "-",
            email: (u.email as string) || "-",
            product_count: productCount,
            order_count: 0,
            created_at: u.created_at as string,
          };
        })
      );

      setSuppliers(enriched);
      setLoading(false);
    };
    init();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">공급업체 관리</h2>
          <button onClick={() => router.push("/admin")} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-100">대시보드</button>
        </div>

        {loading && <div className="text-center py-20 text-gray-500">로딩 중...</div>}

        {!loading && suppliers.length === 0 && (
          <div className="text-center py-20 text-gray-500">등록된 공급업체가 없습니다</div>
        )}

        {!loading && suppliers.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">코드</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">회사명</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">지역</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">담당자</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">연락처</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">WeChat</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">상품수</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">등록일</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {suppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-blue-600 font-medium">{s.member_code}</td>
                      <td className="px-4 py-3">{s.company_name}</td>
                      <td className="px-4 py-3">{s.region}</td>
                      <td className="px-4 py-3">{s.contact_person}</td>
                      <td className="px-4 py-3">{s.phone}</td>
                      <td className="px-4 py-3 text-gray-500">{s.wechat_id}</td>
                      <td className="px-4 py-3 text-center">{s.product_count}</td>
                      <td className="px-4 py-3 text-gray-500">{new Date(s.created_at).toLocaleDateString("ko-KR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
