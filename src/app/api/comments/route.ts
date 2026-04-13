export const dynamic = "force-dynamic";
// 댓글 API - 조회(GET) + 작성(POST) + 삭제/신고(PUT)
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// GET: 댓글 목록
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("product_id");
    if (!productId) return NextResponse.json({ error: "product_id 필요" }, { status: 400 });

    const { data: comments } = await supabaseAdmin
      .from("product_comments")
      .select(`
        id, message, translated_message, language, is_blocked, is_deleted, is_reported, created_at,
        user_id, users!product_comments_user_id_fkey ( email, role, member_code, company_name )
      `)
      .eq("product_id", productId)
      .eq("is_blocked", false)
      .order("created_at", { ascending: true });

    return NextResponse.json({ comments: comments || [] });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// POST: 댓글 작성 (AI 검사 + 번역)
export async function POST(request: NextRequest) {
  try {
    const { product_id, user_id, message } = await request.json();
    if (!product_id || !user_id || !message?.trim()) {
      return NextResponse.json({ error: "필수 정보 부족" }, { status: 400 });
    }

    // 작성자 역할 조회 (번역 방향 결정용)
    const { data: authorData } = await supabaseAdmin
      .from("users").select("role").eq("id", user_id).single();
    const authorRole = authorData?.role || "buyer";
    // 공급업체(supplier)가 쓴 글 → 중국어로 간주 → 한국어로 번역
    // 바이어/관리자가 쓴 글 → 한국어로 간주 → 중국어로 번역
    const isSupplierAuthor = authorRole === "supplier";
    const forcedLanguage = isSupplierAuthor ? "zh" : "ko";
    const translateDirection = isSupplierAuthor
      ? "Translate the message from Chinese to Korean. Output Korean translation."
      : "Translate the message from Korean to Chinese. Output Chinese translation.";

    // AI 검사 + 번역 (번역 방향을 역할 기반으로 강제)
    const aiResponse = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{
        role: "user",
        content: `Analyze this message. Output ONLY valid JSON, nothing else.

Message: "${message.trim()}"
Author role: ${isSupplierAuthor ? "Chinese supplier" : "Korean buyer/admin"}

Rules:
1. is_blocked: true ONLY if the message is CLEARLY trying to:
   - Negotiate prices or ask about costs (询价/报价/多少钱/가격협상/단가협상)
   - Exchange personal contact info (phone numbers like 010-xxxx, emails, 微信号/WeChat ID, 카카오톡, LINE, Telegram)

   is_blocked: false for ALL of these (ALWAYS ALLOWED):
   - Production feasibility, scheduling, delivery dates (生产/交期/납기)
   - Quantity confirmation, samples (数量/样品/수량/샘플)
   - Color/material/size questions (颜色/面料/尺码/색상/소재/사이즈)
   - Adding colors, changing specifications (加颜色/改规格)
   - Any production-related communication

   IMPORTANT: Words like 加颜色(add color), 可以生产(can produce) are production-related and must NOT be blocked.

2. translated: ${translateDirection}

JSON: {"is_blocked":false,"translated":"translation result here"}`,
      }],
    });

    const textBlock = aiResponse.content.find((b) => b.type === "text");
    const rawText = textBlock?.text || "";
    // 언어는 작성자 역할로 강제 결정 (AI 감지에 의존하지 않음)
    const language = forcedLanguage;
    let isBlocked = false;
    let translated = "";

    try {
      // JSON 부분만 추출 (AI가 앞뒤에 텍스트를 붙일 수 있음)
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // language는 작성자 역할로 이미 결정됨 (AI 감지 사용 안 함)
        isBlocked = parsed.is_blocked === true;
        translated = parsed.translated || "";
      }
    } catch {
      // JSON 파싱 실패 → 차단하지 않음 (허용)
      isBlocked = false;
    }

    if (isBlocked) {
      return NextResponse.json({
        blocked: true,
        message_ko: "이 채널은 생산/납기 관련 소통만 가능합니다. 단가 및 연락처 교환은 허용되지 않습니다.",
        message_zh: "此频道仅限生产/交期相关沟通，不允许询价及交换联系方式。",
      });
    }

    const { data: comment, error } = await supabaseAdmin
      .from("product_comments")
      .insert({
        product_id, user_id,
        message: message.trim(),
        translated_message: translated,
        language, is_blocked: false,
      })
      .select(`
        id, message, translated_message, language, is_blocked, is_deleted, is_reported, created_at,
        user_id, users!product_comments_user_id_fkey ( email, role, member_code, company_name )
      `)
      .single();

    if (error) {
      console.error("댓글 저장 오류:", error);
      return NextResponse.json({ error: "저장 실패", detail: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, comment });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// PUT: 댓글 삭제(숨김) / 신고
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { comment_id, action, user_id, message: editMessage } = body;
    if (!comment_id || !action || !user_id) {
      return NextResponse.json({ error: "필수 정보 부족" }, { status: 400 });
    }

    if (action === "delete") {
      // 본인 댓글이면 삭제 허용, 아니면 슈퍼관리자만 삭제 가능
      const { data: comment } = await supabaseAdmin
        .from("product_comments").select("user_id").eq("id", comment_id).single();
      const isOwnComment = comment?.user_id === user_id;
      if (!isOwnComment) {
        const { data: user } = await supabaseAdmin
          .from("users").select("role").eq("id", user_id).single();
        if (!user || user.role !== "super_admin") {
          return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
        }
      }
      await supabaseAdmin
        .from("product_comments")
        .update({ is_deleted: true, deleted_by: user_id })
        .eq("id", comment_id);
      return NextResponse.json({ success: true });
    }

    // 댓글 수정 (본인만 가능)
    if (action === "edit") {
      if (!editMessage?.trim()) {
        return NextResponse.json({ error: "수정 내용을 입력하세요." }, { status: 400 });
      }
      const { data: comment } = await supabaseAdmin
        .from("product_comments").select("user_id").eq("id", comment_id).single();
      if (!comment || comment.user_id !== user_id) {
        return NextResponse.json({ error: "수정 권한이 없습니다." }, { status: 403 });
      }
      await supabaseAdmin
        .from("product_comments")
        .update({ message: editMessage.trim(), updated_at: new Date().toISOString() })
        .eq("id", comment_id);
      return NextResponse.json({ success: true });
    }

    if (action === "report") {
      await supabaseAdmin
        .from("product_comments")
        .update({ is_reported: true, reported_by: user_id, reported_at: new Date().toISOString() })
        .eq("id", comment_id);
      return NextResponse.json({ success: true, message: "신고되었습니다." });
    }

    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
