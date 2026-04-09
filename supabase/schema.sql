-- ============================================
-- Factory Shop CN - 데이터베이스 테이블 생성 SQL
-- Supabase SQL Editor에서 이 파일 내용을 복사해서 실행하세요
-- ============================================

-- 1. 사용자 프로필 테이블 (Supabase Auth와 연결)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('supplier', 'buyer', 'admin')),
  company_name TEXT NOT NULL,
  member_code TEXT UNIQUE,           -- 회원번호 (예: G01, S02, K01)
  region TEXT,                       -- 지역 (공급업체만 해당)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 공급업체 상세 정보 테이블
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name_cn TEXT NOT NULL,  -- 중국어 회사명
  company_name_ko TEXT,            -- 한국어 회사명
  contact_person TEXT,             -- 담당자 이름
  phone TEXT,                      -- 연락처
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 상품 테이블
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  name_cn TEXT NOT NULL,           -- 중국어 상품명
  name_ko TEXT,                    -- 한국어 상품명
  description TEXT,                -- 상품 설명
  material TEXT,                   -- 소재/재질
  moq INTEGER DEFAULT 1,          -- 최소주문수량 (Minimum Order Quantity)
  price_cny DECIMAL(10,2),         -- 가격 (중국 위안)
  is_active BOOLEAN DEFAULT TRUE,  -- 활성 상태
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 상품 이미지 테이블
CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,         -- 이미지 저장 경로
  is_primary BOOLEAN DEFAULT FALSE, -- 대표 이미지 여부
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 발주서 테이블
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES users(id),
  order_number TEXT NOT NULL UNIQUE,  -- 발주번호
  status TEXT NOT NULL DEFAULT '발주완료'
    CHECK (status IN ('발주완료', '생산중', '선적완료', '입고완료')),
  total_amount DECIMAL(12,2) DEFAULT 0,
  notes TEXT,                         -- 메모
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 발주 상품 항목 테이블
CREATE TABLE po_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  internal_sku TEXT NOT NULL,      -- 내부품번 (PRD-YYYYMM-XXXX)
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  comment TEXT,                    -- 수정 코멘트
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 내부품번 매핑 테이블 (자동생성 추적용)
CREATE TABLE internal_skus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_code TEXT NOT NULL UNIQUE,   -- PRD-YYYYMM-XXXX 형식
  product_id UUID NOT NULL REFERENCES products(id),
  po_item_id UUID REFERENCES po_items(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 인덱스 (검색 속도 향상)
-- ============================================
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_products_supplier ON products(supplier_id);
CREATE INDEX idx_product_images_product ON product_images(product_id);
CREATE INDEX idx_purchase_orders_buyer ON purchase_orders(buyer_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_po_items_po ON po_items(po_id);
CREATE INDEX idx_internal_skus_product ON internal_skus(product_id);

-- ============================================
-- RLS (Row Level Security) 정책
-- 각 역할에 맞는 데이터만 보이도록 보안 설정
-- ============================================

-- 모든 테이블에 RLS 활성화
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_skus ENABLE ROW LEVEL SECURITY;

-- users: 본인 정보만 조회 가능
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid() = id);

-- users: 본인 정보 삽입 가능
CREATE POLICY "users_insert_own" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- suppliers: 누구나 공급업체 목록 조회 가능
CREATE POLICY "suppliers_select_all" ON suppliers
  FOR SELECT USING (TRUE);

-- suppliers: 공급업체 본인만 자기 정보 등록/수정
CREATE POLICY "suppliers_insert_own" ON suppliers
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
  );

-- products: 누구나 상품 조회 가능 (바이어가 봐야 하니까)
CREATE POLICY "products_select_all" ON products
  FOR SELECT USING (TRUE);

-- products: 공급업체만 자기 상품 등록
CREATE POLICY "products_insert_supplier" ON products
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM suppliers WHERE suppliers.id = supplier_id AND suppliers.user_id = auth.uid()
    )
  );

-- products: 공급업체만 자기 상품 수정
CREATE POLICY "products_update_supplier" ON products
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM suppliers WHERE suppliers.id = supplier_id AND suppliers.user_id = auth.uid()
    )
  );

-- product_images: 누구나 조회 가능
CREATE POLICY "product_images_select_all" ON product_images
  FOR SELECT USING (TRUE);

-- product_images: 상품 소유 공급업체만 이미지 등록
CREATE POLICY "product_images_insert_supplier" ON product_images
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM products
      JOIN suppliers ON suppliers.id = products.supplier_id
      WHERE products.id = product_id AND suppliers.user_id = auth.uid()
    )
  );

-- purchase_orders: 본인 발주만 조회
CREATE POLICY "po_select_own" ON purchase_orders
  FOR SELECT USING (auth.uid() = buyer_id);

-- purchase_orders: 바이어만 발주 생성
CREATE POLICY "po_insert_buyer" ON purchase_orders
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- po_items: 본인 발주 항목만 조회
CREATE POLICY "po_items_select_own" ON po_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM purchase_orders WHERE purchase_orders.id = po_id AND purchase_orders.buyer_id = auth.uid()
    )
  );

-- po_items: 바이어만 발주 항목 추가
CREATE POLICY "po_items_insert_buyer" ON po_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM purchase_orders WHERE purchase_orders.id = po_id AND purchase_orders.buyer_id = auth.uid()
    )
  );

-- internal_skus: 인증된 사용자는 조회 가능
CREATE POLICY "skus_select_authenticated" ON internal_skus
  FOR SELECT USING (auth.role() = 'authenticated');

-- internal_skus: 서버에서만 생성 (service_role 키 사용)
CREATE POLICY "skus_insert_service" ON internal_skus
  FOR INSERT WITH CHECK (FALSE);

-- ============================================
-- Supabase Storage 버킷 생성 (상품 이미지용)
-- Supabase 대시보드 → Storage 에서 수동으로 생성하거나
-- 아래 SQL을 실행하세요
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Storage 정책: 인증된 사용자만 이미지 업로드 가능
CREATE POLICY "product_images_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'product-images' AND auth.role() = 'authenticated'
  );

-- Storage 정책: 누구나 이미지 조회 가능 (공개)
CREATE POLICY "product_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');
