// 바이어 - 새 발주 작성 (컬러 x 사이즈 매트릭스)
"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";
import { COLOR_CODES } from "@/utils/fashion-codes";

// 상품 타입
interface Product {
  id: string;
  name_cn: string;
  name_ko: string | null;
  price_cny: number | null;
  supplier_sku: string | null;
  category_code: string | null;
  season_code: string | null;
  colors: { code: string; name_cn: string; name_ko: string }[];
  sizes: string[];
  image_url: string | null;
  supplier_member_code: string;
}

// 컬러 x 사이즈 수량 매트릭스
interface OrderMatrix {
  [colorCode: string]: {
    [size: string]: number;
  };
}

// 사이즈 라벨 매핑
interface SizeLabelMap {
  [supplierSize: string]: string;
}

// 추가 색상 (바이어가 직접 추가)
interface CustomColor {
  id: string;
  name: string;
  pantone: string;
  description: string;  // 색상 설명
  matchedCode: string;  // 자동 매칭된 컬러코드
  quantities: { [size: string]: number };
}

export default function NewOrderPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">로딩 중...</div>}>
      <NewOrderPage />
    </Suspense>
  );
}

function NewOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProductId = searchParams.get("product");

  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 컬러 x 사이즈 수량 매트릭스
  const [matrix, setMatrix] = useState<OrderMatrix>({});
  // 사이즈 라벨 매핑
  const [labelMap, setLabelMap] = useState<SizeLabelMap>({});
  // 추가 색상 (바이어가 직접 추가)
  const [customColors, setCustomColors] = useState<CustomColor[]>([]);
  // 컬러별 자수색상/팬톤 매핑
  const [embroideryMap, setEmbroideryMap] = useState<Record<string, string>>({});
  const [pantoneMap, setPantoneMap] = useState<Record<string, string>>({});
  // 작업지시서 파일
  const [attachFiles, setAttachFiles] = useState<File[]>([]);
  // 추가 요청사항
  const [notes, setNotes] = useState("");
  const [colorChangeReq, setColorChangeReq] = useState("");
  const [printReq, setPrintReq] = useState("");
  const [otherReq, setOtherReq] = useState("");

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      setUserId(session.user.id);

      // 역할 확인
      try {
        const meRes = await fetch("/api/auth/ensure-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: session.user.id }),
        });
        const meData = await meRes.json();
        if (meData.role) setUserRole(meData.role);
      } catch {
        const { data: me } = await supabase.from("users").select("role").eq("id", session.user.id).single();
        if (me) setUserRole(me.role);
      }

      if (!preselectedProductId) {
        router.push("/buyer/gallery");
        return;
      }

      // 상품 정보 조회
      const { data: productData } = await supabase
        .from("products")
        .select("*, suppliers!inner(user_id)")
        .eq("id", preselectedProductId)
        .single();

      if (!productData) {
        setLoading(false);
        return;
      }

      // 대표 이미지
      const { data: imgData } = await supabase
        .from("product_images")
        .select("image_url")
        .eq("product_id", preselectedProductId)
        .eq("is_primary", true)
        .limit(1);

      // 공급업체 회원번호
      const supplier = productData.suppliers as { user_id: string };
      const { data: uData } = await supabase
        .from("users")
        .select("member_code")
        .eq("id", supplier.user_id)
        .single();

      // 사이즈 파싱: 범위 형식(90~105, 25-30)이 있으면 개별로 분리
      const rawSizes: string[] = productData.sizes || [];
      const expandedSizes: string[] = [];
      for (const s of rawSizes) {
        const rangeMatch = s.match(/^(\d+)\s*[~\-]\s*(\d+)$/);
        if (rangeMatch) {
          const start = parseInt(rangeMatch[1], 10);
          const end = parseInt(rangeMatch[2], 10);
          // 간격 추정: 90~105→5, 25~30→1
          const diff = end - start;
          const step = diff <= 10 ? 1 : 5;
          for (let v = start; v <= end; v += step) {
            expandedSizes.push(String(v));
          }
        } else {
          // 콤마로 구분된 경우 분리
          const parts = s.split(/[,，]/).map((x) => x.trim()).filter(Boolean);
          expandedSizes.push(...parts);
        }
      }

      const prod: Product = {
        id: productData.id,
        name_cn: productData.name_cn,
        name_ko: productData.name_ko,
        price_cny: productData.price_cny,
        supplier_sku: productData.supplier_sku,
        category_code: productData.category_code,
        season_code: productData.season_code,
        colors: productData.colors || [],
        sizes: expandedSizes.length > 0 ? expandedSizes : rawSizes,
        image_url: imgData?.[0]?.image_url || null,
        supplier_member_code: uData?.member_code || "-",
      };

      setProduct(prod);

      // 매트릭스 초기화
      const initMatrix: OrderMatrix = {};
      for (const color of prod.colors) {
        initMatrix[color.code] = {};
        for (const size of prod.sizes) {
          initMatrix[color.code][size] = 0;
        }
      }
      setMatrix(initMatrix);

      // 사이즈 라벨 초기화
      const initLabels: SizeLabelMap = {};
      for (const size of prod.sizes) {
        initLabels[size] = "";
      }
      setLabelMap(initLabels);

      setLoading(false);
    };
    init();
  }, [router, preselectedProductId]);

  // 수량 업데이트
  const updateQty = (colorCode: string, size: string, value: number) => {
    setMatrix((prev) => ({
      ...prev,
      [colorCode]: {
        ...prev[colorCode],
        [size]: Math.max(0, value),
      },
    }));
  };

  // 라벨 사이즈 업데이트
  const updateLabel = (size: string, label: string) => {
    setLabelMap((prev) => ({ ...prev, [size]: label }));
  };

  // 합계 계산
  const colorTotal = (colorCode: string): number => {
    if (!matrix[colorCode]) return 0;
    return Object.values(matrix[colorCode]).reduce((sum, qty) => sum + qty, 0);
  };

  const sizeTotal = (size: string): number => {
    const matrixTotal = Object.values(matrix).reduce((sum, colors) => sum + (colors[size] || 0), 0);
    const customTotal = customColors.reduce((sum, cc) => sum + (cc.quantities[size] || 0), 0);
    return matrixTotal + customTotal;
  };

  const grandTotal = (): number => {
    const matrixTotal = Object.values(matrix).reduce(
      (sum, colors) => sum + Object.values(colors).reduce((s, q) => s + q, 0),
      0
    );
    const customTotal = customColors.reduce(
      (sum, cc) => sum + Object.values(cc.quantities).reduce((s, q) => s + q, 0),
      0
    );
    return matrixTotal + customTotal;
  };

  // 추가 색상 함수들
  const addCustomColor = () => {
    if (!product) return;
    const newColor: CustomColor = {
      id: `custom_${Date.now()}`,
      name: "",
      pantone: "",
      description: "",
      matchedCode: "",
      quantities: {},
    };
    for (const size of product.sizes) {
      newColor.quantities[size] = 0;
    }
    setCustomColors((prev) => [...prev, newColor]);
  };

  const updateCustomColorName = (id: string, name: string) => {
    setCustomColors((prev) => prev.map((cc) => cc.id === id ? { ...cc, name } : cc));
  };

  // 팬톤 번호 → 가장 유사한 컬러코드 자동 매칭
  const matchPantoneToColor = (pantone: string): string => {
    const p = pantone.toLowerCase().replace(/[^a-z0-9]/g, "");
    // 팬톤 번호에서 키워드 추출하여 매칭
    const pantoneColorMap: Record<string, string> = {
      "white": "01", "black": "02", "navy": "03", "yellow": "04", "red": "05",
      "wine": "06", "beige": "07", "brown": "08", "orange": "09", "green": "10",
      "ivory": "11", "pink": "12", "blue": "13", "khaki": "14", "gray": "15", "grey": "15",
      "charcoal": "16", "purple": "17", "sky": "18", "mustard": "19", "cocoa": "20",
      "mint": "42", "burgundy": "35",
    };
    for (const [keyword, code] of Object.entries(pantoneColorMap)) {
      if (p.includes(keyword)) return code;
    }
    // 숫자 기반 매칭 (Pantone 19-xxxx = 어두운톤, 11-xxxx = 밝은톤 등)
    const numMatch = pantone.match(/(\d{2})-/);
    if (numMatch) {
      const prefix = parseInt(numMatch[1]);
      if (prefix <= 12) return "01"; // 밝은 톤 → 화이트 계열
      if (prefix <= 15) return "07"; // 중간 톤 → 베이지 계열
      if (prefix >= 19) return "02"; // 어두운 톤 → 블랙 계열
      if (prefix >= 17) return "03"; // 진한 톤 → 네이비 계열
    }
    return "";
  };

  const updateCustomColorPantone = (id: string, pantone: string) => {
    const matchedCode = matchPantoneToColor(pantone);
    setCustomColors((prev) => prev.map((cc) => cc.id === id ? { ...cc, pantone, matchedCode } : cc));
  };

  const updateCustomColorDescription = (id: string, description: string) => {
    setCustomColors((prev) => prev.map((cc) => cc.id === id ? { ...cc, description } : cc));
  };

  const updateCustomQty = (id: string, size: string, value: number) => {
    setCustomColors((prev) =>
      prev.map((cc) =>
        cc.id === id ? { ...cc, quantities: { ...cc.quantities, [size]: Math.max(0, value) } } : cc
      )
    );
  };

  const removeCustomColor = (id: string) => {
    setCustomColors((prev) => prev.filter((cc) => cc.id !== id));
  };

  const customColorTotal = (id: string): number => {
    const cc = customColors.find((c) => c.id === id);
    return cc ? Object.values(cc.quantities).reduce((s, q) => s + q, 0) : 0;
  };

  // 발주 제출
  const handleSubmit = async () => {
    if (!product || !userId) return;
    const total = grandTotal();
    if (total === 0) {
      alert("수량을 1개 이상 입력해주세요.");
      return;
    }

    setSubmitting(true);

    // 발주 항목 생성 (컬러 x 사이즈 조합마다 1건)
    const items: {
      product_id: string;
      quantity: number;
      unit_price: number;
      color_code: string;
      color_name: string;
      supplier_size: string;
      korea_label_size: string;
      comment: string | null;
      is_custom_color?: boolean;
      pantone_number?: string;
      embroidery_color?: string;
    }[] = [];

    // 추가 요청사항 합치기
    const extraNotes: string[] = [];
    if (colorChangeReq.trim()) extraNotes.push(`[색상 변경] ${colorChangeReq.trim()}`);
    if (printReq.trim()) extraNotes.push(`[자수/프린트] ${printReq.trim()}`);
    if (otherReq.trim()) extraNotes.push(`[기타] ${otherReq.trim()}`);
    const allNotes = [notes.trim(), ...extraNotes].filter(Boolean).join("\n");

    // 기존 등록 색상
    for (const color of product.colors) {
      for (const size of product.sizes) {
        const qty = matrix[color.code]?.[size] || 0;
        if (qty > 0) {
          const koreaLabel = labelMap[size] || "";
          let comment = "";
          if (koreaLabel && koreaLabel !== size) {
            comment = `공급업체 ${size}사이즈에 한국 ${koreaLabel}라벨 부착 요청`;
          }
          items.push({
            product_id: product.id,
            quantity: qty,
            unit_price: product.price_cny || 0,
            color_code: color.code,
            color_name: color.name_ko,
            supplier_size: size,
            korea_label_size: koreaLabel || size,
            comment: comment || null,
            embroidery_color: embroideryMap[color.code] || undefined,
            pantone_number: pantoneMap[color.code] || undefined,
          });
        }
      }
    }

    // 추가 색상 (바이어가 직접 추가한 색상)
    for (const cc of customColors) {
      if (!cc.name.trim()) continue;
      for (const size of product.sizes) {
        const qty = cc.quantities[size] || 0;
        if (qty > 0) {
          const koreaLabel = labelMap[size] || "";
          let comment = `[추가색상] ${cc.name}`;
          if (cc.pantone) comment += ` (Pantone: ${cc.pantone})`;
          if (cc.description) comment += ` | 설명: ${cc.description}`;
          if (koreaLabel && koreaLabel !== size) {
            comment += ` / 공급업체 ${size}사이즈에 한국 ${koreaLabel}라벨 부착 요청`;
          }
          items.push({
            product_id: product.id,
            quantity: qty,
            unit_price: product.price_cny || 0,
            color_code: "99",
            color_name: cc.name,
            supplier_size: size,
            korea_label_size: koreaLabel || size,
            comment,
            is_custom_color: true,
            pantone_number: cc.pantone || undefined,
          });
        }
      }
    }

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyer_id: userId,
          notes: allNotes || null,
          items,
          product_id: product.id,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // 파일 첨부가 있으면 업로드
        if (attachFiles.length > 0 && data.order?.id) {
          for (const file of attachFiles) {
            const ext = file.name.split(".").pop() || "bin";
            const path = `${data.order.id}/${Date.now()}_${file.name}`;
            const { error: upErr } = await supabase.storage
              .from("order-attachments")
              .upload(path, file);
            if (!upErr) {
              const { data: urlData } = supabase.storage
                .from("order-attachments")
                .getPublicUrl(path);
              await fetch("/api/orders/attachments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  po_id: data.order.id,
                  file_url: urlData.publicUrl,
                  file_name: file.name,
                  file_type: ext,
                }),
              });
            }
          }
        }
        alert(data.message);
        router.push("/buyer/orders");
      } else {
        alert(data.error || "발주 생성에 실패했습니다.");
      }
    } catch {
      alert("서버 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

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
        <div className="text-center py-20 text-gray-500">상품을 찾을 수 없습니다</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-6xl mx-auto px-4 py-6">
        <button
          onClick={() => router.push(`/buyer/products/${product.id}`)}
          className="text-gray-500 hover:text-gray-700 mb-4 inline-block"
        >
          &#8592; 상품으로 돌아가기
        </button>

        <h2 className="text-2xl font-bold text-gray-800 mb-6">발주 작성</h2>

        {/* 상품 요약 */}
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-6 flex gap-4">
          {product.image_url && (
            <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
              <img src={product.image_url} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div>
            <h3 className="font-bold text-gray-800">{product.name_cn}</h3>
            {product.name_ko && <p className="text-sm text-gray-500">{product.name_ko}</p>}
            <p className="text-sm text-gray-500 mt-1">
              {product.supplier_member_code}
              {product.supplier_sku && ` | ${product.supplier_sku}`}
              {/* 단가: super_admin, super_buyer만 */}
              {product.price_cny && ["super_admin", "super_buyer"].includes(userRole) && ` | \u00A5${product.price_cny}`}
            </p>
          </div>
        </div>

        {/* 컬러 x 사이즈 매트릭스 */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6 overflow-x-auto">
          <h3 className="text-lg font-bold text-gray-800 mb-4">수량 입력 (컬러 x 사이즈)</h3>

          <table className="w-full text-sm border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="border px-3 py-2 text-left text-gray-600 font-medium">컬러</th>
                <th className="border px-2 py-2 text-center text-gray-600 font-medium text-xs min-w-[80px]">자수 색상</th>
                <th className="border px-2 py-2 text-center text-gray-600 font-medium text-xs min-w-[100px]">Pantone</th>
                {product.sizes.map((size) => (
                  <th key={size} className="border px-3 py-2 text-center text-gray-600 font-medium min-w-[70px]">
                    {size}
                  </th>
                ))}
                <th className="border px-3 py-2 text-center text-gray-600 font-medium bg-blue-50">합계</th>
              </tr>
            </thead>
            <tbody>
              {product.colors.map((color) => (
                <tr key={color.code} className="hover:bg-gray-50">
                  <td className="border px-3 py-2 font-medium text-gray-800">
                    <span className="text-xs text-gray-400 mr-1">{color.code}</span>
                    {color.name_ko}
                  </td>
                  <td className="border px-1 py-1">
                    <input
                      type="text"
                      value={embroideryMap[color.code] || ""}
                      onChange={(e) => setEmbroideryMap((p) => ({ ...p, [color.code]: e.target.value }))}
                      placeholder="자수색상"
                      className="w-full px-1 py-1 border-0 text-xs text-center focus:ring-2 focus:ring-blue-500 rounded"
                    />
                  </td>
                  <td className="border px-1 py-1">
                    <input
                      type="text"
                      value={pantoneMap[color.code] || ""}
                      onChange={(e) => setPantoneMap((p) => ({ ...p, [color.code]: e.target.value }))}
                      placeholder="Pantone"
                      className="w-full px-1 py-1 border-0 text-xs text-center focus:ring-2 focus:ring-blue-500 rounded"
                    />
                  </td>
                  {product.sizes.map((size) => (
                    <td key={size} className="border px-1 py-1 text-center">
                      <input
                        type="number"
                        min={0}
                        value={matrix[color.code]?.[size] || 0}
                        onChange={(e) => updateQty(color.code, size, parseInt(e.target.value) || 0)}
                        className="w-full text-center px-1 py-1 border-0 focus:ring-2 focus:ring-blue-500 rounded text-sm"
                      />
                    </td>
                  ))}
                  <td className="border px-3 py-2 text-center font-bold text-blue-600 bg-blue-50">
                    {colorTotal(color.code)}
                  </td>
                </tr>
              ))}

              {/* 추가 색상 행 (노란 배경) */}
              {customColors.map((cc) => (
                <tr key={cc.id} className="bg-yellow-50">
                  <td className="border px-2 py-1">
                    <input
                      type="text"
                      value={cc.name}
                      onChange={(e) => updateCustomColorName(cc.id, e.target.value)}
                      placeholder="색상명"
                      className="w-full px-2 py-1 border rounded text-xs bg-yellow-50 mb-1"
                    />
                    <textarea
                      value={cc.description}
                      onChange={(e) => updateCustomColorDescription(cc.id, e.target.value)}
                      placeholder="색상 설명 (예: G01 #1113 베이지와 동일)"
                      rows={2}
                      className="w-full px-2 py-1 border rounded text-[10px] bg-yellow-50 resize-none mb-1"
                    />
                    <button
                      onClick={() => removeCustomColor(cc.id)}
                      className="text-[10px] text-red-500 hover:text-red-700"
                    >
                      삭제
                    </button>
                  </td>
                  <td className="border px-1 py-1 bg-yellow-50">
                    <input type="text" placeholder="자수색상" className="w-full px-1 py-1 border-0 text-xs text-center bg-yellow-50 rounded" />
                  </td>
                  <td className="border px-1 py-1 bg-yellow-50">
                    <input
                      type="text"
                      value={cc.pantone}
                      onChange={(e) => updateCustomColorPantone(cc.id, e.target.value)}
                      placeholder="Pantone 19-4052"
                      className="w-full px-1 py-1 border-0 text-xs text-center bg-yellow-50 rounded"
                    />
                    {cc.matchedCode && (
                      <div className="text-[10px] text-blue-600 text-center mt-0.5">
                        → {cc.matchedCode} {COLOR_CODES[cc.matchedCode] || ""}
                      </div>
                    )}
                  </td>
                  {product.sizes.map((size) => (
                    <td key={size} className="border px-1 py-1 text-center bg-yellow-50">
                      <input
                        type="number"
                        min={0}
                        value={cc.quantities[size] || 0}
                        onChange={(e) => updateCustomQty(cc.id, size, parseInt(e.target.value) || 0)}
                        className="w-full text-center px-1 py-1 border-0 focus:ring-2 focus:ring-yellow-500 rounded text-sm bg-yellow-50"
                      />
                    </td>
                  ))}
                  <td className="border px-3 py-2 text-center font-bold text-yellow-700 bg-yellow-100">
                    {customColorTotal(cc.id)}
                  </td>
                </tr>
              ))}

              {/* 사이즈별 합계 행 */}
              <tr className="bg-blue-50 font-bold">
                <td className="border px-3 py-2 text-gray-600">합계</td>
                <td className="border bg-blue-50"></td>
                <td className="border bg-blue-50"></td>
                {product.sizes.map((size) => (
                  <td key={size} className="border px-3 py-2 text-center text-blue-600">
                    {sizeTotal(size)}
                  </td>
                ))}
                <td className="border px-3 py-2 text-center text-lg text-blue-700">
                  {grandTotal()}
                </td>
              </tr>
            </tbody>
          </table>

          {/* + 색상 추가 버튼 */}
          <button
            type="button"
            onClick={addCustomColor}
            className="mt-3 px-4 py-2 text-sm border-2 border-dashed border-yellow-400 text-yellow-700 rounded-lg hover:bg-yellow-50 transition-colors w-full"
          >
            + 색상 추가
          </button>
        </div>

        {/* 사이즈 라벨 매핑 */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-800 mb-2">한국 라벨 사이즈 매핑</h3>
          <p className="text-sm text-gray-500 mb-4">
            공급업체 사이즈와 다른 한국 라벨을 부착하려면 입력하세요 (비어있으면 그대로 사용)
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {product.sizes.map((size) => (
              <div key={size} className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700 w-16 text-right">{size} →</span>
                <input
                  type="text"
                  value={labelMap[size] || ""}
                  onChange={(e) => updateLabel(size, e.target.value)}
                  placeholder={size}
                  className="flex-1 px-3 py-1.5 border rounded-lg text-sm"
                />
              </div>
            ))}
          </div>
        </div>

        {/* 작업지시서 첨부 */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-800 mb-2">작업지시서 첨부 (선택사항)</h3>
          <p className="text-sm text-gray-500 mb-3">이미지(jpg,png), PDF, 문서(doc,docx) 최대 3개</p>
          {attachFiles.length > 0 && (
            <div className="space-y-2 mb-3">
              {attachFiles.map((f, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg text-sm">
                  <span className="truncate">{f.name} ({(f.size / 1024).toFixed(0)}KB)</span>
                  <button
                    type="button"
                    onClick={() => setAttachFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-red-500 text-xs ml-2"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}
          {attachFiles.length < 3 && (
            <label className="flex items-center justify-center w-full h-16 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <span className="text-sm text-gray-500">+ 파일 첨부 ({attachFiles.length}/3)</span>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && attachFiles.length < 3) setAttachFiles((prev) => [...prev, file]);
                  e.target.value = "";
                }}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* 추가 요청사항 */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6 space-y-4">
          <h3 className="text-lg font-bold text-gray-800">추가 요청사항</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">색상 변경 요청</label>
            <input
              type="text"
              value={colorChangeReq}
              onChange={(e) => setColorChangeReq(e.target.value)}
              placeholder="예: 블랙을 좀 더 진한 톤으로 변경 요청"
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">자수/프린트 추가 요청</label>
            <input
              type="text"
              value={printReq}
              onChange={(e) => setPrintReq(e.target.value)}
              placeholder="예: 가슴 왼쪽에 브랜드 로고 자수 (흰색, 2cm)"
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">기타 수정 요청</label>
            <textarea
              value={otherReq}
              onChange={(e) => setOtherReq(e.target.value)}
              placeholder="기타 요청사항을 입력하세요"
              rows={2}
              className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="공급업체에게 전달할 메모"
              rows={2}
              className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
            />
          </div>
        </div>

        {/* 합계 + 발주 버튼 */}
        {grandTotal() > 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-bold text-gray-800">총 수량</span>
              <span className="text-2xl font-bold text-blue-600">{grandTotal()}개</span>
            </div>
            {/* 총 금액: super_admin, super_buyer만 표시 */}
            {product.price_cny && ["super_admin", "super_buyer"].includes(userRole) && (
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-600">총 금액 (예상)</span>
                <span className="text-xl font-bold text-blue-600">
                  ¥{(grandTotal() * product.price_cny).toLocaleString()}
                </span>
              </div>
            )}
            <div className="text-xs text-gray-500 mb-4">
              {product.colors.filter((c) => colorTotal(c.code) > 0).length}개 컬러 /
              {" "}{product.sizes.filter((s) => sizeTotal(s) > 0).length}개 사이즈
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-3 bg-blue-600 text-white text-lg font-bold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              {submitting ? "처리 중..." : userRole === "buyer" ? "발주 요청" : "발주 확정"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
