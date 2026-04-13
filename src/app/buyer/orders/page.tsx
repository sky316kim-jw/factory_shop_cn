// 바이어 - 발주 관리 페이지 (권한별 표시)
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";

interface OrderRow {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  expected_ship_date: string | null;
  rejection_reason: string | null;
  shipped_at: string | null;
  created_at: string;
  // 보강 데이터
  supplier_code: string;
  supplier_company: string;
  product_name_cn: string;
  product_name_ko: string;
  buyer_sku: string;     // 바이어품번 (발주 시 입력)
  korea_sku: string;     // 한국품번 (자동생성)
  total_qty: number;
  total_received: number;
}

// 상태별 배지 색상 (#11 수정: 입고완료와 발주대기 색상 구분)
const statusColor: Record<string, string> = {
  "발주요청대기": "bg-gray-200 text-gray-600",
  "발주확인중": "bg-gray-200 text-gray-600",
  "발주확정": "bg-blue-100 text-blue-700",
  "생산중": "bg-blue-100 text-blue-700",
  "선적완료": "bg-orange-100 text-orange-700",
  "부분입고": "bg-purple-100 text-purple-700",
  "입고완료": "bg-green-100 text-green-700",
  "발주거절": "bg-red-100 text-red-700",
  "쇼티지마감": "bg-red-100 text-red-700",
};

export default function BuyerOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [canViewPrice, setCanViewPrice] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuper, setIsSuper] = useState(false);
  // #12 검색/정렬 상태
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  // #2 발주 승인/반려 처리 중
  const [processingId, setProcessingId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      setUserId(session.user.id);

      // 권한 확인
      const { data: userData } = await supabase
        .from("users")
        .select("role, can_view_price")
        .eq("id", session.user.id)
        .single();

      const myRole = userData?.role || "";
      const admin = ["super_admin", "admin", "super_buyer"].includes(myRole);
      const superRole = ["super_admin", "super_buyer"].includes(myRole);
      const priceOk = superRole || userData?.can_view_price;
      setIsAdmin(admin);
      setIsSuper(superRole);
      setCanViewPrice(priceOk || false);

      // 발주 목록 (buyer 포함 모든 바이어 역할은 전체 발주 조회)
      const res = await fetch(`/api/orders?user_id=${session.user.id}&role=admin`);
      const data = await res.json();

      // 보강
      const enriched: OrderRow[] = await Promise.all(
        (data.orders || []).map(async (order: Record<string, unknown>) => {
          const poItems = (order.po_items as Record<string, unknown>[]) || [];
          let totalQty = 0;
          let totalReceived = 0;
          let productNameCn = "";
          let productNameKo = "";
          const supplierCode = "-";
          let supplierCompany = "-";
          let buyerSku = "";
          const koreaSkus: string[] = [];

          for (const item of poItems) {
            totalQty += (item.quantity as number) || 0;
            totalReceived += (item.received_qty as number) || 0;
            const sku = item.internal_sku as string || "";
            if (sku) koreaSkus.push(sku);

            const products = item.products as Record<string, unknown> | null;
            if (products && !productNameCn) {
              productNameCn = (products.name_cn as string) || "";
              productNameKo = (products.name_ko as string) || "";
              buyerSku = (products.supplier_sku as string) || "";

              // suppliers 정보는 API에서 조인됨
              const suppliers = products.suppliers as Record<string, unknown> | null;
              if (suppliers) {
                supplierCompany = (suppliers.company_name_ko as string) || (suppliers.company_name_cn as string) || "-";
              }
            }
          }

          // 한국품번: 스타일까지만 (일반 바이어) 또는 전체 (관리자/단가열람)
          let koreaSkuDisplay = "";
          if (koreaSkus.length > 0) {
            if (priceOk) {
              koreaSkuDisplay = koreaSkus[0];
              if (koreaSkus.length > 1) koreaSkuDisplay += ` 외 ${koreaSkus.length - 1}개`;
            } else {
              // 스타일까지만: G01JK001L1 (- 앞부분)
              const first = koreaSkus[0];
              const dashIdx = first.indexOf("-");
              koreaSkuDisplay = dashIdx > 0 ? first.substring(0, dashIdx) : first;
            }
          }

          return {
            id: order.id as string,
            order_number: order.order_number as string,
            status: order.status as string,
            total_amount: order.total_amount as number,
            expected_ship_date: order.expected_ship_date as string | null,
            rejection_reason: order.rejection_reason as string | null,
            shipped_at: order.shipped_at as string | null,
            created_at: order.created_at as string,
            supplier_code: (order.supplier_code as string) || supplierCode || "-",
            supplier_company: (order.supplier_company as string) || supplierCompany || "-",
            product_name_cn: productNameCn,
            product_name_ko: productNameKo,
            buyer_sku: buyerSku,
            korea_sku: koreaSkuDisplay,
            total_qty: totalQty,
            total_received: totalReceived,
          };
        })
      );

      setOrders(enriched);
      setLoading(false);
    };
    init();
  }, [router]);

  // #2 발주 승인 처리 (발주요청대기 → 발주확인중)
  const handleApprove = async (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("이 발주를 승인하시겠습니까?")) return;
    setProcessingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "발주확인중" }),
      });
      const data = await res.json();
      if (data.success) {
        setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: "발주확인중" } : o));
        alert("발주가 승인되었습니다.");
      } else alert(data.error);
    } catch { alert("서버 오류"); }
    setProcessingId(null);
  };

  // #2 발주 반려 처리 (→ 취소(대기) 상태)
  const handleReject = async (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const reason = prompt("반려 사유를 입력하세요:");
    if (!reason?.trim()) return;
    setProcessingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "발주거절", rejection_reason: reason.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: "발주거절" } : o));
        alert("발주가 반려되었습니다.");
      } else alert(data.error);
    } catch { alert("서버 오류"); }
    setProcessingId(null);
  };

  // #12 정렬 토글
  const handleSort = (field: string) => {
    if (sortField === field) { setSortAsc(!sortAsc); }
    else { setSortField(field); setSortAsc(true); }
  };

  // #12 검색 + 정렬 적용
  const displayOrders = (() => {
    let filtered = orders;
    // 검색 필터
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((o) =>
        o.order_number.toLowerCase().includes(q) ||
        o.product_name_cn.toLowerCase().includes(q) ||
        (o.product_name_ko || "").toLowerCase().includes(q) ||
        o.supplier_code.toLowerCase().includes(q) ||
        o.supplier_company.toLowerCase().includes(q)
      );
    }
    // 정렬
    return [...filtered].sort((a, b) => {
      let va: string | number = "";
      let vb: string | number = "";
      switch (sortField) {
        case "created_at": va = a.created_at; vb = b.created_at; break;
        case "status": va = a.status; vb = b.status; break;
        case "supplier_code": va = a.supplier_code; vb = b.supplier_code; break;
        case "order_number": va = a.order_number; vb = b.order_number; break;
        case "total_qty": va = a.total_qty; vb = b.total_qty; break;
        default: va = a.created_at; vb = b.created_at;
      }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
  })();

  // 정렬 아이콘
  const sortIcon = (field: string) => sortField === field ? (sortAsc ? " ▲" : " ▼") : "";

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">발주 관리</h2>
          <div className="flex gap-2">
            <button onClick={() => router.push("/buyer/gallery")}
              className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-100">갤러리</button>
            {isAdmin && (
              <button onClick={() => router.push("/admin")}
                className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-100">대시보드</button>
            )}
          </div>
        </div>

        {/* #12 검색창 */}
        {!loading && orders.length > 0 && (
          <div className="mb-4">
            <input
              type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="발주번호, 상품명, 공급업체로 검색..."
              className="w-full sm:w-80 px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {loading && <div className="text-center py-20 text-gray-500">불러오는 중...</div>}

        {!loading && orders.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg mb-4">발주 내역이 없습니다</p>
            <button onClick={() => router.push("/buyer/gallery")}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">상품 둘러보기</button>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th onClick={() => handleSort("order_number")} className="text-left px-3 py-3 font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:text-blue-600">발주번호{sortIcon("order_number")}</th>
                    <th onClick={() => handleSort("supplier_code")} className="text-left px-3 py-3 font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:text-blue-600">공급업체{sortIcon("supplier_code")}</th>
                    <th className="text-left px-3 py-3 font-medium text-gray-600 whitespace-nowrap">상품명</th>
                    <th className="text-left px-3 py-3 font-medium text-gray-600 whitespace-nowrap">바이어품번</th>
                    <th className="text-left px-3 py-3 font-medium text-gray-600 whitespace-nowrap">한국품번</th>
                    {canViewPrice && <th className="text-right px-3 py-3 font-medium text-gray-600 whitespace-nowrap">총금액</th>}
                    <th onClick={() => handleSort("total_qty")} className="text-center px-3 py-3 font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:text-blue-600">총수량{sortIcon("total_qty")}</th>
                    <th onClick={() => handleSort("created_at")} className="text-left px-3 py-3 font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:text-blue-600">발주일{sortIcon("created_at")}</th>
                    <th className="text-left px-3 py-3 font-medium text-gray-600 whitespace-nowrap">출고예정일</th>
                    <th onClick={() => handleSort("status")} className="text-center px-3 py-3 font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:text-blue-600">상태{sortIcon("status")}</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-600 whitespace-nowrap">입고현황</th>
                    {isAdmin && <th className="text-center px-3 py-3 font-medium text-gray-600 whitespace-nowrap">관리</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {displayOrders.map((o) => (
                    <tr key={o.id} onClick={() => router.push(`/buyer/orders/${o.id}`)}
                      className="hover:bg-gray-50 cursor-pointer">
                      {/* 발주번호 */}
                      <td className="px-3 py-3 font-mono text-blue-600 font-medium whitespace-nowrap">{o.order_number}</td>

                      {/* 공급업체: 권한별 */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        {isSuper ? (
                          <span>
                            <span className="font-mono text-blue-600">{o.supplier_code}</span>
                            <span className="text-gray-500 ml-1">{o.supplier_company}</span>
                          </span>
                        ) : (
                          <span className="font-mono text-blue-600">{o.supplier_code}</span>
                        )}
                      </td>

                      {/* 상품명: 중국어 + 한국어 */}
                      <td className="px-3 py-3 max-w-[200px]">
                        <p className="truncate text-gray-800">{o.product_name_cn}</p>
                        {o.product_name_ko && (
                          <p className="truncate text-xs text-gray-500">{o.product_name_ko}</p>
                        )}
                      </td>

                      {/* 바이어품번 */}
                      <td className="px-3 py-3 font-mono text-xs text-gray-600">{o.buyer_sku || "-"}</td>

                      {/* 한국품번 */}
                      <td className="px-3 py-3 font-mono text-xs text-blue-600 whitespace-nowrap">{o.korea_sku || "-"}</td>

                      {/* 총금액 (권한 있는 경우만) */}
                      {canViewPrice && (
                        <td className="px-3 py-3 text-right font-medium whitespace-nowrap">
                          ¥{Number(o.total_amount).toLocaleString()}
                        </td>
                      )}

                      {/* 총수량 */}
                      <td className="px-3 py-3 text-center">{o.total_qty}</td>

                      {/* 발주일 */}
                      <td className="px-3 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(o.created_at).toLocaleDateString("ko-KR")}
                      </td>

                      {/* 출고예정일 */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-gray-500">{o.expected_ship_date || "-"}</span>
                        {o.shipped_at && (
                          <span className="ml-1 text-[10px] bg-purple-100 text-purple-700 px-1 py-0.5 rounded">출고됨</span>
                        )}
                      </td>

                      {/* 상태 */}
                      <td className="px-3 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusColor[o.status] || "bg-gray-100"}`}>
                          {o.status}
                        </span>
                      </td>

                      {/* 입고현황 */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <span className={o.total_received >= o.total_qty && o.total_qty > 0 ? "text-green-600 font-medium" : ""}>
                          {o.total_received}/{o.total_qty}
                        </span>
                      </td>

                      {/* #2 관리자 승인/반려 버튼 */}
                      {isAdmin && (
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          {o.status === "발주요청대기" && (
                            <div className="flex gap-1 justify-center">
                              <button onClick={(e) => handleApprove(o.id, e)}
                                disabled={processingId === o.id}
                                className="px-2 py-1 text-[10px] bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400">
                                승인
                              </button>
                              <button onClick={(e) => handleReject(o.id, e)}
                                disabled={processingId === o.id}
                                className="px-2 py-1 text-[10px] bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400">
                                반려
                              </button>
                            </div>
                          )}
                        </td>
                      )}
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
