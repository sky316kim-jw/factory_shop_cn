-- ============================================
-- users 테이블에 회원번호 + 지역 컬럼 추가
-- Supabase SQL Editor에서 실행하세요
-- ============================================

-- 회원번호 컬럼 추가 (예: G01, S02, K01)
ALTER TABLE users ADD COLUMN IF NOT EXISTS member_code TEXT UNIQUE;

-- 지역 컬럼 추가 (공급업체만 해당)
ALTER TABLE users ADD COLUMN IF NOT EXISTS region TEXT;
