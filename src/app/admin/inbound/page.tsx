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
  actual_inbound_date: string | null; // #13 실제 입고일
}

export default function AdminInboundPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<InboundOrder[]>([]);
  const [loading, setLoading] = useState(true);
  // #13 검색/정렬
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortAsc, setSortAsc] = useState(false);

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

          // #13 실제 입고일: 가장 최근 입고 기록의 날짜
          const records = order?.inbound_records || [];
          const lastRecord = records.length > 0 ? records[records.length - 1] : null;

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
            actual_inbound_date: lastRecord?.inbound_date || lastRecord?.created_at?.split("T")[0] || null,
          };
        })
      );

      setOrders(enriched);
      setLoading(false);
    };
    init();
  }, [router]);

  // #13 정렬 토글
  const handleSort = (field: string) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  // #13 검색 + 정렬 적용
  const displayOrders = (() => {
    let filtered = orders;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((o) =>
        o.order_number.toLowerCase().includes(q) ||
        o.supplier_code.toLowerCase().includes(q)
      );
    }
    return [...filtered].sort((a, b) => {
      let va: string | number = "";
      let vb: string | number = "";
      switch (sortField) {
        case "created_at": va = a.created_at; vb = b.created_at; break;
        case "order_number": va = a.order_number; vb = b.order_number; break;
        case "supplier_code": va = a.supplier_code; vb = b.supplier_code; break;
        case "status": va = a.status; vb = b.status; break;
        default: va = a.created_at; vb = b.created_at;
      }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
  })();
  const sortIcon = (field: string) => sortField === field ? (sortAsc ? " ▲" : " ▼") : "";

  // 상태별 배지 색상
  const statusColor: Record<string, string> = {
    "발주확정": "bg-blue-100 text-blue-700",
    "생산중": "bg-blue-100 text-blue-700",
    "선적완료": "bg-orange-100 text-orange-700",
    "부분입고": "bg-purple-100 text-purple-700",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">입고 관리</h2>
          <button onClick={() => router.push("/admin")} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-100">대시보드</button>
        </div>

        {/* #13 검색창 */}
        {!loading && orders.length > 0 && (
          <div className="mb-4">
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="발주번호, 공급업체로 검색..." className="w-full sm:w-80 px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
          </div>
        )}

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
                    <th onClick={() => handleSort("order_number")} className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-blue-600">발주번호{sortIcon("order_number")}</th>
                    <th onClick={() => handleSort("supplier_code")} className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-blue-600">공급업체{sortIcon("supplier_code")}</th>
                    <th onClick={() => handleSort("status")} className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-blue-600">상태{sortIcon("status")}</th>
                    <th onClick={() => handleSort("created_at")} className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-blue-600">발주일{sortIcon("created_at")}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">출고일</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">실제 입고일</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">운송장</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">발주/출고/입고</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {displayOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-blue-600">{o.order_number}</td>
                      <td className="px-4 py-3 font-mono">{o.supplier_code}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor[o.status] || "bg-gray-100 text-gray-600"}`}>{o.status}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(o.created_at).toLocaleDateString("ko-KR")}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {o.shipped_at ? new Date(o.shipped_at).toLocaleDateString("ko-KR") : "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {o.actual_inbound_date || "-"}
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
