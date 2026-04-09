// 공급업체 - AI 채팅 기반 상품 등록 페이지
"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ensureSupplier } from "@/lib/ensure-supplier";
import Header from "@/components/Header";
import { COLOR_CODES } from "@/utils/fashion-codes";

// 채팅 메시지 타입
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// 이미지 파일 + 미리보기
interface ImageItem {
  file: File;
  preview: string;
  colorCode?: string;
  colorName?: string;
  isPrimary: boolean;
}

// AI가 추출한 상품 데이터
interface ExtractedProduct {
  name_cn: string;
  supplier_sku: string;
  category_code: string;
  season_code: string;
  colors: { code: string; name_cn: string; name_ko: string }[];
  sizes: string[];
  description: string;
  fabric_composition: string;
  price_cny: number;
}

export default function NewProductPage() {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 이미지 관련
  const [images, setImages] = useState<ImageItem[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // AI 채팅 관련
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedProduct | null>(null);
  const [saving, setSaving] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 채팅 스크롤 자동 이동
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // 초기화: 로그인 확인 + 공급업체 ID
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      const id = await ensureSupplier(session.user.id);
      if (!id) {
        setError("공급업체 정보를 찾을 수 없습니다.");
        setLoading(false);
        return;
      }
      setSupplierId(id);
      setLoading(false);

      // 초기 안내 메시지
      setChatMessages([{
        role: "assistant",
        content: "您好！请输入您的商品信息，我来帮您整理登记。\n\n请提供以下信息：\n- 商品名称\n- 货号\n- 品类（如：T恤、连衣裙、裤子等）\n- 季节（春/夏/秋/冬/四季）\n- 颜色\n- 尺码\n- 面料成分\n- 单价（元）\n\n您可以一次性输入所有信息，也可以分步提供。",
      }]);
    };
    init();
  }, [router]);

  // 이미지 리사이징 함수 (최대 1200px, 품질 85%)
  const resizeImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const img = new Image();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;

      img.onload = () => {
        const maxSize = 1200;
        let { width, height } = img;

        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = (height / width) * maxSize;
            width = maxSize;
          } else {
            width = (width / height) * maxSize;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], file.name, { type: "image/jpeg" }));
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          0.85
        );
      };

      img.src = URL.createObjectURL(file);
    });
  };

  // 이미지 추가
  const handleImageAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newImages: ImageItem[] = [];
    for (const file of files) {
      const resized = await resizeImage(file);
      newImages.push({
        file: resized,
        preview: URL.createObjectURL(resized),
        isPrimary: images.length === 0 && newImages.length === 0, // 첫 이미지가 대표
      });
    }
    setImages((prev) => [...prev, ...newImages]);
    // input 초기화
    e.target.value = "";
  };

  // 이미지 삭제
  const removeImage = (index: number) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      // 대표 이미지가 삭제되면 첫번째를 대표로
      if (prev[index].isPrimary && next.length > 0) {
        next[0].isPrimary = true;
      }
      return next;
    });
  };

  // 대표 이미지 설정
  const setPrimary = (index: number) => {
    setImages((prev) =>
      prev.map((img, i) => ({ ...img, isPrimary: i === index }))
    );
  };

  // 이미지에 컬러 태그 설정
  const setImageColor = (index: number, colorCode: string) => {
    setImages((prev) =>
      prev.map((img, i) =>
        i === index
          ? { ...img, colorCode, colorName: COLOR_CODES[colorCode] || "" }
          : img
      )
    );
  };

  // AI 채팅 전송
  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const userMsg: ChatMessage = { role: "user", content: chatInput.trim() };
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      // 초기 안내 메시지 제외하고 API로 전송
      const apiMessages = updatedMessages.filter((_, i) => i > 0 || updatedMessages[0].role === "user");
      // 첫 메시지가 assistant면 제외
      const messagesToSend = apiMessages[0]?.role === "assistant"
        ? apiMessages.slice(1)
        : apiMessages;

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messagesToSend }),
      });

      const data = await res.json();

      if (data.error) {
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: `错误: ${data.error}` },
        ]);
      } else {
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.message },
        ]);

        // AI가 확정 데이터를 반환했으면 저장
        if (data.extractedData) {
          setExtractedData(data.extractedData);
        }
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "网络错误，请重试。" },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Enter 키로 전송
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  };

  // 상품 등록 (DB 저장)
  const handleRegister = async () => {
    if (!supplierId || !extractedData) return;

    // 이미지 필수 확인
    if (images.length === 0) {
      setError("대표 이미지를 1장 이상 업로드해주세요.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      // 1. 상품 정보 저장
      const { data: product, error: productError } = await supabase
        .from("products")
        .insert({
          supplier_id: supplierId,
          name_cn: extractedData.name_cn,
          name_ko: null, // 바이어가 볼 때 AI 번역으로 표시
          description: extractedData.description || null,
          material: extractedData.fabric_composition || null,
          price_cny: extractedData.price_cny || null,
          supplier_sku: extractedData.supplier_sku || null,
          category_code: extractedData.category_code || null,
          season_code: extractedData.season_code || null,
          colors: extractedData.colors || [],
          sizes: extractedData.sizes || [],
          fabric_composition: extractedData.fabric_composition || null,
          is_active: true,
        })
        .select("id")
        .single();

      if (productError) throw productError;

      // 2. 이미지 업로드
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const fileExt = img.file.name.split(".").pop() || "jpg";
        const filePath = `${product.id}/${Date.now()}_${i}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(filePath, img.file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("product-images")
          .getPublicUrl(filePath);

        await supabase.from("product_images").insert({
          product_id: product.id,
          image_url: urlData.publicUrl,
          is_primary: img.isPrimary,
          color_code: img.colorCode || null,
          color_name: img.colorName || null,
        });
      }

      // 성공! 상품 목록으로 이동
      router.push("/supplier/products");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류";
      setError(`商品登记失败: ${message}`);
      setSaving(false);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* 상단: 뒤로가기 + 제목 */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push("/supplier/products")}
            className="text-gray-500 hover:text-gray-700"
          >
            ← 返回
          </button>
          <h2 className="text-2xl font-bold text-gray-800">新商品登记</h2>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* ========== 상단: 이미지 업로드 영역 ========== */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">
            商品图片 <span className="text-sm font-normal text-gray-500">（点击图片可放大查看）</span>
          </h3>

          {/* 이미지 그리드 */}
          {images.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 mb-4">
              {images.map((img, index) => (
                <div key={index} className="relative group">
                  {/* 이미지 */}
                  <div
                    className={`aspect-square rounded-lg overflow-hidden border-2 cursor-pointer ${
                      img.isPrimary ? "border-blue-500" : "border-gray-200"
                    }`}
                    onClick={() => setLightboxImage(img.preview)}
                  >
                    <img
                      src={img.preview}
                      alt={`图片 ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* 대표 이미지 배지 */}
                  {img.isPrimary && (
                    <div className="absolute top-1 left-1 bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded">
                      主图
                    </div>
                  )}

                  {/* 컬러 태그 */}
                  {img.colorName && (
                    <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                      {img.colorName}
                    </div>
                  )}

                  {/* 호버 시 버튼들 */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col items-center justify-center gap-1">
                    {!img.isPrimary && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setPrimary(index); }}
                        className="text-white text-[10px] bg-blue-500 px-2 py-0.5 rounded"
                      >
                        设为主图
                      </button>
                    )}
                    {/* 컬러 선택 */}
                    {extractedData?.colors && extractedData.colors.length > 0 && (
                      <select
                        className="text-[10px] bg-white text-gray-800 px-1 py-0.5 rounded w-16"
                        value={img.colorCode || ""}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setImageColor(index, e.target.value)}
                      >
                        <option value="">颜色</option>
                        {extractedData.colors.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name_cn}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeImage(index); }}
                      className="text-white text-[10px] bg-red-500 px-2 py-0.5 rounded"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 이미지 추가 버튼 */}
          <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
            <div className="text-center">
              <div className="text-2xl text-gray-400">+</div>
              <p className="text-sm text-gray-500">
                点击添加图片（主图+颜色图）
              </p>
            </div>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageAdd}
              className="hidden"
            />
          </label>
          <p className="text-xs text-gray-400 mt-2">
            图片自动压缩至1200px，鼠标悬停可设置主图和颜色标签
          </p>
        </div>

        {/* ========== 하단: AI 채팅 영역 ========== */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3">
            <h3 className="text-white font-bold">AI 商品信息录入助手</h3>
            <p className="text-blue-100 text-sm">用中文输入商品信息，AI自动整理</p>
          </div>

          {/* 채팅 메시지 영역 */}
          <div className="h-96 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {chatMessages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-md"
                      : "bg-white text-gray-800 border shadow-sm rounded-bl-md"
                  }`}
                >
                  {/* JSON 블록은 숨기고 일반 텍스트만 표시 */}
                  {msg.content.replace(/```json[\s\S]*?```/g, "").trim()}
                </div>
              </div>
            ))}

            {/* AI 로딩 표시 */}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-white border shadow-sm rounded-2xl rounded-bl-md px-4 py-3 text-sm text-gray-500">
                  AI正在分析中...
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* 채팅 입력창 */}
          <div className="border-t p-4 bg-white">
            <div className="flex gap-2">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="请输入商品信息... (Enter发送, Shift+Enter换行)"
                rows={2}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
              <button
                onClick={sendChat}
                disabled={chatLoading || !chatInput.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors self-end"
              >
                发送
              </button>
            </div>
          </div>
        </div>

        {/* ========== AI 추출 결과 확인 + 등록 버튼 ========== */}
        {extractedData && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              确认商品信息
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-500">商品名</span>
                <span className="font-medium">{extractedData.name_cn}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-500">货号</span>
                <span className="font-medium">{extractedData.supplier_sku}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-500">品类</span>
                <span className="font-medium">{extractedData.category_code}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-500">季节</span>
                <span className="font-medium">{extractedData.season_code}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-500">颜色</span>
                <span className="font-medium">
                  {extractedData.colors.map((c) => c.name_cn).join(", ")}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-500">尺码</span>
                <span className="font-medium">{extractedData.sizes.join(", ")}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-500">面料</span>
                <span className="font-medium">{extractedData.fabric_composition}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-500">单价</span>
                <span className="font-medium text-blue-600">¥{extractedData.price_cny}</span>
              </div>
              {extractedData.description && (
                <div className="col-span-full flex justify-between py-2 border-b">
                  <span className="text-gray-500">描述</span>
                  <span className="font-medium text-right max-w-[70%]">{extractedData.description}</span>
                </div>
              )}
            </div>

            <button
              onClick={handleRegister}
              disabled={saving}
              className="w-full mt-6 py-3 bg-blue-600 text-white text-lg font-bold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              {saving ? "登记中..." : "确认登记商品"}
            </button>
          </div>
        )}
      </main>

      {/* ========== 이미지 라이트박스 (크게 보기) ========== */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={lightboxImage}
              alt="상품 이미지 크게보기"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
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
