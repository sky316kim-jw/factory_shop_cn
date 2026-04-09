// 서비스 사용법 가이드 - 스크롤 애니메이션
"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState } from "react";
import Link from "next/link";

// 애니메이션 래퍼: 스크롤 시 등장
function FadeInSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.7, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// 왼쪽에서 슬라이드
function SlideInLeft({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -80 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// 오른쪽에서 슬라이드
function SlideInRight({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 80 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// 스케일 업 등장
function ScaleIn({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// 스텝 카드
function StepCard({ step, title, desc, icon, color }: { step: number; title: string; desc: string; icon: string; color: string }) {
  return (
    <ScaleIn delay={step * 0.15}>
      <div className={`relative p-6 rounded-2xl border-2 ${color} bg-white hover:shadow-lg transition-shadow`}>
        <div className="absolute -top-4 -left-2 w-9 h-9 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center shadow-md">
          {step}
        </div>
        <div className="text-3xl mb-3">{icon}</div>
        <h4 className="font-bold text-gray-800 text-lg mb-2">{title}</h4>
        <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
      </div>
    </ScaleIn>
  );
}

// 역할 탭 타입
type RoleTab = "buyer" | "supplier" | "admin";

export default function GuidePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef });
  const progressWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  const [activeRole, setActiveRole] = useState<RoleTab>("buyer");

  return (
    <div ref={containerRef} className="min-h-screen bg-white">
      {/* 스크롤 진행 바 */}
      <motion.div
        className="fixed top-0 left-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 z-50"
        style={{ width: progressWidth }}
      />

      {/* 상단 네비게이션 */}
      <nav className="fixed top-1 right-4 z-40 print:hidden">
        <Link href="/login" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-full hover:bg-blue-700 shadow-lg">
          로그인 →
        </Link>
      </nav>

      {/* ============================================ */}
      {/* 섹션 1: 히어로 */}
      {/* ============================================ */}
      <section className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4">
        <div className="text-center max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="text-6xl mb-6">🏭</div>
            <h1 className="text-4xl sm:text-6xl font-black text-gray-900 mb-4">
              Factory Shop <span className="text-blue-600">CN</span>
            </h1>
            <p className="text-xl sm:text-2xl text-gray-500 mb-2">
              중국 공급업체 &times; 한국 바이어
            </p>
            <p className="text-lg text-gray-400 mb-8">
              B2B 패션 의류 샘플 발주 관리 플랫폼
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-wrap justify-center gap-4"
          >
            <div className="px-5 py-3 bg-blue-100 text-blue-700 rounded-xl text-sm font-medium">
              🇰🇷 바이어 (한국어)
            </div>
            <div className="px-5 py-3 bg-green-100 text-green-700 rounded-xl text-sm font-medium">
              🇨🇳 공급업체 (中文)
            </div>
            <div className="px-5 py-3 bg-purple-100 text-purple-700 rounded-xl text-sm font-medium">
              🤖 AI 자동 번역
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.8 }}
            className="mt-16 text-gray-400 text-sm animate-bounce"
          >
            ↓ 스크롤하여 더 알아보기
          </motion.div>
        </div>
      </section>

      {/* ============================================ */}
      {/* 섹션 2: 전체 프로세스 */}
      {/* ============================================ */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <FadeInSection>
            <h2 className="text-3xl sm:text-4xl font-black text-center text-gray-900 mb-4">
              전체 업무 프로세스
            </h2>
            <p className="text-center text-gray-500 mb-16">상품 등록부터 입고까지, 한눈에 보는 흐름</p>
          </FadeInSection>

          {/* 프로세스 타임라인 */}
          <div className="relative">
            {/* 가운데 세로선 (데스크톱) */}
            <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-200" />

            {/* 스텝 1 */}
            <div className="md:flex items-center mb-16">
              <SlideInLeft className="md:w-1/2 md:pr-12 md:text-right">
                <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
                  <div className="text-4xl mb-3">📦</div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">1. 공급업체 상품 등록</h3>
                  <p className="text-sm text-gray-600">AI 채팅으로 중국어 상품 정보를 입력하면<br/>자동으로 품목/컬러/사이즈를 분류합니다</p>
                </div>
              </SlideInLeft>
              <div className="hidden md:flex w-10 h-10 rounded-full bg-green-500 text-white items-center justify-center font-bold text-sm z-10 mx-auto flex-shrink-0">1</div>
              <div className="md:w-1/2" />
            </div>

            {/* 스텝 2 */}
            <div className="md:flex items-center mb-16">
              <div className="md:w-1/2" />
              <div className="hidden md:flex w-10 h-10 rounded-full bg-blue-500 text-white items-center justify-center font-bold text-sm z-10 mx-auto flex-shrink-0">2</div>
              <SlideInRight className="md:w-1/2 md:pl-12">
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
                  <div className="text-4xl mb-3">🛒</div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">2. 바이어 상품 확인 + 발주</h3>
                  <p className="text-sm text-gray-600">갤러리에서 상품을 보고<br/>컬러 x 사이즈 매트릭스로 수량 입력 후 발주</p>
                </div>
              </SlideInRight>
            </div>

            {/* 스텝 3 */}
            <div className="md:flex items-center mb-16">
              <SlideInLeft className="md:w-1/2 md:pr-12 md:text-right">
                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-6">
                  <div className="text-4xl mb-3">🏭</div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">3. 공급업체 생산 + 출고</h3>
                  <p className="text-sm text-gray-600">발주 확인 후 생산 시작<br/>출고 등록 시 인보이스 자동 생성</p>
                </div>
              </SlideInLeft>
              <div className="hidden md:flex w-10 h-10 rounded-full bg-purple-500 text-white items-center justify-center font-bold text-sm z-10 mx-auto flex-shrink-0">3</div>
              <div className="md:w-1/2" />
            </div>

            {/* 스텝 4 */}
            <div className="md:flex items-center">
              <div className="md:w-1/2" />
              <div className="hidden md:flex w-10 h-10 rounded-full bg-orange-500 text-white items-center justify-center font-bold text-sm z-10 mx-auto flex-shrink-0">4</div>
              <SlideInRight className="md:w-1/2 md:pl-12">
                <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6">
                  <div className="text-4xl mb-3">✅</div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">4. 바이어 입고 + 정산</h3>
                  <p className="text-sm text-gray-600">입고 수량 확인, 쇼티지 처리<br/>인보이스 기반 대금 지급 관리</p>
                </div>
              </SlideInRight>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* 섹션 3: 역할별 사용법 */}
      {/* ============================================ */}
      <section className="py-24 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <FadeInSection>
            <h2 className="text-3xl sm:text-4xl font-black text-center text-gray-900 mb-4">
              역할별 사용법
            </h2>
            <p className="text-center text-gray-500 mb-12">내 역할을 선택하면 상세 가이드를 확인할 수 있습니다</p>
          </FadeInSection>

          {/* 탭 선택 */}
          <FadeInSection>
            <div className="flex justify-center gap-3 mb-12">
              {[
                { key: "buyer" as RoleTab, label: "🇰🇷 바이어", color: "blue" },
                { key: "supplier" as RoleTab, label: "🇨🇳 공급업체", color: "green" },
                { key: "admin" as RoleTab, label: "👑 관리자", color: "purple" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveRole(tab.key)}
                  className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${
                    activeRole === tab.key
                      ? tab.color === "blue" ? "bg-blue-600 text-white shadow-lg scale-105"
                        : tab.color === "green" ? "bg-green-600 text-white shadow-lg scale-105"
                        : "bg-purple-600 text-white shadow-lg scale-105"
                      : "bg-white text-gray-600 border hover:bg-gray-50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </FadeInSection>

          {/* 바이어 가이드 */}
          {activeRole === "buyer" && (
            <motion.div
              key="buyer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StepCard step={1} icon="🔐" title="회원가입 + 로그인"
                  desc="회사명, 이름, 전화번호 입력 후 가입. 관리자 승인 후 이용 가능합니다."
                  color="border-blue-200" />
                <StepCard step={2} icon="🛍" title="상품 갤러리 탐색"
                  desc="왼쪽 사이드바에서 공급업체별/복종별/시즌별로 상품을 필터링하여 확인합니다."
                  color="border-blue-200" />
                <StepCard step={3} icon="📝" title="발주 작성"
                  desc="상품 선택 후 컬러 x 사이즈 매트릭스에서 수량을 입력하고, 자수색상/팬톤/작업지시서를 첨부합니다."
                  color="border-blue-200" />
                <StepCard step={4} icon="📋" title="발주 관리"
                  desc="발주 목록에서 상태를 확인합니다. 발주확인중 → 생산중 → 선적완료 순으로 진행됩니다."
                  color="border-blue-200" />
                <StepCard step={5} icon="📬" title="입고 등록"
                  desc="선적완료 후 품번별 입고수량을 입력합니다. 여러 회차에 걸쳐 입고 가능합니다."
                  color="border-blue-200" />
                <StepCard step={6} icon="💬" title="소통 댓글"
                  desc="상품/발주 상세에서 공급업체와 실시간 소통. AI가 자동으로 한↔중 번역합니다."
                  color="border-blue-200" />
              </div>
            </motion.div>
          )}

          {/* 공급업체 가이드 */}
          {activeRole === "supplier" && (
            <motion.div
              key="supplier"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StepCard step={1} icon="📱" title="注册 + 登录 (회원가입)"
                  desc="公司名、联系人、电话、地区选择后注册。供应商即时激活，无需审批。"
                  color="border-green-200" />
                <StepCard step={2} icon="📸" title="商品登记 (상품 등록)"
                  desc="AI助手帮您整理商品信息。上传图片后用中文输入商品信息，AI自动分类品类、颜色、尺码。"
                  color="border-green-200" />
                <StepCard step={3} icon="📦" title="订单确认 (발주 확인)"
                  desc="收到买家订单后确认内容。查看颜色x尺码数量表、工艺要求、附件等。"
                  color="border-green-200" />
                <StepCard step={4} icon="🚚" title="出货登记 (출고 등록)"
                  desc="输入出货日期、各品番出货数量、运单号。出货后发票自动生成。"
                  color="border-green-200" />
                <StepCard step={5} icon="💬" title="沟通留言 (소통 댓글)"
                  desc="与买家实时沟通。AI自动翻译中韩文。仅限生产/交期相关沟通。"
                  color="border-green-200" />
                <StepCard step={6} icon="🧾" title="发票查看 (인보이스)"
                  desc="查看已开具的发票列表。出货登记时自动生成发票。"
                  color="border-green-200" />
              </div>
            </motion.div>
          )}

          {/* 관리자 가이드 */}
          {activeRole === "admin" && (
            <motion.div
              key="admin"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StepCard step={1} icon="👥" title="회원 관리"
                  desc="바이어 가입 승인/비활성화, 슈퍼바이어 지정, 단가열람 권한 ON/OFF, 강제 탈퇴 기능."
                  color="border-purple-200" />
                <StepCard step={2} icon="📦" title="발주 현황"
                  desc="전체 발주 목록 확인. 발주요청 승인, 상태별 필터링, 공급업체별 조회."
                  color="border-purple-200" />
                <StepCard step={3} icon="📬" title="입고 관리"
                  desc="선적완료 발주의 입고 처리. 품번별 수량 확인, 쇼티지 마감 처리."
                  color="border-purple-200" />
                <StepCard step={4} icon="🏭" title="공급업체 관리"
                  desc="공급업체 목록, 코드/회사명/지역/담당자/연락처/WeChat 정보 확인."
                  color="border-purple-200" />
                <StepCard step={5} icon="🧾" title="인보이스 + 정산"
                  desc="출고 시 자동 생성된 인보이스 관리. 공급업체별 청구금액/지급금액/잔액 확인."
                  color="border-purple-200" />
                <StepCard step={6} icon="🔔" title="알림 설정"
                  desc="네이버 웍스 Webhook 연동. 발주/입고/정산 알림을 채널별로 독립 설정."
                  color="border-purple-200" />
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* ============================================ */}
      {/* 섹션 4: 핵심 기능 */}
      {/* ============================================ */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <FadeInSection>
            <h2 className="text-3xl sm:text-4xl font-black text-center text-gray-900 mb-16">
              핵심 기능
            </h2>
          </FadeInSection>

          <div className="space-y-20">
            {/* AI 채팅 상품등록 */}
            <div className="md:flex items-center gap-12">
              <SlideInLeft className="md:w-1/2 mb-8 md:mb-0">
                <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-8 text-white">
                  <div className="bg-white/20 rounded-xl p-4 mb-4">
                    <p className="text-sm opacity-90">供应商输入:</p>
                    <p className="font-medium">&quot;白色黑色T恤 S M L XL 28元 纯棉&quot;</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <p className="text-sm opacity-90">AI 자동 추출:</p>
                    <p className="text-xs mt-1">商品: T恤 | 颜色: 01화이트, 02블랙</p>
                    <p className="text-xs">尺码: S/M/L/XL | 单价: ¥28</p>
                    <p className="text-xs">面料: 纯棉100%</p>
                  </div>
                </div>
              </SlideInLeft>
              <SlideInRight className="md:w-1/2">
                <h3 className="text-2xl font-bold text-gray-800 mb-3">🤖 AI 채팅 상품 등록</h3>
                <p className="text-gray-600 leading-relaxed mb-4">
                  공급업체가 중국어로 자유롭게 상품 정보를 입력하면
                  AI가 자동으로 품목, 컬러코드, 사이즈, 원단, 단가를 추출합니다.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">47개 컬러코드 자동 매칭</span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">14개 복종코드 분류</span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">이미지 자동 리사이징</span>
                </div>
              </SlideInRight>
            </div>

            {/* 컬러 x 사이즈 매트릭스 */}
            <div className="md:flex items-center gap-12">
              <SlideInLeft className="md:w-1/2 order-2 md:order-1">
                <h3 className="text-2xl font-bold text-gray-800 mb-3">📊 컬러 x 사이즈 발주</h3>
                <p className="text-gray-600 leading-relaxed mb-4">
                  직관적인 매트릭스 테이블로 컬러별/사이즈별 수량을 한눈에 입력합니다.
                  자수색상, 팬톤번호, 한국 라벨 사이즈 매핑도 지원합니다.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs">자동 합계 계산</span>
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs">추가 색상 요청</span>
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs">작업지시서 첨부</span>
                </div>
              </SlideInLeft>
              <SlideInRight className="md:w-1/2 mb-8 md:mb-0 order-1 md:order-2">
                <div className="bg-white border-2 border-gray-200 rounded-2xl p-4 shadow-sm">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border px-2 py-1.5 text-left text-gray-600">컬러</th>
                        <th className="border px-2 py-1.5 text-center text-gray-600">S</th>
                        <th className="border px-2 py-1.5 text-center text-gray-600">M</th>
                        <th className="border px-2 py-1.5 text-center text-gray-600">L</th>
                        <th className="border px-2 py-1.5 text-center text-gray-600">XL</th>
                        <th className="border px-2 py-1.5 text-center bg-blue-50 text-blue-600">합계</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td className="border px-2 py-1.5">01 화이트</td><td className="border text-center">50</td><td className="border text-center">100</td><td className="border text-center">100</td><td className="border text-center">50</td><td className="border text-center font-bold text-blue-600 bg-blue-50">300</td></tr>
                      <tr><td className="border px-2 py-1.5">02 블랙</td><td className="border text-center">30</td><td className="border text-center">80</td><td className="border text-center">80</td><td className="border text-center">30</td><td className="border text-center font-bold text-blue-600 bg-blue-50">220</td></tr>
                      <tr className="bg-yellow-50"><td className="border px-2 py-1.5 text-yellow-700">+ 추가색상</td><td className="border text-center">10</td><td className="border text-center">20</td><td className="border text-center">20</td><td className="border text-center">10</td><td className="border text-center font-bold text-yellow-700 bg-yellow-100">60</td></tr>
                      <tr className="bg-blue-50 font-bold"><td className="border px-2 py-1.5">합계</td><td className="border text-center">90</td><td className="border text-center">200</td><td className="border text-center">200</td><td className="border text-center">90</td><td className="border text-center text-blue-700">580</td></tr>
                    </tbody>
                  </table>
                </div>
              </SlideInRight>
            </div>

            {/* 자동 번역 소통 */}
            <div className="md:flex items-center gap-12">
              <SlideInLeft className="md:w-1/2 mb-8 md:mb-0">
                <div className="bg-gray-50 rounded-2xl p-6 space-y-3">
                  <div className="flex justify-end">
                    <div>
                      <div className="text-[10px] text-right text-gray-400 mb-1">K01 바이어</div>
                      <div className="bg-blue-600 text-white rounded-2xl rounded-br-md px-4 py-2 text-sm">납기일이 언제인가요?</div>
                      <div className="bg-blue-100 text-blue-800 rounded-xl px-3 py-1 text-xs mt-1 text-right">번역: 交货日期是什么时候？</div>
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div>
                      <div className="text-[10px] text-gray-400 mb-1">G01 供应商</div>
                      <div className="bg-white border rounded-2xl rounded-bl-md px-4 py-2 text-sm">预计下周三可以出货</div>
                      <div className="bg-gray-100 text-gray-600 rounded-xl px-3 py-1 text-xs mt-1">번역: 다음주 수요일 출고 가능합니다</div>
                    </div>
                  </div>
                </div>
              </SlideInLeft>
              <SlideInRight className="md:w-1/2">
                <h3 className="text-2xl font-bold text-gray-800 mb-3">🌐 AI 자동 번역 소통</h3>
                <p className="text-gray-600 leading-relaxed mb-4">
                  바이어는 한국어로, 공급업체는 중국어로 댓글을 작성하면
                  AI가 자동으로 번역하여 상대방 언어로 표시합니다.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">한국어 ↔ 중국어</span>
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">단가/연락처 자동 차단</span>
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">생산/납기 소통 전용</span>
                </div>
              </SlideInRight>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* 섹션 5: 내부 품번 체계 */}
      {/* ============================================ */}
      <section className="py-24 px-4 bg-gradient-to-br from-gray-900 to-gray-800 text-white">
        <div className="max-w-4xl mx-auto">
          <FadeInSection>
            <h2 className="text-3xl sm:text-4xl font-black text-center mb-4">
              내부 품번 자동 생성
            </h2>
            <p className="text-center text-gray-400 mb-12">발주 확정 시 컬러+사이즈 조합마다 고유 품번 자동 부여</p>
          </FadeInSection>

          <FadeInSection>
            <div className="bg-white/10 rounded-2xl p-8 backdrop-blur">
              <div className="text-center font-mono text-2xl sm:text-3xl font-bold mb-6 text-blue-300">
                G01 TS 001 M 2 - 03 - 095
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div className="bg-white/10 rounded-xl p-3 text-center">
                  <div className="text-blue-300 font-mono font-bold text-lg">G01</div>
                  <div className="text-gray-400 text-xs mt-1">공급업체 코드</div>
                </div>
                <div className="bg-white/10 rounded-xl p-3 text-center">
                  <div className="text-green-300 font-mono font-bold text-lg">TS</div>
                  <div className="text-gray-400 text-xs mt-1">복종코드 (티셔츠)</div>
                </div>
                <div className="bg-white/10 rounded-xl p-3 text-center">
                  <div className="text-yellow-300 font-mono font-bold text-lg">001</div>
                  <div className="text-gray-400 text-xs mt-1">스타일번호</div>
                </div>
                <div className="bg-white/10 rounded-xl p-3 text-center">
                  <div className="text-purple-300 font-mono font-bold text-lg">M2</div>
                  <div className="text-gray-400 text-xs mt-1">2026년 여름</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4 text-sm max-w-md mx-auto">
                <div className="bg-white/10 rounded-xl p-3 text-center">
                  <div className="text-orange-300 font-mono font-bold text-lg">03</div>
                  <div className="text-gray-400 text-xs mt-1">네이비 (컬러)</div>
                </div>
                <div className="bg-white/10 rounded-xl p-3 text-center">
                  <div className="text-pink-300 font-mono font-bold text-lg">095</div>
                  <div className="text-gray-400 text-xs mt-1">사이즈 95</div>
                </div>
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ============================================ */}
      {/* 섹션 6: 회원 등급 */}
      {/* ============================================ */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <FadeInSection>
            <h2 className="text-3xl sm:text-4xl font-black text-center text-gray-900 mb-12">
              회원 등급 체계
            </h2>
          </FadeInSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <ScaleIn delay={0}>
              <div className="border-2 border-red-200 rounded-2xl p-6 bg-red-50">
                <div className="text-2xl mb-2">👑</div>
                <h4 className="font-bold text-lg text-gray-800">슈퍼관리자</h4>
                <p className="text-xs text-gray-500 mt-2">모든 기능 접근, 회원 등급 관리, 단가 열람, 대금 지급</p>
              </div>
            </ScaleIn>
            <ScaleIn delay={0.1}>
              <div className="border-2 border-purple-200 rounded-2xl p-6 bg-purple-50">
                <div className="text-2xl mb-2">⭐</div>
                <h4 className="font-bold text-lg text-gray-800">슈퍼바이어</h4>
                <p className="text-xs text-gray-500 mt-2">회원관리 제외 전체 기능, 단가 열람, 인보이스 접근</p>
              </div>
            </ScaleIn>
            <ScaleIn delay={0.2}>
              <div className="border-2 border-orange-200 rounded-2xl p-6 bg-orange-50">
                <div className="text-2xl mb-2">🔧</div>
                <h4 className="font-bold text-lg text-gray-800">일반 관리자</h4>
                <p className="text-xs text-gray-500 mt-2">바이어 승인, 발주 승인, 입고 관리 (단가 접근 불가)</p>
              </div>
            </ScaleIn>
            <ScaleIn delay={0.3}>
              <div className="border-2 border-blue-200 rounded-2xl p-6 bg-blue-50">
                <div className="text-2xl mb-2">🛒</div>
                <h4 className="font-bold text-lg text-gray-800">일반 바이어</h4>
                <p className="text-xs text-gray-500 mt-2">상품 열람, 발주 요청 (관리자 승인 후 전송), 입고 등록</p>
              </div>
            </ScaleIn>
            <ScaleIn delay={0.4}>
              <div className="border-2 border-green-200 rounded-2xl p-6 bg-green-50">
                <div className="text-2xl mb-2">🏭</div>
                <h4 className="font-bold text-lg text-gray-800">공급업체</h4>
                <p className="text-xs text-gray-500 mt-2">본인 상품 등록/수정, 발주 확인, 출고 등록 (즉시 활성화)</p>
              </div>
            </ScaleIn>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* 섹션 7: CTA */}
      {/* ============================================ */}
      <section className="py-24 px-4 bg-gradient-to-br from-blue-600 to-purple-700 text-white text-center">
        <FadeInSection>
          <div className="max-w-2xl mx-auto">
            <div className="text-5xl mb-6">🚀</div>
            <h2 className="text-3xl sm:text-4xl font-black mb-4">지금 시작하세요</h2>
            <p className="text-lg text-blue-100 mb-8">
              중국 공급업체와의 B2B 패션 발주를<br/>
              더 쉽고 체계적으로 관리하세요
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/signup" className="px-8 py-4 bg-white text-blue-700 font-bold rounded-xl hover:bg-blue-50 transition-colors shadow-lg">
                회원가입
              </Link>
              <Link href="/login" className="px-8 py-4 bg-white/20 text-white font-bold rounded-xl hover:bg-white/30 transition-colors border border-white/30">
                로그인
              </Link>
            </div>
          </div>
        </FadeInSection>
      </section>

      {/* 푸터 */}
      <footer className="py-8 bg-gray-900 text-center text-gray-500 text-sm">
        <p>Factory Shop CN &copy; 2026. All rights reserved.</p>
      </footer>
    </div>
  );
}
