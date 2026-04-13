// 바이어 - 상품 상세보기 (패션 전용)
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";
import ProductComments from "@/components/ProductComments";
import { CATEGORY_CODES, SEASON_CODES } from "@/utils/fashion-codes";

// #5 원단 혼용율 중국어→한국어 변환
const FABRIC_CN_TO_KO: Record<string, string> = {
  "棉": "면", "纯棉": "면", "涤纶": "폴리에스터", "聚酯纤维": "폴리에스터", "聚酯": "폴리에스터",
  "氨纶": "스판덱스", "弹力": "스판덱스", "尼龙": "나일론", "锦纶": "나일론",
  "粘胶": "레이온", "人造棉": "레이온", "人棉": "레이온", "粘纤": "레이온",
  "真丝": "실크", "丝": "실크", "桑蚕丝": "실크", "蚕丝": "실크",
  "羊毛": "울", "毛": "울", "羊绒": "캐시미어", "麻": "린넨", "亚麻": "린넨",
  "莫代尔": "모달", "天丝": "텐셀", "莱赛尔": "텐셀", "醋酸": "아세테이트",
  "铜氨": "큐프라", "腈纶": "아크릴", "聚氨酯": "폴리우레탄", "PU": "PU",
};
function translateFabric(text: string): string {
  if (!text) return "";
  let result = text;
  // 중국어 성분명을 한국어로 치환
  for (const [cn, ko] of Object.entries(FABRIC_CN_TO_KO)) {
    result = result.replace(new RegExp(cn, "g"), ko);
  }
  return result;
}

// 상품 상세 타입
interface ProductDetail {
  id: string;
  name_cn: string;
  name_ko: string | null;
  description: string | null;
  material: string | null;
  moq: number | null;
  price_cny: number | null;
  supplier_sku: string | null;
  category_code: string | null;
  season_code: string | null;
  colors: { code: string; name_cn: string; name_ko: string }[];
  sizes: string[];
  fabric_composition: string | null;
  created_at: string;
  supplier_company: string;
  supplier_member_code: string;
  images: { id: string; image_url: string; is_primary: boolean; color_code: string | null; color_name: string | null }[];
}

export default function BuyerProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [canViewPrice, setCanViewPrice] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      setUserId(session.user.id);

      // 단가 열람 권한 확인
      const { data: userData } = await supabase
        .from("users")
        .select("can_view_price, role")
        .eq("id", session.user.id)
        .single();

      setCanViewPrice(userData?.can_view_price || ["super_admin", "super_buyer"].includes(userData?.role || ""));

      // 상품 정보 조회
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("*, suppliers!inner(user_id, company_name_cn, company_name_ko)")
        .eq("id", productId)
        .single();

      if (productError || !productData) {
        setLoading(false);
        return;
      }

      // 이미지 조회
      const { data: images } = await supabase
        .from("product_images")
        .select("id, image_url, is_primary, color_code, color_name")
        .eq("product_id", productId)
        .order("is_primary", { ascending: false });

      // 공급업체 회원번호
      const supplier = productData.suppliers as {
        user_id: string;
        company_name_cn: string;
        company_name_ko: string | null;
      };
      const { data: supplierUser } = await supabase
        .from("users")
        .select("member_code")
        .eq("id", supplier.user_id)
        .single();

      const productObj = {
        id: productData.id,
        name_cn: productData.name_cn,
        name_ko: productData.name_ko,
        description: productData.description,
        material: productData.material,
        moq: productData.moq,
        price_cny: productData.price_cny,
        supplier_sku: productData.supplier_sku,
        category_code: productData.category_code,
        season_code: productData.season_code,
        colors: productData.colors || [],
        sizes: productData.sizes || [],
        fabric_composition: productData.fabric_composition,
        created_at: productData.created_at,
        supplier_company: supplier.company_name_ko || supplier.company_name_cn,
        supplier_member_code: supplierUser?.member_code || "-",
        images: images || [],
      };
      setProduct(productObj);

      // 한국어 번역이 없으면 자동 번역 (백그라운드)
      if (!productObj.name_ko) {
        fetch("/api/ai/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product_ids: [productId] }),
        })
          .then((res) => res.json())
          .then((result) => {
            if (result.translations?.[productId]) {
              setProduct((prev) =>
                prev ? { ...prev, name_ko: result.translations[productId] } : prev
              );
            }
          })
          .catch(() => { /* 무시 */ });
      }

      setLoading(false);
    };

    init();
  }, [router, productId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="text-center py-20 text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="text-center py-20">
          <p className="text-gray-500 text-lg">상품을 찾을 수 없습니다</p>
          <button
            onClick={() => router.push("/buyer/gallery")}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg"
          >
            갤러리로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 컬러 필터링된 이미지
  const filteredImages = selectedColor
    ? product.images.filter((img) => img.color_code === selectedColor)
    : product.images;

  const displayImages = filteredImages.length > 0 ? filteredImages : product.images;
  const currentImage = displayImages[selectedImageIndex] || displayImages[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-5xl mx-auto px-4 py-6">
        <button
          onClick={() => router.push("/buyer/gallery")}
          className="text-gray-500 hover:text-gray-700 mb-4 inline-block"
        >
          &#8592; 갤러리로 돌아가기
        </button>

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="md:flex">
            {/* 왼쪽: 이미지 영역 */}
            <div className="md:w-1/2">
              {/* 메인 이미지 (클릭하면 라이트박스) */}
              <div
                className="aspect-[3/4] bg-gray-100 flex items-center justify-center cursor-pointer"
                onClick={() => setLightboxOpen(true)}
              >
                {currentImage ? (
                  <img
                    src={currentImage.image_url}
                    alt={product.name_cn}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-6xl text-gray-300">&#128247;</span>
                )}
              </div>

              {/* 썸네일 목록 */}
              {displayImages.length > 1 && (
                <div className="flex gap-2 p-3 overflow-x-auto">
                  {displayImages.map((img, index) => (
                    <button
                      key={img.id}
                      onClick={() => setSelectedImageIndex(index)}
                      className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 ${
                        selectedImageIndex === index ? "border-blue-500" : "border-gray-200"
                      }`}
                    >
                      <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* 컬러 필터 버튼 */}
              {product.colors.length > 0 && (
                <div className="px-3 pb-3">
                  <p className="text-xs text-gray-500 mb-2">컬러별 보기:</p>
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      onClick={() => { setSelectedColor(null); setSelectedImageIndex(0); }}
                      className={`text-xs px-2 py-1 rounded-full border ${
                        !selectedColor ? "bg-blue-600 text-white border-blue-600" : "text-gray-600 border-gray-300"
                      }`}
                    >
                      전체
                    </button>
                    {product.colors.map((c) => (
                      <button
                        key={c.code}
                        onClick={() => { setSelectedColor(c.code); setSelectedImageIndex(0); }}
                        className={`text-xs px-2 py-1 rounded-full border ${
                          selectedColor === c.code ? "bg-blue-600 text-white border-blue-600" : "text-gray-600 border-gray-300"
                        }`}
                      >
                        {c.name_cn}({c.name_ko})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 오른쪽: 상품 정보 */}
            <div className="md:w-1/2 p-6">
              {/* 복종 + 시즌 배지 */}
              <div className="flex gap-2 mb-3">
                {product.category_code && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    {CATEGORY_CODES[product.category_code] || product.category_code}
                  </span>
                )}
                {product.season_code && (
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded">
                    {SEASON_CODES[product.season_code] || ""}
                  </span>
                )}
              </div>

              {/* 상품명 (중국어 + 한국어 번역) */}
              <h1 className="text-2xl font-bold text-gray-800 mb-1">{product.name_cn}</h1>
              {product.name_ko && (
                <p className="text-gray-500 mb-4">{product.name_ko}</p>
              )}

              {/* 단가 (권한에 따라) */}
              {canViewPrice && (
                <div className="text-3xl font-bold text-blue-600 mb-6">
                  {product.price_cny
                    ? `\u00A5${Number(product.price_cny).toLocaleString()}`
                    : "가격 미정"}
                </div>
              )}

              {/* 상세 정보 */}
              <div className="space-y-2 mb-6 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">공급업체</span>
                  <span className="font-medium font-mono text-blue-600">{product.supplier_member_code}</span>
                </div>
                {product.supplier_sku && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">공급업체 품번</span>
                    <span className="font-medium font-mono">{product.supplier_sku}</span>
                  </div>
                )}
                {product.colors.length > 0 && (
                  <div className="py-2 border-b border-gray-100">
                    <span className="text-gray-500 text-sm">컬러</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {product.colors.map((c) => (
                        <span key={c.code} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                          {c.name_cn}({c.name_ko})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {product.sizes.length > 0 && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">사이즈</span>
                    <span className="font-medium">{product.sizes.join(" / ")}</span>
                  </div>
                )}
                {product.fabric_composition && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">원단</span>
                    <span className="font-medium">{translateFabric(product.fabric_composition)}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">등록일</span>
                  <span className="font-medium">
                    {new Date(product.created_at).toLocaleDateString("ko-KR")}
                  </span>
                </div>
              </div>

              {/* 상품 설명 */}
              {product.description && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">상품 설명</h3>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{product.description}</p>
                </div>
              )}

              {/* 발주하기 버튼 */}
              <button
                onClick={() => router.push(`/buyer/orders/new?product=${product.id}`)}
                className="w-full py-3 bg-blue-600 text-white text-lg font-bold rounded-lg hover:bg-blue-700 transition-colors"
              >
                발주하기
              </button>
            </div>
          </div>
        </div>

        {/* 소통 댓글창 */}
        {userId && (
          <div className="mt-6">
            <ProductComments productId={product.id} userId={userId} />
          </div>
        )}
      </main>

      {/* 라이트박스 */}
      {lightboxOpen && currentImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={currentImage.image_url}
              alt=""
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-2 right-2 w-10 h-10 bg-black/50 text-white rounded-full text-xl flex items-center justify-center"
            >
              X
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
