// 발주 API - 생성(POST) + 목록 조회(GET)
// 캐시 비활성화 (항상 최신 데이터)
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { YEAR_CODES } from "@/utils/fashion-codes";
import { sendNotification } from "@/lib/notify";

// 년도코드 가져오기
function getYearCode(): string {
  const year = new Date().getFullYear();
  return YEAR_CODES[year] || "X";
}

// 스타일번호 자동생성 (공급업체별 001부터 증가)
async function getNextStyleNumber(supplierMemberCode: string): Promise<string> {
  // 해당 공급업체의 기존 스타일번호 중 최대값 조회
  const { data } = await supabaseAdmin
    .from("internal_skus")
    .select("sku_code")
    .like("sku_code", `${supplierMemberCode}%`)
    .order("sku_code", { ascending: false })
    .limit(1);

  if (data && data.length > 0) {
    // 예: G01TS001L1 에서 스타일번호 001 추출 (회원번호 뒤 2글자(복종코드) 뒤 3글자)
    const code = data[0].sku_code;
    const prefixLen = supplierMemberCode.length + 2; // 회원번호 + 복종코드
    const styleStr = code.substring(prefixLen, prefixLen + 3);
    const styleNum = parseInt(styleStr, 10);
    if (!isNaN(styleNum)) {
      return String(styleNum + 1).padStart(3, "0");
    }
  }
  return "001";
}

// 발주번호 자동생성: ORD-YYMMDD-공급업체코드-일련번호2자리
async function generateOrderNumber(supplierMemberCode: string): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const prefix = `ORD-${yy}${mm}${dd}-${supplierMemberCode}-`;

  const { data } = await supabaseAdmin
    .from("purchase_orders")
    .select("order_number")
    .like("order_number", `${prefix}%`)
    .order("order_number", { ascending: false })
    .limit(1);

  let nextNumber = 1;
  if (data && data.length > 0) {
    const lastPart = data[0].order_number.split("-").pop() || "0";
    const lastNumber = parseInt(lastPart, 10);
    if (!isNaN(lastNumber)) nextNumber = lastNumber + 1;
  }

  return `${prefix}${String(nextNumber).padStart(2, "0")}`;
}

// POST: 발주 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { buyer_id, notes, items, product_id } = body;

    if (!buyer_id || !items || items.length === 0) {
      return NextResponse.json(
        { error: "발주 정보가 부족합니다. 수량을 입력해주세요." },
        { status: 400 }
      );
    }

    // 바이어 확인
    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", buyer_id)
      .single();

    const allowedRoles = ["buyer", "admin", "super_admin", "super_buyer"];
    if (!userData || !allowedRoles.includes(userData.role)) {
      return NextResponse.json({ error: "발주 권한이 없습니다." }, { status: 403 });
    }

    // 일반바이어는 발주요청대기, 나머지는 발주확인중
    const initialStatus = userData.role === "buyer" ? "발주요청대기" : "발주확인중";

    // 상품 정보 조회 (내부품번 생성용)
    const pid = product_id || items[0]?.product_id;
    const { data: productData } = await supabaseAdmin
      .from("products")
      .select("id, category_code, season_code, supplier_id, suppliers!inner(user_id)")
      .eq("id", pid)
      .single();

    // 공급업체 회원번호 조회
    let supplierMemberCode = "XX";
    let categoryCode = "XX";
    let seasonCode = "5";

    if (productData) {
      categoryCode = productData.category_code || "XX";
      seasonCode = productData.season_code || "5";

      const suppliers = productData.suppliers as unknown as { user_id: string };
      const supplierUserId = suppliers.user_id;
      const { data: supplierUser } = await supabaseAdmin
        .from("users")
        .select("member_code")
        .eq("id", supplierUserId)
        .single();

      if (supplierUser?.member_code) {
        supplierMemberCode = supplierUser.member_code;
      }
    }

    // 스타일번호 생성
    const styleNumber = await getNextStyleNumber(supplierMemberCode);
    const yearCode = getYearCode();

    // 발주번호
    const orderNumber = await generateOrderNumber(supplierMemberCode);

    // 총 금액 계산
    let totalAmount = 0;
    for (const item of items) {
      totalAmount += item.quantity * item.unit_price;
    }

    // 1. 발주서 생성
    const { data: poData, error: poError } = await supabaseAdmin
      .from("purchase_orders")
      .insert({
        buyer_id,
        order_number: orderNumber,
        status: initialStatus,
        total_amount: totalAmount,
        notes: notes || null,
        submitted_at: initialStatus === "발주확인중" ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (poError) {
      console.error("발주서 생성 오류:", poError);
      return NextResponse.json({ error: "발주서 생성에 실패했습니다." }, { status: 500 });
    }

    // 2. 각 컬러+사이즈 조합에 대해 내부품번 생성 + 발주 항목 저장
    const createdItems = [];
    for (const item of items) {
      // 내부품번: 공급업체회원번호 + 복종코드 + 스타일번호 + 년도코드 + 시즌코드 - 컬러코드 - 사이즈코드
      // 예: G01TS001L1-03-095
      const colorCode = item.color_code || "00";
      const sizeCode = item.supplier_size || "FF";
      const skuCode = `${supplierMemberCode}${categoryCode}${styleNumber}${yearCode}${seasonCode}-${colorCode}-${sizeCode}`;

      const { data: poItemData, error: poItemError } = await supabaseAdmin
        .from("po_items")
        .insert({
          po_id: poData.id,
          product_id: item.product_id,
          internal_sku: skuCode,
          quantity: item.quantity,
          unit_price: item.unit_price,
          comment: item.comment || null,
          color_code: item.color_code || null,
          color_name: item.color_name || null,
          supplier_size: item.supplier_size || null,
          korea_label_size: item.korea_label_size || null,
          is_custom_color: item.is_custom_color || false,
          pantone_number: item.pantone_number || null,
          embroidery_color: item.embroidery_color || null,
        })
        .select()
        .single();

      if (poItemError) {
        console.error("발주 항목 생성 오류:", poItemError);
        continue;
      }

      // #8 내부품번 매핑 테이블 저장 (중복 시 무시 - 취소/반려 후 재발주 가능하도록)
      await supabaseAdmin.from("internal_skus").upsert({
        sku_code: skuCode,
        product_id: item.product_id,
        po_item_id: poItemData.id,
      }, { onConflict: "sku_code" });

      createdItems.push(poItemData);
    }

    // 알림 전송
    if (initialStatus === "발주요청대기") {
      sendNotification("new_order_request", `[발주요청] ${orderNumber} 승인 대기중`);
    } else {
      sendNotification("new_order_request", `[발주등록] ${orderNumber} 공급업체 확인 대기중`);
    }

    return NextResponse.json({
      success: true,
      message: `발주가 완료되었습니다! (${orderNumber})`,
      order: poData,
      items: createdItems,
    });
  } catch (error) {
    console.error("발주 처리 오류:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

// GET: 발주 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");
    const role = searchParams.get("role");

    if (!userId || !role) {
      return NextResponse.json({ error: "사용자 정보가 필요합니다." }, { status: 400 });
    }

    if (role === "buyer") {
      const { data, error } = await supabaseAdmin
        .from("purchase_orders")
        .select(`
          *,
          po_items (
            id, product_id, internal_sku, quantity, unit_price, comment,
            color_code, color_name, supplier_size, korea_label_size,
            received_qty, shipped_qty,
            products ( name_cn, name_ko, supplier_id, supplier_sku,
              suppliers ( user_id, company_name_cn, company_name_ko )
            )
          )
        `)
        .eq("buyer_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        return NextResponse.json({ error: "발주 조회 실패" }, { status: 500 });
      }

      // 공급업체 member_code 보강
      const enrichedOrders = await Promise.all(
        (data || []).map(async (order: Record<string, unknown>) => {
          const poItems = (order.po_items as Record<string, unknown>[]) || [];
          let supplierCode = "";
          let supplierCompany = "";
          for (const item of poItems) {
            const products = item.products as Record<string, unknown> | null;
            if (products?.suppliers && !supplierCode) {
              const suppliers = products.suppliers as Record<string, unknown>;
              supplierCompany = (suppliers.company_name_ko as string) || (suppliers.company_name_cn as string) || "";
              if (suppliers.user_id) {
                const { data: uData } = await supabaseAdmin
                  .from("users").select("member_code").eq("id", suppliers.user_id as string).single();
                supplierCode = uData?.member_code || "";
              }
            }
          }
          return { ...order, supplier_code: supplierCode, supplier_company: supplierCompany };
        })
      );

      return NextResponse.json({ orders: enrichedOrders });

    } else if (role === "supplier") {
      // 공급업체 ID 조회 (없으면 자동 생성)
      const { data: supplierList } = await supabaseAdmin
        .from("suppliers")
        .select("id")
        .eq("user_id", userId)
        .limit(1);

      let supplierData = supplierList && supplierList.length > 0 ? supplierList[0] : null;

      if (!supplierData) {
        const { data: uData } = await supabaseAdmin
          .from("users")
          .select("company_name")
          .eq("id", userId)
          .single();

        const { data: newSupplier, error: insertErr } = await supabaseAdmin
          .from("suppliers")
          .insert({
            user_id: userId,
            company_name_cn: uData?.company_name || "미입력",
            company_name_ko: uData?.company_name || "미입력",
          })
          .select("id")
          .single();

        if (insertErr) {
          // UNIQUE 제약 위반이면 다시 조회
          const { data: retry } = await supabaseAdmin
            .from("suppliers").select("id").eq("user_id", userId).limit(1);
          supplierData = retry && retry.length > 0 ? retry[0] : null;
        } else {
          supplierData = newSupplier;
        }
        if (!supplierData) return NextResponse.json({ orders: [] });
      }

      const { data: poItems } = await supabaseAdmin
        .from("po_items")
        .select(`
          id, product_id, internal_sku, quantity, unit_price, comment,
          color_code, color_name, supplier_size, korea_label_size,
          products!inner ( name_cn, name_ko, supplier_id ),
          purchase_orders!inner ( id, order_number, status, total_amount, notes, buyer_id, created_at, updated_at )
        `)
        .eq("products.supplier_id", supplierData.id);

      if (!poItems || poItems.length === 0) {
        return NextResponse.json({ orders: [] });
      }

      // 발주별 그룹핑
      const orderMap = new Map<string, Record<string, unknown>>();
      for (const item of poItems) {
        const po = item.purchase_orders as unknown as Record<string, unknown>;
        const poId = po.id as string;
        if (!orderMap.has(poId)) {
          orderMap.set(poId, { ...po, po_items: [] });
        }
        (orderMap.get(poId)!.po_items as unknown[]).push({
          id: item.id,
          product_id: item.product_id,
          internal_sku: item.internal_sku,
          quantity: item.quantity,
          unit_price: item.unit_price,
          comment: item.comment,
          color_code: item.color_code,
          color_name: item.color_name,
          supplier_size: item.supplier_size,
          korea_label_size: item.korea_label_size,
          products: item.products,
        });
      }

      const orders = Array.from(orderMap.values()).sort(
        (a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()
      );

      return NextResponse.json({ orders });

    } else if (role === "admin") {
      // 관리자/바이어 전체 발주 조회 (supplier 정보 포함)
      const { data, error } = await supabaseAdmin
        .from("purchase_orders")
        .select(`
          *,
          po_items (
            id, product_id, internal_sku, quantity, unit_price, comment,
            color_code, color_name, supplier_size, korea_label_size,
            received_qty, shipped_qty,
            products ( name_cn, name_ko, supplier_id, supplier_sku,
              suppliers ( user_id, company_name_cn, company_name_ko )
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        return NextResponse.json({ error: "발주 조회 실패" }, { status: 500 });
      }

      // 공급업체 member_code 보강
      const enrichedOrders = await Promise.all(
        (data || []).map(async (order: Record<string, unknown>) => {
          const poItems = (order.po_items as Record<string, unknown>[]) || [];
          let supplierCode = "";
          let supplierCompany = "";
          for (const item of poItems) {
            const products = item.products as Record<string, unknown> | null;
            if (products?.suppliers && !supplierCode) {
              const suppliers = products.suppliers as Record<string, unknown>;
              supplierCompany = (suppliers.company_name_ko as string) || (suppliers.company_name_cn as string) || "";
              if (suppliers.user_id) {
                const { data: uData } = await supabaseAdmin
                  .from("users").select("member_code").eq("id", suppliers.user_id as string).single();
                supplierCode = uData?.member_code || "";
              }
            }
          }
          return { ...order, supplier_code: supplierCode, supplier_company: supplierCompany };
        })
      );

      return NextResponse.json({ orders: enrichedOrders });
    }

    return NextResponse.json({ orders: [] });
  } catch (error) {
    console.error("발주 목록 조회 오류:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
