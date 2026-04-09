// 인보이스 목록 공통 컴포넌트
"use client";

import { useEffect, useState } from "react";

interface Invoice {
  id: string;
  invoice_number: string;
  order_number: string;
  supplier_code: string;
  supplier_name: string;
  total_amount: number;
  paid_amount: number;
  balance: number;
  status: string;
  issued_at: string;
}

const statusColor: Record<string, string> = {
  "미결제": "bg-red-100 text-red-700",
  "부분결제": "bg-yellow-100 text-yellow-700",
  "결제완료": "bg-green-100 text-green-700",
};

interface InvoiceListProps {
  userId: string;
  role: string;
}

export default function InvoiceList({ userId, role }: InvoiceListProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`/api/invoices?user_id=${userId}&role=${role}`);
      const data = await res.json();
      setInvoices(data.invoices || []);
      setLoading(false);
    };
    load();
  }, [userId, role]);

  if (loading) return <div className="text-center py-10 text-gray-500">로딩 중...</div>;

  if (invoices.length === 0) return <div className="text-center py-10 text-gray-500">인보이스가 없습니다</div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">인보이스번호</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">발주번호</th>
              {role !== "supplier" && <th className="text-left px-4 py-3 font-medium text-gray-600">공급업체</th>}
              <th className="text-right px-4 py-3 font-medium text-gray-600">청구금액</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">지급금액</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">잔액</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">상태</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">발행일</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-blue-600">{inv.invoice_number}</td>
                <td className="px-4 py-3 font-mono text-sm">{inv.order_number}</td>
                {role !== "supplier" && (
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm">{inv.supplier_code}</span>
                    <span className="text-gray-400 text-xs ml-1">{inv.supplier_name}</span>
                  </td>
                )}
                <td className="px-4 py-3 text-right font-medium">¥{Number(inv.total_amount).toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{Number(inv.paid_amount) > 0 ? `¥${Number(inv.paid_amount).toLocaleString()}` : "-"}</td>
                <td className={`px-4 py-3 text-right font-medium ${Number(inv.balance) > 0 ? "text-red-600" : "text-green-600"}`}>
                  {Number(inv.balance) > 0 ? `¥${Number(inv.balance).toLocaleString()}` : "0"}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor[inv.status] || "bg-gray-100"}`}>
                    {inv.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{new Date(inv.issued_at).toLocaleDateString("ko-KR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
