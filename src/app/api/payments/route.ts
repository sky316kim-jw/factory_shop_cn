export const dynamic = "force-dynamic";
// 대금 지급 API - 조회(GET) + 등록(POST)
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

// GET: 정산 현황 + 지급 내역 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");
    const supplierId = searchParams.get("supplier_id");

    // 권한 확인
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("role, can_view_price")
      .eq("id", userId || "")
      .single();

    if (!user || (user.role === "buyer" && !user.can_view_price)) {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    if (supplierId) {
      // 특정 공급업체 거래 내역
      const [invoicesRes, paymentsRes] = await Promise.all([
        supabaseAdmin.from("invoices")
          .select("id, invoice_number, total_amount, paid_amount, balance, status, issued_at, purchase_orders(order_number)")
          .eq("supplier_id", supplierId)
          .order("issued_at", { ascending: false }),
        supabaseAdmin.from("payments")
          .select("*")
          .eq("supplier_id", supplierId)
          .order("payment_date", { ascending: false }),
      ]);

      return NextResponse.json({
        invoices: invoicesRes.data || [],
        payments: paymentsRes.data || [],
      });
    }

    // 전체 공급업체별 정산 현황
    const { data: suppliers } = await supabaseAdmin
      .from("suppliers")
      .select("id, company_name_cn, user_id");

    const summaries = await Promise.all(
      (suppliers || []).map(async (s) => {
        const { data: invoices } = await supabaseAdmin
          .from("invoices")
          .select("total_amount, paid_amount, balance")
          .eq("supplier_id", s.id);

        const { data: lastPayment } = await supabaseAdmin
          .from("payments")
          .select("payment_date")
          .eq("supplier_id", s.id)
          .order("payment_date", { ascending: false })
          .limit(1);

        const { data: u } = await supabaseAdmin
          .from("users")
          .select("member_code")
          .eq("id", s.user_id)
          .single();

        const totalCharged = (invoices || []).reduce((sum, inv) => sum + Number(inv.total_amount), 0);
        const totalPaid = (invoices || []).reduce((sum, inv) => sum + Number(inv.paid_amount), 0);
        const totalBalance = (invoices || []).reduce((sum, inv) => sum + Number(inv.balance), 0);

        return {
          supplier_id: s.id,
          supplier_code: u?.member_code || "-",
          company_name: s.company_name_cn,
          total_charged: totalCharged,
          total_paid: totalPaid,
          total_balance: totalBalance,
          last_payment_date: lastPayment?.[0]?.payment_date || null,
          invoice_count: (invoices || []).length,
        };
      })
    );

    // 거래가 있는 공급업체만
    const filtered = summaries.filter((s) => s.invoice_count > 0);

    return NextResponse.json({ summaries: filtered });
  } catch (error) {
    console.error("정산 조회 오류:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// POST: 대금 지급 등록
export async function POST(request: NextRequest) {
  try {
    const { supplier_id, invoice_id, amount, payment_date, payment_method, note, created_by } = await request.json();

    if (!supplier_id || !invoice_id || !amount || !payment_date) {
      return NextResponse.json({ error: "필수 정보가 부족합니다." }, { status: 400 });
    }

    // 1. 지급 기록 저장
    const { error: payErr } = await supabaseAdmin.from("payments").insert({
      supplier_id,
      invoice_id,
      amount,
      payment_date,
      payment_method: payment_method || "T/T",
      note: note || null,
      created_by: created_by || null,
    });

    if (payErr) {
      return NextResponse.json({ error: "지급 등록 실패" }, { status: 500 });
    }

    // 2. 인보이스 잔액 업데이트
    const { data: invoice } = await supabaseAdmin
      .from("invoices")
      .select("total_amount, paid_amount")
      .eq("id", invoice_id)
      .single();

    if (invoice) {
      const newPaid = Number(invoice.paid_amount) + amount;
      const newBalance = Number(invoice.total_amount) - newPaid;
      const newStatus = newBalance <= 0 ? "결제완료" : newPaid > 0 ? "부분결제" : "미결제";

      await supabaseAdmin
        .from("invoices")
        .update({
          paid_amount: newPaid,
          balance: Math.max(0, newBalance),
          status: newStatus,
        })
        .eq("id", invoice_id);
    }

    return NextResponse.json({ success: true, message: "지급이 등록되었습니다." });
  } catch (error) {
    console.error("지급 등록 오류:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
