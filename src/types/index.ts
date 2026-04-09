// ============================================
// 앱 전체에서 사용하는 타입(데이터 모양) 정의
// ============================================

// 사용자 역할 타입
export type UserRole = "supplier" | "buyer" | "admin";

// 발주 상태 타입
export type OrderStatus = "발주완료" | "생산중" | "선적완료" | "입고완료";

// 컬러 정보
export interface ColorInfo {
  code: string;     // 2자리 컬러코드 (예: "01")
  name_cn: string;  // 중국어 컬러명 (예: "白色")
  name_ko: string;  // 한국어 컬러명 (예: "화이트")
}

// 사용자 정보
export interface User {
  id: string;
  email: string;
  role: UserRole;
  company_name: string;
  member_code: string;       // 회원번호 (예: G01, K01)
  region?: string;           // 지역 코드 (공급업체만)
  can_view_price: boolean;   // 단가 열람 권한
  created_at: string;
}

// 공급업체 정보
export interface Supplier {
  id: string;
  user_id: string;
  company_name_cn: string;
  company_name_ko: string;
  contact_person: string;
  phone: string;
  created_at: string;
}

// 상품 정보
export interface Product {
  id: string;
  supplier_id: string;
  name_cn: string;                // 중국어 상품명
  name_ko?: string;               // 한국어 상품명
  description: string;            // 상품 설명
  material: string;               // 소재
  moq: number;                    // 최소주문수량
  price_cny: number;              // 가격 (위안)
  supplier_sku?: string;          // 공급업체 품번
  category_code?: string;         // 복종코드 (TS, OP 등)
  season_code?: string;           // 시즌코드 (1~5)
  colors: ColorInfo[];            // 컬러 구성
  sizes: string[];                // 사이즈 구성
  fabric_composition?: string;    // 원단 혼용율
  is_active: boolean;
  created_at: string;
  images?: ProductImage[];
}

// 상품 이미지
export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  is_primary: boolean;
  color_code?: string;    // 컬러코드 (컬러별 이미지)
  color_name?: string;    // 컬러명
  created_at: string;
}

// 발주서
export interface PurchaseOrder {
  id: string;
  buyer_id: string;
  order_number: string;
  status: OrderStatus;
  total_amount: number;
  notes?: string;
  created_at: string;
  items?: POItem[];
}

// 발주 상품 항목
export interface POItem {
  id: string;
  po_id: string;
  product_id: string;
  internal_sku: string;           // 내부품번 (G01TS001L1-03-M)
  quantity: number;
  unit_price: number;
  comment?: string;
  color_code?: string;            // 컬러코드
  color_name?: string;            // 컬러명
  supplier_size?: string;         // 공급업체 사이즈
  korea_label_size?: string;      // 한국 라벨 사이즈
  product?: Product;
}

// 내부품번 매핑
export interface InternalSku {
  id: string;
  sku_code: string;
  product_id: string;
  po_item_id: string;
  created_at: string;
}
