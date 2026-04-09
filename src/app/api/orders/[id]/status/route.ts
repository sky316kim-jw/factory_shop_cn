// 발주 상태 변경 API - PUT /api/orders/[id]/status
// 수락/거절 프로세스 포함 + 캐시 비활성화
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { sendNotification } from "@/lib/notify";

// 유효한 상태값 목록
const VALID_STATUSES = [
  "발주요청대기", "발주확인중", "출고일확정대기", "발주확정",
  "생산중", "선적완료", "부분입고", "입고완료", "발주거절", "쇼티지마감",
];

const STATUS_ORDER: Record<string, number> = {
  "발주요청대기": 0,
  "발주확인중": 1,
  "출고일확정대기": 2,
  "발주확정": 3,
  "생산중": 4,
  "선적완료": 5,
  "부분입고": 6,
  "입고완료": 7,
  "쇼티지마감": 7,
};

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;
    const body = await request.json();
    const { status: newStatus, expected_ship_date, rejection_reason } = body;

    // 상태값 검증
    if (!newStatus || !VALID_STATUSES.includes(newStatus)) {
      return NextResponse.json({ error: "유효하지 않은 상태값입니다." }, { status: 400 });
    }

    // 현재 발주 상태 확인
    const { data: currentOrder, error: fetchError } = await supabaseAdmin
      .from("purchase_orders")
      .select("status")
      .eq("id", orderId)
      .single();

    if (fetchError || !currentOrder) {
      return NextResponse.json({ error: "발주를 찾을 수 없습니다." }, { status: 404 });
    }

    // 거절 처리
    if (newStatus === "발주거절") {
      if (!rejection_reason?.trim()) {
        return NextResponse.json({ error: "거절 사유를 입력해주세요." }, { status: 400 });
      }
      const { data, error } = await supabaseAdmin
        .from("purchase_orders")
        .update({
          status: "발주거절",
          rejection_reason: rejection_reason.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .select()
        .single();

      if (error) return NextResponse.json({ error: "상태 변경 실패" }, { status: 500 });
      return NextResponse.json({ success: true, message: "발주가 거절되었습니다.", order: data });
    }

    // 수락: "발주확정" 또는 "생산중" + 출고예정일 저장
    if (newStatus === "발주확정" || (newStatus === "생산중" && expected_ship_date)) {
      if (!expected_ship_date) {
        return NextResponse.json({ error: "출고 예정일을 입력해주세요." }, { status: 400 });
      }
      const { data, error } = await supabaseAdmin
        .from("purchase_orders")
        .update({
          status: newStatus,  // "생산중" 또는 "발주확정"
          expected_ship_date,
          confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .select()
        .single();

      if (error) return NextResponse.json({ error: "상태 변경 실패" }, { status: 500 });
      sendNotification("supplier_response", `[생산시작] ${data.order_number} 출고예정일: ${expected_ship_date}`);
      return NextResponse.json({ success: true, message: "발주가 확정되었습니다!", order: data });
    }

    // 발주 승인 (발주요청대기 → 발주확인중)
    if (newStatus === "발주확인중" && currentOrder.status === "발주요청대기") {
      const { data, error } = await supabaseAdmin
        .from("purchase_orders")
        .update({
          status: "발주확인중",
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .select()
        .single();

      if (error) return NextResponse.json({ error: "상태 변경 실패" }, { status: 500 });
      return NextResponse.json({ success: true, message: "발주가 승인되어 공급업체에 전송되었습니다.", order: data });
    }

    // 일반 상태 변경 (역방향 불가)
    const currentIdx = STATUS_ORDER[currentOrder.status] ?? -1;
    const newIdx = STATUS_ORDER[newStatus] ?? -1;
    if (newIdx <= currentIdx) {
      return NextResponse.json(
        { error: `이미 "${currentOrder.status}" 상태입니다. 이전 단계로 돌아갈 수 없습니다.` },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("purchase_orders")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", orderId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: "상태 변경 실패" }, { status: 500 });

    return NextResponse.json({ success: true, message: `상태가 "${newStatus}"(으)로 변경되었습니다.`, order: data });
  } catch (error) {
    console.error("상태 변경 오류:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
