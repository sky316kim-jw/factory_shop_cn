// 루트 레이아웃 - 모든 페이지에 공통으로 적용되는 뼈대
import type { Metadata } from "next";
import "./globals.css";

// 앱의 기본 정보 (브라우저 탭에 표시됨)
export const metadata: Metadata = {
  title: "Factory Shop CN - B2B 샘플 발주 관리",
  description: "중국 공급업체와 한국 바이어 간의 B2B 샘플 발주 관리 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased bg-gray-50 min-h-screen">
        {children}
      </body>
    </html>
  );
}
