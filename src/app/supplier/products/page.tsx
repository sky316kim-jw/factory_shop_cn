// 공급업체 메인 페이지 - 내 상품 목록
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ensureSupplier } from "@/lib/ensure-supplier";
import Header from "@/components/Header";
import { CATEGORY_CODES } from "@/utils/fashion-codes";

// 상품 데이터 타입
interface Product {
  id: string;
  name_cn: string;
  name_ko: string | null;
  price_cny: number | null;
  moq: number | null;
  is_active: boolean;
  image_url: string | null;
  category_code: string | null;
  supplier_sku: string | null;
  colors: { code: string; name_cn: string; name_ko: string }[];
  created_at: string;
}

export default function SupplierProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  // #15 새 발주 알림
  const [newOrderCount, setNewOrderCount] = useState(0);

  useEffect(() => {
    const init = async () => {
      // 로그인 확인
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const userId = session.user.id;

      // 내 공급업체 정보 조회 (없으면 자동 생성)
      const supplierId = await ensureSupplier(userId);

      if (!supplierId) {
        setProducts([]);
        setLoading(false);
        return;
      }
      const supplierData = { id: supplierId };

      // 내 상품 목록 조회
      const { data: productsData } = await supabase
        .from("products")
        .select("id, name_cn, name_ko, price_cny, moq, is_active, category_code, supplier_sku, colors, created_at")
        .eq("supplier_id", supplierData.id)
        .order("created_at", { ascending: false });

      if (!productsData || productsData.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      // 각 상품의 대표 이미지 가져오기
      const enriched: Product[] = await Promise.all(
        productsData.map(async (p) => {
          const { data: imgData } = await supabase
            .from("product_images")
            .select("image_url")
            .eq("product_id", p.id)
            .eq("is_primary", true)
            .limit(1);

          return {
            ...p,
            image_url: imgData?.[0]?.image_url || null,
          };
        })
      );

      setProducts(enriched);

      // #15 새 발주 건수 확인
      try {
        const ordersRes = await fetch(`/api/orders?user_id=${userId}&role=supplier`);
        const ordersData = await ordersRes.json();
        const pendingOrders = (ordersData.orders || []).filter(
          (o: { status: string }) => o.status === "발주확인중"
        );
        setNewOrderCount(pendingOrders.length);
      } catch { /* 무시 */ }

      setLoading(false);
    };

    init();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* 상단: 제목 + 버튼들 */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">我的商品列表</h2>
          <div className="flex gap-3">
            <button onClick={() => router.push("/supplier/invoices")}
              className="px-5 py-2.5 text-gray-600 border border-gray-300 rounded-lg font-medium hover:bg-gray-100 transition-colors">
              发票列表
            </button>
            <button onClick={() => router.push("/supplier/orders")}
              className="px-5 py-2.5 text-gray-600 border border-gray-300 rounded-lg font-medium hover:bg-gray-100 transition-colors">
              收到的订单
            </button>
            <button onClick={() => router.push("/supplier/products/new")}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
              + 新增商品
            </button>
          </div>
        </div>

        {/* #15 새 발주 알림 배너 */}
        {newOrderCount > 0 && (
          <div onClick={() => router.push("/supplier/orders")}
            className="bg-red-50 border-2 border-red-300 rounded-xl p-4 mb-6 cursor-pointer hover:bg-red-100 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔔</span>
                <div>
                  <p className="font-bold text-red-700">有 {newOrderCount} 个新订单待确认！</p>
                  <p className="text-sm text-red-600">点击查看订单详情</p>
                </div>
              </div>
              <span className="bg-red-600 text-white text-lg font-bold px-3 py-1 rounded-full">{newOrderCount}</span>
            </div>
          </div>
        )}

        {loading && (
          <div className="text-center py-20 text-gray-500">加载中...</div>
        )}

        {!loading && products.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📦</div>
            <p className="text-gray-500 text-lg mb-4">暂无商品</p>
            <button onClick={() => router.push("/supplier/products/new")}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
              立即添加商品
            </button>
          </div>
        )}

        {/* 상품 목록 */}
        {!loading && products.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <div
                key={product.id}
                onClick={() => router.push(`/supplier/products/${product.id}`)}
                className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-shadow overflow-hidden cursor-pointer"
              >
                {/* 상품 이미지 */}
                <div className="aspect-[3/4] bg-gray-100 flex items-center justify-center relative">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name_cn}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl text-gray-300">&#128247;</span>
                  )}
                  {/* 비활성 상품 표시 */}
                  {!product.is_active && (
                    <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
                      비활성
                    </div>
                  )}
                  {/* 복종코드 배지 */}
                  {product.category_code && (
                    <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                      {CATEGORY_CODES[product.category_code] || product.category_code}
                    </div>
                  )}
                </div>

                {/* 상품 정보 */}
                <div className="p-3">
                  <h3 className="font-semibold text-gray-800 text-sm truncate">
                    {product.name_cn}
                  </h3>
                  {product.supplier_sku && (
                    <p className="text-xs text-gray-400 font-mono truncate mt-0.5">
                      {product.supplier_sku}
                    </p>
                  )}
                  {/* 컬러 태그 */}
                  {product.colors && product.colors.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {product.colors.slice(0, 4).map((c) => (
                        <span key={c.code} className="text-[10px] bg-gray-100 text-gray-600 px-1 py-0.5 rounded">
                          {c.name_cn}
                        </span>
                      ))}
                      {product.colors.length > 4 && (
                        <span className="text-[10px] text-gray-400">+{product.colors.length - 4}</span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-bold text-blue-600">
                      {product.price_cny
                        ? `\u00A5${Number(product.price_cny).toLocaleString()}`
                        : "가격 미정"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
