# RunningFit Commercial Phase 3

## 적용 내용
- 공용 JSON 메모리 캐시 추가: 같은 페이지에서 같은 JSON 중복 요청 방지
- 검색 입력 디바운스 적용: 타이핑마다 전체 필터링하는 부담 감소
- 러닝화 카드 24개 단위 점진 렌더링
- 화면 밖 카드에 `content-visibility` 적용
- shoes.js의 중복 햄버거/테마 이벤트 제거
- 기존 `defer` 스크립트 로딩 유지
- Netlify 정적 자산 캐시 보완

## 확인 사항
현재 프로젝트에는 실제 러닝화 이미지 파일이 포함되어 있지 않으므로 WebP/AVIF 변환 대상은 없습니다. 향후 이미지를 추가할 때는 assets/images 아래에 WebP 또는 AVIF로 넣고 width/height, loading=lazy를 적용해야 합니다.
