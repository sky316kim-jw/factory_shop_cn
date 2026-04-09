// 관리자 - 입고 관리 페이지
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";

interface InboundOrder {
  id: string;
  order_number: string;
  status: string;
  expected_ship_date: string | null;
  shipped_at: string | null;
  tracking_number: string | null;
  created_at: string;
  supplier_code: string;
  total_qty: number;
  total_shipped: number;
  total_received: number;
}

export default function AdminInboundPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<InboundOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      // admin API로 전체 발주 조회
      const res = await fetch(`/api/admin?user_id=${session.user.id}`);
      const data = await res.json();
      if (data.error) { router.push("/login"); return; }

      // 발주확정 이후 입고 처리 대상 필터
      const inboundStatuses = ["발주확정", "생산중", "선적완료", "부분입고"];
      const allOrders = data.orders || [];
      const inboundOrders = allOrders.filter(
        (o: { status: string }) => inboundStatuses.includes(o.status)
      );

      // 각 발주의 상세 정보 조회
      const enriched: InboundOrder[] = await Promise.all(
        inboundOrders.map(async (o: Record<string, unknown>) => {
          const detailRes = await fetch(`/api/orders/${o.id}`);
          const detailData = await detailRes.json();
          const order = detailData.order;

          return {
            id: o.id as string,
            order_number: o.order_number as string,
            status: o.status as string,
            expected_ship_date: (o.expected_ship_date as string) || null,
            shipped_at: (o.shipped_at as string) || null,
            tracking_number: (o.tracking_number as string) || null,
            created_at: o.created_at as string,
            supplier_code: order?.supplier_code || "-",
            total_qty: order?.total_qty || 0,
            total_shipped: (order?.po_items || []).reduce((s: number, i: { shipped_qty: number }) => s + (i.shipped_qty || 0), 0),
            total_received: order?.total_received_qty || 0,
          };
        })
      );

      setOrders(enriched);
      setLoading(false);
    };
    init();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">입고 관리</h2>
          <button onClick={() => router.push("/admin")} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-100">대시보드</button>
        </div>

        {loading && <div className="text-center py-20 text-gray-500">로딩 중...</div>}

        {!loading && orders.length === 0 && (
          <div className="text-center py-20 text-gray-500">입고 처리 대기 중인 발주가 없습니다</div>
        )}

        {!loading && orders.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">발주번호</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">공급업체</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">상태</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">출고일</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">운송장</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">발주/출고/입고</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-blue-600">{o.order_number}</td>
                      <td className="px-4 py-3 font-mono">{o.supplier_code}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          o.status === "선적완료" ? "bg-purple-100 text-purple-700" : "bg-orange-100 text-orange-700"
                        }`}>{o.status}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {o.shipped_at ? new Date(o.shipped_at).toLocaleDateString("ko-KR") : "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{o.tracking_number || "-"}</td>
                      <td className="px-4 py-3 text-center">
                        {o.total_qty} / {o.total_shipped} / {o.total_received}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => router.push(`/buyer/orders/${o.id}`)}
                          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">
                          입고 처리
                        </button>
                      </td>
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
