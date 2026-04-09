// 바이어 - 인보이스 목록
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";
import InvoiceList from "@/components/InvoiceList";

export default function BuyerInvoicesPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      setUserId(session.user.id);
    };
    init();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">인보이스 목록</h2>
          <div className="flex gap-2">
            <button onClick={() => router.push("/buyer/payments")} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">대금 지급 관리</button>
            <button onClick={() => router.push("/buyer/gallery")} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-100">갤러리</button>
          </div>
        </div>
        {userId && <InvoiceList userId={userId} role="buyer" />}
      </main>
    </div>
  );
}
