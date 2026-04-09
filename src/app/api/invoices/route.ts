export const dynamic = "force-dynamic";
// 인보이스 API - 조회
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");
    const role = searchParams.get("role");
    const supplierId = searchParams.get("supplier_id");

    if (!userId) {
      return NextResponse.json({ error: "user_id 필요" }, { status: 400 });
    }

    // 권한 확인
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("role, can_view_price")
      .eq("id", userId)
      .single();

    if (!user) return NextResponse.json({ error: "사용자 없음" }, { status: 404 });

    // buyer는 can_view_price=true만 열람 가능
    if (user.role === "buyer" && !user.can_view_price) {
      return NextResponse.json({ invoices: [], message: "단가 열람 권한이 없습니다." });
    }

    let query = supabaseAdmin
      .from("invoices")
      .select(`
        id, invoice_number, po_id, supplier_id, total_amount, paid_amount, balance, status, issued_at, due_date, note,
        purchase_orders ( order_number ),
        suppliers ( company_name_cn, user_id )
      `)
      .order("issued_at", { ascending: false });

    // 공급업체는 본인 것만
    if (role === "supplier" || user.role === "supplier") {
      // 공급업체 ID 조회
      const { data: supplierData } = await supabaseAdmin
        .from("suppliers")
        .select("id")
        .eq("user_id", userId)
        .limit(1);

      if (supplierData && supplierData.length > 0) {
        query = query.eq("supplier_id", supplierData[0].id);
      } else {
        return NextResponse.json({ invoices: [] });
      }
    }

    // 특정 공급업체 필터
    if (supplierId) {
      query = query.eq("supplier_id", supplierId);
    }

    const { data: invoices } = await query;

    // 공급업체 회원코드 추가
    const enriched = await Promise.all(
      (invoices || []).map(async (inv: Record<string, unknown>) => {
        const suppliers = inv.suppliers as { company_name_cn: string; user_id: string } | null;
        let supplierCode = "-";
        if (suppliers?.user_id) {
          const { data: u } = await supabaseAdmin
            .from("users")
            .select("member_code")
            .eq("id", suppliers.user_id)
            .single();
          supplierCode = u?.member_code || "-";
        }
        const po = inv.purchase_orders as { order_number: string } | null;
        return {
          ...inv,
          supplier_code: supplierCode,
          supplier_name: suppliers?.company_name_cn || "-",
          order_number: po?.order_number || "-",
        };
      })
    );

    return NextResponse.json({ invoices: enriched });
  } catch (error) {
    console.error("인보이스 조회 오류:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
