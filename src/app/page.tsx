// 메인 페이지 - 로그인 전 랜딩 페이지
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* 로고 및 타이틀 영역 */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">
          🏭 Factory Shop CN
        </h1>
        <p className="text-lg text-gray-600">
          중국 공급업체 ↔ 한국 바이어 B2B 샘플 발주 관리
        </p>
      </div>

      {/* 로그인 / 회원가입 버튼 */}
      <div className="flex flex-col gap-4 w-full max-w-xs">
        <Link
          href="/login"
          className="w-full py-3 px-6 bg-blue-600 text-white text-center rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          로그인
        </Link>
        <Link
          href="/signup"
          className="w-full py-3 px-6 bg-white text-blue-600 text-center rounded-lg font-medium border-2 border-blue-600 hover:bg-blue-50 transition-colors"
        >
          회원가입
        </Link>
      </div>

      {/* 역할 안내 - 공급업체 & 바이어만 카드로 표시 */}
      <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-md w-full">
        <div className="bg-white p-6 rounded-xl shadow-sm text-center">
          <div className="text-3xl mb-2">📦</div>
          <h3 className="font-semibold text-gray-800">공급업체</h3>
          <p className="text-sm text-gray-500 mt-1">샘플 상품 등록</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm text-center">
          <div className="text-3xl mb-2">🛒</div>
          <h3 className="font-semibold text-gray-800">바이어</h3>
          <p className="text-sm text-gray-500 mt-1">상품 선택 + 발주</p>
        </div>
      </div>

      {/* 관리자 링크 - 우측 하단에 작게 */}
      <Link
        href="/admin"
        className="fixed bottom-4 right-4 text-sm text-gray-400 hover:text-gray-600 transition-colors"
      >
        관리자
      </Link>
    </div>
  );
}
