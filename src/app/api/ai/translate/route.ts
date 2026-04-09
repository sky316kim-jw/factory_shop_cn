// AI 번역 API - 중국어 상품명을 한국어로 번역
// 번역 결과를 DB에 저장하여 캐싱
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase-server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// POST: 상품 ID 배열을 받아서 번역
export async function POST(request: NextRequest) {
  try {
    const { product_ids } = await request.json();

    if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
      return NextResponse.json({ error: "product_ids가 필요합니다." }, { status: 400 });
    }

    // name_ko가 없는 상품만 조회
    const { data: products } = await supabaseAdmin
      .from("products")
      .select("id, name_cn, description")
      .in("id", product_ids)
      .is("name_ko", null);

    if (!products || products.length === 0) {
      return NextResponse.json({ translated: 0 });
    }

    // 한번에 여러 상품을 번역 (최대 20개씩)
    const batch = products.slice(0, 20);
    const namesToTranslate = batch.map((p) => `${p.id}|||${p.name_cn}`).join("\n");

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `다음 중국어 상품명들을 한국어로 번역해주세요. 패션/의류 전문 용어를 사용해주세요.
각 줄은 "ID|||중국어상품명" 형식입니다.
결과는 "ID|||한국어번역" 형식으로 한 줄씩 출력해주세요. 다른 설명 없이 번역 결과만 출력해주세요.

${namesToTranslate}`,
        },
      ],
    });

    // 응답 파싱
    const textBlock = response.content.find((b) => b.type === "text");
    const resultText = textBlock?.text || "";

    const translations: Record<string, string> = {};
    for (const line of resultText.split("\n")) {
      const parts = line.split("|||");
      if (parts.length === 2) {
        const id = parts[0].trim();
        const koName = parts[1].trim();
        if (id && koName) {
          translations[id] = koName;
        }
      }
    }

    // DB에 번역 결과 저장
    let translatedCount = 0;
    for (const [id, name_ko] of Object.entries(translations)) {
      const { error } = await supabaseAdmin
        .from("products")
        .update({ name_ko })
        .eq("id", id);

      if (!error) translatedCount++;
    }

    return NextResponse.json({ translated: translatedCount, translations });
  } catch (error) {
    console.error("번역 오류:", error);
    return NextResponse.json({ error: "번역에 실패했습니다." }, { status: 500 });
  }
}
