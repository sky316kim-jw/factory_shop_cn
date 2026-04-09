// 바이어 메인 페이지 - 사이드바 메뉴 + 상품 갤러리
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";
import { CATEGORY_CODES, SEASON_CODES } from "@/utils/fashion-codes";

// 상품 데이터 타입
interface Product {
  id: string;
  name_cn: string;
  name_ko: string | null;
  price_cny: number | null;
  supplier_id: string;
  supplier_member_code: string;
  supplier_company: string;
  category_code: string | null;
  season_code: string | null;
  colors: { code: string; name_cn: string; name_ko: string }[];
  image_url: string | null;
  created_at: string;
}

// 공급업체 정보
interface SupplierInfo {
  member_code: string;
  company_name: string;
}

// 필터 타입
type FilterType = "all" | "recent" | "supplier" | "category" | "season";

export default function BuyerGalleryPage() {
  const router = useRouter();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [canViewPrice, setCanViewPrice] = useState(false);
  const [userRole, setUserRole] = useState("");

  // 필터 상태
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterValue, setFilterValue] = useState<string>("");

  // 사이드바 토글 (모바일)
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 사이드바 섹션 열림/닫힘
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    supplier: false,
    category: false,
    season: false,
  });

  // 공급업체 목록 (고유값)
  const [supplierList, setSupplierList] = useState<SupplierInfo[]>([]);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      // 단가 열람 권한 확인
      const { data: userData } = await supabase
        .from("users")
        .select("can_view_price, role")
        .eq("id", session.user.id)
        .single();

      const role = userData?.role || "";
      setUserRole(role);
      setCanViewPrice(userData?.can_view_price || ["super_admin", "super_buyer"].includes(role));

      // 활성 상품 목록 조회
      const { data: productsData } = await supabase
        .from("products")
        .select(`
          id, name_cn, name_ko, price_cny, supplier_id,
          category_code, season_code, colors, created_at,
          suppliers!inner ( user_id )
        `)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (!productsData || productsData.length === 0) {
        setAllProducts([]);
        setLoading(false);
        return;
      }

      // 각 상품의 대표 이미지 + 공급업체 회원번호
      const enriched: Product[] = await Promise.all(
        productsData.map(async (p: Record<string, unknown>) => {
          const { data: imgData } = await supabase
            .from("product_images")
            .select("image_url")
            .eq("product_id", p.id as string)
            .eq("is_primary", true)
            .limit(1);

          const supplier = p.suppliers as Record<string, unknown>;
          const { data: uData } = await supabase
            .from("users")
            .select("member_code, company_name")
            .eq("id", supplier.user_id as string)
            .single();

          return {
            id: p.id as string,
            name_cn: p.name_cn as string,
            name_ko: p.name_ko as string | null,
            price_cny: p.price_cny as number | null,
            supplier_id: p.supplier_id as string,
            supplier_member_code: uData?.member_code || "-",
            supplier_company: uData?.company_name || "-",
            category_code: p.category_code as string | null,
            season_code: p.season_code as string | null,
            colors: (p.colors as Product["colors"]) || [],
            image_url: imgData?.[0]?.image_url || null,
            created_at: p.created_at as string,
          };
        })
      );

      setAllProducts(enriched);

      // 공급업체 목록 추출 (고유값)
      const supplierMap = new Map<string, SupplierInfo>();
      enriched.forEach((p) => {
        if (!supplierMap.has(p.supplier_member_code)) {
          supplierMap.set(p.supplier_member_code, {
            member_code: p.supplier_member_code,
            company_name: p.supplier_company,
          });
        }
      });
      setSupplierList(Array.from(supplierMap.values()).sort((a, b) => a.member_code.localeCompare(b.member_code)));

      setLoading(false);

      // 번역 안 된 상품 자동 번역 (백그라운드)
      const untranslated = enriched.filter((p) => !p.name_ko);
      if (untranslated.length > 0) {
        try {
          const res = await fetch("/api/ai/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ product_ids: untranslated.map((p) => p.id) }),
          });
          const result = await res.json();
          if (result.translations) {
            // 번역 결과를 상품 목록에 반영
            setAllProducts((prev) =>
              prev.map((p) =>
                result.translations[p.id]
                  ? { ...p, name_ko: result.translations[p.id] }
                  : p
              )
            );
          }
        } catch {
          // 번역 실패해도 무시 (중국어만 표시)
        }
      }
    };
    init();
  }, [router]);

  // 필터링된 상품 목록
  const filteredProducts = (() => {
    switch (filterType) {
      case "recent":
        return [...allProducts].slice(0, 20);
      case "supplier":
        return allProducts.filter((p) => p.supplier_member_code === filterValue);
      case "category":
        return allProducts.filter((p) => p.category_code === filterValue);
      case "season":
        return allProducts.filter((p) => p.season_code === filterValue);
      default:
        return allProducts;
    }
  })();

  // 현재 필터 제목
  const filterTitle = (() => {
    switch (filterType) {
      case "recent": return "최근 등록 상품";
      case "supplier": {
        const s = supplierList.find((s) => s.member_code === filterValue);
        return s ? `${s.member_code} - ${s.company_name}` : filterValue;
      }
      case "category": return `${CATEGORY_CODES[filterValue] || filterValue}`;
      case "season": return `${SEASON_CODES[filterValue] || filterValue}`;
      default: return "전체 상품";
    }
  })();

  // 섹션 토글
  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // 메뉴 클릭 핸들러
  const handleMenuClick = (type: FilterType, value: string = "") => {
    setFilterType(type);
    setFilterValue(value);
    setSidebarOpen(false); // 모바일에서 사이드바 닫기
  };

  // 사이드바 메뉴 아이템 스타일
  const menuItemClass = (type: FilterType, value: string = "") =>
    `block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
      filterType === type && filterValue === value
        ? "bg-blue-50 text-blue-700 font-medium"
        : "text-gray-700 hover:bg-gray-100"
    }`;

  // 사이드바 컨텐츠 (데스크톱/모바일 공유)
  const SidebarContent = () => (
    <nav className="space-y-1">
      {/* 전체 상품 */}
      <button onClick={() => handleMenuClick("all")} className={menuItemClass("all")}>
        전체 상품
      </button>

      {/* 최근 등록 */}
      <button onClick={() => handleMenuClick("recent")} className={menuItemClass("recent")}>
        최근 등록 상품
      </button>

      {/* 구분선 */}
      <div className="border-t my-2" />

      {/* 공급업체별 */}
      <div>
        <button
          onClick={() => toggleSection("supplier")}
          className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 rounded-lg"
        >
          공급업체별 보기
          <span className="text-gray-400 text-xs">{openSections.supplier ? "▲" : "▼"}</span>
        </button>
        {openSections.supplier && (
          <div className="ml-2 space-y-0.5">
            {supplierList.length === 0 ? (
              <p className="px-3 py-1 text-xs text-gray-400">공급업체 없음</p>
            ) : (
              supplierList.map((s) => (
                <button
                  key={s.member_code}
                  onClick={() => handleMenuClick("supplier", s.member_code)}
                  className={menuItemClass("supplier", s.member_code)}
                >
                  <span className="font-mono text-blue-600 mr-1.5">{s.member_code}</span>
                  <span className="text-gray-500">{s.company_name}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* 복종별 */}
      <div>
        <button
          onClick={() => toggleSection("category")}
          className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 rounded-lg"
        >
          복종별 보기
          <span className="text-gray-400 text-xs">{openSections.category ? "▲" : "▼"}</span>
        </button>
        {openSections.category && (
          <div className="ml-2 space-y-0.5">
            {Object.entries(CATEGORY_CODES).map(([code, name]) => {
              const count = allProducts.filter((p) => p.category_code === code).length;
              return (
                <button
                  key={code}
                  onClick={() => handleMenuClick("category", code)}
                  className={menuItemClass("category", code)}
                >
                  <span className="font-mono text-xs text-gray-400 mr-1.5">{code}</span>
                  {name}
                  {count > 0 && <span className="ml-auto text-xs text-gray-400">({count})</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 시즌별 */}
      <div>
        <button
          onClick={() => toggleSection("season")}
          className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 rounded-lg"
        >
          시즌별 보기
          <span className="text-gray-400 text-xs">{openSections.season ? "▲" : "▼"}</span>
        </button>
        {openSections.season && (
          <div className="ml-2 space-y-0.5">
            {Object.entries(SEASON_CODES).map(([code, name]) => {
              const count = allProducts.filter((p) => p.season_code === code).length;
              return (
                <button
                  key={code}
                  onClick={() => handleMenuClick("season", code)}
                  className={menuItemClass("season", code)}
                >
                  {name}
                  {count > 0 && <span className="ml-auto text-xs text-gray-400">({count})</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 구분선 */}
      <div className="border-t my-2" />

      {/* 발주/정산 관리 */}
      <button onClick={() => router.push("/buyer/orders")}
        className="block w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100">
        📋 발주 관리 →
      </button>
      <button onClick={() => router.push("/buyer/inbound")}
        className="block w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">
        📬 입고 관리 →
      </button>
      {/* super_admin, super_buyer 전용 메뉴 */}
      {["super_admin", "super_buyer"].includes(userRole) && (
        <>
          <div className="border-t my-2" />
          <button onClick={() => router.push("/buyer/invoices")}
            className="block w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">
            📄 인보이스 →
          </button>
          <button onClick={() => router.push("/buyer/payments")}
            className="block w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">
            💰 정산 현황 →
          </button>
          <button onClick={() => router.push("/admin/suppliers")}
            className="block w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">
            🏭 공급업체 정보 →
          </button>
        </>
      )}
    </nav>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* 모바일: 상단 필터 탭 바 */}
      <div className="md:hidden bg-white border-b px-4 py-2 flex items-center justify-between">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 px-3 py-1.5 border rounded-lg hover:bg-gray-50"
        >
          <span>☰</span> 메뉴
        </button>
        <span className="text-sm font-medium text-gray-800">{filterTitle}</span>
        <button
          onClick={() => router.push("/buyer/orders")}
          className="text-xs text-blue-600 font-medium"
        >
          발주목록
        </button>
      </div>

      {/* 모바일 사이드바 오버레이 */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">메뉴</h3>
              <button onClick={() => setSidebarOpen(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <SidebarContent />
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto flex">
        {/* 데스크톱 사이드바 */}
        <aside className="hidden md:block w-60 flex-shrink-0 bg-white border-r min-h-[calc(100vh-65px)] p-4 sticky top-0 overflow-y-auto">
          <SidebarContent />
        </aside>

        {/* 메인 콘텐츠 */}
        <main className="flex-1 px-4 py-6 min-w-0">
          {/* 공급업체 전용 샵 헤더 */}
          {filterType === "supplier" && filterValue && (
            <div className="bg-white rounded-xl shadow-sm border p-5 mb-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleMenuClick("all")}
                  className="text-gray-400 hover:text-gray-600 text-sm"
                >
                  ← 뒤로
                </button>
                <div>
                  <span className="text-2xl font-bold text-blue-600 font-mono">{filterValue}</span>
                  <span className="text-lg text-gray-600 ml-2">
                    {supplierList.find((s) => s.member_code === filterValue)?.company_name || ""}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {filteredProducts.length}개 상품
              </p>
            </div>
          )}

          {/* 페이지 제목 (공급업체 뷰 아닐 때) */}
          {filterType !== "supplier" && (
            <div className="hidden md:flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">{filterTitle}</h2>
              <span className="text-sm text-gray-500">{filteredProducts.length}개 상품</span>
            </div>
          )}

          {/* 로딩 */}
          {loading && (
            <div className="text-center py-20 text-gray-500">상품을 불러오는 중...</div>
          )}

          {/* 상품 없음 */}
          {!loading && filteredProducts.length === 0 && (
            <div className="text-center py-20">
              <p className="text-gray-500 text-lg">
                {filterType === "all" ? "등록된 상품이 없습니다" : "해당 조건의 상품이 없습니다"}
              </p>
              {filterType !== "all" && (
                <button
                  onClick={() => handleMenuClick("all")}
                  className="mt-3 text-sm text-blue-600 hover:underline"
                >
                  전체 상품 보기
                </button>
              )}
            </div>
          )}

          {/* 상품 그리드 */}
          {!loading && filteredProducts.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => router.push(`/buyer/products/${product.id}`)}
                  className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-shadow overflow-hidden cursor-pointer"
                >
                  {/* 이미지 */}
                  <div className="aspect-[3/4] bg-gray-100 flex items-center justify-center relative">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name_ko || product.name_cn}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-4xl text-gray-300">&#128247;</span>
                    )}
                    {product.category_code && (
                      <div className="absolute top-2 left-2 flex gap-1">
                        <span className="bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                          {CATEGORY_CODES[product.category_code] || product.category_code}
                        </span>
                        {product.season_code && (
                          <span className="bg-blue-500/80 text-white text-[10px] px-1.5 py-0.5 rounded">
                            {SEASON_CODES[product.season_code] || ""}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 정보 */}
                  <div className="p-3">
                    <h3 className="font-semibold text-gray-800 text-sm truncate">
                      {product.name_cn}
                    </h3>
                    {product.name_ko && (
                      <p className="text-xs text-gray-500 truncate">{product.name_ko}</p>
                    )}

                    {product.colors.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {product.colors.slice(0, 4).map((c) => (
                          <span
                            key={c.code}
                            className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded"
                          >
                            {c.name_cn}({c.name_ko})
                          </span>
                        ))}
                        {product.colors.length > 4 && (
                          <span className="text-[10px] text-gray-400">
                            +{product.colors.length - 4}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm font-bold text-blue-600">
                        {canViewPrice
                          ? product.price_cny
                            ? `\u00A5${Number(product.price_cny).toLocaleString()}`
                            : "가격 미정"
                          : ""}
                      </span>
                      <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                        {product.supplier_member_code}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
