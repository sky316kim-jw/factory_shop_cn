// 公供业体 - 订单列表页面
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  notes: string | null;
  expected_ship_date: string | null;
  created_at: string;
  po_items: {
    id: string;
    internal_sku: string;
    quantity: number;
    unit_price: number;
    color_name: string | null;
    supplier_size: string | null;
    products: { name_cn: string; name_ko: string | null } | null;
  }[];
}

const statusLabel: Record<string, string> = {
  "발주요청대기": "⏳ 未审批(等待买家审批)",
  "발주확인중": "待确认",
  "발주확정": "已确定",
  "생산중": "生产中",
  "선적완료": "已发货",
  "부분입고": "部分入库",
  "입고완료": "已入库",
  "발주거절": "已拒绝",
  "쇼티지마감": "差异结案",
};

// 상태별 배지 색상 (#11 수정)
const statusColor: Record<string, string> = {
  "발주요청대기": "bg-gray-200 text-gray-600",
  "발주확인중": "bg-gray-200 text-gray-600",
  "발주확정": "bg-blue-100 text-blue-700",
  "생산중": "bg-blue-100 text-blue-700",
  "선적완료": "bg-orange-100 text-orange-700",
  "부분입고": "bg-purple-100 text-purple-700",
  "입고완료": "bg-green-100 text-green-700",
  "발주거절": "bg-red-100 text-red-700",
  "쇼티지마감": "bg-red-100 text-red-700",
};

export default function SupplierOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      const res = await fetch(`/api/orders?user_id=${session.user.id}&role=supplier`);
      const data = await res.json();
      setOrders(data.orders || []);
      setLoading(false);
    };
    init();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">收到的订单</h2>
          <button onClick={() => router.push("/supplier/products")}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100">
            返回商品列表
          </button>
        </div>

        {loading && <div className="text-center py-20 text-gray-500">加载中...</div>}

        {!loading && orders.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📦</div>
            <p className="text-gray-500 text-lg">暂无订单</p>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id}
                onClick={() => router.push(`/supplier/orders/${order.id}`)}
                className="bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-bold text-gray-800 text-lg">{order.order_number}</span>
                    <span className="text-sm text-gray-400 ml-3">
                      {new Date(order.created_at).toLocaleDateString("zh-CN")}
                    </span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColor[order.status] || "bg-gray-100 text-gray-600"}`}>
                    {statusLabel[order.status] || order.status}
                  </span>
                </div>

                {order.expected_ship_date && (
                  <div className="text-sm text-green-700 bg-green-50 px-2 py-1 rounded inline-block mb-2">
                    预计出货: {order.expected_ship_date}
                  </div>
                )}

                <div className="text-sm text-gray-600 mb-2">
                  {order.po_items.slice(0, 3).map((item, idx) => (
                    <span key={item.id}>
                      {idx > 0 && ", "}
                      {item.products?.name_cn || "商品"}
                      {item.color_name && ` (${item.color_name})`}
                      {" "}x{item.quantity}
                    </span>
                  ))}
                  {order.po_items.length > 3 && <span className="text-gray-400"> 等{order.po_items.length}项</span>}
                </div>

                {order.notes && (
                  <p className="text-sm text-gray-400 truncate mb-2">💬 {order.notes}</p>
                )}

                <div className="text-right">
                  <span className="text-lg font-bold text-blue-600">¥{Number(order.total_amount).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
