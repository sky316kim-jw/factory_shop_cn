// 대금 지급 관리 공통 컴포넌트
"use client";

import { useEffect, useState } from "react";

interface Summary {
  supplier_id: string;
  supplier_code: string;
  company_name: string;
  total_charged: number;
  total_paid: number;
  total_balance: number;
  last_payment_date: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  total_amount: number;
  paid_amount: number;
  balance: number;
  status: string;
  purchase_orders: { order_number: string } | null;
}

interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  note: string | null;
}

interface PaymentManagerProps {
  userId: string;
}

export default function PaymentManager({ userId }: PaymentManagerProps) {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);

  // 상세 보기
  const [selectedSupplier, setSelectedSupplier] = useState<Summary | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // 지급 등록 모달
  const [showPayModal, setShowPayModal] = useState(false);
  const [payInvoiceId, setPayInvoiceId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState("");
  const [payMethod, setPayMethod] = useState("T/T");
  const [payNote, setPayNote] = useState("");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    loadSummaries();
  }, [userId]);

  const loadSummaries = async () => {
    const res = await fetch(`/api/payments?user_id=${userId}`);
    const data = await res.json();
    setSummaries(data.summaries || []);
    setLoading(false);
  };

  const loadDetail = async (supplier: Summary) => {
    setSelectedSupplier(supplier);
    setDetailLoading(true);
    const res = await fetch(`/api/payments?user_id=${userId}&supplier_id=${supplier.supplier_id}`);
    const data = await res.json();
    setInvoices(data.invoices || []);
    setPayments(data.payments || []);
    setDetailLoading(false);
  };

  const handlePayment = async () => {
    if (!payInvoiceId || !payAmount || !payDate || !selectedSupplier) return;
    setPaying(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_id: selectedSupplier.supplier_id,
          invoice_id: payInvoiceId,
          amount: parseFloat(payAmount),
          payment_date: payDate,
          payment_method: payMethod,
          note: payNote || null,
          created_by: userId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        setShowPayModal(false);
        setPayInvoiceId(""); setPayAmount(""); setPayNote("");
        await loadDetail(selectedSupplier);
        await loadSummaries();
      } else {
        alert(data.error);
      }
    } catch { alert("서버 오류"); }
    setPaying(false);
  };

  const statusColor: Record<string, string> = {
    "미결제": "bg-red-100 text-red-700",
    "부분결제": "bg-yellow-100 text-yellow-700",
    "결제완료": "bg-green-100 text-green-700",
  };

  if (loading) return <div className="text-center py-10 text-gray-500">로딩 중...</div>;

  // 상세 보기
  if (selectedSupplier) {
    const unpaidInvoices = invoices.filter((i) => i.status !== "결제완료");
    return (
      <div>
        <button onClick={() => setSelectedSupplier(null)} className="text-gray-500 hover:text-gray-700 mb-4 inline-block text-sm">
          ← 전체 목록으로
        </button>

        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h3 className="text-xl font-bold text-gray-800">
            <span className="font-mono text-blue-600">{selectedSupplier.supplier_code}</span> {selectedSupplier.company_name}
          </h3>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">총 청구금액</p>
              <p className="text-lg font-bold">¥{selectedSupplier.total_charged.toLocaleString()}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">총 지급금액</p>
              <p className="text-lg font-bold text-green-700">¥{selectedSupplier.total_paid.toLocaleString()}</p>
            </div>
            <div className={`rounded-lg p-3 ${selectedSupplier.total_balance > 0 ? "bg-red-50" : "bg-gray-50"}`}>
              <p className="text-xs text-gray-500">미지급 잔액</p>
              <p className={`text-lg font-bold ${selectedSupplier.total_balance > 0 ? "text-red-700" : "text-gray-700"}`}>
                ¥{selectedSupplier.total_balance.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* 인보이스 목록 */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-gray-800">인보이스 내역</h4>
            {unpaidInvoices.length > 0 && (
              <button onClick={() => setShowPayModal(true)}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                + 대금 지급 등록
              </button>
            )}
          </div>
          {detailLoading ? (
            <p className="text-gray-500 text-sm">로딩 중...</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2">인보이스번호</th>
                  <th className="text-left px-3 py-2">발주번호</th>
                  <th className="text-right px-3 py-2">청구</th>
                  <th className="text-right px-3 py-2">지급</th>
                  <th className="text-right px-3 py-2">잔액</th>
                  <th className="text-center px-3 py-2">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-blue-600">{inv.invoice_number}</td>
                    <td className="px-3 py-2 font-mono text-xs">{(inv.purchase_orders as { order_number: string } | null)?.order_number || "-"}</td>
                    <td className="px-3 py-2 text-right">¥{Number(inv.total_amount).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{Number(inv.paid_amount) > 0 ? `¥${Number(inv.paid_amount).toLocaleString()}` : "-"}</td>
                    <td className={`px-3 py-2 text-right font-medium ${Number(inv.balance) > 0 ? "text-red-600" : ""}`}>
                      ¥{Number(inv.balance).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${statusColor[inv.status] || ""}`}>{inv.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 지급 내역 */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h4 className="font-bold text-gray-800 mb-4">지급 내역</h4>
          {payments.length === 0 ? (
            <p className="text-gray-500 text-sm">지급 내역이 없습니다</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2">지급일</th>
                  <th className="text-right px-3 py-2">금액</th>
                  <th className="text-left px-3 py-2">방법</th>
                  <th className="text-left px-3 py-2">비고</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2">{p.payment_date}</td>
                    <td className="px-3 py-2 text-right font-medium text-green-700">¥{Number(p.amount).toLocaleString()}</td>
                    <td className="px-3 py-2">{p.payment_method}</td>
                    <td className="px-3 py-2 text-gray-500">{p.note || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 지급 등록 모달 */}
        {showPayModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <h3 className="text-lg font-bold text-gray-800 mb-4">대금 지급 등록</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">인보이스 선택 *</label>
                  <select value={payInvoiceId} onChange={(e) => setPayInvoiceId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm">
                    <option value="">선택하세요</option>
                    {unpaidInvoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_number} (잔액: ¥{Number(inv.balance).toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">지급금액 (CNY) *</label>
                  <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                    min="0" step="0.01" className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">지급일 *</label>
                  <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">지급방법</label>
                  <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg">
                    <option value="T/T">T/T (전신환)</option>
                    <option value="L/C">L/C (신용장)</option>
                    <option value="기타">기타</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">비고</label>
                  <input type="text" value={payNote} onChange={(e) => setPayNote(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowPayModal(false)} className="flex-1 py-2 border rounded-lg text-gray-600 hover:bg-gray-50">취소</button>
                <button onClick={handlePayment} disabled={paying}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                  {paying ? "처리 중..." : "등록"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 전체 정산 현황
  return (
    <div>
      {summaries.length === 0 ? (
        <div className="text-center py-10 text-gray-500">정산 내역이 없습니다</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">공급업체</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">총 청구금액</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">총 지급금액</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">미지급 잔액</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">마지막 지급일</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {summaries.map((s) => (
                  <tr key={s.supplier_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-blue-600 font-medium">{s.supplier_code}</span>
                      <span className="text-gray-500 ml-2">{s.company_name}</span>
                    </td>
                    <td className="px-4 py-3 text-right">¥{s.total_charged.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-green-700">¥{s.total_paid.toLocaleString()}</td>
                    <td className={`px-4 py-3 text-right font-medium ${s.total_balance > 0 ? "text-red-600" : ""}`}>
                      ¥{s.total_balance.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{s.last_payment_date || "-"}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => loadDetail(s)} className="text-blue-600 hover:underline text-xs">상세 →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
