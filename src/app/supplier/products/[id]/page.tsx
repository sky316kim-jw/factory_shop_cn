// 공급업체 - 상품 수정/삭제 페이지 (패션 전용, 중국어 UI)
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";
import ProductComments from "@/components/ProductComments";
import { CATEGORY_CODES, CATEGORY_CN, SEASON_CODES, SEASON_CN, COLOR_CODES } from "@/utils/fashion-codes";

// 기존 이미지 타입
interface ExistingImage {
  id: string;
  image_url: string;
  is_primary: boolean;
  color_code: string | null;
  color_name: string | null;
}

// 컬러 아이템
interface ColorItem {
  code: string;
  name_cn: string;
  name_ko: string;
}

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 상품 정보
  const [nameCn, setNameCn] = useState("");
  const [supplierSku, setSupplierSku] = useState("");
  const [categoryCode, setCategoryCode] = useState("");
  const [seasonCode, setSeasonCode] = useState("");
  const [colors, setColors] = useState<ColorItem[]>([]);
  const [sizesText, setSizesText] = useState("");
  const [description, setDescription] = useState("");
  const [fabricComposition, setFabricComposition] = useState("");
  const [priceCny, setPriceCny] = useState("");
  const [isActive, setIsActive] = useState(true);

  // 컬러 추가용
  const [selectedColorCode, setSelectedColorCode] = useState("");

  // 기존 이미지
  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([]);

  // 새로 추가할 이미지
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);

  // 대표 이미지
  const [primaryImageId, setPrimaryImageId] = useState<string>("");

  // 라이트박스
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      setCurrentUserId(session.user.id);

      // 상품 정보 조회
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("*, suppliers!inner(user_id)")
        .eq("id", productId)
        .single();

      if (productError || !product) {
        setError("找不到该商品。");
        setLoading(false);
        return;
      }

      const supplier = product.suppliers as { user_id: string };
      if (supplier.user_id !== session.user.id) {
        setError("只能修改自己的商品。");
        setLoading(false);
        return;
      }

      // 상품 정보 세팅
      setNameCn(product.name_cn || "");
      setSupplierSku(product.supplier_sku || "");
      setCategoryCode(product.category_code || "");
      setSeasonCode(product.season_code || "");
      setColors(product.colors || []);
      setSizesText((product.sizes || []).join(", "));
      setDescription(product.description || "");
      setFabricComposition(product.fabric_composition || product.material || "");
      setPriceCny(product.price_cny?.toString() || "");
      setIsActive(product.is_active);

      // 이미지 목록 조회
      const { data: images } = await supabase
        .from("product_images")
        .select("id, image_url, is_primary, color_code, color_name")
        .eq("product_id", productId)
        .order("created_at");

      if (images) {
        setExistingImages(images);
        const primary = images.find((img) => img.is_primary);
        if (primary) setPrimaryImageId(primary.id);
      }

      setLoading(false);
    };
    init();
  }, [router, productId]);

  // 컬러 추가
  const addColor = () => {
    if (!selectedColorCode) return;
    if (colors.some((c) => c.code === selectedColorCode)) return;
    const name_ko = COLOR_CODES[selectedColorCode] || "";
    // 중국어 이름은 COLOR_CODES의 한국어 이름을 기반으로 매핑
    const cnNames: Record<string, string> = {
      "01": "白色", "02": "黑色", "03": "藏青色", "04": "黄色", "05": "红色",
      "06": "酒红色", "07": "米色", "08": "棕色", "09": "橙色", "10": "绿色",
      "11": "象牙白", "12": "粉色", "13": "蓝色", "14": "卡其色", "15": "灰色",
      "16": "炭灰", "17": "紫色", "18": "天蓝色", "19": "芥末黄", "20": "可可色",
      "21": "浅灰", "22": "墨绿", "23": "浅米", "24": "深炭灰", "25": "中灰",
      "26": "深灰", "27": "米白色", "28": "浅炭灰", "29": "中炭灰", "30": "红橙",
      "31": "玫红", "32": "藕粉", "33": "浅粉", "34": "深粉", "35": "酒红",
      "36": "浅绿", "37": "深绿", "38": "军绿", "39": "森林绿", "40": "中绿",
      "41": "蓝绿", "42": "薄荷绿", "43": "浅蓝", "44": "深蓝", "45": "浅藏青",
      "46": "深藏青", "47": "蓝藏青",
    };
    setColors([...colors, { code: selectedColorCode, name_cn: cnNames[selectedColorCode] || "", name_ko }]);
    setSelectedColorCode("");
  };

  // 컬러 삭제
  const removeColor = (code: string) => {
    setColors(colors.filter((c) => c.code !== code));
  };

  // 기존 이미지 삭제 표시
  const markImageForDeletion = (imageId: string) => {
    setDeletedImageIds([...deletedImageIds, imageId]);
    if (primaryImageId === imageId) {
      const remaining = existingImages.filter(
        (img) => img.id !== imageId && !deletedImageIds.includes(img.id)
      );
      setPrimaryImageId(remaining[0]?.id || "");
    }
  };

  // 이미지 리사이징
  const resizeImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const img = new Image();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      img.onload = () => {
        const maxSize = 1200;
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) { height = (height / width) * maxSize; width = maxSize; }
          else { width = (width / height) * maxSize; height = maxSize; }
        }
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => resolve(blob ? new File([blob], file.name, { type: "image/jpeg" }) : file),
          "image/jpeg", 0.85
        );
      };
      img.src = URL.createObjectURL(file);
    });
  };

  // 새 이미지 선택
  const handleNewImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const activeExistingCount = existingImages.length - deletedImageIds.length;
    const maxNew = 20 - activeExistingCount - newImageFiles.length;
    const filesToAdd = files.slice(0, maxNew);

    const resized: File[] = [];
    const previews: string[] = [];
    for (const file of filesToAdd) {
      const r = await resizeImage(file);
      resized.push(r);
      previews.push(URL.createObjectURL(r));
    }

    setNewImageFiles((prev) => [...prev, ...resized]);
    setNewImagePreviews((prev) => [...prev, ...previews]);
    e.target.value = "";
  };

  // 새 이미지 삭제
  const removeNewImage = (index: number) => {
    setNewImageFiles(newImageFiles.filter((_, i) => i !== index));
    setNewImagePreviews(newImagePreviews.filter((_, i) => i !== index));
    if (primaryImageId === `new_${index}`) {
      setPrimaryImageId(existingImages[0]?.id || "");
    }
  };

  // 이미지에 컬러 태그 설정 (기존 이미지)
  const setExistingImageColor = (imageId: string, colorCode: string) => {
    setExistingImages((prev) =>
      prev.map((img) =>
        img.id === imageId
          ? { ...img, color_code: colorCode, color_name: COLOR_CODES[colorCode] || "" }
          : img
      )
    );
  };

  // 저장 처리
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameCn.trim()) {
      setError("请输入商品名称。");
      return;
    }

    setSaving(true);
    setError("");

    // 사이즈 파싱
    const sizes = sizesText
      .split(/[,，\/\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      // 1. 상품 정보 업데이트
      const { error: updateError } = await supabase
        .from("products")
        .update({
          name_cn: nameCn.trim(),
          supplier_sku: supplierSku.trim() || null,
          category_code: categoryCode || null,
          season_code: seasonCode || null,
          colors,
          sizes,
          description: description.trim() || null,
          fabric_composition: fabricComposition.trim() || null,
          material: fabricComposition.trim() || null,
          price_cny: priceCny ? parseFloat(priceCny) : null,
          is_active: isActive,
        })
        .eq("id", productId);

      if (updateError) throw updateError;

      // 2. 삭제된 이미지 처리
      for (const imageId of deletedImageIds) {
        await supabase.from("product_images").delete().eq("id", imageId);
      }

      // 3. 기존 이미지 컬러 태그 업데이트
      for (const img of existingImages) {
        if (!deletedImageIds.includes(img.id)) {
          await supabase.from("product_images").update({
            color_code: img.color_code || null,
            color_name: img.color_name || null,
          }).eq("id", img.id);
        }
      }

      // 4. 새 이미지 업로드
      for (let i = 0; i < newImageFiles.length; i++) {
        const file = newImageFiles[i];
        const fileExt = file.name.split(".").pop() || "jpg";
        const filePath = `${productId}/${Date.now()}_${i}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("product-images")
          .getPublicUrl(filePath);

        const { data: newImg, error: imgError } = await supabase
          .from("product_images")
          .insert({
            product_id: productId,
            image_url: urlData.publicUrl,
            is_primary: false,
          })
          .select("id")
          .single();

        if (imgError) throw imgError;

        if (primaryImageId === `new_${i}` && newImg) {
          setPrimaryImageId(newImg.id);
        }
      }

      // 5. 대표 이미지 업데이트
      await supabase
        .from("product_images")
        .update({ is_primary: false })
        .eq("product_id", productId);

      if (primaryImageId && !primaryImageId.startsWith("new_")) {
        await supabase
          .from("product_images")
          .update({ is_primary: true })
          .eq("id", primaryImageId);
      }

      router.push("/supplier/products");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "未知错误";
      setError(`保存失败: ${message}`);
      setSaving(false);
    }
  };

  // 상품 삭제
  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { data: files } = await supabase.storage
        .from("product-images")
        .list(productId);

      if (files && files.length > 0) {
        const paths = files.map((f) => `${productId}/${f.name}`);
        await supabase.storage.from("product-images").remove(paths);
      }

      const { error: deleteError } = await supabase
        .from("products")
        .delete()
        .eq("id", productId);

      if (deleteError) throw deleteError;
      router.push("/supplier/products");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "未知错误";
      setError(`删除失败: ${message}`);
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="text-center py-20 text-gray-500">加载中...</div>
      </div>
    );
  }

  const activeExistingImages = existingImages.filter(
    (img) => !deletedImageIds.includes(img.id)
  );
  const totalImageCount = activeExistingImages.length + newImageFiles.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* 상단 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/supplier/products")}
              className="text-gray-500 hover:text-gray-700"
            >
              &#8592; 返回
            </button>
            <h2 className="text-2xl font-bold text-gray-800">修改商品</h2>
          </div>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
          >
            删除商品
          </button>
        </div>

        {/* 삭제 확인 모달 */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-sm mx-4">
              <h3 className="text-lg font-bold text-gray-800 mb-2">确定要删除吗？</h3>
              <p className="text-gray-500 text-sm mb-4">删除后无法恢复。</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400"
                >
                  {deleting ? "删除中..." : "确认删除"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 에러 */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ========== 商品图片 ========== */}
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3">
              商品图片 <span className="text-xs font-normal text-gray-500">（点击图片可放大，悬停可设置主图/颜色）</span>
            </h3>

            {/* 기존 이미지 */}
            {(activeExistingImages.length > 0 || newImagePreviews.length > 0) && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 mb-3">
                {activeExistingImages.map((img) => (
                  <div key={img.id} className="relative group">
                    <div
                      className={`aspect-square rounded-lg overflow-hidden border-2 cursor-pointer ${
                        primaryImageId === img.id ? "border-blue-500" : "border-gray-200"
                      }`}
                      onClick={() => setLightboxImage(img.image_url)}
                    >
                      <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                    </div>
                    {primaryImageId === img.id && (
                      <div className="absolute top-1 left-1 bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded">主图</div>
                    )}
                    {img.color_name && (
                      <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">{img.color_name}</div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col items-center justify-center gap-1">
                      {primaryImageId !== img.id && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); setPrimaryImageId(img.id); }}
                          className="text-white text-[10px] bg-blue-500 px-2 py-0.5 rounded">设为主图</button>
                      )}
                      {colors.length > 0 && (
                        <select
                          className="text-[10px] bg-white text-gray-800 px-1 py-0.5 rounded w-16"
                          value={img.color_code || ""}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setExistingImageColor(img.id, e.target.value)}
                        >
                          <option value="">颜色</option>
                          {colors.map((c) => (
                            <option key={c.code} value={c.code}>{c.name_cn}</option>
                          ))}
                        </select>
                      )}
                      <button type="button" onClick={(e) => { e.stopPropagation(); markImageForDeletion(img.id); }}
                        className="text-white text-[10px] bg-red-500 px-2 py-0.5 rounded">删除</button>
                    </div>
                  </div>
                ))}

                {/* 새 이미지 */}
                {newImagePreviews.map((preview, index) => (
                  <div key={`new_${index}`} className="relative group">
                    <div
                      className={`aspect-square rounded-lg overflow-hidden border-2 cursor-pointer ${
                        primaryImageId === `new_${index}` ? "border-blue-500" : "border-gray-200 border-dashed"
                      }`}
                      onClick={() => setLightboxImage(preview)}
                    >
                      <img src={preview} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="absolute bottom-1 left-1 bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded">新增</div>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col items-center justify-center gap-1">
                      <button type="button" onClick={(e) => { e.stopPropagation(); setPrimaryImageId(`new_${index}`); }}
                        className="text-white text-[10px] bg-blue-500 px-2 py-0.5 rounded">设为主图</button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); removeNewImage(index); }}
                        className="text-white text-[10px] bg-red-500 px-2 py-0.5 rounded">删除</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 이미지 추가 */}
            <label className="flex items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <div className="text-center">
                <div className="text-xl text-gray-400">+</div>
                <p className="text-xs text-gray-500">点击添加图片 ({totalImageCount}张)</p>
              </div>
              <input type="file" accept="image/*" multiple onChange={handleNewImageSelect} className="hidden" />
            </label>
          </div>

          {/* ========== 商品名称 ========== */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              商品名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nameCn}
              onChange={(e) => setNameCn(e.target.value)}
              placeholder="请输入商品名称"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* ========== 货号 ========== */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">货号</label>
            <input
              type="text"
              value={supplierSku}
              onChange={(e) => setSupplierSku(e.target.value)}
              placeholder="例: HJ-2025-001"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* ========== 品类 + 季节 ========== */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">品类</label>
              <select
                value={categoryCode}
                onChange={(e) => setCategoryCode(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">请选择品类</option>
                {Object.entries(CATEGORY_CODES).map(([code, nameKo]) => (
                  <option key={code} value={code}>
                    {CATEGORY_CN[code] || ""} ({nameKo})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">季节</label>
              <select
                value={seasonCode}
                onChange={(e) => setSeasonCode(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">请选择季节</option>
                {Object.entries(SEASON_CODES).map(([code, nameKo]) => (
                  <option key={code} value={code}>
                    {SEASON_CN[code] || ""} ({nameKo})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ========== 颜色 ========== */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">颜色</label>
            <div className="flex gap-2 mb-2">
              <select
                value={selectedColorCode}
                onChange={(e) => setSelectedColorCode(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">选择颜色</option>
                {Object.entries(COLOR_CODES)
                  .filter(([code]) => !colors.some((c) => c.code === code))
                  .map(([code, name]) => (
                    <option key={code} value={code}>{code} - {name}</option>
                  ))}
              </select>
              <button
                type="button"
                onClick={addColor}
                disabled={!selectedColorCode}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:bg-gray-300"
              >
                添加
              </button>
            </div>
            {colors.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => (
                  <span key={c.code} className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full text-sm">
                    <span className="text-xs text-gray-400">{c.code}</span>
                    {c.name_cn}
                    <button type="button" onClick={() => removeColor(c.code)}
                      className="text-gray-400 hover:text-red-500 ml-0.5">&times;</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ========== 尺码 ========== */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">尺码</label>
            <input
              type="text"
              value={sizesText}
              onChange={(e) => setSizesText(e.target.value)}
              placeholder="例: S, M, L, XL 或 90, 95, 100 或 FF"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">用逗号分隔多个尺码</p>
          </div>

          {/* ========== 商品描述 ========== */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">商品描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="请输入商品描述"
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* ========== 面料成分 ========== */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">面料成分</label>
            <input
              type="text"
              value={fabricComposition}
              onChange={(e) => setFabricComposition(e.target.value)}
              placeholder="例: 棉60% 聚酯纤维40%"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* ========== 单价 ========== */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">单价 (元/CNY)</label>
            <input
              type="number"
              value={priceCny}
              onChange={(e) => setPriceCny(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* ========== 활성 상태 ========== */}
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
            </label>
            <span className="text-sm text-gray-700">
              {isActive ? "上架中（买家可见）" : "已下架（买家不可见）"}
            </span>
          </div>

          {/* ========== 保存 ========== */}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold text-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {saving ? "保存中..." : "保存修改"}
          </button>
        </form>

        {/* 소통 댓글창 */}
        {currentUserId && (
          <div className="mt-6">
            <ProductComments productId={productId} userId={currentUserId} viewerRole="supplier" />
          </div>
        )}
      </main>

      {/* 라이트박스 */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img src={lightboxImage} alt="" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-2 right-2 w-10 h-10 bg-black/50 text-white rounded-full text-xl flex items-center justify-center hover:bg-black/70"
            >
              X
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
