// 네이버 웍스 Webhook 알림 유틸 - 채널별 URL 지원
import { supabaseAdmin } from "@/lib/supabase-server";

// 이벤트 → 채널 매핑
const EVENT_CHANNEL: Record<string, string> = {
  new_order_request: "webhook_order",
  order_approved: "webhook_order",
  supplier_response: "webhook_order",
  shipment_registered: "webhook_inbound",
  inbound_needed: "webhook_inbound",
  invoice_issued: "webhook_payment",
};

// 설정값 가져오기
async function getSetting(key: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("settings")
    .select("value")
    .eq("key", key)
    .single();
  return data?.value || null;
}

// 알림 전송
export async function sendNotification(eventKey: string, message: string) {
  try {
    // 이벤트 활성화 확인
    const enabled = await getSetting(`notify_${eventKey}`);
    if (enabled !== "true") return;

    // 채널별 URL 가져오기
    const channel = EVENT_CHANNEL[eventKey] || "webhook_all";
    const channelEnabled = await getSetting(`${channel}_enabled`);
    const channelUrl = await getSetting(`${channel}_url`);

    // 전체 알림 URL (폴백)
    const allEnabled = await getSetting("webhook_all_enabled");
    const allUrl = await getSetting("webhook_all_url");

    const urls: string[] = [];
    if (channelEnabled === "true" && channelUrl) urls.push(channelUrl);
    if (allEnabled === "true" && allUrl && !urls.includes(allUrl)) urls.push(allUrl);

    // 기존 호환: naver_works_webhook_url
    if (urls.length === 0) {
      const legacyUrl = await getSetting("naver_works_webhook_url");
      if (legacyUrl) urls.push(legacyUrl);
    }

    // 각 URL로 전송
    for (const url of urls) {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botName: "Factory Shop CN", body: message }),
      }).catch(() => { /* 전송 실패 무시 */ });
    }
  } catch (error) {
    console.error("알림 전송 실패:", error);
  }
}
