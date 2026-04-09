// 관리자 - 알림 설정 (채널별 Webhook URL + 이벤트 ON/OFF)
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";

// Webhook 채널 정의
const WEBHOOK_CHANNELS = [
  { key: "webhook_order", label: "발주 알림 Webhook", desc: "발주요청, 승인, 수락/거절 알림" },
  { key: "webhook_inbound", label: "입고 알림 Webhook", desc: "출고 등록, 입고처리 알림" },
  { key: "webhook_payment", label: "정산 알림 Webhook", desc: "인보이스 발행, 결제 알림" },
  { key: "webhook_all", label: "전체 알림 Webhook (선택)", desc: "모든 알림을 하나의 URL로 수신" },
];

// 이벤트별로 어느 채널에 속하는지
const NOTIFY_EVENTS = [
  { key: "new_order_request", label: "새 발주요청 접수", channel: "webhook_order" },
  { key: "order_approved", label: "발주 승인됨", channel: "webhook_order" },
  { key: "supplier_response", label: "공급업체 수락/거절", channel: "webhook_order" },
  { key: "shipment_registered", label: "출고 등록됨", channel: "webhook_inbound" },
  { key: "inbound_needed", label: "입고처리 필요", channel: "webhook_inbound" },
  { key: "invoice_issued", label: "인보이스 발행", channel: "webhook_payment" },
];

export default function AdminSettingsPage() {
  const router = useRouter();
  const [webhooks, setWebhooks] = useState<Record<string, { url: string; enabled: boolean }>>({});
  const [events, setEvents] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      const res = await fetch("/api/settings");
      const data = await res.json();
      const s = data.settings || {};

      // Webhook 채널 초기화
      const wh: Record<string, { url: string; enabled: boolean }> = {};
      for (const ch of WEBHOOK_CHANNELS) {
        wh[ch.key] = {
          url: s[`${ch.key}_url`] || "",
          enabled: s[`${ch.key}_enabled`] === "true",
        };
      }
      setWebhooks(wh);

      // 이벤트 초기화
      const evts: Record<string, boolean> = {};
      for (const e of NOTIFY_EVENTS) {
        evts[e.key] = s[`notify_${e.key}`] === "true";
      }
      setEvents(evts);
      setLoading(false);
    };
    init();
  }, [router]);

  const saveSetting = async (key: string, value: string) => {
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
  };

  const handleSave = async () => {
    setSaving(true);

    // Webhook 채널 저장
    for (const ch of WEBHOOK_CHANNELS) {
      await saveSetting(`${ch.key}_url`, webhooks[ch.key]?.url || "");
      await saveSetting(`${ch.key}_enabled`, webhooks[ch.key]?.enabled ? "true" : "false");
    }

    // 기존 호환: naver_works_webhook_url = 전체 알림 URL 또는 첫 번째 활성 URL
    const allUrl = webhooks.webhook_all?.url || "";
    const firstActiveUrl = WEBHOOK_CHANNELS.find((ch) => webhooks[ch.key]?.enabled && webhooks[ch.key]?.url)?.key;
    await saveSetting("naver_works_webhook_url", allUrl || (firstActiveUrl ? webhooks[firstActiveUrl].url : ""));

    // 이벤트 저장
    for (const e of NOTIFY_EVENTS) {
      await saveSetting(`notify_${e.key}`, events[e.key] ? "true" : "false");
    }

    alert("설정이 저장되었습니다.");
    setSaving(false);
  };

  const updateWebhook = (key: string, field: "url" | "enabled", value: string | boolean) => {
    setWebhooks((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  if (loading) return <div className="min-h-screen bg-gray-50"><Header /><div className="text-center py-20 text-gray-500">로딩 중...</div></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">알림 설정</h2>
          <button onClick={() => router.push("/admin")} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-100">대시보드</button>
        </div>

        {/* Webhook 채널별 설정 */}
        <div className="space-y-4 mb-6">
          {WEBHOOK_CHANNELS.map((ch) => (
            <div key={ch.key} className="bg-white rounded-xl shadow-sm border p-5">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-bold text-gray-800 text-sm">{ch.label}</h3>
                  <p className="text-xs text-gray-400">{ch.desc}</p>
                </div>
                <button
                  onClick={() => updateWebhook(ch.key, "enabled", !webhooks[ch.key]?.enabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    webhooks[ch.key]?.enabled ? "bg-blue-600" : "bg-gray-300"
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    webhooks[ch.key]?.enabled ? "translate-x-6" : "translate-x-1"
                  }`} />
                </button>
              </div>
              <input
                type="url"
                value={webhooks[ch.key]?.url || ""}
                onChange={(e) => updateWebhook(ch.key, "url", e.target.value)}
                placeholder="https://..."
                className={`w-full px-3 py-2 border rounded-lg text-sm ${!webhooks[ch.key]?.enabled ? "bg-gray-50 text-gray-400" : ""}`}
                disabled={!webhooks[ch.key]?.enabled}
              />
            </div>
          ))}
        </div>

        {/* 이벤트별 ON/OFF */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h3 className="font-bold text-gray-800 mb-4">알림 이벤트 설정</h3>

          {/* 채널별로 그룹핑 */}
          {WEBHOOK_CHANNELS.filter((ch) => ch.key !== "webhook_all").map((ch) => {
            const channelEvents = NOTIFY_EVENTS.filter((e) => e.channel === ch.key);
            if (channelEvents.length === 0) return null;
            return (
              <div key={ch.key} className="mb-4">
                <p className="text-xs font-medium text-gray-500 mb-2 uppercase">{ch.label}</p>
                <div className="space-y-2 ml-1">
                  {channelEvents.map((e) => (
                    <label key={e.key} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={events[e.key] || false}
                        onChange={(ev) => setEvents((p) => ({ ...p, [e.key]: ev.target.checked }))}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-sm text-gray-700">{e.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400">
          {saving ? "저장 중..." : "설정 저장"}
        </button>
      </main>
    </div>
  );
}
