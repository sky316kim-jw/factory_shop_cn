export const dynamic = "force-dynamic";
// 출고 등록 + 인보이스 자동 생성 API
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { sendNotification } from "@/lib/notify";

// 인보이스 번호 자동생성
async function generateInvoiceNumber(): Promise<string> {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prefix = `INV-${ym}-`;

  const { data } = await supabaseAdmin
    .from("invoices")
    .select("invoice_number")
    .like("invoice_number", `${prefix}%`)
    .order("invoice_number", { ascending: false })
    .limit(1);

  let next = 1;
  if (data && data.length > 0) {
    const last = parseInt(data[0].invoice_number.slice(-4), 10);
    next = last + 1;
  }
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export async function POST(request: NextRequest) {
  try {
    const { po_id, ship_date, tracking_number, note, items } = await request.json();

    if (!po_id || !ship_date || !items || items.length === 0) {
      return NextResponse.json({ error: "必填信息不完整" }, { status: 400 });
    }

    // 1. shipment_records 생성
    const { data: shipment, error: shipErr } = await supabaseAdmin
      .from("shipment_records")
      .insert({ po_id, ship_date, tracking_number: tracking_number || null, note: note || null })
      .select("id")
      .single();

    if (shipErr || !shipment) {
      return NextResponse.json({ error: "出货记录创建失败" }, { status: 500 });
    }

    // 2. shipment_items 생성 + po_items shipped_qty 업데이트
    // 동시에 인보이스 항목 데이터 수집
    let totalAmount = 0;
    const invoiceItemsData: { po_item_id: string; internal_sku: string; shipped_qty: number; unit_price: number; amount: number }[] = [];

    for (const item of items) {
      await supabaseAdmin.from("shipment_items").insert({
        shipment_id: shipment.id,
        po_item_id: item.po_item_id,
        shipped_qty: item.shipped_qty,
      });

      await supabaseAdmin
        .from("po_items")
        .update({ shipped_qty: item.shipped_qty })
        .eq("id", item.po_item_id);

      // po_item 정보 조회 (단가, 품번)
      const { data: poItem } = await supabaseAdmin
        .from("po_items")
        .select("internal_sku, unit_price")
        .eq("id", item.po_item_id)
        .single();

      const unitPrice = poItem?.unit_price || 0;
      const amount = item.shipped_qty * unitPrice;
      totalAmount += amount;

      invoiceItemsData.push({
        po_item_id: item.po_item_id,
        internal_sku: poItem?.internal_sku || "",
        shipped_qty: item.shipped_qty,
        unit_price: unitPrice,
        amount,
      });
    }

    // 3. 발주 상태 → 선적완료
    await supabaseAdmin
      .from("purchase_orders")
      .update({
        status: "선적완료",
        shipped_at: new Date().toISOString(),
        tracking_number: tracking_number || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", po_id);

    // 4. 공급업체 ID 조회
    const { data: poData } = await supabaseAdmin
      .from("po_items")
      .select("products!inner(supplier_id)")
      .eq("po_id", po_id)
      .limit(1);

    let supplierId: string | null = null;
    if (poData && poData.length > 0) {
      const products = poData[0].products as unknown as { supplier_id: string };
      supplierId = products.supplier_id;
    }

    // 5. 인보이스 자동 생성
    if (supplierId) {
      const invoiceNumber = await generateInvoiceNumber();
      const { data: invoice } = await supabaseAdmin
        .from("invoices")
        .insert({
          invoice_number: invoiceNumber,
          po_id,
          supplier_id: supplierId,
          shipment_id: shipment.id,
          total_amount: totalAmount,
          paid_amount: 0,
          balance: totalAmount,
          status: "미결제",
        })
        .select("id")
        .single();

      if (invoice) {
        // 인보이스 항목 저장
        for (const ii of invoiceItemsData) {
          await supabaseAdmin.from("invoice_items").insert({
            invoice_id: invoice.id,
            po_item_id: ii.po_item_id,
            internal_sku: ii.internal_sku,
            shipped_qty: ii.shipped_qty,
            unit_price: ii.unit_price,
            amount: ii.amount,
          });
        }
      }
    }

    // 알림: 출고 등록
    const { data: poInfo } = await supabaseAdmin.from("purchase_orders").select("order_number").eq("id", po_id).single();
    if (poInfo) {
      sendNotification("shipment_registered", `[출고완료] ${poInfo.order_number} 입고 준비하세요`);
    }

    return NextResponse.json({ success: true, message: "出货登记完成！发票已自动生成。" });
  } catch (error) {
    console.error("출고 등록 오류:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
