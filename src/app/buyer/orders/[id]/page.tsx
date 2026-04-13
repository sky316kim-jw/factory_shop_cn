// 바이어 - 발주 상세 + 입고 처리 페이지
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";

// 입고 이력 타입
interface InboundRecord {
  id: string;
  po_item_id: string;
  received_qty: number;
  inbound_date: string | null;
  created_at: string;
}

interface OrderDetail {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  notes: string | null;
  expected_ship_date: string | null;
  expected_arrival_date: string | null;
  rejection_reason: string | null;
  shortage_reason: string | null;
  created_at: string;
  supplier_code: string;
  total_qty: number;
  total_received_qty: number;
  buyer: { email: string; company_name: string; member_code: string } | null;
  po_items: {
    id: string;
    internal_sku: string;
    quantity: number;
    unit_price: number;
    received_qty: number;
    shipped_qty: number;
    color_code: string | null;
    color_name: string | null;
    supplier_size: string | null;
    korea_label_size: string | null;
    embroidery_color: string | null;
    pantone_number: string | null;
    is_custom_color: boolean;
    comment: string | null;
    product_image: string | null;
    products: { name_cn: string; name_ko: string | null } | null;
  }[];
  attachments: { id: string; file_url: string; file_name: string }[];
  // 입고 이력
  inbound_records: InboundRecord[];
  shipped_at: string | null;
  tracking_number: string | null;
  shipment_note: string | null; // 출고 비고
}

// 상태별 배지 색상 (#11 수정)
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

export default function BuyerOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  // 단가 열람 가능 여부 (super_admin, super_buyer만)
  const [canViewPrice, setCanViewPrice] = useState(false);
  // 관리자 여부 (#10 입고 취소용)
  const [isAdmin, setIsAdmin] = useState(false);

  // 신규 입고 수량 (이번 회차에 입력하는 수량, 초기값 0)
  const [newInboundQty, setNewInboundQty] = useState<Record<string, number>>({});
  // 쇼티지 사유
  const [shortageReason, setShortageReason] = useState("");
  const [showShortageModal, setShowShortageModal] = useState(false);

  const fetchOrder = async () => {
    const res = await fetch(`/api/orders/${orderId}`);
    const data = await res.json();
    if (data.order) {
      setOrder(data.order);
      // 신규 입고 입력란은 항상 0으로 초기화
      const initQty: Record<string, number> = {};
      for (const item of data.order.po_items) {
        initQty[item.id] = 0;
      }
      setNewInboundQty(initQty);
    }
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      // 역할 확인 (단가 열람 권한 판단)
      try {
        const meRes = await fetch("/api/auth/ensure-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: session.user.id }),
        });
        const meData = await meRes.json();
        // super_admin, super_buyer만 단가 볼 수 있음
        const role = meData.role || "";
        setCanViewPrice(["super_admin", "super_buyer"].includes(role));
        setIsAdmin(["super_admin", "super_buyer", "admin"].includes(role));
      } catch { /* 기본값 false */ }

      await fetchOrder();
    };
    init();
  }, [router, orderId]);

  // 입고 처리 (partial: 이번 회차 등록 / shortage_close: 쇼티지 마감)
  const handleInbound = async (action: "complete" | "partial" | "shortage_close") => {
    if (!order) return;
    setProcessing(true);

    // received_qty = 기존 누적 + 이번 회차 신규 입고
    const items = order.po_items.map((item) => ({
      po_item_id: item.id,
      ordered_qty: item.quantity,
      received_qty: (item.received_qty || 0) + (newInboundQty[item.id] || 0),
    }));

    try {
      const res = await fetch("/api/orders/inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          po_id: order.id,
          items,
          action,
          shortage_reason: action === "shortage_close" ? shortageReason : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        setShowShortageModal(false);
        await fetchOrder();
      } else {
        alert(data.error);
      }
    } catch {
      alert("서버 오류가 발생했습니다.");
    }
    setProcessing(false);
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50"><Header /><div className="text-center py-20 text-gray-500">로딩 중...</div></div>;
  }
  if (!order) {
    return <div className="min-h-screen bg-gray-50"><Header /><div className="text-center py-20 text-gray-500">발주를 찾을 수 없습니다</div></div>;
  }

  // 수량 계산
  const totalOrdered = order.po_items.reduce((s, i) => s + i.quantity, 0);
  // 기존 누적 입고 수량 (DB 저장값)
  const totalPrevReceived = order.po_items.reduce((s, i) => s + (i.received_qty || 0), 0);
  // 이번 회차 신규 입고 수량
  const totalNewInbound = Object.values(newInboundQty).reduce((s, q) => s + q, 0);
  // 전체 누적 (기존 + 신규)
  const totalCumulativeReceived = totalPrevReceived + totalNewInbound;
  // 잔량
  const totalRemaining = totalOrdered - totalCumulativeReceived;
  // 입고 가능 상태 (입고완료/거절 외)
  const inboundStatuses = ["발주확정", "생산중", "선적완료", "부분입고"];
  const canProcessInbound = inboundStatuses.includes(order.status);
  // 입고 이력 (회차별)
  const inboundHistory = order.inbound_records || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4 print:hidden">
          <button onClick={() => router.push("/buyer/orders")}
            className="text-gray-500 hover:text-gray-700">
            ← 발주 목록으로
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-800"
          >
            🖨 PDF 출력
          </button>
        </div>

        {/* 거절 알림 */}
        {order.status === "발주거절" && order.rejection_reason && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-4 mb-6">
            <p className="text-red-700 font-bold">발주가 거절되었습니다</p>
            <p className="text-red-600 text-sm mt-1">사유: {order.rejection_reason}</p>
          </div>
        )}

        {/* 쇼티지 알림 */}
        {order.status === "쇼티지마감" && order.shortage_reason && (
          <div className="bg-orange-50 border border-orange-300 rounded-xl p-4 mb-6">
            <p className="text-orange-700 font-bold">쇼티지 마감</p>
            <p className="text-orange-600 text-sm mt-1">사유: {order.shortage_reason}</p>
          </div>
        )}

        {/* 상단 정보 - 이미지 + 발주 정보 나란히 배치 */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex gap-5">
            {/* 왼쪽: 발주 정보 */}
            <div className="flex-1 min-w-0">
              {/* 발주번호 + 품번 + 상태 배지 */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {/* 발주번호 (20% 축소) */}
                <h2 className="text-lg font-bold text-gray-800">{order.order_number}</h2>
                {/* 품번: 컬러코드/사이즈 제외한 스타일까지만 (예: G01JK001M1) */}
                {order.po_items[0]?.internal_sku && (
                  <span className="font-mono text-sm text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                    {order.po_items[0].internal_sku.split("-")[0]}
                  </span>
                )}
                {/* 상태 배지 */}
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor[order.status] || "bg-gray-100"}`}>
                  {order.status}
                </span>
              </div>

              {/* 상세 정보 그리드 */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">공급업체</span>
                  <p className="font-mono font-medium text-blue-600">{order.supplier_code}</p>
                </div>
                <div>
                  <span className="text-gray-500">발주일</span>
                  <p className="font-medium">{new Date(order.created_at).toLocaleDateString("ko-KR")}</p>
                </div>
                <div>
                  <span className="text-gray-500">출고예정일</span>
                  <p className="font-medium">{order.expected_ship_date || "-"}</p>
                </div>
                <div>
                  <span className="text-gray-500">입고현황</span>
                  <p className="font-medium">{order.total_received_qty}/{order.total_qty}</p>
                </div>
                {/* 단가 총액: super_admin/super_buyer만 표시 */}
                {canViewPrice && (
                  <div>
                    <span className="text-gray-500">총 금액</span>
                    <p className="font-bold text-blue-600">¥{Number(order.total_amount).toLocaleString()}</p>
                  </div>
                )}
              </div>

              {/* 출고 정보 */}
              {order.shipped_at && (
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="text-sm text-purple-700 bg-purple-50 px-3 py-1 rounded">
                    📦 출고등록됨: {new Date(order.shipped_at).toLocaleDateString("ko-KR")}
                  </span>
                  {order.tracking_number && (
                    <span className="text-sm text-blue-700 bg-blue-50 px-3 py-1 rounded">
                      운송장: {order.tracking_number}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 오른쪽: 상품 대표 이미지 */}
            {order.po_items[0]?.product_image && (
              <div className="flex-shrink-0 w-28 h-28 sm:w-36 sm:h-36 rounded-lg overflow-hidden bg-gray-100 border">
                <img src={order.po_items[0].product_image} alt="상품" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        </div>

        {/* 발주 항목 테이블 */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6 overflow-x-auto">
          <h3 className="text-lg font-bold text-gray-800 mb-4">발주 내역</h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-3 py-2 font-medium text-gray-600">품번</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">컬러</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">사이즈</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">자수</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Pantone</th>
                {/* 단가: super_admin/super_buyer만 */}
                {canViewPrice && <th className="text-right px-3 py-2 font-medium text-gray-600">단가</th>}
                <th className="text-center px-3 py-2 font-medium text-gray-600">발주</th>
                <th className="text-center px-3 py-2 font-medium text-gray-600">출고</th>
                <th className="text-center px-3 py-2 font-medium text-gray-600">누적입고</th>
                {/* 입고 가능 상태일 때: 신규 입고 입력란 + 잔량 */}
                {canProcessInbound && (
                  <>
                    <th className="text-center px-3 py-2 font-medium text-blue-600 bg-blue-50">신규입고</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-600">잔량</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {order.po_items.map((item) => {
                // 이 품번의 누적 입고 + 이번 회차 신규를 합산하여 잔량 계산
                const prevReceived = item.received_qty || 0;
                const newQty = newInboundQty[item.id] || 0;
                const remaining = item.quantity - prevReceived - newQty;
                return (
                  <tr key={item.id} className={`${item.is_custom_color ? "bg-red-50" : "hover:bg-gray-50"}`}>
                    <td className="px-3 py-2 font-mono text-xs text-blue-600">{item.internal_sku}</td>
                    <td className="px-3 py-2">
                      {item.color_name || "-"}
                      {item.is_custom_color && <span className="text-[10px] text-red-500 ml-1">(추가)</span>}
                    </td>
                    <td className="px-3 py-2">
                      {item.supplier_size || "-"}
                      {item.korea_label_size && item.korea_label_size !== item.supplier_size && (
                        <span className="text-[10px] text-orange-500 ml-1">→{item.korea_label_size}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">{item.embroidery_color || "-"}</td>
                    <td className="px-3 py-2 text-xs text-purple-600">{item.pantone_number || "-"}</td>
                    {canViewPrice && (
                      <td className="px-3 py-2 text-right text-xs">¥{Number(item.unit_price).toLocaleString()}</td>
                    )}
                    {/* 발주수량 */}
                    <td className="px-3 py-2 text-center font-medium">{item.quantity}</td>
                    {/* 출고수량 */}
                    <td className={`px-3 py-2 text-center ${(item.shipped_qty || 0) < item.quantity ? "text-orange-600 font-medium" : "text-gray-600"}`}>
                      {item.shipped_qty || 0}
                    </td>
                    {/* 누적입고 (DB 저장값) */}
                    <td className="px-3 py-2 text-center text-green-700 font-medium">{prevReceived}</td>
                    {/* 신규입고 입력란 + 잔량 (입고 가능 상태일 때만) */}
                    {canProcessInbound && (
                      <>
                        <td className="px-3 py-2 text-center bg-blue-50">
                          <input
                            type="number"
                            min={0}
                            max={item.quantity - prevReceived}
                            value={newQty}
                            onChange={(e) => setNewInboundQty((p) => ({
                              ...p,
                              [item.id]: Math.min(item.quantity - prevReceived, Math.max(0, parseInt(e.target.value) || 0))
                            }))}
                            className="w-16 text-center px-1 py-1 border rounded text-sm"
                          />
                        </td>
                        <td className={`px-3 py-2 text-center font-medium ${remaining > 0 ? "text-red-600" : "text-green-600"}`}>
                          {remaining > 0 ? remaining : "0"}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              {/* 컬러별 소계 행 */}
              {(() => {
                // 컬러별로 그룹핑하여 소계 계산
                const colorGroups: Record<string, { name: string; qty: number; shipped: number; received: number; amount: number }> = {};
                for (const item of order.po_items) {
                  const key = item.color_name || "기타";
                  if (!colorGroups[key]) colorGroups[key] = { name: key, qty: 0, shipped: 0, received: 0, amount: 0 };
                  colorGroups[key].qty += item.quantity;
                  colorGroups[key].shipped += item.shipped_qty || 0;
                  colorGroups[key].received += (item.received_qty || 0) + (newInboundQty[item.id] || 0);
                  colorGroups[key].amount += item.quantity * Number(item.unit_price);
                }
                const colorKeys = Object.keys(colorGroups);
                // 컬러가 2개 이상일 때만 소계 표시
                if (colorKeys.length < 2) return null;

                // 기본 컬럼 수 계산 (품번~Pantone = 5, 단가 있으면 +1)
                const baseColSpan = canViewPrice ? 6 : 5;

                return colorKeys.map((key) => {
                  const g = colorGroups[key];
                  return (
                    <tr key={`subtotal-${key}`} className="bg-gray-50 text-xs border-t">
                      {/* 소계 라벨 (품번~단가까지 합치기) */}
                      <td colSpan={baseColSpan} className="px-3 py-1.5 text-right text-gray-500">
                        {g.name} 소계
                        {/* 소계 금액은 라벨 안에 표시 (권한별) */}
                        {canViewPrice && <span className="ml-2 text-gray-600">¥{g.amount.toLocaleString()}</span>}
                      </td>
                      {/* 발주수량 소계 */}
                      <td className="px-3 py-1.5 text-center font-medium text-gray-700">{g.qty}</td>
                      {/* 출고수량 소계 */}
                      <td className="px-3 py-1.5 text-center text-gray-500">{g.shipped}</td>
                      {/* 입고 관련 (canProcessInbound일 때) */}
                      {canProcessInbound ? (
                        <>
                          <td className="px-3 py-1.5 text-center text-gray-500">{g.received}</td>
                          <td className="px-3 py-1.5 text-center text-gray-400">{g.qty - g.received > 0 ? `-${g.qty - g.received}` : "0"}</td>
                        </>
                      ) : (
                        <td className="px-3 py-1.5 text-center text-gray-500">{g.received}</td>
                      )}
                    </tr>
                  );
                });
              })()}

              {/* 전체 합계 행 (항상 표시) */}
              <tr className="bg-blue-50 font-bold border-t-2 border-blue-200">
                <td colSpan={canViewPrice ? 6 : 5} className="px-3 py-2 text-right text-gray-800">
                  전체 합계
                  {/* 전체 금액 합계 (권한별) */}
                  {canViewPrice && (
                    <span className="ml-2 text-blue-700">
                      ¥{order.po_items.reduce((s, i) => s + i.quantity * Number(i.unit_price), 0).toLocaleString()}
                    </span>
                  )}
                </td>
                {/* 전체 발주수량 */}
                <td className="px-3 py-2 text-center text-blue-700">{totalOrdered}</td>
                {/* 전체 출고수량 */}
                <td className="px-3 py-2 text-center">{order.po_items.reduce((s, i) => s + (i.shipped_qty || 0), 0)}</td>
                {/* 누적입고 */}
                <td className="px-3 py-2 text-center text-green-700">{totalPrevReceived}</td>
                {/* 신규입고 + 잔량 (입고 가능 상태일 때) */}
                {canProcessInbound && (
                  <>
                    <td className="px-3 py-2 text-center bg-blue-50 font-bold text-blue-700">{totalNewInbound}</td>
                    <td className={`px-3 py-2 text-center font-bold ${totalRemaining > 0 ? "text-red-600" : "text-green-600"}`}>
                      {totalRemaining > 0 ? totalRemaining : "0"}
                    </td>
                  </>
                )}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* 첨부파일 */}
        {order.attachments && order.attachments.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-800 mb-3">작업지시서</h3>
            <div className="space-y-2">
              {order.attachments.map((att) => (
                <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 text-sm text-blue-600">
                  📎 {att.file_name}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* 메모 */}
        {order.notes && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-800 mb-3">메모</h3>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{order.notes}</p>
          </div>
        )}

        {/* #9 입고 이력 (회차별 표시 - 차수 올바르게 표기) */}
        {inboundHistory.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-800 mb-3">입고 이력</h3>
            <div className="space-y-2">
              {(() => {
                // #9 회차별로 그룹핑 (같은 inbound_date 기준 → 시간 단위 그룹핑)
                const rounds: { key: string; date: string; items: InboundRecord[]; roundId: string }[] = [];
                const processed = new Set<string>();
                for (const rec of inboundHistory) {
                  // 같은 시간대(분 단위)에 등록된 것들을 하나의 차수로 그룹
                  const key = rec.created_at.substring(0, 16);
                  if (processed.has(key)) continue;
                  processed.add(key);
                  const groupItems = inboundHistory.filter((r) => r.created_at.substring(0, 16) === key);
                  rounds.push({
                    key,
                    date: rec.inbound_date || rec.created_at.split("T")[0],
                    items: groupItems,
                    roundId: key,
                  });
                }
                return rounds.map((round, idx) => {
                  const roundTotal = round.items.reduce((s, r) => s + r.received_qty, 0);
                  return (
                    <div key={round.key} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-sm">
                      <span className="text-gray-600">
                        <span className="font-medium text-gray-800">{idx + 1}차 입고</span>
                        <span className="text-gray-400 ml-2">{round.date}</span>
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-green-700">{roundTotal}개</span>
                        {/* #10 입고 취소 버튼 (관리자만, 가장 최근 차수만) */}
                        {isAdmin && idx === rounds.length - 1 && (
                          <button
                            onClick={async () => {
                              if (!confirm(`${idx + 1}차 입고(${roundTotal}개)를 취소하시겠습니까?`)) return;
                              setProcessing(true);
                              try {
                                // 해당 차수의 입고 기록 삭제 + po_items received_qty 되돌리기
                                for (const rec of round.items) {
                                  const item = order!.po_items.find((i) => i.id === rec.po_item_id);
                                  if (item) {
                                    const newReceivedQty = Math.max(0, (item.received_qty || 0) - rec.received_qty);
                                    await fetch(`/api/orders/${orderId}/status`, {
                                      method: "PUT",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ status: newReceivedQty > 0 ? "부분입고" : order!.status }),
                                    }).catch(() => {});
                                  }
                                }
                                // 페이지 새로고침으로 최신 데이터 반영
                                await fetchOrder();
                                alert("입고가 취소되었습니다.");
                              } catch { alert("취소 처리 중 오류가 발생했습니다."); }
                              setProcessing(false);
                            }}
                            disabled={processing}
                            className="px-2 py-1 text-[10px] bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400"
                          >
                            취소
                          </button>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
              {/* 누적 합계 (차수와 별도로 합계만 표기) */}
              <div className="flex items-center justify-between px-3 py-2 bg-blue-50 rounded-lg text-sm font-bold border-t">
                <span className="text-gray-800">누적 입고 합계</span>
                <span className="text-blue-700">{totalPrevReceived}개 / {totalOrdered}개</span>
              </div>
              {totalRemaining > 0 && (
                <div className="text-xs text-red-600 px-3">잔량: {totalRemaining}개</div>
              )}
            </div>
          </div>
        )}

        {/* 입고 처리 버튼 섹션 */}
        {canProcessInbound && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6 print:hidden">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              {inboundHistory.length > 0 ? `${Math.floor(inboundHistory.length / order.po_items.length) + 1}차 입고 등록` : "입고 등록"}
            </h3>

            {totalRemaining <= 0 && totalNewInbound > 0 ? (
              <button
                onClick={() => handleInbound("complete")}
                disabled={processing}
                className="w-full py-3 bg-green-600 text-white font-bold text-lg rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              >
                {processing ? "처리 중..." : "전량 입고 완료"}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                  잔량이 {totalRemaining}개 있습니다. 아래에서 처리 방법을 선택하세요.
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleInbound("partial")}
                    disabled={processing}
                    className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    {/* 부분 입고 후 나머지 대기 버튼 */}
                    {processing ? "처리 중..." : "입고등록 후 대기"}
                  </button>
                  <button
                    onClick={() => setShowShortageModal(true)}
                    disabled={processing}
                    className="flex-1 py-3 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 disabled:bg-gray-400"
                  >
                    쇼티지 마감
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 금액 */}
        {/* 총 금액: super_admin/super_buyer만 표시 */}
        {canViewPrice && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-gray-800">총 금액</span>
              <span className="text-2xl font-bold text-blue-600">¥{Number(order.total_amount).toLocaleString()}</span>
            </div>
          </div>
        )}
      </main>

      {/* 쇼티지 마감 모달 */}
      {showShortageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-gray-800 mb-2">쇼티지 마감</h3>
            <p className="text-sm text-gray-500 mb-3">잔량 {totalRemaining}개를 쇼티지로 마감합니다.</p>
            <label className="block text-sm font-medium text-gray-700 mb-1">마감 사유</label>
            <textarea
              value={shortageReason}
              onChange={(e) => setShortageReason(e.target.value)}
              placeholder="쇼티지 마감 사유를 입력하세요"
              rows={3}
              className="w-full px-4 py-2 border rounded-lg mb-4 resize-none"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowShortageModal(false)}
                className="flex-1 py-2 border rounded-lg text-gray-600 hover:bg-gray-50">취소</button>
              <button onClick={() => handleInbound("shortage_close")} disabled={processing}
                className="flex-1 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400">
                {processing ? "처리 중..." : "마감 확정"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
