// 중국 지역 목록 및 이니셜 매핑
// 드롭다운에는 한국어 + 중국어만 표시, 이니셜은 내부 코드용

export interface Region {
  label: string; // 드롭다운에 보이는 텍스트 (예: "광저우 (广州)")
  code: string;  // 내부 이니셜 코드 (예: "G")
}

// 지역 목록 (이니셜이 겹치지 않게 설정됨)
export const REGIONS: Region[] = [
  { label: "광저우 (广州)", code: "G" },
  { label: "상하이 (上海)", code: "S" },
  { label: "베이징 (北京)", code: "B" },
  { label: "선전 (深圳)", code: "Z" },
  { label: "이우 (义乌)", code: "Y" },
  { label: "청두 (成都)", code: "C" },
  { label: "항저우 (杭州)", code: "H" },
  { label: "닝보 (宁波)", code: "N" },
  { label: "포산 (佛山)", code: "F" },
  { label: "창저우 (常州)", code: "J" },
  { label: "칭다오 (青岛)", code: "Q" },
  { label: "선양 (沈阳)", code: "E" },
  { label: "다롄 (大连)", code: "D" },
  { label: "우한 (武汉)", code: "W" },
  { label: "난징 (南京)", code: "R" },
  { label: "쑤저우 (苏州)", code: "U" },
  { label: "샤먼 (厦门)", code: "X" },
  { label: "정저우 (郑州)", code: "P" },
  { label: "톈진 (天津)", code: "T" },
  { label: "충칭 (重庆)", code: "O" },
  { label: "기타", code: "K" },
];
