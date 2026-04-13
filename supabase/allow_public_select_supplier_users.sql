-- 바이어 갤러리 사이드바 "공급업체별 보기"가 공급업체 목록을 읽으려면
-- users 테이블에서 role='supplier'인 row를 조회할 수 있어야 함.
-- 기존 RLS는 자기 자신 + admin 만 허용하므로, 공급업체 row만 공개 SELECT 허용 정책 추가.
-- 노출되는 필드(member_code, company_name)는 이미 UI에 공개되는 값이므로 보안상 문제 없음.

CREATE POLICY users_select_suppliers_public ON public.users
  FOR SELECT USING (role = 'supplier');
