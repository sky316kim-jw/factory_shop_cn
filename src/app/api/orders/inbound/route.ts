export const dynamic = "force-dynamic";
// 입고 처리 API + 인보이스 자동 생성
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

// 인보이스 번호 자동생성
async function generateInvoiceNumber(): Promise<string> {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prefix = `INV-${ym}-`;
  const { data } = await supabaseAdmin
    .from("invoices").select("invoice_number").like("invoice_number", `${prefix}%`)
    .order("invoice_number", { ascending: false }).limit(1);
  let next = 1;
  if (data && data.length > 0) { next = parseInt(data[0].invoice_number.slice(-4), 10) + 1; }
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export async function POST(request: NextRequest) {
  try {
    const { po_id, items, action, shortage_reason } = await request.json();

    if (!po_id || !items || items.length === 0) {
      return NextResponse.json({ error: "필수 정보가 부족합니다." }, { status: 400 });
    }

    const now = new Date().toISOString().split("T")[0];

    // 각 항목별 입고 기록 + po_items 업데이트 + 인보이스 데이터 수집
    let totalInvoiceAmount = 0;
    const invoiceItems: { po_item_id: string; internal_sku: string; received_qty: number; unit_price: number; amount: number }[] = [];

    for (const item of items) {
      const shortageQty = Math.max(0, item.ordered_qty - item.received_qty);

      await supabaseAdmin.from("inbound_records").insert({
        po_id, po_item_id: item.po_item_id,
        ordered_qty: item.ordered_qty, received_qty: item.received_qty,
        shortage_qty: shortageQty, is_shortage_closed: action === "shortage_close",
        inbound_date: now,
      });

      await supabaseAdmin.from("po_items")
        .update({ received_qty: item.received_qty })
        .eq("id", item.po_item_id);

      // 인보이스 항목 데이터
      if (item.received_qty > 0) {
        const { data: poItem } = await supabaseAdmin
          .from("po_items").select("internal_sku, unit_price").eq("id", item.po_item_id).single();
        const unitPrice = Number(poItem?.unit_price) || 0;
        const amount = item.received_qty * unitPrice;
        totalInvoiceAmount += amount;
        invoiceItems.push({
          po_item_id: item.po_item_id,
          internal_sku: poItem?.internal_sku || "",
          received_qty: item.received_qty,
          unit_price: unitPrice, amount,
        });
      }
    }

    // 발주 상태 결정
    let newStatus: string;

    if (action === "shortage_close") {
      // 쇼티지 마감 → 입고완료로 처리 (잔량은 쇼티지로 기록)
      newStatus = "입고완료";
    } else if (action === "partial") {
      // 부분 입고 → 누적 입고수량 확인하여 자동 입고완료 판단
      const { data: allItems } = await supabaseAdmin
        .from("po_items")
        .select("quantity, received_qty")
        .eq("po_id", po_id);

      const totalOrderedQty = (allItems || []).reduce((s, i) => s + (i.quantity || 0), 0);
      const totalReceivedQty = (allItems || []).reduce((s, i) => s + (i.received_qty || 0), 0);

      // 누적 입고수량 >= 발주수량이면 자동 입고완료
      newStatus = totalReceivedQty >= totalOrderedQty ? "입고완료" : "부분입고";
    } else {
      // complete → 전량 입고완료
      newStatus = "입고완료";
    }

    const updateData: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() };
    // 쇼티지 마감 사유 저장
    if (action === "shortage_close" && shortage_reason) updateData.shortage_reason = shortage_reason;

    await supabaseAdmin.from("purchase_orders").update(updateData).eq("id", po_id);

    // 인보이스 자동 생성 (입고수량 > 0이면)
    if (totalInvoiceAmount > 0) {
      // 공급업체 ID 조회
      const { data: poItems } = await supabaseAdmin
        .from("po_items").select("products!inner(supplier_id)").eq("po_id", po_id).limit(1);
      let supplierId: string | null = null;
      if (poItems && poItems.length > 0) {
        supplierId = (poItems[0].products as unknown as { supplier_id: string }).supplier_id;
      }

      if (supplierId) {
        const invoiceNumber = await generateInvoiceNumber();
        const { data: invoice } = await supabaseAdmin.from("invoices").insert({
          invoice_number: invoiceNumber, po_id, supplier_id: supplierId,
          total_amount: totalInvoiceAmount, paid_amount: 0, balance: totalInvoiceAmount, status: "미결제",
        }).select("id").single();

        if (invoice) {
          for (const ii of invoiceItems) {
            await supabaseAdmin.from("invoice_items").insert({
              invoice_id: invoice.id, po_item_id: ii.po_item_id,
              internal_sku: ii.internal_sku, shipped_qty: ii.received_qty,
              unit_price: ii.unit_price, amount: ii.amount,
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      // 상태별 응답 메시지
      message: newStatus === "입고완료"
        ? (action === "shortage_close"
          ? "쇼티지 마감 → 입고완료 처리되었습니다. 인보이스가 자동 생성되었습니다."
          : "입고가 완료되었습니다! 인보이스가 자동 생성되었습니다.")
        : "입고등록 후 대기 처리되었습니다.",
    });
  } catch (error) {
    console.error("입고 처리 오류:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
