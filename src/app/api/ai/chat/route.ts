// AI 채팅 API - 공급업체 상품 등록용
// Claude API를 사용하여 중국어 상품 정보를 분석하고 필수 항목 추출
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  CATEGORY_CODES,
  CATEGORY_CN,
  COLOR_CODES,
  COLOR_CN_MAP,
  SEASON_CODES,
  SEASON_CN,
} from "@/utils/fashion-codes";

// Anthropic 클라이언트 생성
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// 시스템 프롬프트 - AI의 역할 정의
const SYSTEM_PROMPT = `你是一个专业的服装商品信息录入助手。你的任务是从供应商提供的中文商品信息中提取必填项目。

## 你需要提取的必填项目：
1. 商品名 (中文)
2. 供应商货号
3. 品类代码 (从以下列表匹配):
${Object.entries(CATEGORY_CN).map(([code, cn]) => `   ${code}=${cn}(${CATEGORY_CODES[code]})`).join("\n")}
4. 季节: ${Object.entries(SEASON_CN).map(([code, cn]) => `${code}=${cn}`).join(", ")}
5. 颜色组合 (从以下颜色代码匹配):
${Object.entries(COLOR_CN_MAP).filter((_, i) => i % 2 === 0).slice(0, 30).map(([cn, code]) => `   ${cn}→${code}(${COLOR_CODES[code]})`).join(", ")}
   还有更多颜色...
6. 尺码组合 (必须用逗号分隔每个尺码，不能用范围):
   正确: FF 或 S,M,L,XL 或 90,95,100,105 或 25,26,27,28,29,30 或 55,66,77
   错误: 90~105, 25-30 (范围格式不允许)
   如果供应商输入范围格式(如90~105, 25-30)，必须自动展开为逗号分隔的个别尺码并向供应商确认:
   例如: "90~105" → 询问 "尺码是 90,95,100,105 吗？请确认。"
   例如: "25-30" → 询问 "尺码是 25,26,27,28,29,30 吗？请确认。"
7. 商品描述
8. 面料成分 (如: 棉60% 聚酯纤维40%)
9. 单价 (CNY/元)

## 工作流程：
1. 分析供应商的输入信息
2. 从中提取上述项目
3. 对于能确定的信息，整理成结构化格式回复
4. 对于缺少的信息，用中文礼貌地询问

## 回复格式规则：
- 始终用中文回复
- 当所有信息齐全时，以JSON格式输出提取的数据，包裹在 \`\`\`json 代码块中
- JSON格式如下:
\`\`\`json
{
  "status": "confirmed",
  "data": {
    "name_cn": "商品名",
    "supplier_sku": "货号",
    "category_code": "品类代码(2字母)",
    "season_code": "季节代码(1数字)",
    "colors": [{"code": "01", "name_cn": "白色", "name_ko": "화이트"}],
    "sizes": ["S", "M", "L"],  // 必须是单独的尺码数组，不能有范围格式
    "description": "商品描述",
    "fabric_composition": "面料成分",
    "price_cny": 28
  }
}
\`\`\`
- 当还缺少信息时，status应为 "incomplete"，只列出已有信息，并在message字段说明缺少什么
- 当供应商说"注册"、"确认"、"登录"、"OK"等确认词时，如果之前已确认所有信息，输出 status: "confirmed"

## 重要：
- 不要猜测信息，缺少的就询问
- 颜色必须匹配到对应的颜色代码
- 品类必须匹配到对应的品类代码
- 尺码按供应商原样记录，不做转换`;

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "메시지가 필요합니다." },
        { status: 400 }
      );
    }

    // Claude API 호출
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    // 응답 텍스트 추출
    const textBlock = response.content.find((block) => block.type === "text");
    const assistantMessage = textBlock ? textBlock.text : "";

    // JSON 데이터 추출 시도
    let extractedData = null;
    const jsonMatch = assistantMessage.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.status === "confirmed" && parsed.data) {
          extractedData = parsed.data;
        }
      } catch {
        // JSON 파싱 실패 - 무시
      }
    }

    return NextResponse.json({
      message: assistantMessage,
      extractedData,
    });
  } catch (error) {
    console.error("AI 채팅 오류:", error);
    return NextResponse.json(
      { error: "AI 응답에 실패했습니다. 다시 시도해주세요." },
      { status: 500 }
    );
  }
}
