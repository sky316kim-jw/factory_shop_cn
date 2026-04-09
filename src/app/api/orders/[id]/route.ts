// 발주 상세 조회 API - GET /api/orders/[id]
// 캐시 비활성화 (항상 최신 데이터 반환)
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;

    const { data: order, error } = await supabaseAdmin
      .from("purchase_orders")
      .select(`
        *,
        po_items (
          id, product_id, internal_sku, quantity, unit_price, comment,
          color_code, color_name, supplier_size, korea_label_size,
          is_custom_color, pantone_number, embroidery_color, received_qty, shipped_qty,
          products (
            id, name_cn, name_ko, material, price_cny, supplier_id, supplier_sku,
            suppliers ( company_name_cn, company_name_ko, user_id )
          )
        )
      `)
      .eq("id", orderId)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: "발주를 찾을 수 없습니다." }, { status: 404 });
    }

    // 바이어 정보
    const { data: buyerData } = await supabaseAdmin
      .from("users")
      .select("email, company_name, member_code")
      .eq("id", order.buyer_id)
      .single();

    // 공급업체 회원코드 조회 (첫 항목의 상품에서)
    let supplierCode = "-";
    const firstItem = (order.po_items as Record<string, unknown>[])?.[0];
    if (firstItem) {
      const products = firstItem.products as Record<string, unknown> | null;
      if (products) {
        const suppliers = products.suppliers as Record<string, unknown> | null;
        if (suppliers?.user_id) {
          const { data: supplierUser } = await supabaseAdmin
            .from("users")
            .select("member_code")
            .eq("id", suppliers.user_id as string)
            .single();
          supplierCode = supplierUser?.member_code || "-";
        }
      }
    }

    // 이미지 + 총수량 계산
    let totalQty = 0;
    let totalReceivedQty = 0;
    const itemsWithImages = await Promise.all(
      (order.po_items || []).map(async (item: Record<string, unknown>) => {
        const { data: imgData } = await supabaseAdmin
          .from("product_images")
          .select("image_url")
          .eq("product_id", item.product_id as string)
          .eq("is_primary", true)
          .limit(1);

        totalQty += (item.quantity as number) || 0;
        totalReceivedQty += (item.received_qty as number) || 0;

        return {
          ...item,
          product_image: imgData?.[0]?.image_url || null,
        };
      })
    );

    // 첨부파일
    const { data: attachments } = await supabaseAdmin
      .from("order_attachments")
      .select("id, file_url, file_name, file_type")
      .eq("po_id", orderId);

    // 입고 이력 조회 (회차별)
    const { data: inboundRecords } = await supabaseAdmin
      .from("inbound_records")
      .select("id, po_item_id, ordered_qty, received_qty, shortage_qty, inbound_date, note, created_at")
      .eq("po_id", orderId)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      order: {
        ...order,
        po_items: itemsWithImages,
        buyer: buyerData,
        supplier_code: supplierCode,
        attachments: attachments || [],
        inbound_records: inboundRecords || [],
        total_qty: totalQty,
        total_received_qty: totalReceivedQty,
      },
    });
  } catch (error) {
    console.error("발주 상세 조회 오류:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
