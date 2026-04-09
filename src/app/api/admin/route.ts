export const dynamic = "force-dynamic";
// 관리자 API - 전체 데이터 조회 + 권한 관리
// service_role 키를 사용하여 RLS를 우회 (관리자 전용)
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

// GET: 관리자 대시보드 데이터 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");

    if (!userId) {
      return NextResponse.json({ error: "사용자 정보가 필요합니다." }, { status: 400 });
    }

    // 관리자 권한 확인
    const { data: adminUser } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    if (!adminUser || !["super_admin", "admin", "super_buyer"].includes(adminUser.role)) {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }

    // 전체 데이터 동시 조회
    const [usersRes, productsRes, ordersRes] = await Promise.all([
      supabaseAdmin
        .from("users")
        .select("id, email, role, company_name, member_code, can_view_price, is_approved, is_active, created_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("products")
        .select("id, name_cn, name_ko, price_cny, category_code, is_active")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("purchase_orders")
        .select("id, order_number, status, total_amount, created_at")
        .order("created_at", { ascending: false }),
    ]);

    return NextResponse.json({
      users: usersRes.data || [],
      products: productsRes.data || [],
      orders: ordersRes.data || [],
    });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// PUT: 회원 정보 업데이트 (단가권한, 승인, 역할 등)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { admin_id, target_user_id, can_view_price, is_approved, is_active, role } = body;

    if (!admin_id || !target_user_id) {
      return NextResponse.json({ error: "필수 정보가 부족합니다." }, { status: 400 });
    }

    const { data: adminUser } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", admin_id)
      .single();

    if (!adminUser || !["super_admin", "admin", "super_buyer"].includes(adminUser.role)) {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }

    // 업데이트할 필드만 모음
    const updateData: Record<string, unknown> = {};
    if (can_view_price !== undefined) updateData.can_view_price = can_view_price;
    if (is_approved !== undefined) updateData.is_approved = is_approved;
    if (is_active !== undefined) updateData.is_active = is_active;
    // 역할 변경은 super_admin만 가능
    if (role !== undefined && adminUser.role === "super_admin") updateData.role = role;

    const { error } = await supabaseAdmin
      .from("users")
      .update(updateData)
      .eq("id", target_user_id);

    if (error) return NextResponse.json({ error: "업데이트 실패" }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// DELETE: 회원 강제 탈퇴
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get("admin_id");
    const targetId = searchParams.get("target_id");

    if (!adminId || !targetId) {
      return NextResponse.json({ error: "필수 정보 부족" }, { status: 400 });
    }

    // 관리자 권한 확인
    const { data: adminUser } = await supabaseAdmin
      .from("users").select("role").eq("id", adminId).single();
    if (!adminUser) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

    // 대상 사용자 확인
    const { data: targetUser } = await supabaseAdmin
      .from("users").select("role").eq("id", targetId).single();
    if (!targetUser) return NextResponse.json({ error: "대상 없음" }, { status: 404 });

    // 권한 체크
    // super_admin: 본인 제외 모든 회원 삭제 가능
    // admin: buyer만 삭제 가능
    if (adminId === targetId) {
      return NextResponse.json({ error: "본인은 탈퇴할 수 없습니다." }, { status: 400 });
    }
    if (adminUser.role === "admin" && targetUser.role !== "buyer") {
      return NextResponse.json({ error: "일반 관리자는 바이어만 탈퇴시킬 수 있습니다." }, { status: 403 });
    }
    if (!["super_admin", "admin"].includes(adminUser.role)) {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    // 1. public.users 삭제 (CASCADE로 suppliers, products 등 연쇄 삭제)
    await supabaseAdmin.from("users").delete().eq("id", targetId);

    // 2. auth.users 삭제
    await supabaseAdmin.auth.admin.deleteUser(targetId);

    return NextResponse.json({ success: true, message: "회원이 탈퇴 처리되었습니다." });
  } catch (error) {
    console.error("회원 탈퇴 오류:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
