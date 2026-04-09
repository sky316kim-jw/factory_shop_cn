// 공급업체 - 订单详情 + 接受/拒绝 + 状态变更
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";
import ProductComments from "@/components/ProductComments";

// 订单详情类型
interface OrderDetail {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  notes: string | null;
  expected_ship_date: string | null;
  rejection_reason: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  buyer: { email: string; company_name: string; member_code: string } | null;
  po_items: {
    id: string;
    product_id: string;
    internal_sku: string;
    quantity: number;
    unit_price: number;
    comment: string | null;
    color_code: string | null;
    color_name: string | null;
    supplier_size: string | null;
    korea_label_size: string | null;
    is_custom_color: boolean;
    pantone_number: string | null;
    embroidery_color: string | null;
    shipped_qty: number;
    product_image: string | null;
    products: { id: string; name_cn: string; name_ko: string | null; supplier_sku: string | null } | null;
  }[];
  attachments: { id: string; file_url: string; file_name: string; file_type: string }[];
  shipped_at: string | null;
  tracking_number: string | null;
}

// 공급업체는 진행바 없이 출고등록 버튼만 사용

export default function SupplierOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // 수락/거절 모달
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [expectedShipDate, setExpectedShipDate] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  // 出货登记
  const [showShipModal, setShowShipModal] = useState(false);
  const [shipDateInput, setShipDateInput] = useState("");
  const [trackingInput, setTrackingInput] = useState("");
  const [shipNote, setShipNote] = useState("");
  const [shipQty, setShipQty] = useState<Record<string, number>>({});

  const fetchOrder = async () => {
    const res = await fetch(`/api/orders/${orderId}`);
    const data = await res.json();
    if (data.order) {
      setOrder(data.order);
      const initQty: Record<string, number> = {};
      for (const item of data.order.po_items) {
        initQty[item.id] = item.quantity; // 기본값: 발주수량 전량
      }
      setShipQty(initQty);
    }
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      setUserId(session.user.id);
      await fetchOrder();
    };
    init();
  }, [router, orderId]);

  // 订单接受 (수락: 출고예정일 입력 → 생산중으로 변경)
  const handleAccept = async () => {
    if (!expectedShipDate) { alert("请输入预计出货日期"); return; }
    setUpdating(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "생산중", expected_ship_date: expectedShipDate }),
      });
      const data = await res.json();
      if (data.success) { alert("订单已确认！生产开始。"); setShowAcceptModal(false); await fetchOrder(); }
      else alert(data.error);
    } catch { alert("服务器错误"); }
    setUpdating(false);
  };

  // 订单拒绝 (거절: 사유 입력 필수)
  const handleReject = async () => {
    if (!rejectReason.trim()) { alert("请输入拒绝原因"); return; }
    setUpdating(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "발주거절", rejection_reason: rejectReason }),
      });
      const data = await res.json();
      if (data.success) { alert("订单已拒绝"); setShowRejectModal(false); await fetchOrder(); }
      else alert(data.error);
    } catch { alert("服务器错误"); }
    setUpdating(false);
  };

  // 出货登记
  const handleShipment = async () => {
    if (!order || !shipDateInput) { alert("请输入出货日期"); return; }
    setUpdating(true);
    try {
      const items = order.po_items.map((item) => ({
        po_item_id: item.id,
        shipped_qty: shipQty[item.id] || 0,
      }));
      const res = await fetch("/api/orders/shipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          po_id: order.id,
          ship_date: shipDateInput,
          tracking_number: trackingInput || null,
          note: shipNote || null,
          items,
        }),
      });
      const data = await res.json();
      if (data.success) { alert("出货登记完成！"); setShowShipModal(false); await fetchOrder(); }
      else alert(data.error);
    } catch { alert("服务器错误"); }
    setUpdating(false);
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50"><Header /><div className="text-center py-20 text-gray-500">加载中...</div></div>;
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50"><Header />
        <div className="text-center py-20">
          <p className="text-gray-500">找不到订单</p>
          <button onClick={() => router.push("/supplier/orders")} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg">返回</button>
        </div>
      </div>
    );
  }

  // 상태 판단 (진행바 삭제 후 출고등록 버튼만 사용)
  const isRejected = order.status === "발주거절";
  const hasCustomColors = order.po_items.some((item) => item.is_custom_color);
  const firstProductId = order.po_items[0]?.product_id;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4 print:hidden">
          <button onClick={() => router.push("/supplier/orders")} className="text-gray-500 hover:text-gray-700">
            ← 返回订单列表
          </button>
          {/* 거절 외 모든 상태에서 인쇄 가능 */}
          {!isRejected && (
            <button onClick={() => window.print()}
              className="px-4 py-2 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-800">
              🖨 打印订单
            </button>
          )}
        </div>

        {/* 未登记颜色警告 */}
        {hasCustomColors && (
          <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 mb-6 print:hidden">
            <p className="text-red-700 font-bold text-sm">⚠️ 包含未登记颜色的订单，请确认是否可以生产！</p>
          </div>
        )}

        {/* 已拒绝 */}
        {isRejected && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-4 mb-6">
            <p className="text-red-700 font-bold">订单已拒绝</p>
            {order.rejection_reason && <p className="text-red-600 text-sm mt-1">拒绝原因: {order.rejection_reason}</p>}
          </div>
        )}

        {/* 订单信息 */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold text-gray-800">订单号: {order.order_number}</h2>
            <span className="text-sm text-gray-400">
              下单日期: {new Date(order.created_at).toLocaleDateString("zh-CN")}
            </span>
          </div>
          {order.buyer && (
            <div className="text-sm text-gray-500 mb-4">
              买家: {order.buyer.company_name} ({order.buyer.member_code})
            </div>
          )}
          <div className="flex flex-wrap gap-2 mb-4">
            {order.expected_ship_date && (
              <div className="text-sm text-green-700 bg-green-50 px-3 py-1.5 rounded inline-block">
                预计出货日期: {order.expected_ship_date}
              </div>
            )}
            {order.shipped_at && (
              <div className="text-sm text-purple-700 bg-purple-50 px-3 py-1.5 rounded inline-block">
                已出货: {new Date(order.shipped_at).toLocaleDateString("zh-CN")}
              </div>
            )}
            {order.tracking_number && (
              <div className="text-sm text-blue-700 bg-blue-50 px-3 py-1.5 rounded inline-block">
                运单号: {order.tracking_number}
              </div>
            )}
          </div>

          {/* 현재 상태 배지 */}
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm text-gray-500">当前状态:</span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              order.status === "발주거절" ? "bg-red-100 text-red-700"
              : order.status === "입고완료" ? "bg-green-100 text-green-700"
              : order.status === "선적완료" ? "bg-purple-100 text-purple-700"
              : "bg-blue-100 text-blue-700"
            }`}>
              {order.status === "발주확인중" ? "待确认" : order.status === "생산중" ? "生产中"
              : order.status === "선적완료" ? "已发货" : order.status === "부분입고" ? "部分入库"
              : order.status === "입고완료" ? "已入库" : order.status === "발주거절" ? "已拒绝"
              : order.status}
            </span>
          </div>

          {/* 발주확인중: 수락/거절 버튼 표시 */}
          {order.status === "발주확인중" && (
            <div className="flex gap-3 mt-6 print:hidden">
              <button onClick={() => setShowAcceptModal(true)}
                className="flex-1 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors text-lg">
                ✅ 接受订单
              </button>
              <button onClick={() => setShowRejectModal(true)}
                className="flex-1 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors text-lg">
                ❌ 拒绝订单
              </button>
            </div>
          )}

          {/* 생산중 이후: 출고등록 버튼 (입고완료/거절 제외, 파샬 출고 반복 가능) */}
          {!["발주확인중", "입고완료", "발주거절"].includes(order.status) && (
            <div className="mt-6 text-center print:hidden">
              <button onClick={() => setShowShipModal(true)}
                className="px-8 py-3 bg-purple-600 text-white font-bold text-lg rounded-lg hover:bg-purple-700 transition-colors">
                📦 出货登记
              </button>
            </div>
          )}

          {/* 입고완료 안내 */}
          {order.status === "입고완료" && (
            <div className="mt-6 text-center">
              <span className="px-6 py-3 bg-green-100 text-green-700 font-bold rounded-lg inline-block">✅ 全部完成</span>
            </div>
          )}
        </div>

        {/* 订单商品列表 */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">订单商品</h3>
          <div className="space-y-4">
            {order.po_items.map((item) => (
              <div key={item.id} className={`flex gap-4 p-4 border rounded-lg ${item.is_custom_color ? "border-red-300 bg-red-50" : ""}`}>
                <div className="w-16 h-16 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                  {item.product_image ? (
                    <img src={item.product_image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl text-gray-300">&#128247;</div>
                  )}
                </div>
                <div className="flex-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800">{item.products?.name_cn || "商品"}</span>
                    {item.is_custom_color && <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded">未登记颜色</span>}
                  </div>
                  <p className="text-gray-500 mt-0.5">
                    买家品号: <span className="font-mono text-blue-600 font-medium">{item.internal_sku}</span>
                  </p>
                  {item.products?.supplier_sku && (
                    <p className="text-gray-500">
                      供应商货号: <span className="font-mono text-gray-700">{item.products.supplier_sku}</span>
                    </p>
                  )}
                  <div className="text-gray-500 mt-0.5 space-y-0.5">
                    {item.color_name && (
                      <p>颜色: <span className="font-medium text-gray-700">{item.color_name}</span>
                        {item.color_code && <span className="text-gray-400"> ({item.color_code})</span>}
                      </p>
                    )}
                    {item.pantone_number && (
                      <p>潘通色号: <span className="font-medium text-purple-600">{item.pantone_number}</span></p>
                    )}
                    {item.embroidery_color && (
                      <p>刺绣颜色: <span className="font-medium text-orange-600">{item.embroidery_color}</span></p>
                    )}
                    {item.supplier_size && (
                      <p>尺码: <span className="font-medium text-gray-700">{item.supplier_size}</span>
                        {item.korea_label_size && item.korea_label_size !== item.supplier_size && (
                          <span className="text-orange-600"> (韩国标签: {item.korea_label_size})</span>
                        )}
                      </p>
                    )}
                    <p>数量: {item.quantity}个 | 单价: ¥{Number(item.unit_price).toLocaleString()} | 小计: ¥{(item.quantity * item.unit_price).toLocaleString()}</p>
                  </div>
                  {item.comment && (
                    <div className={`mt-1.5 px-3 py-1.5 rounded-lg text-xs ${item.is_custom_color ? "bg-red-100 text-red-800" : "bg-yellow-50 text-yellow-800 border border-yellow-200"}`}>
                      💬 买家备注: {item.comment}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 工艺单/附件 */}
        {order.attachments && order.attachments.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-800 mb-3">工艺单 / 附件</h3>
            <div className="space-y-2">
              {order.attachments.map((att) => (
                <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 text-sm text-blue-600">
                  📎 {att.file_name}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* 买家备注 */}
        {order.notes && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-800 mb-3">买家备注</h3>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{order.notes}</p>
          </div>
        )}

        {/* 总金额 */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-gray-800">总金额</span>
            <span className="text-2xl font-bold text-blue-600">¥{Number(order.total_amount).toLocaleString()}</span>
          </div>
        </div>

        {/* 沟通记录 */}
        {userId && firstProductId && (
          <div className="mb-6 print:hidden">
            <ProductComments productId={firstProductId} userId={userId} viewerRole="supplier" />
          </div>
        )}
      </main>

      {/* 接受订单弹窗 (수락: 출고예정일 입력) */}
      {showAcceptModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-gray-800 mb-4">确认接受订单</h3>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              请输入预计出货日期 <span className="text-red-500">*</span>
            </label>
            <input type="date" value={expectedShipDate} onChange={(e) => setExpectedShipDate(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setShowAcceptModal(false)}
                className="flex-1 py-2 border rounded-lg text-gray-600 hover:bg-gray-50">取消</button>
              <button onClick={handleAccept} disabled={updating}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400">
                {updating ? "处理中..." : "确认接受"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 拒绝订单弹窗 (거절: 사유 입력) */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-gray-800 mb-4">拒绝订单</h3>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              拒绝原因 <span className="text-red-500">*</span>
            </label>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
              placeholder="请输入拒绝原因" rows={3}
              className="w-full px-4 py-2 border rounded-lg mb-4 resize-none" />
            <div className="flex gap-3">
              <button onClick={() => setShowRejectModal(false)}
                className="flex-1 py-2 border rounded-lg text-gray-600 hover:bg-gray-50">取消</button>
              <button onClick={handleReject} disabled={updating}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400">
                {updating ? "处理中..." : "确认拒绝"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 出货登记弹窗 */}
      {showShipModal && order && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full my-8">
            <h3 className="text-lg font-bold text-gray-800 mb-4">📦 出货登记</h3>

            <div className="space-y-4">
              {/* 出货日期 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  出货日期 <span className="text-red-500">*</span>
                </label>
                <input type="date" value={shipDateInput} onChange={(e) => setShipDateInput(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg" />
              </div>

              {/* 运单号 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">运单号 (选填)</label>
                <input type="text" value={trackingInput} onChange={(e) => setTrackingInput(e.target.value)}
                  placeholder="请输入运单号" className="w-full px-4 py-2 border rounded-lg" />
              </div>

              {/* 品番별 出货数量 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">出货数量</label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {order.po_items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs text-blue-600 truncate">{item.internal_sku}</p>
                        <p className="text-xs text-gray-500">
                          {item.color_name && `${item.color_name} `}
                          {item.supplier_size && `${item.supplier_size} `}
                          | 订单数量: {item.quantity}
                        </p>
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={item.quantity}
                        value={shipQty[item.id] || 0}
                        onChange={(e) => setShipQty((p) => ({ ...p, [item.id]: Math.max(0, parseInt(e.target.value) || 0) }))}
                        className="w-20 text-center px-2 py-1 border rounded text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* 备注 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注 (选填)</label>
                <textarea value={shipNote} onChange={(e) => setShipNote(e.target.value)}
                  placeholder="备注信息" rows={2} className="w-full px-4 py-2 border rounded-lg resize-none" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowShipModal(false)}
                className="flex-1 py-2 border rounded-lg text-gray-600 hover:bg-gray-50">取消</button>
              <button onClick={handleShipment} disabled={updating}
                className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400">
                {updating ? "处理中..." : "确认出货"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
